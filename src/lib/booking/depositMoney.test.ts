import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUniqueBooking = vi.fn();
const createRefund = vi.fn();
const findUniqueRefund = vi.fn();
const findFirstRefund = vi.fn();
const findManyRefund = vi.fn();
const updateRefund = vi.fn();
const updateManyRefund = vi.fn();
const updateBooking = vi.fn();
const updateManyBooking = vi.fn();
const refundPaymentIntent = vi.fn();
const notifyOpsDurable = vi.fn();
const captureOpsException = vi.fn();

vi.mock('../db/client', () => ({
  prisma: {
    booking: {
      findUnique: (...args: unknown[]) => findUniqueBooking(...args),
      update: (...args: unknown[]) => updateBooking(...args),
      updateMany: (...args: unknown[]) => updateManyBooking(...args),
    },
    bookingDepositRefund: {
      create: (...args: unknown[]) => createRefund(...args),
      findUnique: (...args: unknown[]) => findUniqueRefund(...args),
      findFirst: (...args: unknown[]) => findFirstRefund(...args),
      findMany: (...args: unknown[]) => findManyRefund(...args),
      update: (...args: unknown[]) => updateRefund(...args),
      updateMany: (...args: unknown[]) => updateManyRefund(...args),
    },
  },
}));

vi.mock('../shop/stripeConnect', () => ({
  refundPaymentIntent: (...args: unknown[]) => refundPaymentIntent(...args),
}));

vi.mock('../ops/stripeWebhookLedger', () => ({
  notifyOpsDurable: (...args: unknown[]) => notifyOpsDurable(...args),
}));

vi.mock('../ops/sentry', () => ({
  captureOpsException: (...args: unknown[]) => captureOpsException(...args),
}));

import {
  attemptDepositRefund,
  confirmDepositRefundFromWebhook,
  refundBookingDepositIfEligible,
  requestDepositRefund,
  retryDepositRefundForOperator,
} from './depositMoney';

function paidBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'book_1',
    paymentRequired: true,
    paymentStatus: 'PAID',
    depositAmountPence: 500,
    depositRefundedAt: null,
    depositForfeitedAt: null,
    stripePaymentIntentId: 'pi_1',
    depositRefund: null,
    barber: { shopId: 'shop_1', shop: { stripeConnectAccountId: 'acct_shop' } },
    ...overrides,
  };
}

function pendingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ref_1',
    bookingId: 'book_1',
    shopId: 'shop_1',
    status: 'REFUND_PENDING',
    amountPence: 500,
    reason: 'shop_cancel',
    idempotencyKey: 'deposit_refund_book_1',
    stripeRefundId: null,
    stripePaymentIntentId: 'pi_1',
    connectAccountId: 'acct_shop',
    attempts: 0,
    maxAttempts: 6,
    nextAttemptAt: new Date(0),
    lastAttemptAt: null,
    lastError: null,
    confirmedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('requestDepositRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyOpsDurable.mockResolvedValue({ sent: false });
  });

  it('creates write-ahead ledger row without calling Stripe', async () => {
    findUniqueBooking.mockResolvedValue(paidBooking());
    createRefund.mockResolvedValue(pendingRow());

    const result = await requestDepositRefund({ bookingId: 'book_1', reason: 'shop_cancel' });

    expect(result.outcome).toBe('pending');
    expect(result.refund?.id).toBe('ref_1');
    expect(refundPaymentIntent).not.toHaveBeenCalled();
    expect(createRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: 'book_1',
          idempotencyKey: 'deposit_refund_book_1',
          status: 'REFUND_PENDING',
        }),
      }),
    );
  });

  it('returns existing ledger row without creating a duplicate', async () => {
    findUniqueBooking.mockResolvedValue(paidBooking({ depositRefund: pendingRow() }));

    const result = await requestDepositRefund({
      bookingId: 'book_1',
      reason: 'client_cancel_in_window',
    });

    expect(result.outcome).toBe('pending');
    expect(createRefund).not.toHaveBeenCalled();
  });
});

