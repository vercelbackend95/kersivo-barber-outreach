import type { BookingPaymentMode } from '@prisma/client';
import { isDemoShopId } from '../shop/cardPaymentsGate';
import { hasKersivoCapability, type KersivoAccess } from '../shop/kersivoAccess';
import {
  buildBookingPaymentSnapshot,
  kersivoPlatformFeeBps,
  requiresOnlineBookingPayment,
  resolveRequiredBookingPayment,
  type BookingPaymentSnapshot,
} from './bookingPaymentPolicy';

export type BookingPaymentsGateReason =
  | 'ok'
  | 'demo_shop'
  | 'no_booking_payments_capability'
  | 'connect_missing'
  | 'connect_not_ready';

export type BookingPaymentsShopFields = {
  id: string;
  stripeConnectAccountId: string | null;
  stripeConnectChargesEnabled: boolean;
};

/**
 * Whether a shop can take BOOKING payments (FREE_BOOKING or FULL_KERSIVO with Stripe Connect
 * ready). Booking-only: Retail stays on cardPaymentsGate (Full-only).
 */
export function evaluateBookingPayments(params: {
  shop: BookingPaymentsShopFields;
  access: KersivoAccess;
}): { ok: boolean; reason: BookingPaymentsGateReason } {
  const { shop, access } = params;
  if (isDemoShopId(shop.id)) return { ok: false, reason: 'demo_shop' };
  if (!hasKersivoCapability(access, 'BOOKING_PAYMENTS')) {
    return { ok: false, reason: 'no_booking_payments_capability' };
  }
  if (!shop.stripeConnectAccountId?.trim()) return { ok: false, reason: 'connect_missing' };
  if (!shop.stripeConnectChargesEnabled) return { ok: false, reason: 'connect_not_ready' };
  return { ok: true, reason: 'ok' };
}

export function canTakeBookingPayments(params: {
  shop: BookingPaymentsShopFields;
  access: KersivoAccess;
}): boolean {
  return evaluateBookingPayments(params).ok;
}

/** Whether the shop may create / continue Stripe Connect onboarding for booking payments. */
export function canStartBookingPaymentsOnboarding(params: {
  shopId: string;
  access: KersivoAccess;
}): boolean {
  if (isDemoShopId(params.shopId)) return false;
  return hasKersivoCapability(params.access, 'BOOKING_PAYMENTS');
}

export type LiveBookingPaymentDecision =
  | { outcome: 'none' }
  | { outcome: 'collect'; snapshot: BookingPaymentSnapshot }
  | { outcome: 'full_not_available' }
  | { outcome: 'not_ready'; reason: BookingPaymentsGateReason };

/**
 * Payment requirement for a live public booking. FULL mode is not available yet and fails
 * closed; DEPOSIT never silently falls back to pay-at-shop when payments are not ready.
 */
export function resolveLiveBookingPayment(params: {
  mode: BookingPaymentMode;
  servicePricePence: number;
  shop: BookingPaymentsShopFields;
  access: KersivoAccess;
}): LiveBookingPaymentDecision {
  if (params.mode === 'FULL') return { outcome: 'full_not_available' };
  if (params.mode !== 'DEPOSIT') return { outcome: 'none' };

  const required = resolveRequiredBookingPayment({
    mode: params.mode,
    servicePricePence: params.servicePricePence,
  });
  if (!requiresOnlineBookingPayment(required)) return { outcome: 'none' };

  const gate = evaluateBookingPayments({ shop: params.shop, access: params.access });
  if (!gate.ok) return { outcome: 'not_ready', reason: gate.reason };

  const feeBps = kersivoPlatformFeeBps(params.access.state);
  if (feeBps === null) return { outcome: 'not_ready', reason: 'no_booking_payments_capability' };

  return {
    outcome: 'collect',
    snapshot: buildBookingPaymentSnapshot({
      type: required.type,
      amountPence: required.amountPence,
      feeBps,
    }),
  };
}

/** Public booking page hint: will a priced service require an online deposit right now? */
export function shopRequiresOnlineDeposit(params: {
  mode: BookingPaymentMode;
  shop: BookingPaymentsShopFields;
  access: KersivoAccess;
}): boolean {
  return params.mode === 'DEPOSIT' && evaluateBookingPayments(params).ok;
}
