import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Phase 4C: FULL upfront payments — settlement-driven refund ledger, partial refunds,
 * PARTIALLY_REFUNDED transitions, application fee handling and webhook confirmation.
 */

const findUniqueBooking = vi.fn();
const createRefund = vi.fn();
const findUniqueRefund = vi.fn();
const findFirstRefund = vi.fn();
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
      findMany: vi.fn().mockResolvedValue([]),
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
  attemptBookingPaymentRefund,
  attemptDepositRefund,
  bookingPaymentRefundClientMessage,
  confirmBookingPaymentRefundFromWebhook,
  confirmDepositRefundFromWebhook,
  markNoShowWithPaymentSettlement,
  requestBookingPaymentRefund,
  requestDepositRefund,
  retryBookingPaymentRefundForOperator,
  retryDepositRefundForOperator,
} from './depositMoney';

/** One booking row serving every select used by the refund domain. */
function fullBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'book_1',
    paymentRequired: true,
    paymentStatus: 'PAID',
    bookingPaymentType: 'FULL',
    paymentAmountPence: 3000,
    depositAmountPence: null,
    kersivoPlatformFeeBps: 100,
    kersivoPlatformFeePence: 30,
    stripeConnectAccountIdAtPayment: 'acct_A',
    depositRefundedAt: null,
    depositForfeitedAt: null,
    stripePaymentIntentId: 'pi_1',
    depositRefund: null,
    barber: { shopId: 'shop_1', shop: { stripeConnectAccountId: 'acct_current' } },
    ...overrides,
  };
}

function ledgerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ref_1',
    bookingId: 'book_1',
    shopId: 'shop_1',
    status: 'REFUND_PENDING',
    amountPence: 3000,
    reason: 'client_cancel_in_window',
    idempotencyKey: 'deposit_refund_book_1',
    stripeRefundId: null,
    stripePaymentIntentId: 'pi_1',
    connectAccountId: 'acct_A',
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

function createdLedgerData(): Record<string, unknown> {
  expect(createRefund).toHaveBeenCalledTimes(1);
  return createRefund.mock.calls[0][0].data as Record<string, unknown>;
}

/** Arrange an attempt that Stripe confirms synchronously. */
function arrangeSuccessfulAttempt(booking: Record<string, unknown>, row: Record<string, unknown>) {
  findUniqueBooking.mockResolvedValue(booking);
  findUniqueRefund.mockResolvedValue(row);
  updateManyRefund.mockResolvedValue({ count: 1 });
  refundPaymentIntent.mockResolvedValue({
    id: 're_1',
    mode: 'direct',
    status: 'succeeded',
    amount: row.amountPence,
  });
  updateRefund.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...row, ...data }));
  updateBooking.mockResolvedValue({});
}

function bookingUpdateData(): Record<string, unknown> {
  expect(updateBooking).toHaveBeenCalledTimes(1);
  return updateBooking.mock.calls[0][0].data as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  createRefund.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ledgerRow(data));
});

describe('generic names keep the old deposit names as aliases', () => {
  it('requestDepositRefund / attemptDepositRefund / retry / webhook are the generic functions', () => {
    expect(requestDepositRefund).toBe(requestBookingPaymentRefund);
    expect(attemptDepositRefund).toBe(attemptBookingPaymentRefund);
    expect(retryDepositRefundForOperator).toBe(retryBookingPaymentRefundForOperator);
    expect(confirmDepositRefundFromWebhook).toBe(confirmBookingPaymentRefundFromWebhook);
  });
});

