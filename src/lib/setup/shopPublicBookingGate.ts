import { prisma } from '@/lib/db/client';
import { STARTER_MIN_PUBLIC_SERVICE_PRICE_PENCE } from '@/lib/booking/bookingPaymentPolicy';
import { evaluateBookingPayments } from '@/lib/booking/bookingPaymentsGate';
import { hasKersivoCapability, loadKersivoAccess } from '@/lib/shop/kersivoAccess';

/**
 * Whether a shop may accept NEW public online bookings.
 *
 * v1.19 Starter adds a launch/runtime readiness layer on top of entitlement:
 * - PUBLIC_BOOKING entitlement must still exist;
 * - Stripe Connect must be payment-ready;
 * - at least one active service must exist;
 * - no active Starter service may be priced below £5.
 *
 * Full keeps its existing entitlement behaviour here. Its payment mode remains authoritative
 * inside booking creation: online-payment modes fail closed when Stripe is unavailable, while
 * Full Pay-at-shop may continue without Stripe.
 */
export async function shopAcceptsPublicBookings(shopId: string): Promise<boolean> {
  const access = await loadKersivoAccess(shopId);
  if (!hasKersivoCapability(access, 'PUBLIC_BOOKING')) return false;
  if (access.state !== 'FREE_BOOKING') return true;

  const [shop, anyActiveService, underpricedActiveService] = await Promise.all([
    prisma.shopSettings.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        stripeConnectAccountId: true,
        stripeConnectChargesEnabled: true,
        stripeConnectDisconnectedAt: true,
      },
    }),
    prisma.service.findFirst({
      where: { shopId, isActive: true },
      select: { id: true },
    }),
    prisma.service.findFirst({
      where: {
        shopId,
        isActive: true,
        pricePence: { lt: STARTER_MIN_PUBLIC_SERVICE_PRICE_PENCE },
      },
      select: { id: true },
    }),
  ]);

  if (!shop || !anyActiveService || underpricedActiveService) return false;

  return evaluateBookingPayments({ shop, access }).ok;
}
