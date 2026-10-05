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
const captureOpsException = vi.fn();
const captureOpsMessage = vi.fn();

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

vi.mock('../ops/sentry', () => ({
  captureOpsException: (...args: unknown[]) => captureOpsException(...args),
  captureOpsMessage: (...args: unknown[]) => captureOpsMessage(...args),
}));

import {
  attemptDepositRefund,
  confirmDepositRefundFromWebhook,
  forfeitBookingDeposit,
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
      allowPlatformLegacyFallback: true,
    });
    expect(updateBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'book_1' },
        data: expect.objectContaining({ paymentStatus: 'REFUNDED', refundedAmountPence: 500 }),
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
    expect(captureOpsException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        opsAlert: true,
        route: 'depositMoney.attemptDepositRefund',
      }),
    );
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
      stripeAccountId: 'acct_shop',
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
      amountPence: 500,
      stripeAccountId: 'acct_shop',
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
      stripeAccountId: 'acct_shop',
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
      stripeAccountId: 'acct_shop',
    });

    expect(result.matched).toBe(true);
    expect(captureOpsMessage).toHaveBeenCalledWith(
      'Booking payment refund failed via Stripe webhook',
      expect.objectContaining({
        level: 'error',
        tags: expect.objectContaining({
          bookingId: 'book_1',
          stripeStatus: 'failed',
        }),
      }),
    );
    expect(captureOpsException).not.toHaveBeenCalled();
  });
});

