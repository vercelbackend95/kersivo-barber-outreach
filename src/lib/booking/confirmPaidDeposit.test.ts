import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus, EmailOutboundPurpose, PaymentStatus } from '@prisma/client';

const findFirstBooking = vi.fn();
const findFirstOrThrowBooking = vi.fn();
const updateManyBooking = vi.fn();
const findFirstOverlap = vi.fn();
const findFirstTimeOff = vi.fn();
const findUniqueShop = vi.fn();
const transaction = vi.fn();
const enqueueEmail = vi.fn();
const tryDeliverOutboxEmail = vi.fn();
const notifyOpsDurable = vi.fn();
const captureOpsException = vi.fn();
const requestDepositRefund = vi.fn();
const attemptDepositRefund = vi.fn();
const generateToken = vi.fn(() => 'plain-manage-token');
const hashToken = vi.fn((token: string) => `hash:${token}`);
const buildInstantBookingConfirmationEmail = vi.fn((..._args: unknown[]) => ({
  subject: 'Your booking is confirmed',
  html: '<p>confirmed</p><a href="https://kersivo.co.uk/book/cancel?token=plain-manage-token">cancel</a>',
}));
const buildLateDepositRefundEmail = vi.fn((..._args: unknown[]) => ({
  subject: 'Your deposit is being refunded',
  html: '<p>refund</p>',
}));
const getPublicSiteUrl = vi.fn(() => 'https://kersivo.co.uk');

