import { prisma } from '@/lib/db/client';

export { RETAIL_SETUP_TOTAL_STEPS } from '@/lib/admin/retailOnboardingConstants';


export type RetailOnboardingProductRef = {
  id: string;
  name: string;
  category: string;
};

/**
 * Resolve the product created during retail onboarding for this shop only.
 * Persists retailOnboardingProductId when recovered via fallback.
 * Only returns active products (inactive ids are cleared so the walkthrough can recover).
 */
export async function resolveRetailOnboardingProduct(
  shopId: string,
): Promise<{
  product: RetailOnboardingProductRef | null;
  retailTestOrderId: string | null;
  retailOnboardingCompleted: boolean;
  retailOnboardingSkipped: boolean;
  retailPickupWalkthroughCompleted: boolean;
}> {
  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: {
      retailOnboardingCompleted: true,
      retailOnboardingSkipped: true,
      retailOnboardingCompletedAt: true,
      retailOnboardingProductId: true,
      retailTestOrderId: true,
      retailPickupWalkthroughCompletedAt: true,
    },
  });

  if (!shop) {
    return {
      product: null,
      retailTestOrderId: null,
      retailOnboardingCompleted: false,
      retailOnboardingSkipped: false,
      retailPickupWalkthroughCompleted: false,
    };
  }

  let productId = shop.retailOnboardingProductId;

  if (productId) {
    const owned = await prisma.product.findFirst({
      where: { id: productId, shopId },
      select: { id: true, name: true, category: true, active: true },
    });
    if (owned?.active) {
      return {
        product: { id: owned.id, name: owned.name, category: owned.category },
        retailTestOrderId: shop.retailTestOrderId,
        retailOnboardingCompleted: shop.retailOnboardingCompleted,
        retailOnboardingSkipped: shop.retailOnboardingSkipped,
        retailPickupWalkthroughCompleted: Boolean(shop.retailPickupWalkthroughCompletedAt),
      };
    }

    // Stale / inactive id — clear so fallbacks can re-attach an active product.
    await prisma.shopSettings.updateMany({
      where: { id: shopId, retailOnboardingProductId: productId },
      data: { retailOnboardingProductId: null },
    });
    productId = null;
  }

  if (shop.retailOnboardingCompleted && !productId) {
    const completedAt = shop.retailOnboardingCompletedAt;
    const fallback =
      (completedAt
        ? await prisma.product.findFirst({
            where: {
              shopId,
              active: true,
              createdAt: { gte: new Date(completedAt.getTime() - 60_000) },
            },
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true, category: true },
          })
        : null) ??
      (await prisma.product.findFirst({
        where: { shopId, active: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, category: true },
      }));

    if (fallback) {
      await prisma.shopSettings.updateMany({
        where: { id: shopId, retailOnboardingProductId: null },
        data: { retailOnboardingProductId: fallback.id },
      });
      return {
        product: fallback,
        retailTestOrderId: shop.retailTestOrderId,
        retailOnboardingCompleted: shop.retailOnboardingCompleted,
        retailOnboardingSkipped: shop.retailOnboardingSkipped,
        retailPickupWalkthroughCompleted: Boolean(shop.retailPickupWalkthroughCompletedAt),
      };
    }
  }

  return {
    product: null,
    retailTestOrderId: shop.retailTestOrderId,
    retailOnboardingCompleted: shop.retailOnboardingCompleted,
    retailOnboardingSkipped: shop.retailOnboardingSkipped,
    retailPickupWalkthroughCompleted: Boolean(shop.retailPickupWalkthroughCompletedAt),
  };
}
