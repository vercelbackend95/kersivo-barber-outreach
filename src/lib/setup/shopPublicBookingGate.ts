import { hasKersivoCapability, loadKersivoAccess } from '@/lib/shop/kersivoAccess';

/**
 * Whether a shop may accept public online bookings.
 * Allowed for FREE_BOOKING and FULL_KERSIVO (incl. paid grace); denied for SETUP and demo shops.
 */
export async function shopAcceptsPublicBookings(shopId: string): Promise<boolean> {
  const access = await loadKersivoAccess(shopId);
  return hasKersivoCapability(access, 'PUBLIC_BOOKING');
}
