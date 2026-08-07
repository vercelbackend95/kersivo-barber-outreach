import {
  EmailOutboundPurpose,
  EmailOutboundStatus,
  Prisma,
  type EmailOutbound,
} from '@prisma/client';
import { prisma } from '../db/client';
import { captureOpsException } from '../ops/sentry';
import { notifyOpsDurable } from '../ops/stripeWebhookLedger';
import { isEmailDeliveryConfigured, sendRenderedEmail } from './sender';

const DEFAULT_MAX_ATTEMPTS = 6;
const BASE_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;

export type EmailOutboxPayload = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

function backoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
}

function nextAttemptAt(attempts: number, now = new Date()): Date {
  return new Date(now.getTime() + backoffMs(attempts));
}

function parsePayload(raw: unknown): EmailOutboxPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const to = typeof obj.to === 'string' ? obj.to.trim() : '';
  const subject = typeof obj.subject === 'string' ? obj.subject : '';
  const html = typeof obj.html === 'string' ? obj.html : '';
  if (!to || !subject || !html) return null;
  const replyTo = typeof obj.replyTo === 'string' && obj.replyTo.trim() ? obj.replyTo.trim() : undefined;
  return { to, subject, html, replyTo };
}

async function alertEmailFailed(row: EmailOutbound, errorMessage: string): Promise<void> {
  await notifyOpsDurable({
    severity: 'critical',
    title: 'Transactional email delivery failed',
    body: errorMessage.slice(0, 500),
    dedupeKey: `email:failed:${row.id}`,
    fields: {
      emailOutboundId: row.id,
      shopId: row.shopId,
      bookingId: row.bookingId ?? '',
      purpose: row.purpose,
      attempts: row.attempts,
      toEmail: row.toEmail,
    },
  });
}

/**
 * Write-ahead: enqueue a transactional email inside an existing Prisma transaction.
 * Caller must commit the transaction before calling deliverOutboxEmail.
 * Optional dedupeKey makes concurrent/retry enqueues idempotent (unique constraint).
 */
export async function enqueueEmail(
  tx: Prisma.TransactionClient,
  input: {
    shopId: string;
    bookingId?: string | null;
    purpose: EmailOutboundPurpose;
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
    dedupeKey?: string | null;
  },
): Promise<EmailOutbound> {
  const now = new Date();
  const to = input.to.trim().toLowerCase();
  const dedupeKey = input.dedupeKey?.trim() || null;
  const payload: EmailOutboxPayload = {
    to,
    subject: input.subject,
    html: input.html,
    ...(input.replyTo?.trim() ? { replyTo: input.replyTo.trim() } : {}),
  };

  try {
    return await tx.emailOutbound.create({
      data: {
        shopId: input.shopId,
        bookingId: input.bookingId ?? null,
        toEmail: to,
        subject: input.subject,
        purpose: input.purpose,
        provider: isEmailDeliveryConfigured() ? 'resend' : 'dev-log',
        status: EmailOutboundStatus.QUEUED,
        payload,
        dedupeKey,
        attempts: 0,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
        nextAttemptAt: now,
        error: null,
      },
    });
  } catch (error) {
    if (
      dedupeKey &&
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      const existing = await tx.emailOutbound.findUnique({ where: { dedupeKey } });
      if (existing) return existing;
    }
    throw error;
  }
}

export type DeliverOutboxResult = {
  status: 'sent' | 'queued' | 'failed' | 'skipped';
  row: EmailOutbound | null;
};

/**
 * CAS-claim + send one outbox row. Never throws for delivery failures —
 * updates ledger state instead.
 */
