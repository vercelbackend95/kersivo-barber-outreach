import {
  BookingStatus,
  DepositRefundStatus,
  PaymentStatus,
  type BookingDepositRefund,
} from '@prisma/client';
import { prisma } from '../db/client';
import { captureOpsException, captureOpsMessage } from '../ops/sentry';
import { refundPaymentIntent } from '../shop/stripeConnect';
import { resolveBookingPaymentAccount } from './bookingPaymentAccount';
import {
  paymentStatusAfterRefund,
  resolveBookingPaymentSettlement,
  resolveStoredBookingPayment,
  type BookingSettlementEvent,
} from './bookingPaymentPolicy';

/** Ledger reason; every value except manual_retry is a settlement event. */
export type BookingPaymentRefundReason = BookingSettlementEvent | 'manual_retry';
/** @deprecated Use BookingPaymentRefundReason. */
export type DepositRefundReason = BookingPaymentRefundReason;

export type BookingPaymentRefundOutcome =
  | 'refunded'
  | 'pending'
  | 'failed'
  | 'skipped_unpaid'
  | 'skipped_already'
  | 'skipped_forfeited'
  /** Settlement leaves nothing to refund (e.g. FULL £3 late cancel) — no Stripe call. */
  | 'skipped_no_refund_due';
/** @deprecated Use BookingPaymentRefundOutcome. */
export type DepositRefundOutcome = BookingPaymentRefundOutcome;

type StoredPaymentFields = {
  bookingPaymentType?: Parameters<typeof resolveStoredBookingPayment>[0]['bookingPaymentType'];
  paymentAmountPence?: number | null;
  depositAmountPence?: number | null;
  paymentRequired?: boolean | null;
};

/**
 * Customer refund owed for a ledger reason. Operator retries without a ledger only re-issue a
 * full refund for deposits; FULL payments must go through a settlement-backed action.
 */
function refundAmountForReason(booking: StoredPaymentFields, reason: BookingPaymentRefundReason): number {
  const stored = resolveStoredBookingPayment(booking);
  if (reason === 'manual_retry') {
    return stored.type === 'FULL' ? 0 : stored.amountPence;
  }
  return resolveBookingPaymentSettlement({
    bookingPaymentType: stored.type,
    paymentAmountPence: stored.amountPence,
    event: reason,
  }).refundPence;
}

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

/**
 * `refundedAmountPence` is set (not incremented) from the confirmed ledger row, so replays are
 * idempotent. Status is derived from the confirmed amount: equal to the payment → REFUNDED,
 * less → PARTIALLY_REFUNDED. `depositRefundedAt` stays a deposit/legacy-only marker.
 * Returns false (and alerts) when the amount is impossible for the booking's payment.
 */
async function markBookingRefunded(
  bookingId: string,
  refundedAmountPence: number,
  now = new Date(),
): Promise<boolean> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      bookingPaymentType: true,
      paymentAmountPence: true,
      depositAmountPence: true,
      paymentRequired: true,
      barber: { select: { shopId: true } },
    },
  });
  const stored = resolveStoredBookingPayment(booking ?? {});
  const paymentStatus = paymentStatusAfterRefund({
    paymentAmountPence: stored.amountPence,
    refundedAmountPence,
  });
  if (!booking || !paymentStatus) {
    captureOpsMessage('Booking refund amount is impossible for the original payment', {
      level: 'error',
      route: 'depositMoney.markBookingRefunded',
      shopId: booking?.barber?.shopId,
      opsAlert: true,
      tags: {
        bookingId,
        refundedAmountPence: String(refundedAmountPence),
        paymentAmountPence: String(stored.amountPence),
      },
    });
    return false;
  }
  const isFullRefund = paymentStatus === PaymentStatus.REFUNDED;
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      paymentStatus,
      refundedAmountPence,
      ...(stored.type !== 'FULL' && isFullRefund ? { depositRefundedAt: now } : {}),
    },
  });
  return true;
}

async function alertRefundFailed(row: BookingDepositRefund, errorMessage: string): Promise<void> {
  captureOpsException(new Error(errorMessage), {
    route: 'depositMoney.attemptDepositRefund',
    shopId: row.shopId,
    opsAlert: true,
    tags: { bookingId: row.bookingId, refundId: row.id },
  });
}

