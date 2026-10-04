import { prisma } from '../db/client';

/**
 * Which Stripe Connect account a booking payment lives on.
 *
 * A PaymentIntent belongs to the connected account it was created on, so Checkout retrieval,
 * confirmation, hold recovery and refunds must use `Booking.stripeConnectAccountIdAtPayment`.
 * Rows created before that snapshot existed (null) fall back to the shop's current account —
 * but only when they carry no KERSIVO application fee, because every fee-bearing booking is
 * created with a snapshot and a missing one is an integrity problem.
 */
export type BookingPaymentAccountFields = {
  stripeConnectAccountIdAtPayment?: string | null;
  kersivoPlatformFeePence?: number | null;
};

export type BookingPaymentAccountResolution =
  | { ok: true; accountId: string; source: 'snapshot' | 'legacy_shop_account' }
  | { ok: false; reason: 'missing_payment_account_snapshot' | 'no_connect_account' };

export function bookingPaymentAccountSnapshot(
  booking: BookingPaymentAccountFields,
): string | null {
  return booking.stripeConnectAccountIdAtPayment?.trim() || null;
}

/** Null snapshot on a booking that must have one (fee-bearing ⇒ created after the snapshot). */
export function isMissingRequiredPaymentAccountSnapshot(
  booking: BookingPaymentAccountFields,
): boolean {
  return !bookingPaymentAccountSnapshot(booking) && (booking.kersivoPlatformFeePence ?? 0) > 0;
}

/**
 * Account for retrieving a customer-returned Checkout Session: found via the Booking that
 * stored this session id within the shop — never from a customer-supplied account id.
 * Unknown sessions fall back to the shop account; confirmation re-verifies the account anyway.
 */
export async function resolveCheckoutSessionPaymentAccount(input: {
  shopId: string;
  sessionId: string;
  currentShopAccountId: string | null | undefined;
}): Promise<BookingPaymentAccountResolution> {
  const booking = await prisma.booking.findFirst({
    where: { stripeCheckoutSessionId: input.sessionId, barber: { shopId: input.shopId } },
    select: { stripeConnectAccountIdAtPayment: true, kersivoPlatformFeePence: true },
  });
  return resolveBookingPaymentAccount({
    booking: booking ?? {},
    currentShopAccountId: input.currentShopAccountId,
  });
}

export function resolveBookingPaymentAccount(input: {
  booking: BookingPaymentAccountFields;
  currentShopAccountId: string | null | undefined;
  /** Newly created paid bookings always carry a snapshot; never fall back for them. */
  requireSnapshot?: boolean;
}): BookingPaymentAccountResolution {
  const snapshot = bookingPaymentAccountSnapshot(input.booking);
  if (snapshot) return { ok: true, accountId: snapshot, source: 'snapshot' };
  if (input.requireSnapshot || isMissingRequiredPaymentAccountSnapshot(input.booking)) {
    return { ok: false, reason: 'missing_payment_account_snapshot' };
  }
  const current = input.currentShopAccountId?.trim();
  if (!current) return { ok: false, reason: 'no_connect_account' };
  return { ok: true, accountId: current, source: 'legacy_shop_account' };
}
