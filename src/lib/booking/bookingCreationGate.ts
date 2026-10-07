import { Prisma } from '@prisma/client';
import {
  hasKersivoCapability,
  loadKersivoAccess,
  type KersivoCapability,
  type KersivoProductState,
} from '../shop/kersivoAccess';

export const SHOP_NOT_ACCEPTING_NEW_BOOKINGS = 'SHOP_NOT_ACCEPTING_NEW_BOOKINGS';
/** The shop's product state changed between the payment decision and the locked insert. */
export const BOOKING_PRODUCT_STATE_CHANGED = 'BOOKING_PRODUCT_STATE_CHANGED';

/**
 * Final entitlement check for a NEW booking, run inside the booking-create transaction.
 * Takes the same ShopSettings row lock as "Leave KERSIVO" (requestStarterDeparture), so a
 * booking insert and a departure serialize: once a departure has committed, no new booking can.
 * Returns the product state read under the lock so callers can bind their snapshots to it.
 */
export async function lockShopAndCheckNewBookingCapability(
  tx: Prisma.TransactionClient,
  shopId: string,
  capability: KersivoCapability,
  now: Date = new Date(),
): Promise<{ ok: true; state: KersivoProductState } | { ok: false; departed: boolean }> {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "ShopSettings" WHERE id = ${shopId} FOR UPDATE`);
  const access = await loadKersivoAccess(shopId, now, tx);
  if (hasKersivoCapability(access, capability)) return { ok: true, state: access.state };
  return { ok: false, departed: Boolean(access.departure) };
}
