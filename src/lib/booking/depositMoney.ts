import {
  BookingStatus,
  DepositRefundStatus,
  PaymentStatus,
  type BookingDepositRefund,
} from '@prisma/client';
import { prisma } from '../db/client';
import { captureOpsException } from '../ops/sentry';
import { notifyOpsDurable } from '../ops/stripeWebhookLedger';
import { refundPaymentIntent } from '../shop/stripeConnect';

export type DepositRefundReason =
  | 'client_cancel_in_window'
  | 'shop_cancel'
  | 'manual_retry'
  | 'late_payment_slot_lost';

export type DepositRefundOutcome =
  | 'refunded'
  | 'pending'
  | 'failed'
  | 'skipped_unpaid'
  | 'skipped_already'
  | 'skipped_forfeited';

const DEFAULT_MAX_ATTEMPTS = 6;
const BASE_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;

function backoffMs(attempts: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
  return exp;
}

function nextAttemptAt(attempts: number, now = new Date()): Date {
  return new Date(now.getTime() + backoffMs(attempts));
}

function buildIdempotencyKey(bookingId: string): string {
  return `deposit_refund_${bookingId}`;
}

async function markBookingRefunded(bookingId: string, now = new Date()): Promise<void> {
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      paymentStatus: PaymentStatus.REFUNDED,
      depositRefundedAt: now,
    },
  });
}

async function alertRefundFailed(row: BookingDepositRefund, errorMessage: string): Promise<void> {
  await notifyOpsDurable({
    severity: 'critical',
    title: 'Deposit refund failed',
    body: errorMessage.slice(0, 500),
    dedupeKey: `refund:failed:${row.bookingId}`,
    fields: {
      bookingId: row.bookingId,
      shopId: row.shopId,
      refundLedgerId: row.id,
      attempts: row.attempts,
      stripePaymentIntentId: row.stripePaymentIntentId,
    },
  });
}

/**
 * Write-ahead: create (or return existing) ledger row before calling Stripe.
 * Does not call Stripe.
 */
export async function requestDepositRefund(input: {
  bookingId: string;
  reason: DepositRefundReason;
}): Promise<
  | { outcome: 'skipped_unpaid' | 'skipped_already' | 'skipped_forfeited'; refund: null }
  | { outcome: 'pending'; refund: BookingDepositRefund }
> {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: {
      barber: {
        select: {
          shopId: true,
          shop: { select: { stripeConnectAccountId: true } },
        },
      },
      depositRefund: true,
    },
  });

  if (!booking) return { outcome: 'skipped_unpaid', refund: null };
  if (!booking.paymentRequired || booking.paymentStatus !== PaymentStatus.PAID) {
    return { outcome: 'skipped_unpaid', refund: null };
  }
  if (booking.depositForfeitedAt) {
    return { outcome: 'skipped_forfeited', refund: null };
  }
  if (booking.depositRefundedAt) {
    return { outcome: 'skipped_already', refund: null };
  }
  if (booking.depositRefund?.status === DepositRefundStatus.REFUNDED) {
    return { outcome: 'skipped_already', refund: null };
  }
  if (!booking.stripePaymentIntentId) {
    // Create a FAILED ledger so ops can see the gap (no PI to refund).
    const amountPence = booking.depositAmountPence ?? 0;
    const existing = booking.depositRefund;
    if (existing) {
      return { outcome: 'pending', refund: existing };
    }
    const failed = await prisma.bookingDepositRefund.create({
      data: {
        bookingId: booking.id,
        shopId: booking.barber.shopId,
        status: DepositRefundStatus.REFUND_FAILED,
        amountPence,
        reason: input.reason,
        idempotencyKey: buildIdempotencyKey(booking.id),
        stripePaymentIntentId: '',
        connectAccountId: booking.barber.shop.stripeConnectAccountId?.trim() || null,
        attempts: 0,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
        lastError: 'Missing stripePaymentIntentId on paid booking.',
        nextAttemptAt: null,
      },
    });
    await alertRefundFailed(failed, 'Missing stripePaymentIntentId on paid booking.');
    return { outcome: 'pending', refund: failed };
  }

  if (booking.depositRefund) {
    return { outcome: 'pending', refund: booking.depositRefund };
  }

  const connectAccountId = booking.barber.shop.stripeConnectAccountId?.trim() || null;
  const amountPence = booking.depositAmountPence ?? 0;
  const refund = await prisma.bookingDepositRefund.create({
    data: {
      bookingId: booking.id,
      shopId: booking.barber.shopId,
      status: DepositRefundStatus.REFUND_PENDING,
      amountPence,
      reason: input.reason,
      idempotencyKey: buildIdempotencyKey(booking.id),
      stripePaymentIntentId: booking.stripePaymentIntentId,
      connectAccountId,
      attempts: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      nextAttemptAt: new Date(),
    },
  });

  return { outcome: 'pending', refund };
}