export async function deliverOutboxEmail(id: string): Promise<DeliverOutboxResult> {
  const row = await prisma.emailOutbound.findUnique({ where: { id } });
  if (!row) return { status: 'skipped', row: null };

  if (row.status === EmailOutboundStatus.SENT) {
    return { status: 'sent', row };
  }

  if (row.status === EmailOutboundStatus.FAILED && row.attempts >= row.maxAttempts) {
    return { status: 'failed', row };
  }

  const now = new Date();
  const claimed = await prisma.emailOutbound.updateMany({
    where: {
      id: row.id,
      status: { in: [EmailOutboundStatus.QUEUED, EmailOutboundStatus.FAILED] },
      nextAttemptAt: { lte: now },
    },
    data: {
      lastAttemptAt: now,
      // Push nextAttemptAt forward to reduce double-claim races until we finish.
      nextAttemptAt: nextAttemptAt(row.attempts + 1, now),
      status: EmailOutboundStatus.QUEUED,
    },
  });

  if (claimed.count === 0) {
    const fresh = await prisma.emailOutbound.findUnique({ where: { id } });
    if (fresh?.status === EmailOutboundStatus.SENT) {
      return { status: 'sent', row: fresh };
    }
    return { status: 'queued', row: fresh };
  }

  const payload = parsePayload(row.payload);
  if (!payload) {
    const updated = await prisma.emailOutbound.update({
      where: { id: row.id },
      data: {
        status: EmailOutboundStatus.FAILED,
        attempts: row.attempts + 1,
        nextAttemptAt: null,
        error: 'Missing or invalid outbox payload; cannot replay.',
      },
    });
    await alertEmailFailed(updated, 'Missing or invalid outbox payload; cannot replay.');
    captureOpsException(new Error('Missing or invalid outbox payload'), {
      route: 'email.outbox.deliverOutboxEmail',
      shopId: row.shopId,
      tags: { emailOutboundId: row.id, purpose: row.purpose },
    });
    return { status: 'failed', row: updated };
  }

  try {
    const result = await sendRenderedEmail({
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      replyTo: payload.replyTo,
      devLogLabel: `[DEV EMAIL] Outbox ${row.purpose}`,
    });

    const sentAt = new Date();
    const updated = await prisma.emailOutbound.update({
      where: { id: row.id },
      data: {
        status: EmailOutboundStatus.SENT,
        provider: isEmailDeliveryConfigured() ? 'resend' : 'dev-log',
        providerMessageId: result.messageId,
        attempts: row.attempts + 1,
        error: null,
        nextAttemptAt: null,
        sentAt,
        payload: Prisma.DbNull,
      },
    });
    return { status: 'sent', row: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const attempts = row.attempts + 1;
    const exhausted = attempts >= row.maxAttempts;

    console.error('[EMAIL] Outbox delivery failed', {
      emailOutboundId: row.id,
      purpose: row.purpose,
      bookingId: row.bookingId,
      attempts,
      error: message,
    });

    const updated = await prisma.emailOutbound.update({
      where: { id: row.id },
      data: {
        status: exhausted ? EmailOutboundStatus.FAILED : EmailOutboundStatus.QUEUED,
        attempts,
        error: message.slice(0, 1000),
        nextAttemptAt: exhausted ? null : nextAttemptAt(attempts, now),
        provider: isEmailDeliveryConfigured() ? 'resend' : 'dev-log',
      },
    });

    if (exhausted) {
      await alertEmailFailed(updated, message);
      captureOpsException(error, {
        route: 'email.outbox.deliverOutboxEmail',
        shopId: row.shopId,
        tags: { emailOutboundId: row.id, purpose: row.purpose },
      });
      return { status: 'failed', row: updated };
    }

    return { status: 'queued', row: updated };
  }
}

/**
 * Best-effort immediate delivery after commit. Never throws.
 */
export async function tryDeliverOutboxEmail(id: string | null | undefined): Promise<void> {
  if (!id) return;
  try {
    await deliverOutboxEmail(id);
  } catch (error) {
    console.warn('[EMAIL] Outbox best-effort deliver threw', {
      emailOutboundId: id,
      error: error instanceof Error ? error.message : error,
    });
  }
}

export type ProcessEmailOutboxResult = {
  scanned: number;
  sent: number;
  queued: number;
  failed: number;
  skipped: number;
};

/** Cron drain: process due QUEUED/FAILED rows with nextAttemptAt <= now. */
export async function processDueEmailOutbox(
  now: Date = new Date(),
  options?: { limit?: number },
): Promise<ProcessEmailOutboxResult> {
  const limit = Math.max(1, Math.min(options?.limit ?? 25, 100));
  const due = await prisma.emailOutbound.findMany({
    where: {
      status: { in: [EmailOutboundStatus.QUEUED, EmailOutboundStatus.FAILED] },
      nextAttemptAt: { lte: now },
      // Only rows with a replayable payload (reminder log rows without nextAttemptAt are skipped).
      payload: { not: Prisma.DbNull },
    },
    orderBy: { nextAttemptAt: 'asc' },
    take: limit,
    select: { id: true },
  });

  const summary: ProcessEmailOutboxResult = {
    scanned: due.length,
    sent: 0,
    queued: 0,
    failed: 0,
    skipped: 0,
  };

  for (const item of due) {
    const result = await deliverOutboxEmail(item.id);
    if (result.status === 'sent') summary.sent += 1;
    else if (result.status === 'queued') summary.queued += 1;
    else if (result.status === 'failed') summary.failed += 1;
    else summary.skipped += 1;
  }

  return summary;
}

/** Operator / ops: reset a terminal FAILED row and attempt immediately. */
export async function retryOutboxEmailForOperator(id: string): Promise<DeliverOutboxResult> {
  const row = await prisma.emailOutbound.findUnique({ where: { id } });
  if (!row) return { status: 'skipped', row: null };
  if (row.status === EmailOutboundStatus.SENT) return { status: 'sent', row };
  if (!parsePayload(row.payload)) {
    return { status: 'failed', row };
  }

  await prisma.emailOutbound.update({
    where: { id: row.id },
    data: {
      status: EmailOutboundStatus.QUEUED,
      attempts: 0,
      nextAttemptAt: new Date(),
      error: null,
    },
  });

  return deliverOutboxEmail(id);
}