describe('FULL refund ledger amounts come from the settlement policy', () => {
  it('P: in-window cancel → ledger 3000 → booking REFUNDED with refundedAmountPence 3000', async () => {
    findUniqueBooking.mockResolvedValue(fullBooking());
    const requested = await requestBookingPaymentRefund({ bookingId: 'book_1', reason: 'client_cancel_in_window' });
    expect(requested.outcome).toBe('pending');
    expect(createdLedgerData()).toMatchObject({ amountPence: 3000, status: 'REFUND_PENDING', connectAccountId: 'acct_A' });

    arrangeSuccessfulAttempt(fullBooking(), ledgerRow({ amountPence: 3000 }));
    const attempted = await attemptBookingPaymentRefund('ref_1');

    expect(attempted.outcome).toBe('refunded');
    const data = bookingUpdateData();
    expect(data).toEqual({ paymentStatus: 'REFUNDED', refundedAmountPence: 3000 });
    expect(data).not.toHaveProperty('depositRefundedAt');
  });

  it('Q: late cancel → ledger 2500 (actual customer refund, not 3000) → PARTIALLY_REFUNDED / 2500', async () => {
    findUniqueBooking.mockResolvedValue(fullBooking());
    await requestBookingPaymentRefund({ bookingId: 'book_1', reason: 'client_cancel_late' });
    expect(createdLedgerData()).toMatchObject({ amountPence: 2500, reason: 'client_cancel_late' });

    arrangeSuccessfulAttempt(fullBooking(), ledgerRow({ amountPence: 2500, reason: 'client_cancel_late' }));
    await attemptBookingPaymentRefund('ref_1');

    expect(refundPaymentIntent).toHaveBeenCalledWith('pi_1', expect.objectContaining({ amount: 2500 }));
    expect(bookingUpdateData()).toEqual({ paymentStatus: 'PARTIALLY_REFUNDED', refundedAmountPence: 2500 });
  });

  it('R: £3 late cancel → no ledger, no Stripe call (never a 0p refund)', async () => {
    findUniqueBooking.mockResolvedValue(fullBooking({ paymentAmountPence: 300, kersivoPlatformFeePence: 3 }));

    const requested = await requestBookingPaymentRefund({ bookingId: 'book_1', reason: 'client_cancel_late' });

    expect(requested).toEqual({ outcome: 'skipped_no_refund_due', refund: null });
    expect(createRefund).not.toHaveBeenCalled();
    expect(refundPaymentIntent).not.toHaveBeenCalled();
    expect(updateBooking).not.toHaveBeenCalled();
  });

  it('U: shop cancel → ledger 3000', async () => {
    findUniqueBooking.mockResolvedValue(fullBooking());
    await requestBookingPaymentRefund({ bookingId: 'book_1', reason: 'shop_cancel' });
    expect(createdLedgerData()).toMatchObject({ amountPence: 3000 });
  });

  it('late payment with slot lost → ledger refunds the ENTIRE FULL payment', async () => {
    findUniqueBooking.mockResolvedValue(fullBooking());
    await requestBookingPaymentRefund({ bookingId: 'book_1', reason: 'late_payment_slot_lost' });
    expect(createdLedgerData()).toMatchObject({ amountPence: 3000 });
  });

  it('a partially refunded booking is never refunded again (one ledger row per booking)', async () => {
    findUniqueBooking.mockResolvedValue(fullBooking({ paymentStatus: 'PARTIALLY_REFUNDED' }));
    const requested = await requestBookingPaymentRefund({ bookingId: 'book_1', reason: 'shop_cancel' });
    expect(requested.outcome).toBe('skipped_already');
    expect(createRefund).not.toHaveBeenCalled();
  });

  it('an existing ledger row is returned as-is (no second row, no recalculation)', async () => {
    findUniqueBooking.mockResolvedValue(fullBooking({ depositRefund: ledgerRow({ amountPence: 2500 }) }));
    const requested = await requestBookingPaymentRefund({ bookingId: 'book_1', reason: 'shop_cancel' });
    expect(requested.refund?.amountPence).toBe(2500);
    expect(createRefund).not.toHaveBeenCalled();
  });

  it('a non-positive ledger amount fails closed instead of refunding the whole PaymentIntent', async () => {
    findUniqueRefund.mockResolvedValue(ledgerRow({ amountPence: 0 }));
    updateManyRefund.mockResolvedValue({ count: 1 });
    updateRefund.mockResolvedValue(ledgerRow({ amountPence: 0, status: 'REFUND_FAILED' }));

    const result = await attemptBookingPaymentRefund('ref_1');

    expect(result.outcome).toBe('failed');
    expect(refundPaymentIntent).not.toHaveBeenCalled();
    expect(captureOpsException).toHaveBeenCalled();
  });
});

