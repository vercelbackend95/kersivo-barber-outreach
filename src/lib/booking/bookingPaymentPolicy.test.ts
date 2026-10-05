import { describe, expect, it } from 'vitest';
import {
  BOOKING_DEPOSIT_CAP_PENCE,
  FULL_KERSIVO_PLATFORM_FEE_BPS,
  KERSIVO_STARTER_PLATFORM_FEE_BPS,
  bookingPaymentModeForLegacyDepositToggle,
  buildBookingPaymentSnapshot,
  calculatePlatformFeePence,
  kersivoPlatformFeeBps,
  fullPaymentBlocksServicePrice,
  paymentStatusAfterRefund,
  requiresOnlineBookingPayment,
  resolveBookingPaymentSettlement,
  resolveRequiredBookingPayment,
  resolveStoredBookingPayment,
} from './bookingPaymentPolicy';
import { BOOKING_DEPOSIT_PENCE, resolveBookingDepositPence } from './depositGate';

describe('bookingPaymentPolicy — required payment', () => {
  it('A: NONE requires no online payment', () => {
    const payment = resolveRequiredBookingPayment({ mode: 'NONE', servicePricePence: 3000 });
    expect(payment).toEqual({ type: 'NONE', amountPence: 0 });
    expect(requiresOnlineBookingPayment(payment)).toBe(false);
  });

  it('B: DEPOSIT on a £30 service requires £5', () => {
    const payment = resolveRequiredBookingPayment({ mode: 'DEPOSIT', servicePricePence: 3000 });
    expect(payment).toEqual({ type: 'DEPOSIT', amountPence: 500 });
    expect(requiresOnlineBookingPayment(payment)).toBe(true);
  });

  it('C: DEPOSIT on a £3 service requires £3 (never more than the service)', () => {
    expect(resolveRequiredBookingPayment({ mode: 'DEPOSIT', servicePricePence: 300 })).toEqual({
      type: 'DEPOSIT',
      amountPence: 300,
    });
  });

  it('D: FULL on a £30 service requires £30', () => {
    expect(resolveRequiredBookingPayment({ mode: 'FULL', servicePricePence: 3000 })).toEqual({
      type: 'FULL',
      amountPence: 3000,
    });
  });

  it('E: a £0 service never requires Stripe payment in any mode', () => {
    for (const mode of ['NONE', 'DEPOSIT', 'FULL'] as const) {
      const payment = resolveRequiredBookingPayment({ mode, servicePricePence: 0 });
      expect(payment.amountPence).toBe(0);
      expect(requiresOnlineBookingPayment(payment)).toBe(false);
    }
  });

  it('DEPOSIT cap matches the legacy deposit gate for every price', () => {
    expect(BOOKING_DEPOSIT_CAP_PENCE).toBe(BOOKING_DEPOSIT_PENCE);
    for (const price of [0, 1, 299, 499, 500, 501, 1250, 3000, 10_000]) {
      expect(resolveRequiredBookingPayment({ mode: 'DEPOSIT', servicePricePence: price }).amountPence).toBe(
        resolveBookingDepositPence(price),
      );
    }
  });

  it('negative / fractional prices are clamped to whole non-negative pence', () => {
    expect(resolveRequiredBookingPayment({ mode: 'FULL', servicePricePence: -100 }).amountPence).toBe(0);
    expect(resolveRequiredBookingPayment({ mode: 'FULL', servicePricePence: 1250.9 }).amountPence).toBe(1250);
  });
});

