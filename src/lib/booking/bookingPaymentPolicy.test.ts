import { describe, expect, it } from 'vitest';
import {
  BOOKING_DEPOSIT_CAP_PENCE,
  FREE_BOOKING_PLATFORM_FEE_BPS,
  FULL_KERSIVO_PLATFORM_FEE_BPS,
  bookingPaymentModeForLegacyDepositToggle,
  buildBookingPaymentSnapshot,
  calculatePlatformFeePence,
  kersivoPlatformFeeBps,
  requiresOnlineBookingPayment,
  resolveRequiredBookingPayment,
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

describe('bookingPaymentPolicy — KERSIVO platform fee', () => {
  it('fee rates: Free 100 bps, Full 0 bps, SETUP none', () => {
    expect(FREE_BOOKING_PLATFORM_FEE_BPS).toBe(100);
    expect(FULL_KERSIVO_PLATFORM_FEE_BPS).toBe(0);
    expect(kersivoPlatformFeeBps('FREE_BOOKING')).toBe(100);
    expect(kersivoPlatformFeeBps('FULL_KERSIVO')).toBe(0);
    expect(kersivoPlatformFeeBps('SETUP')).toBeNull();
  });

  it('F: Free £5 deposit → 5p fee', () => {
    expect(calculatePlatformFeePence(500, FREE_BOOKING_PLATFORM_FEE_BPS)).toBe(5);
  });

  it('G: Free £30 full payment → 30p fee', () => {
    expect(calculatePlatformFeePence(3000, FREE_BOOKING_PLATFORM_FEE_BPS)).toBe(30);
  });

  it('H: Free £12.50 full payment → 13p fee (Math.round)', () => {
    expect(calculatePlatformFeePence(1250, FREE_BOOKING_PLATFORM_FEE_BPS)).toBe(13);
  });

  it('I: Full £30 payment → 0p fee', () => {
    expect(calculatePlatformFeePence(3000, FULL_KERSIVO_PLATFORM_FEE_BPS)).toBe(0);
  });

  it('Free fee equals Math.round(pence / 100) across a range of amounts', () => {
    for (let pence = 0; pence <= 20_000; pence += 37) {
      expect(calculatePlatformFeePence(pence, FREE_BOOKING_PLATFORM_FEE_BPS)).toBe(Math.round(pence / 100));
    }
  });

  it('snapshot: NONE is always 0 / 0 / 0', () => {
    expect(buildBookingPaymentSnapshot({ type: 'NONE', amountPence: 500, feeBps: 100 })).toEqual({
      bookingPaymentType: 'NONE',
      paymentAmountPence: 0,
      kersivoPlatformFeeBps: 0,
      kersivoPlatformFeePence: 0,
    });
  });

  it('snapshot: Free £5 deposit records amount, bps and fee', () => {
    expect(buildBookingPaymentSnapshot({ type: 'DEPOSIT', amountPence: 500, feeBps: 100 })).toEqual({
      bookingPaymentType: 'DEPOSIT',
      paymentAmountPence: 500,
      kersivoPlatformFeeBps: 100,
      kersivoPlatformFeePence: 5,
    });
  });

  it('legacy toggle maps only to NONE / DEPOSIT, never FULL', () => {
    expect(bookingPaymentModeForLegacyDepositToggle(true)).toBe('DEPOSIT');
    expect(bookingPaymentModeForLegacyDepositToggle(false)).toBe('NONE');
  });
});
