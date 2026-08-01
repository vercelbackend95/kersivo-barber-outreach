import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus, PaymentStatus } from '@prisma/client';

const findManyBooking = vi.fn();
const updateManyBooking = vi.fn();
const retrieveBookingDepositSession = vi.fn();
const expireBookingDepositSession = vi.fn();
const confirmPaidDeposit = vi.fn();
const notifyOpsDurable = vi.fn();
const captureOpsException = vi.fn();
const getCheckoutPaymentIntentId = vi.fn((_session?: unknown) => 'pi_1');

vi.mock('../db/client', () => ({
  prisma: {
    booking: {
      findMany: (...args: unknown[]) => findManyBooking(...args),
      updateMany: (...args: unknown[]) => updateManyBooking(...args),
    },
  },
}));

vi.mock('../shop/stripeConnect', () => ({
  retrieveBookingDepositSession: (...args: unknown[]) => retrieveBookingDepositSession(...args),
  expireBookingDepositSession: (...args: unknown[]) => expireBookingDepositSession(...args),
}));

vi.mock('../shop/stripe', () => ({
  getCheckoutPaymentIntentId: (session: unknown) => getCheckoutPaymentIntentId(session),
}));

vi.mock('./confirmPaidDeposit', () => ({
  confirmPaidDeposit: (...args: unknown[]) => confirmPaidDeposit(...args),
}));

vi.mock('../ops/stripeWebhookLedger', () => ({
  notifyOpsDurable: (...args: unknown[]) => notifyOpsDurable(...args),
}));

vi.mock('../ops/sentry', () => ({
  captureOpsException: (...args: unknown[]) => captureOpsException(...args),
}));

import { processExpiredDepositHolds } from './depositHoldExpiry';

function dueRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'book_1',
    stripeCheckoutSessionId: 'cs_1',
    paymentExpiresAt: new Date('2026-08-01T12:15:00.000Z'),
    barber: {
      shopId: 'shop_1',
      shop: { stripeConnectAccountId: 'acct_shop' },
    },
    ...overrides,
  };
}

describe('processExpiredDepositHolds', () => {
  const now = new Date('2026-08-01T12:20:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
    notifyOpsDurable.mockResolvedValue({ sent: true });
    updateManyBooking.mockResolvedValue({ count: 1 });
  });

  it('expires an open session then releases the hold', async () => {
    findManyBooking.mockResolvedValue([dueRow()]);
    retrieveBookingDepositSession.mockResolvedValue({
      id: 'cs_1',
      status: 'open',
      payment_status: 'unpaid',
    });
    expireBookingDepositSession.mockResolvedValue('expired');

    const result = await processExpiredDepositHolds(now);

    expect(expireBookingDepositSession).toHaveBeenCalledWith('cs_1', 'acct_shop');
    expect(updateManyBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'book_1',
          status: BookingStatus.PENDING_PAYMENT,
          paymentStatus: PaymentStatus.UNPAID,
        },
        data: { status: BookingStatus.EXPIRED },
      }),
    );
    expect(confirmPaidDeposit).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, released: 1, recovered: 0, deferred: 0 });
  });

  it('recovers a paid session without calling expire', async () => {
    findManyBooking.mockResolvedValue([dueRow()]);
    retrieveBookingDepositSession.mockResolvedValue({
      id: 'cs_1',
      status: 'complete',
      payment_status: 'paid',
      payment_intent: 'pi_1',
    });
    confirmPaidDeposit.mockResolvedValue({ outcome: 'confirmed' });

    const result = await processExpiredDepositHolds(now);

    expect(expireBookingDepositSession).not.toHaveBeenCalled();
    expect(confirmPaidDeposit).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'book_1',
        shopId: 'shop_1',
        sessionId: 'cs_1',
        paymentIntentId: 'pi_1',
      }),
    );
    expect(updateManyBooking).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, released: 0, recovered: 1, deferred: 0 });
  });

  it('defers release when Stripe expire API fails', async () => {
    findManyBooking.mockResolvedValue([dueRow()]);
    retrieveBookingDepositSession.mockResolvedValue({
      id: 'cs_1',
      status: 'open',
      payment_status: 'unpaid',
    });
    expireBookingDepositSession.mockRejectedValue(new Error('Stripe 503'));

    const result = await processExpiredDepositHolds(now);

    expect(updateManyBooking).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, released: 0, recovered: 0, deferred: 1 });
    expect(notifyOpsDurable).not.toHaveBeenCalled();
  });

  it('releases immediately when there is no session id', async () => {
    findManyBooking.mockResolvedValue([
      dueRow({ stripeCheckoutSessionId: null }),
    ]);

    const result = await processExpiredDepositHolds(now);

    expect(retrieveBookingDepositSession).not.toHaveBeenCalled();
    expect(expireBookingDepositSession).not.toHaveBeenCalled();
    expect(updateManyBooking).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ scanned: 1, released: 1, recovered: 0, deferred: 0 });
  });

  it('alerts ops when a hold is stuck more than 60 minutes', async () => {
    findManyBooking.mockResolvedValue([
      dueRow({
        paymentExpiresAt: new Date('2026-08-01T10:00:00.000Z'),
      }),
    ]);
    retrieveBookingDepositSession.mockResolvedValue({
      id: 'cs_1',
      status: 'open',
      payment_status: 'unpaid',
    });
    expireBookingDepositSession.mockRejectedValue(new Error('Stripe down'));

    const stuckNow = new Date('2026-08-01T12:00:00.000Z');
    const result = await processExpiredDepositHolds(stuckNow);

    expect(result.deferred).toBe(1);
    expect(notifyOpsDurable).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: 'deposit:hold-stuck:book_1',
        title: 'Deposit hold stuck — session expire failed',
      }),
    );
  });
});