/**
 * Attempt Stripe refund for an existing ledger row. Idempotent via Stripe Idempotency-Key.
 */
export async function attemptDepositRefund(refundId: string): Promise<{
  outcome: DepositRefundOutcome;
  refund: BookingDepositRefund | null;
}> {
  const row = await prisma.bookingDepositRefund.findUnique({ where: { id: refundId } });
  if (!row) return { outcome: 'skipped_unpaid', refund: null };

  if (row.status === DepositRefundStatus.REFUNDED) {
    return { outcome: 'refunded', refund: row };
  }

  if (!row.stripePaymentIntentId) {
    return { outcome: 'failed', refund: row };
  }

  // Already have a Stripe refund id — wait for webhook confirmation unless status is terminal failure.
  if (row.stripeRefundId && row.status === DepositRefundStatus.REFUND_PENDING) {
    return { outcome: 'pending', refund: row };
  }

  if (row.status === DepositRefundStatus.REFUND_FAILED && row.attempts >= row.maxAttempts) {
    // Operator retry path resets attempts/status before calling attempt again.
    return { outcome: 'failed', refund: row };
  }

  const now = new Date();
  const claimed = await prisma.bookingDepositRefund.updateMany({
    where: {
      id: row.id,
      status: {
        in: [DepositRefundStatus.REFUND_PENDING, DepositRefundStatus.REFUND_FAILED],
      },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    data: {
      lastAttemptAt: now,
      // Push nextAttemptAt forward to reduce double-claim races until we finish.
      nextAttemptAt: nextAttemptAt(row.attempts + 1, now),
      status: DepositRefundStatus.REFUND_PENDING,
    },
  });

  if (claimed.count === 0) {
    const fresh = await prisma.bookingDepositRefund.findUnique({ where: { id: refundId } });
    if (fresh?.status === DepositRefundStatus.REFUNDED) {
      return { outcome: 'refunded', refund: fresh };
    }
    return { outcome: 'pending', refund: fresh };
  }

  try {
    const result = await refundPaymentIntent(row.stripePaymentIntentId, {
      stripeAccount: row.connectAccountId ?? undefined,
      reverseTransfer: true,
      amount: row.amountPence > 0 ? row.amountPence : undefined,
      idempotencyKey: row.idempotencyKey,
    });

    const stripeStatus = (result.status || '').toLowerCase();
    const attempts = row.attempts + 1;

    if (stripeStatus === 'failed' || stripeStatus === 'canceled' || stripeStatus === 'cancelled') {
      const updated = await prisma.bookingDepositRefund.update({
        where: { id: row.id },
        data: {
          status: DepositRefundStatus.REFUND_FAILED,
          stripeRefundId: result.id,
          attempts,
          lastError: `Stripe refund status: ${result.status}`,
          nextAttemptAt: null,
        },
      });
      await alertRefundFailed(updated, `Stripe refund status: ${result.status}`);
      captureOpsException(new Error(`Stripe refund status: ${result.status}`), {
        route: 'depositMoney.attemptDepositRefund',
        shopId: row.shopId,
        tags: { bookingId: row.bookingId, refundId: row.id },
      });
      return { outcome: 'failed', refund: updated };
    }

    if (stripeStatus === 'succeeded' || stripeStatus === '') {
      const confirmedAt = new Date();
      const updated = await prisma.bookingDepositRefund.update({
        where: { id: row.id },
        data: {
          status: DepositRefundStatus.REFUNDED,
          stripeRefundId: result.id,
          attempts,
          lastError: null,
          nextAttemptAt: null,
          confirmedAt,
        },
      });
      await markBookingRefunded(row.bookingId, confirmedAt);
      console.info('[deposit] refund ok', {
        bookingId: row.bookingId,
        reason: row.reason,
        mode: result.mode,
        connectAccountId: row.connectAccountId,
        refundId: result.id,
      });
      return { outcome: 'refunded', refund: updated };
    }

    // pending / requires_action / unknown — keep PENDING, wait for webhook.
    const updated = await prisma.bookingDepositRefund.update({
      where: { id: row.id },
      data: {
        status: DepositRefundStatus.REFUND_PENDING,
        stripeRefundId: result.id,
        attempts,
        lastError: null,
        // Do not hammer Stripe while waiting for webhook confirmation.
        nextAttemptAt: nextAttemptAt(Math.max(attempts, 3), now),
      },
    });
    return { outcome: 'pending', refund: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const attempts = row.attempts + 1;
    const exhausted = attempts >= row.maxAttempts;

    console.error('[deposit] refund failed', {
      bookingId: row.bookingId,
      reason: row.reason,
      connectAccountId: row.connectAccountId,
      attempts,
      error: message,
    });

    const updated = await prisma.bookingDepositRefund.update({
      where: { id: row.id },
      data: {
        status: exhausted ? DepositRefundStatus.REFUND_FAILED : DepositRefundStatus.REFUND_PENDING,
        attempts,
        lastError: message.slice(0, 1000),
        nextAttemptAt: exhausted ? null : nextAttemptAt(attempts, now),
      },
    });

    if (exhausted) {
      await alertRefundFailed(updated, message);
      captureOpsException(error, {
        route: 'depositMoney.attemptDepositRefund',
        shopId: row.shopId,
        tags: { bookingId: row.bookingId, refundId: row.id },
      });
      return { outcome: 'failed', refund: updated };
    }

    return { outcome: 'pending', refund: updated };
  }
}

/**
 * Confirm / fail a ledger row from Stripe webhook events.
 * Never demotes REFUNDED back to PENDING/FAILED.
 */
export async function confirmDepositRefundFromWebhook(input: {
  stripeRefundId?: string | null;
  paymentIntentId?: string | null;
  status: 'succeeded' | 'failed' | 'pending' | 'canceled';
  amountPence?: number | null;
}): Promise<{ matched: boolean; refund: BookingDepositRefund | null }> {
  let row: BookingDepositRefund | null = null;

  const refundId = input.stripeRefundId?.trim() || '';
  const pi = input.paymentIntentId?.trim() || '';

  if (refundId) {
    row = await prisma.bookingDepositRefund.findFirst({
      where: { stripeRefundId: refundId },
    });
  }
  if (!row && pi) {
    row = await prisma.bookingDepositRefund.findFirst({
      where: {
        stripePaymentIntentId: pi,
        status: { in: [DepositRefundStatus.REFUND_PENDING, DepositRefundStatus.REFUND_FAILED] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  // Webhook may arrive before API wrote stripeRefundId — also match PENDING by PI only.
  if (!row && pi) {
    row = await prisma.bookingDepositRefund.findFirst({
      where: { stripePaymentIntentId: pi },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!row) return { matched: false, refund: null };

  if (row.status === DepositRefundStatus.REFUNDED) {
    // Never demote; optionally backfill stripeRefundId.
    if (refundId && !row.stripeRefundId) {
      const updated = await prisma.bookingDepositRefund.update({
        where: { id: row.id },
        data: { stripeRefundId: refundId },
      });
      return { matched: true, refund: updated };
    }
    return { matched: true, refund: row };
  }

  if (input.status === 'succeeded') {
    const confirmedAt = new Date();
    const updated = await prisma.bookingDepositRefund.update({
      where: { id: row.id },
      data: {
        status: DepositRefundStatus.REFUNDED,
        stripeRefundId: refundId || row.stripeRefundId,
        confirmedAt,
        lastError: null,
        nextAttemptAt: null,
        ...(typeof input.amountPence === 'number' && input.amountPence > 0
          ? { amountPence: input.amountPence }
          : {}),
      },
    });
    await markBookingRefunded(row.bookingId, confirmedAt);
    return { matched: true, refund: updated };
  }

  if (input.status === 'failed' || input.status === 'canceled') {
    const updated = await prisma.bookingDepositRefund.update({
      where: { id: row.id },
      data: {
        status: DepositRefundStatus.REFUND_FAILED,
        stripeRefundId: refundId || row.stripeRefundId,
        lastError: `Webhook: refund ${input.status}`,
        nextAttemptAt: null,
      },
    });
    await alertRefundFailed(updated, `Webhook: refund ${input.status}`);
    return { matched: true, refund: updated };
  }

  // pending — record refund id if we learned it.
  if (refundId && refundId !== row.stripeRefundId) {
    const updated = await prisma.bookingDepositRefund.update({
      where: { id: row.id },
      data: { stripeRefundId: refundId },
    });
    return { matched: true, refund: updated };
  }

  return { matched: true, refund: row };
}

/** Operator repair: re-open a FAILED (or stuck PENDING) row and attempt again. */
export async function retryDepositRefundForOperator(bookingId: string): Promise<{
  outcome: DepositRefundOutcome;
  refund: BookingDepositRefund | null;
}> {
  const row = await prisma.bookingDepositRefund.findUnique({ where: { bookingId } });
  if (!row) {
    const requested = await requestDepositRefund({
      bookingId,
      reason: 'manual_retry',
    });
    if (!requested.refund) {
      return { outcome: requested.outcome, refund: null };
    }
    return attemptDepositRefund(requested.refund.id);
  }

  if (row.status === DepositRefundStatus.REFUNDED) {
    return { outcome: 'refunded', refund: row };
  }

  // Rotate idempotency key only after a terminal failure so Stripe accepts a fresh refund
  // attempt. PENDING retries keep the original key to avoid double-refunds.
  const rotateKey = row.status === DepositRefundStatus.REFUND_FAILED;
  await prisma.bookingDepositRefund.update({
    where: { id: row.id },
    data: {
      status: DepositRefundStatus.REFUND_PENDING,
      attempts: 0,
      nextAttemptAt: new Date(),
      lastError: null,
      reason: 'manual_retry',
      ...(rotateKey
        ? {
            idempotencyKey: `${buildIdempotencyKey(bookingId)}_retry_${Date.now()}`,
            stripeRefundId: null,
          }
        : {}),
    },
  });

  return attemptDepositRefund(row.id);
}

/** Cron: claim and attempt due PENDING refunds. */
export async function processDueDepositRefunds(now = new Date()): Promise<{
  claimed: number;
  refunded: number;
  pending: number;
  failed: number;
}> {
  const webhookWaitCutoff = new Date(now.getTime() - 30 * 60 * 1000);
  const due = await prisma.bookingDepositRefund.findMany({
    where: {
      status: DepositRefundStatus.REFUND_PENDING,
      AND: [
        { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        // Skip rows waiting on webhook confirmation unless overdue badly.
        {
          OR: [
            { stripeRefundId: null },
            { nextAttemptAt: { lte: webhookWaitCutoff } },
            { lastAttemptAt: { lte: webhookWaitCutoff } },
          ],
        },
      ],
    },
    orderBy: { nextAttemptAt: 'asc' },
    take: 25,
    select: { id: true },
  });

  let refunded = 0;
  let pending = 0;
  let failed = 0;

  for (const { id } of due) {
    const result = await attemptDepositRefund(id);
    if (result.outcome === 'refunded') refunded += 1;
    else if (result.outcome === 'failed') failed += 1;
    else pending += 1;
  }

  return { claimed: due.length, refunded, pending, failed };
}

/**
 * Backward-compatible wrapper: write-ahead ledger + immediate attempt.
 */
export async function refundBookingDepositIfEligible(input: {
  bookingId: string;
  reason: 'client_cancel_in_window' | 'shop_cancel';
}): Promise<DepositRefundOutcome> {
  const requested = await requestDepositRefund(input);
  if (!requested.refund) return requested.outcome;

  if (requested.refund.status === DepositRefundStatus.REFUNDED) return 'refunded';
  if (
    requested.refund.status === DepositRefundStatus.REFUND_FAILED &&
    !requested.refund.stripePaymentIntentId
  ) {
    return 'failed';
  }

  const attempted = await attemptDepositRefund(requested.refund.id);
  return attempted.outcome;
}

export async function forfeitBookingDeposit(bookingId: string): Promise<void> {
  await prisma.booking.updateMany({
    where: {
      id: bookingId,
      paymentRequired: true,
      paymentStatus: PaymentStatus.PAID,
      depositRefundedAt: null,
      depositForfeitedAt: null,
    },
    data: { depositForfeitedAt: new Date() },
  });
}

export async function expireUnpaidDepositHolds(now: Date = new Date()): Promise<number> {
  const result = await prisma.booking.updateMany({
    where: {
      status: BookingStatus.PENDING_PAYMENT,
      paymentExpiresAt: { lte: now },
    },
    data: { status: BookingStatus.EXPIRED },
  });
  return result.count;
}

export function depositRefundClientMessage(outcome: DepositRefundOutcome | null | undefined): string {
  switch (outcome) {
    case 'refunded':
      return 'Your booking has been cancelled. Your deposit refund has been confirmed.';
    case 'pending':
      return 'Your booking has been cancelled. Your deposit refund is being processed.';
    case 'failed':
      return 'Your booking has been cancelled. Your deposit refund could not be completed automatically — the shop will resolve this shortly.';
    case 'skipped_forfeited':
      return 'Your booking has been cancelled. The deposit was forfeited because the cancellation window has passed.';
    default:
      return 'Your booking has been cancelled successfully.';
  }
}
