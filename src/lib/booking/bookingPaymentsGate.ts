import { isDemoShopId } from '../shop/cardPaymentsGate';
import { hasKersivoCapability, type KersivoAccess } from '../shop/kersivoAccess';

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
 * Whether a shop is technically eligible to take BOOKING payments (FREE_BOOKING or FULL_KERSIVO
 * with Stripe Connect ready). Booking-only: Retail stays on cardPaymentsGate (Full-only).
 *
 * Not yet wired into live deposit collection: Free shops must not take deposits until the 1%
 * KERSIVO fee is charged at checkout (Phase 4B). Live deposits still use depositGate.
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
