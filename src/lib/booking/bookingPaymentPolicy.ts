import type { BookingPaymentMode, BookingPaymentType } from '@prisma/client';
import type { KersivoProductState } from '../shop/kersivoAccess';

/**
 * Pure booking-payment rules (no Stripe / database access). All amounts are integer pence.
 */

/** DEPOSIT mode charges £5, or the full service price when the service costs less. */
export const BOOKING_DEPOSIT_CAP_PENCE = 500;

/** Checkout Session metadata.type for booking payments created from Phase 4B onward. */
export const BOOKING_PAYMENT_METADATA_TYPE = 'booking_payment';
/** Pre-4B deposit sessions; still honoured so open sessions keep working after deploy. */
export const LEGACY_BOOKING_DEPOSIT_METADATA_TYPE = 'booking_deposit';

export function isBookingCheckoutMetadataType(type: string | null | undefined): boolean {
  const value = (type ?? '').trim();
  return value === BOOKING_PAYMENT_METADATA_TYPE || value === LEGACY_BOOKING_DEPOSIT_METADATA_TYPE;
}

/** Stable API error codes for booking payments. */
export const BOOKING_PAYMENT_NOT_READY = 'BOOKING_PAYMENT_NOT_READY';

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

/** Late cancel / no-show on a FULL upfront payment: the shop keeps at most £5. */
export const FULL_PAYMENT_RETAINED_CAP_PENCE = 500;

export const FULL_PAYMENT_SERVICE_PRICE_CHANGE_NOT_SUPPORTED =
  'FULL_PAYMENT_SERVICE_PRICE_CHANGE_NOT_SUPPORTED';

/** Online payment recorded on a Booking; pre-snapshot rows fall back to the legacy deposit fields. */
export function resolveStoredBookingPayment(booking: {
  bookingPaymentType?: BookingPaymentType | null;
  paymentAmountPence?: number | null;
  depositAmountPence?: number | null;
  paymentRequired?: boolean | null;
}): { type: BookingPaymentType; amountPence: number } {
  const snapshotType = booking.bookingPaymentType;
  const type =
    snapshotType && snapshotType !== 'NONE' ? snapshotType : booking.paymentRequired ? 'DEPOSIT' : 'NONE';
  if (type === 'NONE') return { type, amountPence: 0 };
  return { type, amountPence: toPence(booking.paymentAmountPence ?? booking.depositAmountPence ?? 0) };
}

export type BookingSettlementEvent =
  | 'client_cancel_in_window'
  | 'client_cancel_late'
  | 'no_show'
  | 'shop_cancel'
  | 'late_payment_slot_lost';

export type BookingPaymentSettlement = {
  /** Amount to refund to the customer, in pence. 0 means no Stripe refund. */
  refundPence: number;
  /** Amount the shop keeps, in pence. */
  retainedPence: number;
};

/**
 * Single source of truth for what happens to a captured online booking payment.
 * Integer pence only.
 *
 * DEPOSIT: refunded in full on in-window client cancel / shop cancel / lost slot;
 *          retained in full on late client cancel / no-show.
 * FULL:    refunded in full on in-window client cancel / shop cancel / lost slot;
 *          on late client cancel / no-show the shop keeps min(payment, £5), rest refunded.
 */
export function resolveBookingPaymentSettlement(params: {
  bookingPaymentType: BookingPaymentType | null | undefined;
  paymentAmountPence: number;
  event: BookingSettlementEvent;
}): BookingPaymentSettlement {
  const amount = toPence(params.paymentAmountPence);
  const type = params.bookingPaymentType ?? 'NONE';
  if (type === 'NONE' || amount === 0) return { refundPence: 0, retainedPence: 0 };

  switch (params.event) {
    case 'client_cancel_in_window':
    case 'shop_cancel':
    case 'late_payment_slot_lost':
      return { refundPence: amount, retainedPence: 0 };
    case 'client_cancel_late':
    case 'no_show': {
      if (type === 'FULL') {
        const retainedPence = Math.min(amount, FULL_PAYMENT_RETAINED_CAP_PENCE);
        return { refundPence: amount - retainedPence, retainedPence };
      }
      return { refundPence: 0, retainedPence: amount };
    }
    default:
      return { refundPence: 0, retainedPence: amount };
  }
}

/**
 * Payment status after confirmed refunds. Returns null for impossible values (negative refund
 * or a refund above the original online payment) so callers can alert instead of corrupting state.
 */
export function paymentStatusAfterRefund(params: {
  paymentAmountPence: number;
  refundedAmountPence: number;
}): 'PAID' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | null {
  const { paymentAmountPence: payment, refundedAmountPence: refunded } = params;
  if (!Number.isInteger(payment) || !Number.isInteger(refunded)) return null;
  if (payment <= 0 || refunded < 0 || refunded > payment) return null;
  if (refunded === 0) return 'PAID';
  return refunded === payment ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
}

/**
 * A paid FULL booking may move date/time/barber, but may only switch to a service with exactly
 * the paid price — top-ups and partial service-change refunds are not supported.
 */
export function fullPaymentBlocksServicePrice(
  booking: {
    bookingPaymentType?: BookingPaymentType | null;
    paymentAmountPence?: number | null;
    paymentStatus?: string | null;
  },
  newServicePricePence: number,
): boolean {
  if (booking.bookingPaymentType !== 'FULL') return false;
  if (booking.paymentStatus !== 'PAID' && booking.paymentStatus !== 'PARTIALLY_REFUNDED') return false;
  return booking.paymentAmountPence !== newServicePricePence;
}

/** Payment mode equivalent of the legacy depositsEnabled toggle. */
export function bookingPaymentModeForLegacyDepositToggle(depositsEnabled: boolean): BookingPaymentMode {
  return depositsEnabled ? 'DEPOSIT' : 'NONE';
}