vi.mock('../db/client', () => ({
  prisma: {
    booking: {
      findFirst: (...args: unknown[]) => findFirstBooking(...args),
      findFirstOrThrow: (...args: unknown[]) => findFirstOrThrowBooking(...args),
      updateMany: (...args: unknown[]) => updateManyBooking(...args),
    },
    shopSettings: {
      findUnique: (...args: unknown[]) => findUniqueShop(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

vi.mock('../email/outbox', () => ({
  enqueueEmail: (...args: unknown[]) => enqueueEmail(...args),
  tryDeliverOutboxEmail: (...args: unknown[]) => tryDeliverOutboxEmail(...args),
}));

vi.mock('../email/sender', () => ({
  buildInstantBookingConfirmationEmail: (...args: unknown[]) =>
    buildInstantBookingConfirmationEmail(...args),
  buildLateDepositRefundEmail: (...args: unknown[]) => buildLateDepositRefundEmail(...args),
}));

vi.mock('../ops/stripeWebhookLedger', () => ({
  notifyOpsDurable: (...args: unknown[]) => notifyOpsDurable(...args),
}));

vi.mock('../ops/sentry', () => ({
  captureOpsException: (...args: unknown[]) => captureOpsException(...args),
}));

vi.mock('../setup/siteUrl', () => ({
  getPublicSiteUrl: () => getPublicSiteUrl(),
}));

vi.mock('./depositMoney', () => ({
  requestDepositRefund: (...args: unknown[]) => requestDepositRefund(...args),
  attemptDepositRefund: (...args: unknown[]) => attemptDepositRefund(...args),
}));

vi.mock('./tokens', () => ({
  generateToken: () => generateToken(),
  hashToken: (token: string) => hashToken(token),
}));

import { confirmPaidDeposit } from './confirmPaidDeposit';

function pendingBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'book_1',
    barberId: 'barber_1',
    status: BookingStatus.PENDING_PAYMENT,
    paymentStatus: PaymentStatus.UNPAID,
    stripeCheckoutSessionId: 'cs_existing',
    stripePaymentIntentId: null,
    manageTokenHash: 'hash:old',
    email: 'client@example.com',
    fullName: 'Client One',
    startAt: new Date('2026-08-10T10:00:00.000Z'),
    endAt: new Date('2026-08-10T10:30:00.000Z'),
    depositAmountPence: 500,
    serviceNameAtBooking: 'Fade',
    barber: { id: 'barber_1', name: 'Alex', shopId: 'shop_1' },
    service: { id: 'svc_1', name: 'Fade' },
    ...overrides,
  };
}

function paidBooking(overrides: Record<string, unknown> = {}) {
  return pendingBooking({
    status: BookingStatus.BOOKED,
    paymentStatus: PaymentStatus.PAID,
    stripeCheckoutSessionId: 'cs_1',
    stripePaymentIntentId: 'pi_1',
    manageTokenHash: 'hash:plain-manage-token',
    paidAt: new Date('2026-08-01T12:00:00.000Z'),
    paymentExpiresAt: null,
    ...overrides,
  });
}

describe('confirmPaidDeposit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyOpsDurable.mockResolvedValue({ sent: true });
    tryDeliverOutboxEmail.mockResolvedValue(undefined);
    findUniqueShop.mockResolvedValue({ name: 'Test Shop' });
    enqueueEmail.mockResolvedValue({ id: 'out_1' });
  });

  function mockWinningTransaction() {
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        booking: {
          updateMany: (...args: unknown[]) => updateManyBooking(...args),
          findFirstOrThrow: (...args: unknown[]) => findFirstOrThrowBooking(...args),
          findFirst: (...args: unknown[]) => findFirstOverlap(...args),
        },
        barberTimeOff: {
          findFirst: (...args: unknown[]) => findFirstTimeOff(...args),
        },
        shopSettings: {
          findUnique: (...args: unknown[]) => findUniqueShop(...args),
        },
      };
      return fn(tx);
    });
  }

  it('CAS-confirms once: enqueues one email and delivers after commit', async () => {
    const pending = pendingBooking();
    const confirmed = paidBooking();
    findFirstBooking.mockResolvedValueOnce(pending);
    findFirstOrThrowBooking.mockResolvedValue(confirmed);
    updateManyBooking.mockResolvedValue({ count: 1 });
    mockWinningTransaction();

    const result = await confirmPaidDeposit({
      bookingId: 'book_1',
      shopId: 'shop_1',
      sessionId: 'cs_1',
      paymentIntentId: 'pi_1',
      paidAt: new Date('2026-08-01T12:00:00.000Z'),
    });

    expect(result.outcome).toBe('confirmed');
    expect(updateManyBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'book_1',
          status: BookingStatus.PENDING_PAYMENT,
          paymentStatus: PaymentStatus.UNPAID,
        },
        data: expect.objectContaining({
          status: BookingStatus.BOOKED,
          paymentStatus: PaymentStatus.PAID,
          stripeCheckoutSessionId: 'cs_1',
          stripePaymentIntentId: 'pi_1',
          manageTokenHash: 'hash:plain-manage-token',
          paymentExpiresAt: null,
        }),
      }),
    );
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    expect(enqueueEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        shopId: 'shop_1',
        bookingId: 'book_1',
        purpose: EmailOutboundPurpose.BOOKING_CONFIRMATION,
        to: 'client@example.com',
      }),
    );
    expect(tryDeliverOutboxEmail).toHaveBeenCalledWith('out_1');
  });

  it('concurrent webhook + success + two retries: exactly one confirmation email', async () => {
    const pending = pendingBooking();
    const confirmed = paidBooking();
    let casCalls = 0;

    findFirstBooking.mockImplementation(async () => {
      // First wave sees pending; losers re-read after CAS miss and see paid.
      if (casCalls === 0) return pending;
      return confirmed;
    });
    findFirstOrThrowBooking.mockResolvedValue(confirmed);
    updateManyBooking.mockImplementation(async () => {
      casCalls += 1;
      return { count: casCalls === 1 ? 1 : 0 };
    });
    mockWinningTransaction();

    const input = {
      bookingId: 'book_1',
      shopId: 'shop_1',
      sessionId: 'cs_1',
      paymentIntentId: 'pi_1',
    };

    const results = await Promise.all([
      confirmPaidDeposit(input), // webhook
      confirmPaidDeposit(input), // success page
      confirmPaidDeposit(input), // retry 1
      confirmPaidDeposit(input), // retry 2
    ]);

    const confirmedCount = results.filter((r) => r.outcome === 'confirmed').length;
    const duplicateCount = results.filter((r) => r.outcome === 'duplicate').length;

    expect(confirmedCount).toBe(1);
    expect(duplicateCount).toBe(3);
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    expect(tryDeliverOutboxEmail).toHaveBeenCalledTimes(1);
    // One successful CAS (count:1); losers get count:0 and must not enqueue.
    expect(casCalls).toBeGreaterThanOrEqual(1);
    expect(notifyOpsDurable).not.toHaveBeenCalled();
  });

  it('duplicate same session does not rotate token or enqueue email', async () => {
    findFirstBooking.mockResolvedValue(paidBooking({ stripeCheckoutSessionId: 'cs_1' }));

    const result = await confirmPaidDeposit({
      bookingId: 'book_1',
      shopId: 'shop_1',
      sessionId: 'cs_1',
      paymentIntentId: 'pi_1',
    });

    expect(result.outcome).toBe('duplicate');
    expect(transaction).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(tryDeliverOutboxEmail).not.toHaveBeenCalled();
    expect(generateToken).not.toHaveBeenCalled();
  });

  it('conflicting payment alerts ops and does not mutate booking', async () => {
    findFirstBooking.mockResolvedValue(paidBooking({ stripeCheckoutSessionId: 'cs_other' }));

    const result = await confirmPaidDeposit({
      bookingId: 'book_1',
      shopId: 'shop_1',
      sessionId: 'cs_new',
      paymentIntentId: 'pi_new',
    });

    expect(result.outcome).toBe('conflicting_payment');
    expect(transaction).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(notifyOpsDurable).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'critical',
        dedupeKey: 'deposit:double-charge:book_1',
      }),
    );
    expect(captureOpsException).toHaveBeenCalled();
  });

  it('delivery failure after commit still returns confirmed', async () => {
    const pending = pendingBooking();
    const confirmed = paidBooking();
    findFirstBooking.mockResolvedValueOnce(pending);
    findFirstOrThrowBooking.mockResolvedValue(confirmed);
    updateManyBooking.mockResolvedValue({ count: 1 });
    mockWinningTransaction();
    // tryDeliverOutboxEmail swallows errors in production; assert call-site still confirms.
    tryDeliverOutboxEmail.mockImplementation(async () => {
      /* swallow */
    });

    const result = await confirmPaidDeposit({
      bookingId: 'book_1',
      shopId: 'shop_1',
      sessionId: 'cs_1',
      paymentIntentId: 'pi_1',
    });

    expect(result.outcome).toBe('confirmed');
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
  });

  it('returns not_found when booking is missing', async () => {
    findFirstBooking.mockResolvedValue(null);

    const result = await confirmPaidDeposit({
      bookingId: 'missing',
      shopId: 'shop_1',
      sessionId: 'cs_1',
      paymentIntentId: 'pi_1',
    });

    expect(result).toEqual({ outcome: 'not_found' });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('reinstates an expired booking when the slot is still free', async () => {
    const expired = pendingBooking({ status: BookingStatus.EXPIRED });
    const reinstated = paidBooking({
      status: BookingStatus.BOOKED,
      stripeCheckoutSessionId: 'cs_late',
      stripePaymentIntentId: 'pi_late',
    });

    // 1) initial load → EXPIRED; 2) after first CAS miss re-read → EXPIRED; late path uses tx
    findFirstBooking.mockResolvedValue(expired);
    findFirstOrThrowBooking.mockResolvedValue(reinstated);
    findFirstOverlap.mockResolvedValue(null);
    findFirstTimeOff.mockResolvedValue(null);
    updateManyBooking
      .mockResolvedValueOnce({ count: 0 }) // PENDING_PAYMENT CAS miss
      .mockResolvedValueOnce({ count: 1 }); // EXPIRED reinstate CAS win
    mockWinningTransaction();

    const result = await confirmPaidDeposit({
      bookingId: 'book_1',
      shopId: 'shop_1',
      sessionId: 'cs_late',
      paymentIntentId: 'pi_late',
    });

    expect(result.outcome).toBe('reinstated');
    expect(enqueueEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        purpose: EmailOutboundPurpose.BOOKING_CONFIRMATION,
      }),
    );
    expect(tryDeliverOutboxEmail).toHaveBeenCalledWith('out_1');
    expect(requestDepositRefund).not.toHaveBeenCalled();
    expect(notifyOpsDurable).not.toHaveBeenCalled();
  });

  it('late payment with taken slot stamps PI, refunds, and alerts under late-paid title', async () => {
    const expired = pendingBooking({ status: BookingStatus.EXPIRED });
    const stamped = pendingBooking({
      status: BookingStatus.EXPIRED,
      paymentStatus: PaymentStatus.PAID,
      stripeCheckoutSessionId: 'cs_late',
      stripePaymentIntentId: 'pi_late',
      paidAt: new Date('2026-08-01T12:30:00.000Z'),
      paymentExpiresAt: null,
    });

    findFirstBooking.mockResolvedValue(expired);
    findFirstOrThrowBooking.mockResolvedValue(stamped);
    findFirstOverlap.mockResolvedValue({ id: 'book_other' });
    findFirstTimeOff.mockResolvedValue(null);
    updateManyBooking
      .mockResolvedValueOnce({ count: 0 }) // PENDING_PAYMENT CAS miss
      .mockResolvedValueOnce({ count: 1 }); // EXPIRED stamp PAID
    mockWinningTransaction();
    requestDepositRefund.mockResolvedValue({
      outcome: 'pending',
      refund: { id: 'refund_1' },
    });
    attemptDepositRefund.mockResolvedValue({ outcome: 'refunded', refund: { id: 'refund_1' } });

    const result = await confirmPaidDeposit({
      bookingId: 'book_1',
      shopId: 'shop_1',
      sessionId: 'cs_late',
      paymentIntentId: 'pi_late',
    });

    expect(result.outcome).toBe('late_refunded');
    expect(updateManyBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'book_1',
          status: BookingStatus.EXPIRED,
          paymentStatus: PaymentStatus.UNPAID,
        },
        data: expect.objectContaining({
          paymentStatus: PaymentStatus.PAID,
          stripePaymentIntentId: 'pi_late',
          stripeCheckoutSessionId: 'cs_late',
        }),
      }),
    );
    // Must NOT flip status away from EXPIRED on the stamp path.
    const stampCall = updateManyBooking.mock.calls.find(
      (call) =>
        (call[0] as { where?: { status?: BookingStatus } })?.where?.status ===
        BookingStatus.EXPIRED,
    );
    expect((stampCall?.[0] as { data: { status?: BookingStatus } }).data.status).toBeUndefined();

    expect(enqueueEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        purpose: EmailOutboundPurpose.DEPOSIT_REFUNDED_SLOT_LOST,
      }),
    );
    expect(requestDepositRefund).toHaveBeenCalledWith({
      bookingId: 'book_1',
      reason: 'late_payment_slot_lost',
    });
    expect(attemptDepositRefund).toHaveBeenCalledWith('refund_1');
    expect(notifyOpsDurable).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: 'deposit:late-paid:book_1',
        title: 'Late deposit payment — slot lost, refund queued',
      }),
    );
  });
});
