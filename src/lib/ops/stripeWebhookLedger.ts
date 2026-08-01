import type { StripeWebhookEventStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { notifyOps, type OpsAlertInput, type OpsAlertResult } from '@/lib/ops/alertSink';
import { opsLog, opsLogError } from '@/lib/ops/opsLog';

export type WebhookIngestResult = {
  alreadyFinalized: boolean;
  previousStatus: StripeWebhookEventStatus | null;
};

export async function recordStripeWebhookReceived(input: {
  id: string;
  type: string;
  livemode?: boolean;
  eventCreatedAt?: Date | null;
}): Promise<WebhookIngestResult> {
  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { id: input.id },
    select: { status: true },
  });

  const previousStatus = existing?.status ?? null;
  const alreadyFinalized = previousStatus === 'PROCESSED' || previousStatus === 'IGNORED';

  await prisma.stripeWebhookEvent.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      type: input.type,
      livemode: Boolean(input.livemode),
      status: 'RECEIVED',
      eventCreatedAt: input.eventCreatedAt ?? null,
    },
    update: {
      type: input.type,
      livemode: Boolean(input.livemode),
      ...(input.eventCreatedAt ? { eventCreatedAt: input.eventCreatedAt } : {}),
    },
  });

  return { alreadyFinalized, previousStatus };
}

export async function markStripeWebhookStatus(
  id: string,
  status: StripeWebhookEventStatus,
  options: { error?: string; httpStatus?: number } = {},
): Promise<void> {
  const existing = await prisma.stripeWebhookEvent.findUnique({ where: { id } });
  if (!existing) {
    await prisma.stripeWebhookEvent.create({
      data: {
        id,
        type: 'unknown',
        status,
        error: options.error ?? null,
        httpStatus: options.httpStatus ?? null,
        processedAt: status === 'PROCESSED' || status === 'IGNORED' ? new Date() : null,
      },
    });
    return;
  }

  // Never overwrite PROCESSED with FAILED on a late retry of a success response path.
  if (existing.status === 'PROCESSED' && status === 'FAILED') {
    return;
  }

  await prisma.stripeWebhookEvent.update({
    where: { id },
    data: {
      status,
      error: options.error ?? null,
      httpStatus: options.httpStatus ?? null,
      processedAt:
        status === 'PROCESSED' || status === 'IGNORED' ? new Date() : existing.processedAt,
    },
  });
}

/** AlertSink with durable OpsAlertDedupe cooldown in Postgres. */
export async function notifyOpsDurable(input: OpsAlertInput): Promise<OpsAlertResult> {
  return notifyOps(input, {
    isDeduped: async (dedupeKey, cooldownMs) => {
      const row = await prisma.opsAlertDedupe.findUnique({ where: { dedupeKey } });
      if (!row) return false;
      return Date.now() - row.lastSentAt.getTime() < cooldownMs;
    },
    markSent: async (dedupeKey) => {
      await prisma.opsAlertDedupe.upsert({
        where: { dedupeKey },
        create: { dedupeKey, lastSentAt: new Date() },
        update: { lastSentAt: new Date() },
      });
    },
  });
}

export async function alertStripeWebhookFailure(input: {
  eventId: string;
  type: string;
  error: string;
  httpStatus: number;
}): Promise<void> {
  opsLogError('stripe.webhook', 'processing_failed', input.error, {
    eventId: input.eventId,
    type: input.type,
    httpStatus: input.httpStatus,
  });
  await notifyOpsDurable({
    severity: 'critical',
    title: 'Stripe webhook FAILED',
    body: input.error.slice(0, 500),
    dedupeKey: `webhook:failed:${input.eventId}`,
    fields: {
      eventId: input.eventId,
      type: input.type,
      httpStatus: input.httpStatus,
    },
  });
}

export async function alertLifecycleNotFound(input: {
  eventType: string;
  eventId?: string;
}): Promise<void> {
  opsLog('stripe.webhook', 'lifecycle_not_found', {
    eventType: input.eventType,
    eventId: input.eventId,
  });
  await notifyOpsDurable({
    severity: 'warning',
    title: 'SaaS lifecycle webhook: record not found',
    body: `Event ${input.eventType} had no matching SaasSubscription (race or orphan).`,
    dedupeKey: `webhook:lifecycle-miss:${input.eventType}:${input.eventId ?? 'unknown'}`,
    fields: { eventType: input.eventType, eventId: input.eventId ?? null },
    cooldownMs: 60 * 60 * 1000,
  });
}
