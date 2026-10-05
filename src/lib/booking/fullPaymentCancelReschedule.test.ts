import { BookingStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Phase 4C service orchestration: customer cancel, shop cancel and reschedule for FULL upfront
 * payments. The refund domain itself is covered in bookingPaymentRefunds.test.ts.
 */

const { prismaMock, requestBookingPaymentRefund, attemptBookingPaymentRefund, forfeitBookingDeposit, sendShopCancelledBookingEmail } =
  vi.hoisted(() => ({
    prismaMock: {
      booking: { findFirst: vi.fn(), update: vi.fn() },
      shopSettings: { findUniqueOrThrow: vi.fn() },
      service: { findUniqueOrThrow: vi.fn() },
      $transaction: vi.fn(),
    },
    requestBookingPaymentRefund: vi.fn(),
    attemptBookingPaymentRefund: vi.fn(),
    forfeitBookingDeposit: vi.fn(),
    sendShopCancelledBookingEmail: vi.fn(),
  }));

vi.mock('../db/client', () => ({ prisma: prismaMock }));

vi.mock('../email/sender', () => ({
  buildInstantBookingConfirmationEmail: vi.fn(() => ({ subject: 'ok', html: '<p>ok</p>' })),
  buildRescheduledBookingEmail: vi.fn(() => ({ subject: 'ok', html: '<p>ok</p>' })),
  sendShopCancelledBookingEmail: (...args: unknown[]) => sendShopCancelledBookingEmail(...args),
}));

vi.mock('../email/outbox', () => ({
  enqueueEmail: vi.fn().mockResolvedValue({ id: 'out_1' }),
  tryDeliverOutboxEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./depositMoney', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./depositMoney')>()),
  requestBookingPaymentRefund: (...args: unknown[]) => requestBookingPaymentRefund(...args),
  attemptBookingPaymentRefund: (...args: unknown[]) => attemptBookingPaymentRefund(...args),
  forfeitBookingDeposit: (...args: unknown[]) => forfeitBookingDeposit(...args),
}));

import { cancelByManageToken, cancelByShop, rescheduleByToken } from './service';

const HOUR = 60 * 60 * 1000;

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'book_1',
    status: BookingStatus.BOOKED,
    email: 'c@example.com',
    fullName: 'Client',
    startAt: new Date(Date.now() + 72 * HOUR),
    endAt: new Date(Date.now() + 73 * HOUR),
    originalStartAt: null,
    originalEndAt: null,
    clientRescheduleCount: 0,
    serviceNameAtBooking: 'Cut',
    paymentRequired: true,
    paymentStatus: 'PAID',
    bookingPaymentType: 'FULL',
    paymentAmountPence: 3000,
    depositAmountPence: null,
    barber: { id: 'barber_1', name: 'Alex', shopId: 'shop_1' },
    service: { id: 'svc_1', name: 'Cut' },
    ...overrides,
  };
}

const settings = {
  id: 'shop_1',
  name: 'Shop',
  cancellationWindowHours: 24,
  rescheduleWindowHours: 24,
  maxClientReschedules: 2,
  defaultBufferMinutes: 0,
  slotIntervalMinutes: 15,
  timezone: 'Europe/London',
};

const pendingLedger = { id: 'ref_1', status: 'REFUND_PENDING', stripePaymentIntentId: 'pi_1' };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.shopSettings.findUniqueOrThrow.mockResolvedValue(settings);
  prismaMock.booking.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    ...booking(),
    ...data,
  }));
});