describe('attemptDepositRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyOpsDurable.mockResolvedValue({ sent: false });
  });

  it('marks REFUNDED on Stripe succeeded and stamps booking', async () => {
    findUniqueRefund.mockResolvedValue(pendingRow());
    updateManyRefund.mockResolvedValue({ count: 1 });
    refundPaymentIntent.mockResolvedValue({
      id: 're_1',
      mode: 'direct',
      status: 'succeeded',
      amount: 500,
    });
    updateRefund.mockResolvedValue(pendingRow({ status: 'REFUNDED', stripeRefundId: 're_1' }));
    updateBooking.mockResolvedValue({});

    const result = await attemptDepositRefund('ref_1');

    expect(result.outcome).toBe('refunded');
    expect(refundPaymentIntent).toHaveBeenCalledWith('pi_1', {
      stripeAccount: 'acct_shop',
      reverseTransfer: true,
      amount: 500,
      idempotencyKey: 'deposit_refund_book_1',
    });
    expect(updateBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'book_1' },
        data: expect.objectContaining({ paymentStatus: 'REFUNDED' }),
      }),
    );
  });

  it('keeps PENDING when Stripe returns pending status', async () => {
    findUniqueRefund.mockResolvedValue(pendingRow());
    updateManyRefund.mockResolvedValue({ count: 1 });
    refundPaymentIntent.mockResolvedValue({
      id: 're_pending',
      mode: 'direct',
      status: 'pending',
      amount: 500,
    });
    updateRefund.mockResolvedValue(
      pendingRow({ status: 'REFUND_PENDING', stripeRefundId: 're_pending', attempts: 1 }),
    );

    const result = await attemptDepositRefund('ref_1');
    expect(result.outcome).toBe('pending');
    expect(updateBooking).not.toHaveBeenCalled();
  });

  it('backs off on Stripe throw and keeps PENDING', async () => {
    findUniqueRefund.mockResolvedValue(pendingRow({ attempts: 1 }));
    updateManyRefund.mockResolvedValue({ count: 1 });
    refundPaymentIntent.mockRejectedValue(new Error('timeout'));
    updateRefund.mockResolvedValue(
      pendingRow({ status: 'REFUND_PENDING', attempts: 2, lastError: 'timeout' }),
    );

    const result = await attemptDepositRefund('ref_1');
    expect(result.outcome).toBe('pending');
    expect(updateRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REFUND_PENDING',
          attempts: 2,
          lastError: 'timeout',
          nextAttemptAt: expect.any(Date),
        }),
      }),
    );
    expect(notifyOpsDurable).not.toHaveBeenCalled();
  });

  it('marks REFUND_FAILED and alerts when attempts are exhausted', async () => {
    findUniqueRefund.mockResolvedValue(pendingRow({ attempts: 5, maxAttempts: 6 }));
    updateManyRefund.mockResolvedValue({ count: 1 });
    refundPaymentIntent.mockRejectedValue(new Error('boom'));
    updateRefund.mockResolvedValue(
      pendingRow({ status: 'REFUND_FAILED', attempts: 6, lastError: 'boom' }),
    );

    const result = await attemptDepositRefund('ref_1');
    expect(result.outcome).toBe('failed');
    expect(notifyOpsDurable).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'critical',
        dedupeKey: 'refund:failed:book_1',
      }),
    );
    expect(captureOpsException).toHaveBeenCalled();
  });

  it('does not call Stripe again when already REFUNDED', async () => {
    findUniqueRefund.mockResolvedValue(pendingRow({ status: 'REFUNDED', stripeRefundId: 're_done' }));

    const result = await attemptDepositRefund('ref_1');
    expect(result.outcome).toBe('refunded');
    expect(refundPaymentIntent).not.toHaveBeenCalled();
  });

  it('reuses the same idempotency key across retries', async () => {
    findUniqueRefund.mockResolvedValue(pendingRow({ attempts: 2 }));
    updateManyRefund.mockResolvedValue({ count: 1 });
    refundPaymentIntent.mockResolvedValue({
      id: 're_1',
      mode: 'direct',
      status: 'succeeded',
      amount: 500,
    });
    updateRefund.mockResolvedValue(pendingRow({ status: 'REFUNDED' }));
    updateBooking.mockResolvedValue({});

    await attemptDepositRefund('ref_1');
    expect(refundPaymentIntent).toHaveBeenCalledWith(
      'pi_1',
      expect.objectContaining({ idempotencyKey: 'deposit_refund_book_1' }),
    );
  });
});