describe('retryDepositRefundForOperator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

describe('KERSIVO application fee on deposit refunds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateManyRefund.mockResolvedValue({ count: 1 });
    updateBooking.mockResolvedValue({});
  });

  function arrangeRefund(depositPence: number, feePence: number | null) {
    findUniqueBooking.mockResolvedValue(
      paidBooking({
        depositAmountPence: depositPence,
        kersivoPlatformFeePence: feePence,
        stripeConnectAccountIdAtPayment: 'acct_shop',
      }),
    );
    createRefund.mockResolvedValue(pendingRow({ amountPence: depositPence }));
    findUniqueRefund.mockResolvedValue(pendingRow({ amountPence: depositPence }));
    refundPaymentIntent.mockResolvedValue({
      id: 're_1',
      mode: 'direct',
      status: 'succeeded',
      amount: depositPence,
    });
    updateRefund.mockResolvedValue(pendingRow({ status: 'REFUNDED', amountPence: depositPence }));
  }

  it('R: historical 1% deposit refund requests refund_application_fee (fee snapshot > 0)', async () => {
    arrangeRefund(500, 5);

    const result = await attemptDepositRefund('ref_1');

    expect(result.outcome).toBe('refunded');
    expect(findUniqueBooking).toHaveBeenCalledWith({
      where: { id: 'book_1' },
      select: { kersivoPlatformFeePence: true, stripeConnectAccountIdAtPayment: true },
    });
    expect(refundPaymentIntent).toHaveBeenCalledWith(
      'pi_1',
      expect.objectContaining({ amount: 500, refundApplicationFee: true }),
    );
  });

  it('S: Full / historical 0%-fee deposits never request an application-fee refund', async () => {
    for (const fee of [0, null]) {
      vi.clearAllMocks();
      updateManyRefund.mockResolvedValue({ count: 1 });
      updateBooking.mockResolvedValue({});
      arrangeRefund(500, fee);

      await attemptDepositRefund('ref_1');

      const options = refundPaymentIntent.mock.calls[0][1] as Record<string, unknown>;
      expect(options.amount).toBe(500);
      expect(options).not.toHaveProperty('refundApplicationFee');
    }
  });

  it('T: Free in-window client cancel and shop cancel refund the FULL deposit plus the fee', async () => {
    for (const [deposit, fee] of [
      [500, 5],
      [300, 3],
    ] as const) {
      for (const reason of ['client_cancel_in_window', 'shop_cancel'] as const) {
        vi.clearAllMocks();
        updateManyRefund.mockResolvedValue({ count: 1 });
        updateBooking.mockResolvedValue({});
        arrangeRefund(deposit, fee);

        const outcome = await refundBookingDepositIfEligible({ bookingId: 'book_1', reason });

        expect(outcome).toBe('refunded');
        expect(createRefund).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ amountPence: deposit, reason }) }),
        );
        expect(refundPaymentIntent).toHaveBeenCalledWith(
          'pi_1',
          expect.objectContaining({ amount: deposit, refundApplicationFee: true }),
        );
        expect(updateBooking).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ paymentStatus: 'REFUNDED', refundedAmountPence: deposit }),
          }),
        );
      }
    }
  });

  it('U: late cancel / no-show forfeits the deposit — no Stripe refund, KERSIVO fee retained', async () => {
    updateManyBooking.mockResolvedValue({ count: 1 });

    await forfeitBookingDeposit('book_1');

    expect(updateManyBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'book_1', depositRefundedAt: null, depositForfeitedAt: null }),
        data: { depositForfeitedAt: expect.any(Date) },
      }),
    );
    expect(refundPaymentIntent).not.toHaveBeenCalled();
    expect(createRefund).not.toHaveBeenCalled();
  });

  describe('payment account snapshot', () => {
    function bookingOnOriginalAccount(overrides: Record<string, unknown> = {}) {
      return paidBooking({
        kersivoPlatformFeePence: 5,
        stripeConnectAccountIdAtPayment: 'acct_original',
        barber: { shopId: 'shop_1', shop: { stripeConnectAccountId: 'acct_new' } },
        ...overrides,
      });
    }

    it('J: refund ledger uses the original Booking account after the shop account changed', async () => {
      findUniqueBooking.mockResolvedValue(bookingOnOriginalAccount());
      createRefund.mockResolvedValue(pendingRow({ connectAccountId: 'acct_original' }));

      await requestDepositRefund({ bookingId: 'book_1', reason: 'shop_cancel' });

      expect(createRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REFUND_PENDING',
            connectAccountId: 'acct_original',
          }),
        }),
      );
    });

    it('K: Free application-fee refund is sent against the original connected account', async () => {
      findUniqueBooking.mockResolvedValue(bookingOnOriginalAccount());
      createRefund.mockResolvedValue(pendingRow({ connectAccountId: 'acct_original' }));
      findUniqueRefund.mockResolvedValue(pendingRow({ connectAccountId: 'acct_original' }));
      refundPaymentIntent.mockResolvedValue({ id: 're_1', mode: 'direct', status: 'succeeded', amount: 500 });
      updateRefund.mockResolvedValue(pendingRow({ status: 'REFUNDED', connectAccountId: 'acct_original' }));

      const outcome = await refundBookingDepositIfEligible({ bookingId: 'book_1', reason: 'shop_cancel' });

      expect(outcome).toBe('refunded');
      expect(refundPaymentIntent).toHaveBeenCalledWith(
        'pi_1',
        expect.objectContaining({ stripeAccount: 'acct_original', refundApplicationFee: true, amount: 500 }),
      );
      expect(refundPaymentIntent).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ stripeAccount: 'acct_new' }),
      );
    });

    it('fee-bearing booking without an account snapshot never refunds via the current shop account', async () => {
      findUniqueBooking.mockResolvedValue(bookingOnOriginalAccount({ stripeConnectAccountIdAtPayment: null }));
      createRefund.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        pendingRow({ ...data, id: 'ref_failed' }),
      );

      const outcome = await refundBookingDepositIfEligible({ bookingId: 'book_1', reason: 'shop_cancel' });

      expect(outcome).toBe('failed');
      expect(createRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REFUND_FAILED',
            connectAccountId: null,
            stripePaymentIntentId: '',
          }),
        }),
      );
      expect(refundPaymentIntent).not.toHaveBeenCalled();
      expect(captureOpsException).toHaveBeenCalled();
    });

    it('a fee-bearing ledger row without a connected account is failed without calling Stripe', async () => {
      findUniqueRefund.mockResolvedValue(pendingRow({ connectAccountId: null }));
      findUniqueBooking.mockResolvedValue({ kersivoPlatformFeePence: 5 });
      updateRefund.mockResolvedValue(pendingRow({ status: 'REFUND_FAILED', connectAccountId: null }));

      const result = await attemptDepositRefund('ref_1');

      expect(result.outcome).toBe('failed');
      expect(refundPaymentIntent).not.toHaveBeenCalled();
    });

    describe('platform legacy fallback is decided by the account snapshot', () => {
      function arrangeLedger(booking: Record<string, unknown>, connectAccountId: string | null = 'acct_A') {
        findUniqueRefund.mockResolvedValue(pendingRow({ connectAccountId }));
        findUniqueBooking.mockResolvedValue(booking);
        updateManyRefund.mockResolvedValue({ count: 1 });
        updateBooking.mockResolvedValue({});
      }

      it('A / E: Free snapshotted refund goes to acct_A with the fee refund and no platform fallback', async () => {
        arrangeLedger({ kersivoPlatformFeePence: 5, stripeConnectAccountIdAtPayment: 'acct_A' });
        refundPaymentIntent.mockResolvedValue({ id: 're_1', mode: 'direct', status: 'succeeded', amount: 500 });
        updateRefund.mockResolvedValue(pendingRow({ status: 'REFUNDED' }));

        const result = await attemptDepositRefund('ref_1');

        expect(result.outcome).toBe('refunded');
        expect(refundPaymentIntent).toHaveBeenCalledWith('pi_1', {
          stripeAccount: 'acct_A',
          reverseTransfer: true,
          amount: 500,
          idempotencyKey: 'deposit_refund_book_1',
          refundApplicationFee: true,
          allowPlatformLegacyFallback: false,
        });
        expect(findUniqueBooking).toHaveBeenCalledWith({
          where: { id: 'book_1' },
          select: { kersivoPlatformFeePence: true, stripeConnectAccountIdAtPayment: true },
        });
      });

      it('F / C: Full 0%-fee snapshotted refund omits the fee refund but is still NOT legacy', async () => {
        arrangeLedger({ kersivoPlatformFeePence: 0, stripeConnectAccountIdAtPayment: 'acct_A' });
        refundPaymentIntent.mockResolvedValue({ id: 're_1', mode: 'direct', status: 'succeeded', amount: 500 });
        updateRefund.mockResolvedValue(pendingRow({ status: 'REFUNDED' }));

        await attemptDepositRefund('ref_1');

        const options = refundPaymentIntent.mock.calls[0][1] as Record<string, unknown>;
        expect(options.stripeAccount).toBe('acct_A');
        expect(options.allowPlatformLegacyFallback).toBe(false);
        expect(options).not.toHaveProperty('refundApplicationFee');
      });

      it('B / C / G: resource_missing on acct_A fails closed — booking never marked REFUNDED', async () => {
        for (const fee of [5, 0]) {
          vi.clearAllMocks();
          arrangeLedger({ kersivoPlatformFeePence: fee, stripeConnectAccountIdAtPayment: 'acct_A' });
          refundPaymentIntent.mockRejectedValue(
            Object.assign(new Error('No such payment_intent: pi_1'), { code: 'resource_missing' }),
          );
          updateRefund.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
            pendingRow({ ...data }),
          );

          const result = await attemptDepositRefund('ref_1');

          expect(result.outcome).toBe('pending');
          expect(refundPaymentIntent).toHaveBeenCalledTimes(1);
          expect(refundPaymentIntent).toHaveBeenCalledWith(
            'pi_1',
            expect.objectContaining({ stripeAccount: 'acct_A', allowPlatformLegacyFallback: false }),
          );
          expect(updateRefund).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({ status: 'REFUND_PENDING', lastError: expect.stringContaining('No such payment_intent') }),
            }),
          );
          expect(updateBooking).not.toHaveBeenCalled();
          expect(updateManyBooking).not.toHaveBeenCalled();
        }
      });

      it('G: exhausted snapshotted refund becomes REFUND_FAILED with the ops signal, booking untouched', async () => {
        findUniqueRefund.mockResolvedValue(pendingRow({ connectAccountId: 'acct_A', attempts: 5, maxAttempts: 6 }));
        findUniqueBooking.mockResolvedValue({ kersivoPlatformFeePence: 0, stripeConnectAccountIdAtPayment: 'acct_A' });
        updateManyRefund.mockResolvedValue({ count: 1 });
        refundPaymentIntent.mockRejectedValue(new Error('No such payment_intent: pi_1'));
        updateRefund.mockResolvedValue(pendingRow({ status: 'REFUND_FAILED', attempts: 6 }));

        const result = await attemptDepositRefund('ref_1');

        expect(result.outcome).toBe('failed');
        expect(captureOpsException).toHaveBeenCalled();
        expect(updateBooking).not.toHaveBeenCalled();
      });

      it('D: legacy null-snapshot refund keeps the platform legacy fallback enabled', async () => {
        for (const snapshot of [null, '', '  ']) {
          vi.clearAllMocks();
          arrangeLedger({ kersivoPlatformFeePence: 0, stripeConnectAccountIdAtPayment: snapshot }, 'acct_shop');
          refundPaymentIntent.mockResolvedValue({
            id: 're_legacy',
            mode: 'platform_legacy',
            status: 'succeeded',
            amount: 500,
          });
          updateRefund.mockResolvedValue(pendingRow({ status: 'REFUNDED' }));

          const result = await attemptDepositRefund('ref_1');

          expect(result.outcome).toBe('refunded');
          expect(refundPaymentIntent).toHaveBeenCalledWith(
            'pi_1',
            expect.objectContaining({
              stripeAccount: 'acct_shop',
              reverseTransfer: true,
              allowPlatformLegacyFallback: true,
            }),
          );
        }
      });

      it('snapshotted ledger row without a connected account never refunds on the platform', async () => {
        arrangeLedger({ kersivoPlatformFeePence: 0, stripeConnectAccountIdAtPayment: 'acct_A' }, null);
        updateRefund.mockResolvedValue(pendingRow({ status: 'REFUND_FAILED' }));

        const result = await attemptDepositRefund('ref_1');

        expect(result.outcome).toBe('failed');
        expect(refundPaymentIntent).not.toHaveBeenCalled();
        expect(updateBooking).not.toHaveBeenCalled();
      });
    });

    it('existing ledger connectAccountId stays authoritative for retries', async () => {
      findUniqueRefund.mockResolvedValue(pendingRow({ connectAccountId: 'acct_original' }));
      findUniqueBooking.mockResolvedValue({ kersivoPlatformFeePence: 5 });
      refundPaymentIntent.mockResolvedValue({ id: 're_1', mode: 'direct', status: 'succeeded', amount: 500 });
      updateRefund.mockResolvedValue(pendingRow({ status: 'REFUNDED' }));

      await attemptDepositRefund('ref_1');

      expect(refundPaymentIntent).toHaveBeenCalledWith(
        'pi_1',
        expect.objectContaining({ stripeAccount: 'acct_original' }),
      );
    });

    it('Q: legacy 0%-fee booking with null snapshot falls back to the current shop account', async () => {
      findUniqueBooking.mockResolvedValue(
        paidBooking({ kersivoPlatformFeePence: 0, stripeConnectAccountIdAtPayment: null }),
      );
      createRefund.mockResolvedValue(pendingRow());

      await requestDepositRefund({ bookingId: 'book_1', reason: 'shop_cancel' });

      expect(createRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REFUND_PENDING', connectAccountId: 'acct_shop' }),
        }),
      );
    });
  });

  it('U: a forfeited Free deposit is never refunded afterwards', async () => {
    findUniqueBooking.mockResolvedValue(
      paidBooking({ kersivoPlatformFeePence: 5, depositForfeitedAt: new Date() }),
    );

    const outcome = await refundBookingDepositIfEligible({ bookingId: 'book_1', reason: 'shop_cancel' });

    expect(outcome).toBe('skipped_forfeited');
    expect(refundPaymentIntent).not.toHaveBeenCalled();
  });
});