describe('bookingPaymentPolicy — KERSIVO platform fee (v1.18: 0% on Starter and Full)', () => {
  it('fee rates for new payments: Starter 0 bps, Full 0 bps, SETUP none', () => {
    expect(KERSIVO_STARTER_PLATFORM_FEE_BPS).toBe(0);
    expect(FULL_KERSIVO_PLATFORM_FEE_BPS).toBe(0);
    expect(kersivoPlatformFeeBps('FREE_BOOKING')).toBe(0);
    expect(kersivoPlatformFeeBps('FULL_KERSIVO')).toBe(0);
    expect(kersivoPlatformFeeBps('SETUP')).toBeNull();
  });

  it('F: Starter £5 deposit → KERSIVO fee 0', () => {
    expect(
      buildBookingPaymentSnapshot({
        type: 'DEPOSIT',
        amountPence: 500,
        feeBps: kersivoPlatformFeeBps('FREE_BOOKING')!,
      }),
    ).toEqual({
      bookingPaymentType: 'DEPOSIT',
      paymentAmountPence: 500,
      kersivoPlatformFeeBps: 0,
      kersivoPlatformFeePence: 0,
    });
  });

  it('G: Starter £30 FULL payment → KERSIVO fee 0', () => {
    expect(
      buildBookingPaymentSnapshot({
        type: 'FULL',
        amountPence: 3000,
        feeBps: kersivoPlatformFeeBps('FREE_BOOKING')!,
      }),
    ).toEqual({
      bookingPaymentType: 'FULL',
      paymentAmountPence: 3000,
      kersivoPlatformFeeBps: 0,
      kersivoPlatformFeePence: 0,
    });
  });

  it('I: Full £30 payment → KERSIVO fee 0', () => {
    expect(
      buildBookingPaymentSnapshot({
        type: 'FULL',
        amountPence: 3000,
        feeBps: kersivoPlatformFeeBps('FULL_KERSIVO')!,
      }),
    ).toMatchObject({ kersivoPlatformFeeBps: 0, kersivoPlatformFeePence: 0 });
  });

  it('no product state yields a positive fee for any new payment amount', () => {
    for (const state of ['FREE_BOOKING', 'FULL_KERSIVO'] as const) {
      for (let pence = 0; pence <= 20_000; pence += 37) {
        const bps = kersivoPlatformFeeBps(state)!;
        expect(calculatePlatformFeePence(pence, bps), `${state} ${pence}`).toBe(0);
      }
    }
  });

  it('historical 1% snapshots stay interpretable: 100 bps maths is unchanged (Math.round)', () => {
    expect(calculatePlatformFeePence(500, 100)).toBe(5);
    expect(calculatePlatformFeePence(3000, 100)).toBe(30);
    expect(calculatePlatformFeePence(1250, 100)).toBe(13);
    expect(buildBookingPaymentSnapshot({ type: 'DEPOSIT', amountPence: 500, feeBps: 100 })).toEqual({
      bookingPaymentType: 'DEPOSIT',
      paymentAmountPence: 500,
      kersivoPlatformFeeBps: 100,
      kersivoPlatformFeePence: 5,
    });
  });

  it('snapshot: NONE is always 0 / 0 / 0', () => {
    expect(buildBookingPaymentSnapshot({ type: 'NONE', amountPence: 500, feeBps: 100 })).toEqual({
      bookingPaymentType: 'NONE',
      paymentAmountPence: 0,
      kersivoPlatformFeeBps: 0,
      kersivoPlatformFeePence: 0,
    });
  });

  it('legacy toggle maps only to NONE / DEPOSIT, never FULL', () => {
    expect(bookingPaymentModeForLegacyDepositToggle(true)).toBe('DEPOSIT');
    expect(bookingPaymentModeForLegacyDepositToggle(false)).toBe('NONE');
  });
});