describe('DEPOSIT and NONE behaviour is unchanged', () => {
  const deposit = (overrides: Record<string, unknown> = {}) =>
    fullBooking({
      bookingPaymentType: 'DEPOSIT',
      paymentAmountPence: 500,
      depositAmountPence: 500,
      kersivoPlatformFeePence: 5,
      ...overrides,
    });

  it('V: DEPOSIT late cancel retains the deposit (no ledger)', async () => {
    findUniqueBooking.mockResolvedValue(deposit());
    const requested = await requestBookingPaymentRefund({ bookingId: 'book_1', reason: 'client_cancel_late' });
    expect(requested.outcome).toBe('skipped_no_refund_due');
    expect(createRefund).not.toHaveBeenCalled();
  });

  it('W: DEPOSIT in-window cancel refunds 500 → REFUNDED with legacy depositRefundedAt', async () => {
    findUniqueBooking.mockResolvedValue(deposit());
    await requestBookingPaymentRefund({ bookingId: 'book_1', reason: 'client_cancel_in_window' });
    expect(createdLedgerData()).toMatchObject({ amountPence: 500 });

    arrangeSuccessfulAttempt(deposit(), ledgerRow({ amountPence: 500 }));
    await attemptBookingPaymentRefund('ref_1');
    expect(bookingUpdateData()).toMatchObject({
      paymentStatus: 'REFUNDED',
      refundedAmountPence: 500,
      depositRefundedAt: expect.any(Date),
    });
  });

  it('X: NONE booking never creates a ledger row', async () => {
    findUniqueBooking.mockResolvedValue(
      fullBooking({ paymentRequired: false, paymentStatus: null, bookingPaymentType: 'NONE', paymentAmountPence: 0 }),
    );
    const requested = await requestBookingPaymentRefund({ bookingId: 'book_1', reason: 'shop_cancel' });
    expect(requested.outcome).toBe('skipped_unpaid');
    expect(createRefund).not.toHaveBeenCalled();
  });
});