describe('cancelByManageToken — FULL upfront payment', () => {
  it('P: in-window → write-ahead full refund, cancel, attempt; payment wording', async () => {
    const order: string[] = [];
    prismaMock.booking.findFirst.mockResolvedValue(booking());
    requestBookingPaymentRefund.mockImplementation(async () => {
      order.push('ledger');
      return { outcome: 'pending', refund: pendingLedger };
    });
    prismaMock.booking.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      order.push('cancel');
      return { ...booking(), ...data };
    });
    attemptBookingPaymentRefund.mockImplementation(async () => {
      order.push('attempt');
      return { outcome: 'refunded', refund: pendingLedger };
    });

    const result = await cancelByManageToken('tok');

    expect(order).toEqual(['ledger', 'cancel', 'attempt']);
    expect(requestBookingPaymentRefund).toHaveBeenCalledWith({ bookingId: 'book_1', reason: 'client_cancel_in_window' });
    expect(result.booking.status).toBe(BookingStatus.CANCELLED_BY_CLIENT);
    expect(result.refundOutcome).toBe('refunded');
    expect(result.message).toBe('Your booking has been cancelled. Your payment refund has been confirmed.');
  });

  it('Q: outside the window → partial refund ledger (client_cancel_late), cancel, attempt', async () => {
    prismaMock.booking.findFirst.mockResolvedValue(booking({ startAt: new Date(Date.now() + 2 * HOUR) }));
    requestBookingPaymentRefund.mockResolvedValue({ outcome: 'pending', refund: pendingLedger });
    attemptBookingPaymentRefund.mockResolvedValue({ outcome: 'pending', refund: pendingLedger });

    const result = await cancelByManageToken('tok');

    expect(requestBookingPaymentRefund).toHaveBeenCalledWith({ bookingId: 'book_1', reason: 'client_cancel_late' });
    expect(forfeitBookingDeposit).not.toHaveBeenCalled();
    expect(result.booking.status).toBe(BookingStatus.CANCELLED_BY_CLIENT);
    expect(result.message).toBe('Your booking has been cancelled. A partial refund is being processed.');
  });

  it('R: £3 outside the window → cancelled with no refund, payment stays PAID', async () => {
    prismaMock.booking.findFirst.mockResolvedValue(
      booking({ startAt: new Date(Date.now() + 2 * HOUR), paymentAmountPence: 300 }),
    );
    requestBookingPaymentRefund.mockResolvedValue({ outcome: 'skipped_no_refund_due', refund: null });

    const result = await cancelByManageToken('tok');

    expect(attemptBookingPaymentRefund).not.toHaveBeenCalled();
    expect(prismaMock.booking.update).toHaveBeenCalledWith({
      where: { id: 'book_1' },
      data: { status: BookingStatus.CANCELLED_BY_CLIENT },
    });
    expect(result.refundOutcome).toBe('skipped_no_refund_due');
    expect(result.message).toContain('cancellation window has passed');
  });

  it('a refund failure never blocks the cancellation', async () => {
    prismaMock.booking.findFirst.mockResolvedValue(booking());
    requestBookingPaymentRefund.mockResolvedValue({ outcome: 'pending', refund: pendingLedger });
    attemptBookingPaymentRefund.mockRejectedValue(new Error('stripe down'));

    const result = await cancelByManageToken('tok');

    expect(result.booking.status).toBe(BookingStatus.CANCELLED_BY_CLIENT);
    expect(result.refundOutcome).toBe('pending');
  });
});

describe('cancelByManageToken — DEPOSIT and NONE unchanged', () => {
  const deposit = (overrides: Record<string, unknown> = {}) =>
    booking({ bookingPaymentType: 'DEPOSIT', paymentAmountPence: 500, depositAmountPence: 500, ...overrides });

  it('V: DEPOSIT late cancel forfeits the deposit (no refund request)', async () => {
    prismaMock.booking.findFirst.mockResolvedValue(deposit({ startAt: new Date(Date.now() + 2 * HOUR) }));

    const result = await cancelByManageToken('tok');

    expect(forfeitBookingDeposit).toHaveBeenCalledWith('book_1');
    expect(requestBookingPaymentRefund).not.toHaveBeenCalled();
    expect(result.refundOutcome).toBe('skipped_forfeited');
  });

  it('W: DEPOSIT in-window cancel refunds the deposit with deposit wording', async () => {
    prismaMock.booking.findFirst.mockResolvedValue(deposit());
    requestBookingPaymentRefund.mockResolvedValue({ outcome: 'pending', refund: pendingLedger });
    attemptBookingPaymentRefund.mockResolvedValue({ outcome: 'refunded', refund: pendingLedger });

    const result = await cancelByManageToken('tok');

    expect(requestBookingPaymentRefund).toHaveBeenCalledWith({ bookingId: 'book_1', reason: 'client_cancel_in_window' });
    expect(result.message).toBe('Your booking has been cancelled. Your deposit refund has been confirmed.');
  });

  it('X: NONE booking outside the window is still rejected', async () => {
    prismaMock.booking.findFirst.mockResolvedValue(
      booking({
        startAt: new Date(Date.now() + 2 * HOUR),
        paymentRequired: false,
        paymentStatus: null,
        bookingPaymentType: 'NONE',
        paymentAmountPence: 0,
      }),
    );

    await expect(cancelByManageToken('tok')).rejects.toMatchObject({ message: 'Cancellation window has passed.' });
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });
});