describe('resolveBookingPaymentSettlement (Phase 4C)', () => {
  const settle = (
    bookingPaymentType: 'NONE' | 'DEPOSIT' | 'FULL',
    paymentAmountPence: number,
    event: Parameters<typeof resolveBookingPaymentSettlement>[0]['event'],
  ) => resolveBookingPaymentSettlement({ bookingPaymentType, paymentAmountPence, event });

  it('FULL £30: in-window 3000/0, late 2500/500, no-show 2500/500, shop 3000/0', () => {
    expect(settle('FULL', 3000, 'client_cancel_in_window')).toEqual({ refundPence: 3000, retainedPence: 0 });
    expect(settle('FULL', 3000, 'client_cancel_late')).toEqual({ refundPence: 2500, retainedPence: 500 });
    expect(settle('FULL', 3000, 'no_show')).toEqual({ refundPence: 2500, retainedPence: 500 });
    expect(settle('FULL', 3000, 'shop_cancel')).toEqual({ refundPence: 3000, retainedPence: 0 });
  });

  it('FULL £12.50 late: retain 500, refund 750', () => {
    expect(settle('FULL', 1250, 'client_cancel_late')).toEqual({ refundPence: 750, retainedPence: 500 });
  });

  it('FULL £3 late / no-show: retain 300, refund 0 (never a 0p Stripe refund)', () => {
    expect(settle('FULL', 300, 'client_cancel_late')).toEqual({ refundPence: 0, retainedPence: 300 });
    expect(settle('FULL', 300, 'no_show')).toEqual({ refundPence: 0, retainedPence: 300 });
  });

  it('FULL late payment with slot lost refunds the entire payment', () => {
    expect(settle('FULL', 3000, 'late_payment_slot_lost')).toEqual({ refundPence: 3000, retainedPence: 0 });
  });

  it('DEPOSIT £5: late 0/500, no-show 0/500, in-window 500/0, shop 500/0', () => {
    expect(settle('DEPOSIT', 500, 'client_cancel_late')).toEqual({ refundPence: 0, retainedPence: 500 });
    expect(settle('DEPOSIT', 500, 'no_show')).toEqual({ refundPence: 0, retainedPence: 500 });
    expect(settle('DEPOSIT', 500, 'client_cancel_in_window')).toEqual({ refundPence: 500, retainedPence: 0 });
    expect(settle('DEPOSIT', 500, 'shop_cancel')).toEqual({ refundPence: 500, retainedPence: 0 });
  });

  it('NONE and £0 never refund or retain anything', () => {
    expect(settle('NONE', 3000, 'no_show')).toEqual({ refundPence: 0, retainedPence: 0 });
    expect(settle('FULL', 0, 'shop_cancel')).toEqual({ refundPence: 0, retainedPence: 0 });
  });
});

describe('paymentStatusAfterRefund (Phase 4C)', () => {
  it('refund == payment → REFUNDED; 0 < refund < payment → PARTIALLY_REFUNDED; 0 → PAID', () => {
    expect(paymentStatusAfterRefund({ paymentAmountPence: 3000, refundedAmountPence: 3000 })).toBe('REFUNDED');
    expect(paymentStatusAfterRefund({ paymentAmountPence: 3000, refundedAmountPence: 2500 })).toBe(
      'PARTIALLY_REFUNDED',
    );
    expect(paymentStatusAfterRefund({ paymentAmountPence: 3000, refundedAmountPence: 0 })).toBe('PAID');
  });

  it('impossible amounts return null (refund above payment, negative, missing payment)', () => {
    expect(paymentStatusAfterRefund({ paymentAmountPence: 3000, refundedAmountPence: 3001 })).toBeNull();
    expect(paymentStatusAfterRefund({ paymentAmountPence: 3000, refundedAmountPence: -1 })).toBeNull();
    expect(paymentStatusAfterRefund({ paymentAmountPence: 0, refundedAmountPence: 0 })).toBeNull();
  });

  it('legacy rows fall back to depositAmountPence for the payment amount', () => {
    expect(resolveStoredBookingPayment({ paymentRequired: true, depositAmountPence: 500 })).toEqual({
      type: 'DEPOSIT',
      amountPence: 500,
    });
    expect(
      resolveStoredBookingPayment({ bookingPaymentType: 'FULL', paymentAmountPence: 3000, depositAmountPence: null }),
    ).toEqual({ type: 'FULL', amountPence: 3000 });
  });
});

describe('fullPaymentBlocksServicePrice (Phase 4C)', () => {
  const paidFull = { bookingPaymentType: 'FULL' as const, paymentAmountPence: 3000, paymentStatus: 'PAID' };

  it('same price allowed; higher or lower price blocked', () => {
    expect(fullPaymentBlocksServicePrice(paidFull, 3000)).toBe(false);
    expect(fullPaymentBlocksServicePrice(paidFull, 3500)).toBe(true);
    expect(fullPaymentBlocksServicePrice(paidFull, 2500)).toBe(true);
  });

  it('DEPOSIT and NONE bookings are unchanged', () => {
    expect(
      fullPaymentBlocksServicePrice({ bookingPaymentType: 'DEPOSIT', paymentAmountPence: 500, paymentStatus: 'PAID' }, 3500),
    ).toBe(false);
    expect(fullPaymentBlocksServicePrice({ bookingPaymentType: 'NONE', paymentAmountPence: 0, paymentStatus: null }, 3500)).toBe(
      false,
    );
  });
});
