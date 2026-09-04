import { prisma } from '@/lib/db/client';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import { BLACKLINE_SHOP_ID } from '@/lib/demo/products';
import { canSellRetail } from '@/lib/shop/cardPaymentsGate';
import { scheduleCatalogueRebuild } from './scheduleCatalogueRebuild';

/** Max shops without recommendation state to bootstrap per cron invocation. */
export const RECOMMENDATION_BOOTSTRAP_BATCH_SIZE = 5;

export type BootstrapEligibleShopsResult = {
  considered: number;
  bootstrapped: number;
  skippedExisting: number;
  shopIds: string[];
};

/**
 * Create pending initial catalogue work for retail-eligible tenant shops that
 * have never received a ShopRecommendationState row. Idempotent and bounded.
 */
export async function bootstrapEligibleRecommendationShops(
  now = new Date(),
  options?: {
    batchSize?: number;
    db?: typeof prisma;
  },
): Promise<BootstrapEligibleShopsResult> {
  const db = options?.db ?? prisma;
  const batchSize = options?.batchSize ?? RECOMMENDATION_BOOTSTRAP_BATCH_SIZE;

  const candidates = await db.shopSettings.findMany({
    where: {
      id: { notIn: [DEMO_SHOP_ID, BLACKLINE_SHOP_ID] },
      retailEnabled: true,
      stripeConnectChargesEnabled: true,
      stripeConnectAccountId: { not: null },
      OR: [{ shopPaidAt: { not: null } }, { smsRemindersEnabled: true }],
      recommendationState: null,
      services: { some: { isActive: true } },
      products: { some: { active: true } },
    },
    select: {
      id: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      stripeConnectAccountId: true,
      stripeConnectChargesEnabled: true,
      retailEnabled: true,
    },
    take: batchSize,
    orderBy: { id: 'asc' },
  });

  let bootstrapped = 0;
  let skippedExisting = 0;
  const shopIds: string[] = [];

  for (const shop of candidates) {
    if (
      !canSellRetail({
        id: shop.id,
        shopPaidAt: shop.shopPaidAt,
        smsRemindersEnabled: shop.smsRemindersEnabled,
        stripeConnectAccountId: shop.stripeConnectAccountId,
        stripeConnectChargesEnabled: shop.stripeConnectChargesEnabled,
        retailEnabled: shop.retailEnabled,
      })
    ) {
      continue;
    }

    const existing = await db.shopRecommendationState.findUnique({
      where: { shopId: shop.id },
      select: { shopId: true },
    });
    if (existing) {
      skippedExisting += 1;
      continue;
    }

    await scheduleCatalogueRebuild(shop.id, db, now);
    bootstrapped += 1;
    shopIds.push(shop.id);
  }

  return {
    considered: candidates.length,
    bootstrapped,
    skippedExisting,
    shopIds,
  };
}