describe('cancelByShop — FULL refunds 100%', () => {
  it('U: shop cancel writes a shop_cancel ledger, cancels, attempts and uses payment wording', async () => {
    prismaMock.booking.findFirst.mockResolvedValue(booking());
    requestBookingPaymentRefund.mockResolvedValue({ outcome: 'pending', refund: pendingLedger });
    attemptBookingPaymentRefund.mockResolvedValue({ outcome: 'refunded', refund: pendingLedger });

    const result = await cancelByShop({ bookingId: 'book_1', shopId: 'shop_1' });

    expect(requestBookingPaymentRefund).toHaveBeenCalledWith({ bookingId: 'book_1', reason: 'shop_cancel' });
    expect(result.message).toBe('Booking cancelled. Payment refund confirmed.');
    expect(sendShopCancelledBookingEmail).toHaveBeenCalledWith(
      expect.objectContaining({ depositRefundStatus: 'refunded', refundKind: 'payment' }),
    );
  });

  it('a Stripe failure does not block the shop cancel', async () => {
    prismaMock.booking.findFirst.mockResolvedValue(booking());
    requestBookingPaymentRefund.mockResolvedValue({ outcome: 'pending', refund: pendingLedger });
    attemptBookingPaymentRefund.mockRejectedValue(new Error('stripe down'));

    const result = await cancelByShop({ bookingId: 'book_1', shopId: 'shop_1' });

    expect(result.booking.status).toBe(BookingStatus.CANCELLED_BY_SHOP);
    expect(result.refundOutcome).toBe('pending');
  });

  it('keeps the 1-hour lead-time rule', async () => {
    prismaMock.booking.findFirst.mockResolvedValue(booking({ startAt: new Date(Date.now() + 30 * 60 * 1000) }));

    await expect(cancelByShop({ bookingId: 'book_1', shopId: 'shop_1' })).rejects.toMatchObject({ statusCode: 409 });
    expect(requestBookingPaymentRefund).not.toHaveBeenCalled();
  });
});

describe('rescheduleByToken — FULL same-price rule', () => {
  const service = (pricePence: number) => ({
    id: 'svc_2',
    shopId: 'shop_1',
    name: 'Other',
    isActive: true,
    durationMinutes: 30,
    bufferMinutes: 0,
    pricePence,
  });
  const reschedule = () =>
    rescheduleByToken({ token: 'tok', serviceId: 'svc_2', barberId: 'barber_1', date: '2026-12-10', time: '10:00' });

  it('AI: same-price service passes the guard (reaches the normal window check)', async () => {
    prismaMock.booking.findFirst.mockResolvedValue(booking({ startAt: new Date(Date.now() + 2 * HOUR) }));
    prismaMock.service.findUniqueOrThrow.mockResolvedValue(service(3000));

    await expect(reschedule()).rejects.toMatchObject({ message: 'Reschedule window has passed.' });
  });

  it('AJ / AK: £35 or £25 service is rejected with FULL_PAYMENT_SERVICE_PRICE_CHANGE_NOT_SUPPORTED', async () => {
    for (const price of [3500, 2500]) {
      prismaMock.booking.findFirst.mockResolvedValue(booking());
      prismaMock.service.findUniqueOrThrow.mockResolvedValue(service(price));

      await expect(reschedule()).rejects.toMatchObject({
        statusCode: 409,
        code: 'FULL_PAYMENT_SERVICE_PRICE_CHANGE_NOT_SUPPORTED',
      });
    }
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('AM: DEPOSIT bookings may still change to a different-price service', async () => {
    prismaMock.booking.findFirst.mockResolvedValue(
      booking({
        startAt: new Date(Date.now() + 2 * HOUR),
        bookingPaymentType: 'DEPOSIT',
        paymentAmountPence: 500,
        depositAmountPence: 500,
      }),
    );
    prismaMock.service.findUniqueOrThrow.mockResolvedValue(service(3500));

    await expect(reschedule()).rejects.toMatchObject({ message: 'Reschedule window has passed.' });
  });
});