describe('no-show settlement (single helper for every NO_SHOW path)', () => {
  it('S: FULL £30 no-show → ledger 2500 written BEFORE the status change, then attempted', async () => {
    const order: string[] = [];
    findUniqueBooking.mockResolvedValue(fullBooking());
    createRefund.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      order.push('ledger');
      return ledgerRow(data);
    });
    findUniqueRefund.mockResolvedValue(ledgerRow({ amountPence: 2500, reason: 'no_show' }));
    updateManyRefund.mockResolvedValue({ count: 1 });
    refundPaymentIntent.mockResolvedValue({ id: 're_ns', mode: 'direct', status: 'succeeded', amount: 2500 });
    updateRefund.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      ledgerRow({ amountPence: 2500, ...data }),
    );
    const markNoShow = vi.fn(async () => {
      order.push('status');
    });

    const result = await markNoShowWithPaymentSettlement({ bookingId: 'book_1', markNoShow });

    expect(order).toEqual(['ledger', 'status']);
    expect(createdLedgerData()).toMatchObject({ amountPence: 2500, reason: 'no_show' });
    expect(refundPaymentIntent).toHaveBeenCalledWith('pi_1', expect.objectContaining({ amount: 2500 }));
    expect(result.outcome).toBe('refunded');
    expect(updateBooking).toHaveBeenCalledWith(
      expect.objectContaining({ data: { paymentStatus: 'PARTIALLY_REFUNDED', refundedAmountPence: 2500 } }),
    );
  });

  it('T: FULL £3 no-show → shop keeps £3, no ledger, still marked no-show', async () => {
    findUniqueBooking.mockResolvedValue(fullBooking({ paymentAmountPence: 300 }));
    const markNoShow = vi.fn(async () => undefined);

    const result = await markNoShowWithPaymentSettlement({ bookingId: 'book_1', markNoShow });

    expect(markNoShow).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe('skipped_no_refund_due');
    expect(createRefund).not.toHaveBeenCalled();
    expect(refundPaymentIntent).not.toHaveBeenCalled();
  });

  it('DEPOSIT no-show forfeits the whole deposit (no refund)', async () => {
    findUniqueBooking.mockResolvedValue(
      fullBooking({ bookingPaymentType: 'DEPOSIT', paymentAmountPence: 500, depositAmountPence: 500 }),
    );
    updateManyBooking.mockResolvedValue({ count: 1 });
    const markNoShow = vi.fn(async () => undefined);

    const result = await markNoShowWithPaymentSettlement({ bookingId: 'book_1', markNoShow });

    expect(result.outcome).toBe('skipped_forfeited');
    expect(updateManyBooking).toHaveBeenCalledWith(
      expect.objectContaining({ data: { depositForfeitedAt: expect.any(Date) } }),
    );
    expect(createRefund).not.toHaveBeenCalled();
  });

  it('a Stripe failure never blocks marking the no-show', async () => {
    findUniqueBooking.mockResolvedValue(fullBooking());
    findUniqueRefund.mockRejectedValue(new Error('db blip'));
    const markNoShow = vi.fn(async () => undefined);

    const result = await markNoShowWithPaymentSettlement({ bookingId: 'book_1', markNoShow });

    expect(markNoShow).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe('pending');
  });
});

describe('KERSIVO application fee on FULL refunds', () => {
  it('Y: Free FULL full refund 3000 sends refund_application_fee', async () => {
    arrangeSuccessfulAttempt(fullBooking(), ledgerRow({ amountPence: 3000 }));
    await attemptBookingPaymentRefund('ref_1');
    expect(refundPaymentIntent).toHaveBeenCalledWith('pi_1', {
      stripeAccount: 'acct_A',
      reverseTransfer: true,
      amount: 3000,
      idempotencyKey: 'deposit_refund_book_1',
      refundApplicationFee: true,
      allowPlatformLegacyFallback: false,
    });
  });

  it('Z: Free FULL partial refund 2500 still sends refund_application_fee (Stripe prorates; no manual fee refund)', async () => {
    arrangeSuccessfulAttempt(fullBooking(), ledgerRow({ amountPence: 2500 }));
    await attemptBookingPaymentRefund('ref_1');
    expect(refundPaymentIntent).toHaveBeenCalledTimes(1);
    expect(refundPaymentIntent).toHaveBeenCalledWith(
      'pi_1',
      expect.objectContaining({ amount: 2500, refundApplicationFee: true }),
    );
  });

  it('AA: Full KERSIVO partial refund 2500 has no fee flag', async () => {
    arrangeSuccessfulAttempt(
      fullBooking({ kersivoPlatformFeeBps: 0, kersivoPlatformFeePence: 0 }),
      ledgerRow({ amountPence: 2500 }),
    );
    await attemptBookingPaymentRefund('ref_1');
    const options = refundPaymentIntent.mock.calls[0][1] as Record<string, unknown>;
    expect(options.amount).toBe(2500);
    expect(options).not.toHaveProperty('refundApplicationFee');
  });

  it('AB: refunds go to the original payment account, never the current shop account', async () => {
    findUniqueBooking.mockResolvedValue(fullBooking());
    await requestBookingPaymentRefund({ bookingId: 'book_1', reason: 'client_cancel_late' });
    expect(createdLedgerData()).toMatchObject({ connectAccountId: 'acct_A' });

    arrangeSuccessfulAttempt(fullBooking(), ledgerRow({ amountPence: 2500 }));
    await attemptBookingPaymentRefund('ref_1');
    expect(refundPaymentIntent).toHaveBeenCalledWith(
      'pi_1',
      expect.objectContaining({ stripeAccount: 'acct_A', allowPlatformLegacyFallback: false }),
    );
    expect(refundPaymentIntent).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ stripeAccount: 'acct_current' }),
    );
  });

  it('AC: resource_missing on the original account fails closed — booking untouched', async () => {
    findUniqueBooking.mockResolvedValue(fullBooking());
    findUniqueRefund.mockResolvedValue(ledgerRow({ amountPence: 2500 }));
    updateManyRefund.mockResolvedValue({ count: 1 });
    refundPaymentIntent.mockRejectedValue(
      Object.assign(new Error('No such payment_intent: pi_1'), { code: 'resource_missing' }),
    );
    updateRefund.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ledgerRow({ ...data }));

    const result = await attemptBookingPaymentRefund('ref_1');

    expect(result.outcome).toBe('pending');
    expect(refundPaymentIntent).toHaveBeenCalledTimes(1);
    expect(updateBooking).not.toHaveBeenCalled();
  });
});