/**
 * Write-ahead: create (or return existing) ledger row before calling Stripe.
 * The ledger amount is the actual customer refund from the settlement policy (e.g. a late FULL
 * £30 cancel stores 2500, not 3000). One ledger row per booking. Does not call Stripe.
 */
export async function requestBookingPaymentRefund(input: {
  bookingId: string;
  reason: BookingPaymentRefundReason;
}): Promise<
  | {
      outcome: 'skipped_unpaid' | 'skipped_already' | 'skipped_forfeited' | 'skipped_no_refund_due';
      refund: null;
    }
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
  if (
    booking.paymentStatus === PaymentStatus.REFUNDED ||
    booking.paymentStatus === PaymentStatus.PARTIALLY_REFUNDED
  ) {
    return { outcome: 'skipped_already', refund: null };
  }
  if (!booking.paymentRequired || booking.paymentStatus !== PaymentStatus.PAID) {
    return { outcome: 'skipped_unpaid', refund: null };
  }
  // depositForfeitedAt / depositRefundedAt are deposit + legacy markers; FULL never sets them.
  if (booking.depositForfeitedAt) {
    return { outcome: 'skipped_forfeited', refund: null };
  }
  if (booking.depositRefundedAt) {
    return { outcome: 'skipped_already', refund: null };
  }
  if (booking.depositRefund?.status === DepositRefundStatus.REFUNDED) {
    return { outcome: 'skipped_already', refund: null };
  }
  if (booking.depositRefund) {
    return { outcome: 'pending', refund: booking.depositRefund };
  }
  const amountPence = refundAmountForReason(booking, input.reason);
  if (amountPence <= 0) {
    return { outcome: 'skipped_no_refund_due', refund: null };
  }
  // The PaymentIntent lives on the account the booking was paid on — never a later shop account.
  const paymentAccount = resolveBookingPaymentAccount({
    booking,
    currentShopAccountId: booking.barber.shop.stripeConnectAccountId,
  });
  const connectAccountId = paymentAccount.ok ? paymentAccount.accountId : null;

  const missingAccountSnapshot =
    !paymentAccount.ok && paymentAccount.reason === 'missing_payment_account_snapshot';

  if (!booking.stripePaymentIntentId || missingAccountSnapshot) {
    const integrityError = !booking.stripePaymentIntentId
      ? 'Missing stripePaymentIntentId on paid booking.'
      : 'Missing Stripe Connect payment account snapshot on fee-bearing booking.';
    // Create a FAILED ledger so ops can see the gap; never refund via a guessed account.
    const failed = await prisma.bookingDepositRefund.create({
      data: {
        bookingId: booking.id,
        shopId: booking.barber.shopId,
        status: DepositRefundStatus.REFUND_FAILED,
        amountPence,
        reason: input.reason,
        idempotencyKey: buildIdempotencyKey(booking.id),
        stripePaymentIntentId: '',
        connectAccountId,
        attempts: 0,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
        lastError: integrityError,
        nextAttemptAt: null,
      },
    });
    await alertRefundFailed(failed, integrityError);
    return { outcome: 'pending', refund: failed };
  }

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
export async function attemptBookingPaymentRefund(refundId: string): Promise<{
  outcome: BookingPaymentRefundOutcome;
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
    if (!Number.isInteger(row.amountPence) || row.amountPence <= 0) {
      // An amount-less Stripe refund would refund the whole PaymentIntent; never guess.
      const lastError = 'Refund ledger amount must be a positive integer.';
      const updated = await prisma.bookingDepositRefund.update({
        where: { id: row.id },
        data: { status: DepositRefundStatus.REFUND_FAILED, lastError, nextAttemptAt: null },
      });
      await alertRefundFailed(updated, lastError);
      return { outcome: 'failed', refund: updated };
    }
    // Historical (pre-v1.18 Starter/Free) bookings may carry a non-zero KERSIVO fee snapshot; Stripe
    // returns it proportionally for full and partial refunds when refund_application_fee is set.
    // New v1.18 bookings snapshot a 0 fee and never set it.
    const paymentSnapshot = await prisma.booking.findUnique({
      where: { id: row.bookingId },
      select: { kersivoPlatformFeePence: true, stripeConnectAccountIdAtPayment: true },
    });
    const refundApplicationFee = (paymentSnapshot?.kersivoPlatformFeePence ?? 0) > 0;
    // A snapshotted direct charge (Free or Full, any fee) lives only on its connected account;
    // the platform-account fallback is reserved for pre-snapshot destination charges.
    const hasAccountSnapshot = Boolean(paymentSnapshot?.stripeConnectAccountIdAtPayment?.trim());
    if ((refundApplicationFee || hasAccountSnapshot) && !row.connectAccountId?.trim()) {
      // A connected-account payment only exists on that account; never refund elsewhere.
      const lastError = 'Missing connected account for direct-charge booking refund.';
      const updated = await prisma.bookingDepositRefund.update({
        where: { id: row.id },
        data: {
          status: DepositRefundStatus.REFUND_FAILED,
          lastError,
          nextAttemptAt: null,
        },
      });
      await alertRefundFailed(updated, lastError);
      return { outcome: 'failed', refund: updated };
    }
    const result = await refundPaymentIntent(row.stripePaymentIntentId, {
      stripeAccount: row.connectAccountId ?? undefined,
      reverseTransfer: true,
      amount: row.amountPence,
      idempotencyKey: row.idempotencyKey,
      ...(refundApplicationFee ? { refundApplicationFee: true } : {}),
      allowPlatformLegacyFallback: !hasAccountSnapshot,
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
      await markBookingRefunded(row.bookingId, updated.amountPence, confirmedAt);
      console.info('[booking-payment] refund ok', {
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

    console.error('[booking-payment] refund failed', {
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
      return { outcome: 'failed', refund: updated };
    }

    return { outcome: 'pending', refund: updated };
  }
}

export type RefundWebhookConfirmation = {
  matched: boolean;
  refund: BookingDepositRefund | null;
  /** True only when this event moved the ledger to REFUNDED. */
  confirmed?: boolean;
  reason?: 'refund_integrity_mismatch';
};

type RefundIntegrityMismatch = 'account' | 'refund_id' | 'amount' | 'amount_missing' | 'refund_id_missing';

function alertRefundIntegrityMismatch(row: BookingDepositRefund, mismatch: RefundIntegrityMismatch): void {
  captureOpsMessage('Stripe refund webhook does not match the booking refund ledger', {
    level: 'error',
    route: 'depositMoney.applyStripeRefundWebhook',
    shopId: row.shopId,
    opsAlert: true,
    tags: { bookingId: row.bookingId, refundLedgerId: row.id, mismatch },
  });
}

/**
 * Confirm / fail a ledger row from Stripe webhook events.
 *
 * The webhook is evidence about the refund the settlement action already wrote; it never
 * changes the refund amount. Before any write it must match the ledger's connected account,
 * its stored refund id, and — when correlated only by PaymentIntent because the refund id is
 * not persisted yet — exactly the ledger amount. Mismatches are alerted and left untouched.
 * Never demotes REFUNDED back to PENDING/FAILED.
 */
export async function confirmBookingPaymentRefundFromWebhook(input: {
  stripeRefundId?: string | null;
  paymentIntentId?: string | null;
  status: 'succeeded' | 'failed' | 'pending' | 'canceled';
  amountPence?: number | null;
  /** Connected account the Stripe event was delivered for (`event.account`). */
  stripeAccountId?: string | null;
  /** Only correlate via a refund id already stored on a ledger (no PaymentIntent fallback). */
  requireStoredRefundId?: boolean;
}): Promise<RefundWebhookConfirmation> {
  let row: BookingDepositRefund | null = null;

  const refundId = input.stripeRefundId?.trim() || '';
  const pi = input.paymentIntentId?.trim() || '';
  const eventAccount = input.stripeAccountId?.trim() || '';
  const eventAmount =
    typeof input.amountPence === 'number' && Number.isInteger(input.amountPence) && input.amountPence > 0
      ? input.amountPence
      : null;

  if (refundId) {
    row = await prisma.bookingDepositRefund.findFirst({
      where: { stripeRefundId: refundId },
    });
  }
  if (!row && pi && !input.requireStoredRefundId) {
    row = await prisma.bookingDepositRefund.findFirst({
      where: {
        stripePaymentIntentId: pi,
        status: { in: [DepositRefundStatus.REFUND_PENDING, DepositRefundStatus.REFUND_FAILED] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  // Webhook may arrive before API wrote stripeRefundId — also match by PI only.
  if (!row && pi && !input.requireStoredRefundId) {
    row = await prisma.bookingDepositRefund.findFirst({
      where: { stripePaymentIntentId: pi },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!row) return { matched: false, refund: null };

  const mismatch = ((): RefundIntegrityMismatch | null => {
    // Legacy rows (null account snapshot) keep historical platform-account compatibility.
    const ledgerAccount = row.connectAccountId?.trim() || '';
    if (ledgerAccount && eventAccount !== ledgerAccount) return 'account';
    if (row.stripeRefundId) {
      if (!refundId) return 'refund_id_missing';
      if (refundId !== row.stripeRefundId) return 'refund_id';
      if (eventAmount !== null && eventAmount !== row.amountPence) return 'amount';
      return null;
    }
    // PaymentIntent-only correlation: only the exact intended refund may bind to this ledger.
    if (eventAmount === null) return 'amount_missing';
    if (eventAmount !== row.amountPence) return 'amount';
    return null;
  })();
  if (mismatch) {
    alertRefundIntegrityMismatch(row, mismatch);
    return { matched: true, confirmed: false, reason: 'refund_integrity_mismatch', refund: row };
  }

  if (row.status === DepositRefundStatus.REFUNDED) {
    // Never demote; optionally backfill stripeRefundId.
    if (refundId && !row.stripeRefundId) {
      const updated = await prisma.bookingDepositRefund.update({
        where: { id: row.id },
        data: { stripeRefundId: refundId },
      });
      return { matched: true, confirmed: false, refund: updated };
    }
    return { matched: true, confirmed: false, refund: row };
  }

  if (input.status === 'succeeded') {
    // Single refund per booking: the durable ledger amount is what was refunded.
    const confirmedAmountPence = row.amountPence;
    const booking = await prisma.booking.findUnique({
      where: { id: row.bookingId },
      select: {
        bookingPaymentType: true,
        paymentAmountPence: true,
        depositAmountPence: true,
        paymentRequired: true,
      },
    });
    const stored = resolveStoredBookingPayment(booking ?? {});
    if (
      !paymentStatusAfterRefund({
        paymentAmountPence: stored.amountPence,
        refundedAmountPence: confirmedAmountPence,
      })
    ) {
      // Never record more than was paid online; leave the ledger for ops to inspect.
      captureOpsMessage('Stripe refund webhook amount exceeds the booking payment', {
        level: 'error',
        route: 'depositMoney.applyStripeRefundWebhook',
        shopId: row.shopId,
        opsAlert: true,
        tags: {
          bookingId: row.bookingId,
          refundLedgerId: row.id,
          refundAmountPence: String(confirmedAmountPence),
          paymentAmountPence: String(stored.amountPence),
        },
      });
      return { matched: true, confirmed: false, reason: 'refund_integrity_mismatch', refund: row };
    }
    const confirmedAt = new Date();
    const updated = await prisma.bookingDepositRefund.update({
      where: { id: row.id },
      data: {
        status: DepositRefundStatus.REFUNDED,
        stripeRefundId: refundId || row.stripeRefundId,
        confirmedAt,
        lastError: null,
        nextAttemptAt: null,
      },
    });
    await markBookingRefunded(row.bookingId, confirmedAmountPence, confirmedAt);
    return { matched: true, confirmed: true, refund: updated };
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
    captureOpsMessage('Booking payment refund failed via Stripe webhook', {
      level: 'error',
      route: 'depositMoney.applyStripeRefundWebhook',
      shopId: updated.shopId,
      tags: {
        bookingId: updated.bookingId,
        refundLedgerId: updated.id,
        stripeStatus: input.status,
      },
    });
    return { matched: true, confirmed: false, refund: updated };
  }

  // pending — record refund id if we learned it.
  if (refundId && refundId !== row.stripeRefundId) {
    const updated = await prisma.bookingDepositRefund.update({
      where: { id: row.id },
      data: { stripeRefundId: refundId },
    });
    return { matched: true, confirmed: false, refund: updated };
  }

  return { matched: true, confirmed: false, refund: row };
}

/**
 * Operator repair: re-open a FAILED (or stuck PENDING) row and attempt again. Always retries the
 * stored ledger amount (full or partial) — the settlement policy is never recalculated here.
 */
export async function retryBookingPaymentRefundForOperator(bookingId: string): Promise<{
  outcome: BookingPaymentRefundOutcome;
  refund: BookingDepositRefund | null;
}> {
  const row = await prisma.bookingDepositRefund.findUnique({ where: { bookingId } });
  if (!row) {
    const requested = await requestBookingPaymentRefund({
      bookingId,
      reason: 'manual_retry',
    });
    if (!requested.refund) {
      return { outcome: requested.outcome, refund: null };
    }
    return attemptBookingPaymentRefund(requested.refund.id);
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

  return attemptBookingPaymentRefund(row.id);
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
    const result = await attemptBookingPaymentRefund(id);
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
}): Promise<BookingPaymentRefundOutcome> {
  const requested = await requestBookingPaymentRefund(input);
  if (!requested.refund) return requested.outcome;

  if (requested.refund.status === DepositRefundStatus.REFUNDED) return 'refunded';
  if (
    requested.refund.status === DepositRefundStatus.REFUND_FAILED &&
    !requested.refund.stripePaymentIntentId
  ) {
    return 'failed';
  }

  const attempted = await attemptBookingPaymentRefund(requested.refund.id);
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

/**
 * The single no-show path for every endpoint: DEPOSIT retains the deposit, FULL retains up to £5
 * and refunds the rest. A FULL refund ledger is written before the status change; a Stripe
 * failure never blocks marking the no-show.
 */
export async function markNoShowWithPaymentSettlement(params: {
  bookingId: string;
  markNoShow: () => Promise<void>;
}): Promise<{ outcome: BookingPaymentRefundOutcome | null }> {
  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    select: {
      bookingPaymentType: true,
      paymentAmountPence: true,
      depositAmountPence: true,
      paymentRequired: true,
      paymentStatus: true,
    },
  });
  const stored = resolveStoredBookingPayment(booking ?? {});
  const paid = Boolean(booking?.paymentRequired) && booking?.paymentStatus === PaymentStatus.PAID;

  if (!paid || stored.type === 'NONE') {
    await params.markNoShow();
    return { outcome: null };
  }

  if (stored.type === 'DEPOSIT') {
    await params.markNoShow();
    await forfeitBookingDeposit(params.bookingId);
    return { outcome: 'skipped_forfeited' };
  }

  const requested = await requestBookingPaymentRefund({ bookingId: params.bookingId, reason: 'no_show' });
  await params.markNoShow();
  if (!requested.refund) return { outcome: requested.outcome };
  try {
    const attempted = await attemptBookingPaymentRefund(requested.refund.id);
    return { outcome: attempted.outcome };
  } catch (error) {
    captureOpsException(error, {
      route: 'depositMoney.markNoShowWithPaymentSettlement',
      opsAlert: true,
      tags: { bookingId: params.bookingId },
    });
    return { outcome: 'pending' };
  }
}

/** Customer-facing cancel message; FULL payments use payment wording, deposits keep deposit wording. */
export function bookingPaymentRefundClientMessage(
  outcome: BookingPaymentRefundOutcome | null | undefined,
  options: { bookingPaymentType?: string | null; partial?: boolean } = {},
): string {
  if (options.bookingPaymentType !== 'FULL') return depositRefundClientMessage(outcome);
  const partial = Boolean(options.partial);
  switch (outcome) {
    case 'refunded':
      return partial
        ? 'Your booking has been cancelled. Your partial refund has been confirmed.'
        : 'Your booking has been cancelled. Your payment refund has been confirmed.';
    case 'pending':
      return partial
        ? 'Your booking has been cancelled. A partial refund is being processed.'
        : 'Your booking has been cancelled. Your payment refund is being processed.';
    case 'failed':
      return 'Your booking has been cancelled. Your refund could not be completed automatically — the shop will resolve this shortly.';
    case 'skipped_no_refund_due':
      return 'Your booking has been cancelled. Your payment was kept because the cancellation window has passed.';
    default:
      return 'Your booking has been cancelled successfully.';
  }
}

/** @deprecated Use requestBookingPaymentRefund. */
export const requestDepositRefund = requestBookingPaymentRefund;
/** @deprecated Use attemptBookingPaymentRefund. */
export const attemptDepositRefund = attemptBookingPaymentRefund;
/** @deprecated Use retryBookingPaymentRefundForOperator. */
export const retryDepositRefundForOperator = retryBookingPaymentRefundForOperator;
/** @deprecated Use confirmBookingPaymentRefundFromWebhook. */
export const confirmDepositRefundFromWebhook = confirmBookingPaymentRefundFromWebhook;

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
