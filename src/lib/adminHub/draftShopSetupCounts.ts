import { prisma } from '@/lib/db/client';
import type { SetupShopCounts } from './setupCard';

/** One query: active services, barbers with online bookings on, and products on the draft shop. */
export async function loadDraftShopSetupCounts(shopId: string | null | undefined): Promise<SetupShopCounts | null> {
  if (!shopId) return null;
  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: {
      _count: {
        select: {
          services: { where: { isActive: true } },
          barbers: { where: { active: true } },
          products: true,
        },
      },
    },
  });
  if (!shop) return null;
  return {
    activeServices: shop._count.services,
    activeBarbers: shop._count.barbers,
    products: shop._count.products,
  };
}