describe('webhook refund confirmation', () => {
  function arrangeWebhook(
    booking: Record<string, unknown>,
    row: Record<string, unknown>,
    lookup: 'refund_id' | 'payment_intent' = 'refund_id',
  ) {
    if (lookup === 'refund_id') {
      findFirstRefund.mockResolvedValue(row);
    } else {
      // No row carries the event's refund id yet; the PaymentIntent fallback finds the ledger.
      findFirstRefund.mockResolvedValueOnce(null).mockResolvedValue(row);
    }
    findUniqueBooking.mockResolvedValue(booking);
    updateRefund.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...row, ...data }));
    updateBooking.mockResolvedValue({});
  }

  function expectIntegrityMismatch(result: Awaited<ReturnType<typeof confirmBookingPaymentRefundFromWebhook>>) {
    expect(result).toMatchObject({ matched: true, confirmed: false, reason: 'refund_integrity_mismatch' });
    expect(updateRefund).not.toHaveBeenCalled();
    expect(updateBooking).not.toHaveBeenCalled();
    expect(captureOpsMessage).toHaveBeenCalledWith(
      'Stripe refund webhook does not match the booking refund ledger',
      expect.objectContaining({ opsAlert: true }),
    );
  }

  it('AD: 3000 of 3000 → REFUNDED', async () => {
    arrangeWebhook(fullBooking(), ledgerRow({ amountPence: 3000, stripeRefundId: 're_1' }));
    const result = await confirmBookingPaymentRefundFromWebhook({
      stripeRefundId: 're_1',
      status: 'succeeded',
      amountPence: 3000,
      stripeAccountId: 'acct_A',
    });
    expect(result.confirmed).toBe(true);
    expect(bookingUpdateData()).toEqual({ paymentStatus: 'REFUNDED', refundedAmountPence: 3000 });
  });

  it('A: PI-only race recovery — exact 2500 binds the refund id, ledger REFUNDED, booking PARTIALLY_REFUNDED', async () => {
    arrangeWebhook(fullBooking(), ledgerRow({ amountPence: 2500, stripeRefundId: null }), 'payment_intent');

    const result = await confirmBookingPaymentRefundFromWebhook({
      stripeRefundId: 're_ours',
      paymentIntentId: 'pi_1',
      status: 'succeeded',
      amountPence: 2500,
      stripeAccountId: 'acct_A',
    });

    expect(result).toMatchObject({ matched: true, confirmed: true });
    expect(updateRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REFUNDED', stripeRefundId: 're_ours' }),
      }),
    );
    expect(updateRefund.mock.calls[0][0].data).not.toHaveProperty('amountPence');
    expect(bookingUpdateData()).toEqual({ paymentStatus: 'PARTIALLY_REFUNDED', refundedAmountPence: 2500 });
  });

  it('B: PI-only match with a different refund (500 vs ledger 2500) is not ours — ledger and booking untouched', async () => {
    arrangeWebhook(fullBooking(), ledgerRow({ amountPence: 2500, stripeRefundId: null }), 'payment_intent');

    const result = await confirmBookingPaymentRefundFromWebhook({
      stripeRefundId: 're_manual',
      paymentIntentId: 'pi_1',
      status: 'succeeded',
      amountPence: 500,
      stripeAccountId: 'acct_A',
    });

    expectIntegrityMismatch(result);
    expect(result.refund).toMatchObject({ amountPence: 2500, status: 'REFUND_PENDING', stripeRefundId: null });
  });

  it('B: a mismatching PI-only refund.failed cannot fail our pending ledger either', async () => {
    arrangeWebhook(fullBooking(), ledgerRow({ amountPence: 2500, stripeRefundId: null }), 'payment_intent');
    const result = await confirmBookingPaymentRefundFromWebhook({
      stripeRefundId: 're_manual',
      paymentIntentId: 'pi_1',
      status: 'failed',
      amountPence: 500,
      stripeAccountId: 'acct_A',
    });
    expectIntegrityMismatch(result);
  });

  it('C: ledger bound to re_A ignores an event for re_B', async () => {
    // The ledger is found via the PaymentIntent but already carries a different refund id.
    arrangeWebhook(fullBooking(), ledgerRow({ amountPence: 2500, stripeRefundId: 're_A' }), 'payment_intent');

    const result = await confirmBookingPaymentRefundFromWebhook({
      stripeRefundId: 're_B',
      paymentIntentId: 'pi_1',
      status: 'succeeded',
      amountPence: 2500,
      stripeAccountId: 'acct_A',
    });

    expectIntegrityMismatch(result);
  });

  it('D / AE: ledger re_A + event re_A + 2500 confirms normally → PARTIALLY_REFUNDED', async () => {
    arrangeWebhook(fullBooking(), ledgerRow({ amountPence: 2500, stripeRefundId: 're_A' }));

    const result = await confirmBookingPaymentRefundFromWebhook({
      stripeRefundId: 're_A',
      paymentIntentId: 'pi_1',
      status: 'succeeded',
      amountPence: 2500,
      stripeAccountId: 'acct_A',
    });

    expect(result).toMatchObject({ matched: true, confirmed: true });
    expect(bookingUpdateData()).toEqual({ paymentStatus: 'PARTIALLY_REFUNDED', refundedAmountPence: 2500 });
  });

  it('E: ledger acct_A + event.account acct_B (or missing) → no mutation, ops alert', async () => {
    for (const stripeAccountId of ['acct_B', null]) {
      vi.clearAllMocks();
      arrangeWebhook(fullBooking(), ledgerRow({ amountPence: 2500, stripeRefundId: 're_A' }));
      const result = await confirmBookingPaymentRefundFromWebhook({
        stripeRefundId: 're_A',
        status: 'succeeded',
        amountPence: 2500,
        stripeAccountId,
      });
      expectIntegrityMismatch(result);
    }
  });

  it('F: ledger acct_A + event.account acct_A → normal', async () => {
    arrangeWebhook(fullBooking(), ledgerRow({ amountPence: 2500, stripeRefundId: 're_A' }));
    const result = await confirmBookingPaymentRefundFromWebhook({
      stripeRefundId: 're_A',
      status: 'succeeded',
      amountPence: 2500,
      stripeAccountId: ' acct_A ',
    });
    expect(result.confirmed).toBe(true);
  });

  it('G / AH: legacy ledger without an account snapshot keeps platform-event compatibility (no account filled in)', async () => {
    arrangeWebhook(
      fullBooking({ bookingPaymentType: null, paymentAmountPence: null, depositAmountPence: 500 }),
      ledgerRow({ amountPence: 500, stripeRefundId: 're_legacy', connectAccountId: null }),
    );
    const result = await confirmBookingPaymentRefundFromWebhook({
      stripeRefundId: 're_legacy',
      status: 'succeeded',
      amountPence: 500,
      stripeAccountId: null,
    });
    expect(result.confirmed).toBe(true);
    expect(updateRefund.mock.calls[0][0].data).not.toHaveProperty('connectAccountId');
    expect(bookingUpdateData()).toMatchObject({
      paymentStatus: 'REFUNDED',
      refundedAmountPence: 500,
      depositRefundedAt: expect.any(Date),
    });
  });

  it('H: PI-only fallback without a webhook amount never confirms or rewrites the policy amount', async () => {
    for (const amountPence of [null, undefined, 0, -100, 25.5]) {
      vi.clearAllMocks();
      arrangeWebhook(fullBooking(), ledgerRow({ amountPence: 2500, stripeRefundId: null }), 'payment_intent');
      const result = await confirmBookingPaymentRefundFromWebhook({
        stripeRefundId: 're_unknown',
        paymentIntentId: 'pi_1',
        status: 'succeeded',
        amountPence,
        stripeAccountId: 'acct_A',
      });
      expectIntegrityMismatch(result);
    }
  });

  it('I / AG: a webhook can never change the ledger amount from 2500 to another positive amount', async () => {
    for (const amountPence of [500, 3000, 3500]) {
      vi.clearAllMocks();
      arrangeWebhook(fullBooking(), ledgerRow({ amountPence: 2500, stripeRefundId: 're_A' }));
      const result = await confirmBookingPaymentRefundFromWebhook({
        stripeRefundId: 're_A',
        status: 'succeeded',
        amountPence,
        stripeAccountId: 'acct_A',
      });
      expectIntegrityMismatch(result);
    }
  });

  it('a corrupt ledger amount above the payment is still never recorded', async () => {
    arrangeWebhook(fullBooking(), ledgerRow({ amountPence: 3500, stripeRefundId: 're_A' }));
    const result = await confirmBookingPaymentRefundFromWebhook({
      stripeRefundId: 're_A',
      status: 'succeeded',
      amountPence: 3500,
      stripeAccountId: 'acct_A',
    });
    expect(result.confirmed).toBe(false);
    expect(updateBooking).not.toHaveBeenCalled();
    expect(captureOpsMessage).toHaveBeenCalledWith(
      'Stripe refund webhook amount exceeds the booking payment',
      expect.objectContaining({ opsAlert: true }),
    );
  });

  it('J / AF: replay of a confirmed refund is idempotent (no double-count, no writes)', async () => {
    arrangeWebhook(
      fullBooking({ paymentStatus: 'PARTIALLY_REFUNDED', refundedAmountPence: 2500 }),
      ledgerRow({ amountPence: 2500, status: 'REFUNDED', stripeRefundId: 're_1' }),
    );
    for (let i = 0; i < 2; i += 1) {
      const result = await confirmBookingPaymentRefundFromWebhook({
        stripeRefundId: 're_1',
        status: 'succeeded',
        amountPence: 2500,
        stripeAccountId: 'acct_A',
      });
      expect(result).toMatchObject({ matched: true, confirmed: false });
      expect(result.reason).toBeUndefined();
    }
    expect(updateBooking).not.toHaveBeenCalled();
    expect(updateRefund).not.toHaveBeenCalled();
  });

  it('charge.refunded-style lookups never use the PaymentIntent fallback', async () => {
    findFirstRefund.mockResolvedValue(null);
    const result = await confirmBookingPaymentRefundFromWebhook({
      stripeRefundId: 're_other',
      paymentIntentId: 'pi_1',
      status: 'succeeded',
      amountPence: 2500,
      stripeAccountId: 'acct_A',
      requireStoredRefundId: true,
    });
    expect(result.matched).toBe(false);
    expect(findFirstRefund).toHaveBeenCalledTimes(1);
    expect(findFirstRefund).toHaveBeenCalledWith({ where: { stripeRefundId: 're_other' } });
  });
});

