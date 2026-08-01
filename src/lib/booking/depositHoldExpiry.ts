import { BookingStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../db/client';
import { notifyOpsDurable } from '../ops/stripeWebhookLedger';
import { captureOpsException } from '../ops/sentry';
import {
  expireBookingDepositSession,
  retrieveBookingDepositSession,
} from '../shop/stripeConnect';
import { getCheckoutPaymentIntentId } from '../shop/stripe';
import { confirmPaidDeposit } from './confirmPaidDeposit';

const BATCH_LIMIT = 25;
const STUCK_ALERT_AFTER_MS = 60 * 60 * 1000;

export type ProcessExpiredDepositHoldsResult = {
  scanned: number;
  released: number;
  recovered: number;
  deferred: number;
};

async function releaseHold(bookingId: string): Promise<boolean> {
  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: BookingStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.UNPAID,
    },
    data: { status: BookingStatus.EXPIRED },
  });
  return result.count > 0;
}

async function alertHoldStuck(input: {
  bookingId: string;
  shopId: string;
  sessionId: string;
  paymentExpiresAt: Date | null;
  errorMessage: string;
}): Promise<void> {
  await notifyOpsDurable({
    severity: 'critical',
    title: 'Deposit hold stuck — session expire failed',
    body: input.errorMessage.slice(0, 500),
    dedupeKey: `deposit:hold-stuck:${input.bookingId}`,
    fields: {
      bookingId: input.bookingId,
      shopId: input.shopId,
      sessionId: input.sessionId,
      paymentExpiresAt: input.paymentExpiresAt?.toISOString() ?? '',
    },
  });
  captureOpsException(new Error(input.errorMessage), {
    route: 'depositHoldExpiry.processExpiredDepositHolds',
    shopId: input.shopId,
    tags: { bookingId: input.bookingId, sessionId: input.sessionId },
  });
}

/**
 * Safely release unpaid deposit holds.
 * Never frees the slot while a Checkout Session may still accept payment —
 * expire the session first (or recover if it already paid).
 */
export async function processExpiredDepositHolds(
  now: Date = new Date(),
): Promise<ProcessExpiredDepositHoldsResult> {
  const due = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PENDING_PAYMENT,
      paymentExpiresAt: { lte: now },
    },
    orderBy: { paymentExpiresAt: 'asc' },
    take: BATCH_LIMIT,
    select: {
      id: true,
      stripeCheckoutSessionId: true,
      paymentExpiresAt: true,
      barber: {
        select: {
          shopId: true,
          shop: { select: { stripeConnectAccountId: true } },
        },
      },
    },
  });

  let released = 0;
  let recovered = 0;
  let deferred = 0;

  for (const row of due) {
    const shopId = row.barber.shopId;
    const sessionId = row.stripeCheckoutSessionId?.trim() || '';
    const connectAccountId = row.barber.shop.stripeConnectAccountId?.trim() || '';

    if (!sessionId || !connectAccountId) {
      if (await releaseHold(row.id)) released += 1;
      continue;
    }

    try {
      let session = await retrieveBookingDepositSession(sessionId, connectAccountId);
      let status = (session.status ?? '').toLowerCase();
      let paymentStatus = (session.payment_status ?? '').toLowerCase();

      if (status === 'complete' && paymentStatus === 'paid') {
        const result = await confirmPaidDeposit({
          bookingId: row.id,
          shopId,
          sessionId,
          paymentIntentId: getCheckoutPaymentIntentId(session),
          paidAt: now,
        });
        if (
          result.outcome === 'confirmed' ||
          result.outcome === 'duplicate' ||
          result.outcome === 'reinstated'
        ) {
          recovered += 1;
        } else if (result.outcome === 'late_refunded') {
          // Slot already gone / paid late — hold is not PENDING anymore.
          released += 1;
        } else {
          deferred += 1;
        }
        continue;
      }

      if (status === 'expired') {
        if (await releaseHold(row.id)) released += 1;
        continue;
      }

      if (status === 'open') {
        const expireOutcome = await expireBookingDepositSession(sessionId, connectAccountId);
        if (expireOutcome === 'already_completed') {
          session = await retrieveBookingDepositSession(sessionId, connectAccountId);
          status = (session.status ?? '').toLowerCase();
          paymentStatus = (session.payment_status ?? '').toLowerCase();
          if (status === 'complete' && paymentStatus === 'paid') {
            const result = await confirmPaidDeposit({
              bookingId: row.id,
              shopId,
              sessionId,
              paymentIntentId: getCheckoutPaymentIntentId(session),
              paidAt: now,
            });
            if (
              result.outcome === 'confirmed' ||
              result.outcome === 'duplicate' ||
              result.outcome === 'reinstated'
            ) {
              recovered += 1;
            } else if (result.outcome === 'late_refunded') {
              released += 1;
            } else {
              deferred += 1;
            }
            continue;
          }
        }
        // expired | already_expired | already_completed-but-unpaid → release
        if (await releaseHold(row.id)) released += 1;
        continue;
      }

      // Unknown status — do not free the slot.
      deferred += 1;
      const overdueMs =
        row.paymentExpiresAt instanceof Date ? now.getTime() - row.paymentExpiresAt.getTime() : 0;
      if (overdueMs >= STUCK_ALERT_AFTER_MS) {
        await alertHoldStuck({
          bookingId: row.id,
          shopId,
          sessionId,
          paymentExpiresAt: row.paymentExpiresAt,
          errorMessage: `Deposit hold overdue with session status "${status || 'unknown'}".`,
        });
      }
    } catch (error) {
      deferred += 1;
      const message = error instanceof Error ? error.message : String(error);
      const overdueMs =
        row.paymentExpiresAt instanceof Date ? now.getTime() - row.paymentExpiresAt.getTime() : 0;
      if (overdueMs >= STUCK_ALERT_AFTER_MS) {
        await alertHoldStuck({
          bookingId: row.id,
          shopId,
          sessionId,
          paymentExpiresAt: row.paymentExpiresAt,
          errorMessage: message,
        });
      } else {
        console.warn('[depositHoldExpiry] deferred expire', {
          bookingId: row.id,
          shopId,
          sessionId,
          error: message,
        });
      }
    }
  }

  return { scanned: due.length, released, recovered, deferred };
}
