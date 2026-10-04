import type { BookingPaymentMode, BookingPaymentType } from '@prisma/client';
import type { KersivoProductState } from '../shop/kersivoAccess';

/**
 * Pure booking-payment rules (no Stripe / database access). All amounts are integer pence.
 */

/** DEPOSIT mode charges £5, or the full service price when the service costs less. */
export const BOOKING_DEPOSIT_CAP_PENCE = 500;

/** KERSIVO platform fee in basis points (100 bps = 1%). */
export const FREE_BOOKING_PLATFORM_FEE_BPS = 100;
export const FULL_KERSIVO_PLATFORM_FEE_BPS = 0;

export type RequiredBookingPayment = {
  type: BookingPaymentType;
  /** Amount that must be paid online; 0 means no Stripe payment is required. */
  amountPence: number;
};

function toPence(value: number): number {
  return Math.max(0, Math.trunc(value));
}

/**
 * Online payment required for one booking under the shop's payment mode.
 * A £0 service never requires a Stripe payment.
 */
export function resolveRequiredBookingPayment(params: {
  mode: BookingPaymentMode;
  servicePricePence: number;
}): RequiredBookingPayment {
  const price = toPence(params.servicePricePence);
  switch (params.mode) {
    case 'DEPOSIT':
      return { type: 'DEPOSIT', amountPence: Math.min(price, BOOKING_DEPOSIT_CAP_PENCE) };
    case 'FULL':
      return { type: 'FULL', amountPence: price };
    case 'NONE':
    default:
      return { type: 'NONE', amountPence: 0 };
  }
}

export function requiresOnlineBookingPayment(payment: RequiredBookingPayment): boolean {
  return payment.type !== 'NONE' && payment.amountPence > 0;
}

/** KERSIVO fee rate for the product state; SETUP cannot take live booking payments. */
export function kersivoPlatformFeeBps(state: KersivoProductState): number | null {
  switch (state) {
    case 'FREE_BOOKING':
      return FREE_BOOKING_PLATFORM_FEE_BPS;
    case 'FULL_KERSIVO':
      return FULL_KERSIVO_PLATFORM_FEE_BPS;
    case 'SETUP':
    default:
      return null;
  }
}

/**
 * Fee in pence for an online payment at `feeBps`. Integer maths only; rounds to the nearest
 * penny with Math.round semantics (1250p at 1% → 13p).
 */
export function calculatePlatformFeePence(paymentAmountPence: number, feeBps: number): number {
  const amount = toPence(paymentAmountPence);
  const bps = toPence(feeBps);
  if (amount === 0 || bps === 0) return 0;
  return Math.round((amount * bps) / 10_000);
}

export type BookingPaymentSnapshot = {
  bookingPaymentType: BookingPaymentType;
  paymentAmountPence: number;
  kersivoPlatformFeeBps: number;
  kersivoPlatformFeePence: number;
};

/** Durable Booking snapshot for a payment at a given fee rate. */
export function buildBookingPaymentSnapshot(params: {
  type: BookingPaymentType;
  amountPence: number;
  feeBps: number;
}): BookingPaymentSnapshot {
  const amount = params.type === 'NONE' ? 0 : toPence(params.amountPence);
  const feeBps = amount === 0 ? 0 : toPence(params.feeBps);
  return {
    bookingPaymentType: params.type,
    paymentAmountPence: amount,
    kersivoPlatformFeeBps: feeBps,
    kersivoPlatformFeePence: calculatePlatformFeePence(amount, feeBps),
  };
}

/** Payment mode equivalent of the legacy depositsEnabled toggle. */
export function bookingPaymentModeForLegacyDepositToggle(depositsEnabled: boolean): BookingPaymentMode {
  return depositsEnabled ? 'DEPOSIT' : 'NONE';
}
