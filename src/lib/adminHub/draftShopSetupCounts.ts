import { prisma } from '@/lib/db/client';
import type { SetupShopCounts } from './setupCard';

export const EMPTY_DRAFT_SHOP_COUNTS: SetupShopCounts = {
  activeServices: 0,
  activeBarbers: 0,
  products: 0,
};

/** One query per page load: active services, active team members, and products on the draft shop. */
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

/** No draft shop → zeros. Never invents catalogue numbers. */
export function draftShopCountsOrZero(counts: SetupShopCounts | null | undefined): SetupShopCounts {
  return counts ?? EMPTY_DRAFT_SHOP_COUNTS;
}
