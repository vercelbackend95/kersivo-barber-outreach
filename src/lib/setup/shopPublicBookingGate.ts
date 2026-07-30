import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import { prisma } from '@/lib/db/client';
import { isPaidShop } from '@/lib/shop/paidShop';
import { saasSubscriptionGrantsAccess } from '@/lib/setup/saasEntitlement';

/**
 * Whether a shop may accept public online bookings (paid + not suspended).
 * Loads the latest non-PENDING SaaS subscription when present.
 */
export async function shopAcceptsPublicBookings(shopId: string): Promise<boolean> {
  const id = shopId.trim();
  if (!id || id === DEMO_SHOP_ID) return false;

  const shop = await prisma.shopSettings.findUnique({
    where: { id },
    select: { id: true, shopPaidAt: true, smsRemindersEnabled: true },
  });
  if (!shop) return false;

  const subscription = await prisma.saasSubscription.findFirst({
    where: { shopId: id, status: { not: 'PENDING' } },
    orderBy: { createdAt: 'desc' },
    select: {
      status: true,
      currentPeriodEnd: true,
      pastDueSince: true,
      cancelAtPeriodEnd: true,
    },
  });

  if (subscription) {
    return saasSubscriptionGrantsAccess(subscription);
  }

  return isPaidShop(shop);
}