describe('operator refund retry uses the stored ledger amount', () => {
  it('retries a FAILED FULL partial row for exactly 2500 (policy not recalculated)', async () => {
    const failed = ledgerRow({ amountPence: 2500, status: 'REFUND_FAILED', attempts: 6, reason: 'no_show' });
    findUniqueRefund.mockResolvedValueOnce(failed).mockResolvedValue({ ...failed, status: 'REFUND_PENDING', attempts: 0 });
    updateManyRefund.mockResolvedValue({ count: 1 });
    findUniqueBooking.mockResolvedValue(fullBooking());
    refundPaymentIntent.mockResolvedValue({ id: 're_retry', mode: 'direct', status: 'succeeded', amount: 2500 });
    updateRefund.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...failed, ...data }));

    const result = await retryBookingPaymentRefundForOperator('book_1');

    expect(result.outcome).toBe('refunded');
    expect(refundPaymentIntent).toHaveBeenCalledWith(
      'pi_1',
      expect.objectContaining({ amount: 2500, refundApplicationFee: true }),
    );
  });

  it('retries a FULL full refund row for 3000 and a legacy deposit row for 500', async () => {
    for (const [booking, amount] of [
      [fullBooking(), 3000],
      [fullBooking({ bookingPaymentType: null, paymentAmountPence: null, depositAmountPence: 500, kersivoPlatformFeePence: null, stripeConnectAccountIdAtPayment: null }), 500],
    ] as const) {
      vi.clearAllMocks();
      const failed = ledgerRow({ amountPence: amount, status: 'REFUND_FAILED' });
      findUniqueRefund.mockResolvedValue(failed);
      updateManyRefund.mockResolvedValue({ count: 1 });
      findUniqueBooking.mockResolvedValue(booking);
      refundPaymentIntent.mockResolvedValue({ id: 're_r', mode: 'direct', status: 'succeeded', amount });
      updateRefund.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...failed, ...data }));

      await retryBookingPaymentRefundForOperator('book_1');

      expect(refundPaymentIntent).toHaveBeenCalledWith('pi_1', expect.objectContaining({ amount }));
    }
  });

  it('a FULL booking without a ledger is never given a guessed refund by operator retry', async () => {
    findUniqueRefund.mockResolvedValue(null);
    findUniqueBooking.mockResolvedValue(fullBooking({ paymentAmountPence: 300 }));

    const result = await retryBookingPaymentRefundForOperator('book_1');

    expect(result.outcome).toBe('skipped_no_refund_due');
    expect(createRefund).not.toHaveBeenCalled();
    expect(refundPaymentIntent).not.toHaveBeenCalled();
  });
});

describe('customer-facing refund messages', () => {
  it('FULL wording for confirmed / partial / kept payments; deposits keep deposit wording', () => {
    expect(bookingPaymentRefundClientMessage('refunded', { bookingPaymentType: 'FULL' })).toBe(
      'Your booking has been cancelled. Your payment refund has been confirmed.',
    );
    expect(bookingPaymentRefundClientMessage('pending', { bookingPaymentType: 'FULL', partial: true })).toBe(
      'Your booking has been cancelled. A partial refund is being processed.',
    );
    expect(bookingPaymentRefundClientMessage('skipped_no_refund_due', { bookingPaymentType: 'FULL' })).toContain(
      'cancellation window has passed',
    );
    expect(bookingPaymentRefundClientMessage('refunded', { bookingPaymentType: 'DEPOSIT' })).toBe(
      'Your booking has been cancelled. Your deposit refund has been confirmed.',
    );
  });
});