describe('confirmDepositRefundFromWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyOpsDurable.mockResolvedValue({ sent: false });
  });

  it('confirms by stripeRefundId', async () => {
    findFirstRefund.mockResolvedValueOnce(pendingRow({ stripeRefundId: 're_1' }));
    updateRefund.mockResolvedValue(pendingRow({ status: 'REFUNDED', stripeRefundId: 're_1' }));
    updateBooking.mockResolvedValue({});

    const result = await confirmDepositRefundFromWebhook({
      stripeRefundId: 're_1',
      paymentIntentId: 'pi_1',
      status: 'succeeded',
      amountPence: 500,
    });

    expect(result.matched).toBe(true);
    expect(result.refund?.status).toBe('REFUNDED');
    expect(updateBooking).toHaveBeenCalled();
  });

  it('matches by payment_intent when refund id not yet stored (webhook before API)', async () => {
    findFirstRefund
      .mockResolvedValueOnce(null) // by refund id
      .mockResolvedValueOnce(pendingRow()); // by PI + pending/failed
    updateRefund.mockResolvedValue(pendingRow({ status: 'REFUNDED', stripeRefundId: 're_late' }));
    updateBooking.mockResolvedValue({});

    const result = await confirmDepositRefundFromWebhook({
      stripeRefundId: 're_late',
      paymentIntentId: 'pi_1',
      status: 'succeeded',
    });

    expect(result.matched).toBe(true);
    expect(updateRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REFUNDED',
          stripeRefundId: 're_late',
        }),
      }),
    );
  });

  it('never demotes REFUNDED on duplicate webhook', async () => {
    findFirstRefund.mockResolvedValueOnce(
      pendingRow({ status: 'REFUNDED', stripeRefundId: 're_1', confirmedAt: new Date() }),
    );

    const result = await confirmDepositRefundFromWebhook({
      stripeRefundId: 're_1',
      paymentIntentId: 'pi_1',
      status: 'failed',
    });

    expect(result.matched).toBe(true);
    expect(result.refund?.status).toBe('REFUNDED');
    expect(updateRefund).not.toHaveBeenCalled();
  });

  it('marks REFUND_FAILED on refund.failed webhook', async () => {
    findFirstRefund.mockResolvedValueOnce(pendingRow({ stripeRefundId: 're_bad' }));
    updateRefund.mockResolvedValue(pendingRow({ status: 'REFUND_FAILED' }));

    const result = await confirmDepositRefundFromWebhook({
      stripeRefundId: 're_bad',
      paymentIntentId: 'pi_1',
      status: 'failed',
    });

    expect(result.matched).toBe(true);
    expect(notifyOpsDurable).toHaveBeenCalled();
  });
});

describe('retryDepositRefundForOperator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyOpsDurable.mockResolvedValue({ sent: false });
  });

  it('rotates idempotency key after REFUND_FAILED', async () => {
    findUniqueRefund
      .mockResolvedValueOnce(pendingRow({ status: 'REFUND_FAILED', attempts: 6 }))
      .mockResolvedValueOnce(
        pendingRow({ status: 'REFUND_PENDING', attempts: 0, idempotencyKey: 'rotated' }),
      );
    updateRefund.mockResolvedValue({});
    updateManyRefund.mockResolvedValue({ count: 1 });
    refundPaymentIntent.mockResolvedValue({
      id: 're_2',
      mode: 'direct',
      status: 'succeeded',
      amount: 500,
    });
    updateRefund.mockResolvedValue(pendingRow({ status: 'REFUNDED' }));
    updateBooking.mockResolvedValue({});

    await retryDepositRefundForOperator('book_1');

    expect(updateRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REFUND_PENDING',
          attempts: 0,
          reason: 'manual_retry',
          idempotencyKey: expect.stringContaining('deposit_refund_book_1_retry_'),
          stripeRefundId: null,
        }),
      }),
    );
  });
});

describe('refundBookingDepositIfEligible wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyOpsDurable.mockResolvedValue({ sent: false });
  });

  it('passes connect account id and returns refunded', async () => {
    findUniqueBooking.mockResolvedValue(paidBooking());
    createRefund.mockResolvedValue(pendingRow());
    findUniqueRefund.mockResolvedValue(pendingRow());
    updateManyRefund.mockResolvedValue({ count: 1 });
    refundPaymentIntent.mockResolvedValue({
      id: 're_1',
      mode: 'direct',
      status: 'succeeded',
      amount: 500,
    });
    updateRefund.mockResolvedValue(pendingRow({ status: 'REFUNDED' }));
    updateBooking.mockResolvedValue({});

    const result = await refundBookingDepositIfEligible({
      bookingId: 'book_1',
      reason: 'shop_cancel',
    });

    expect(result).toBe('refunded');
    expect(refundPaymentIntent).toHaveBeenCalledWith(
      'pi_1',
      expect.objectContaining({ stripeAccount: 'acct_shop', idempotencyKey: 'deposit_refund_book_1' }),
    );
  });

  it('returns failed when Stripe throws and attempts exhausted on first try with maxAttempts 1', async () => {
    findUniqueBooking.mockResolvedValue(paidBooking());
    createRefund.mockResolvedValue(pendingRow({ maxAttempts: 1 }));
    findUniqueRefund.mockResolvedValue(pendingRow({ maxAttempts: 1 }));
    updateManyRefund.mockResolvedValue({ count: 1 });
    refundPaymentIntent.mockRejectedValue(new Error('boom'));
    updateRefund.mockResolvedValue(pendingRow({ status: 'REFUND_FAILED', attempts: 1, maxAttempts: 1 }));

    const result = await refundBookingDepositIfEligible({
      bookingId: 'book_1',
      reason: 'client_cancel_in_window',
    });
    expect(result).toBe('failed');
  });
});
