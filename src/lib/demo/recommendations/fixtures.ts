import { DEMO_PRODUCTS } from '@/lib/demo/products';
import { DEMO_SERVICES } from '@/lib/demo/services';
import { SCHEMA_VERSION, TAXONOMY_VERSION } from '@/lib/recommendations/constants';
import { buildRankedRecommendationsForService } from '@/lib/recommendations/scorer';
import type { CarouselProduct } from '@/lib/shop/carouselProducts';

import { DEMO_PRODUCT_PROFILES } from './productProfiles';
import { DEMO_SERVICE_PROFILES } from './serviceProfiles';

export { DEMO_PRODUCT_PROFILES } from './productProfiles';
export { DEMO_SERVICE_PROFILES } from './serviceProfiles';

function activeDemoProducts() {
  return DEMO_PRODUCTS.filter((p) => p.active)
    .map((p) => ({
      id: p.id,
      profile: DEMO_PRODUCT_PROFILES[p.id],
    }))
    .filter((row): row is { id: string; profile: (typeof DEMO_PRODUCT_PROFILES)[string] } =>
      Boolean(row.profile),
    );
}

export function getDemoRecommendationProducts(serviceId: string): CarouselProduct[] {
  const service = DEMO_SERVICES.find((s) => s.id === serviceId);
  const serviceSemantic = DEMO_SERVICE_PROFILES[serviceId];
  if (!service || !serviceSemantic) return [];

  const ranked = buildRankedRecommendationsForService(serviceSemantic, activeDemoProducts());
  const productById = new Map(DEMO_PRODUCTS.map((p) => [p.id, p]));

  return ranked
    .map((row) => productById.get(row.productId))
    .filter((p): p is (typeof DEMO_PRODUCTS)[number] => Boolean(p))
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      pricePence: p.pricePence,
      imageUrl: p.image.src,
      available: true,
      requiresOptions: false,
    }));
}

/** Ranked product IDs for a service — used by determinism tests. */
export function getDemoRecommendationProductIds(serviceId: string): string[] {
  return getDemoRecommendationProducts(serviceId).map((p) => p.id);
}

export function rankDemoRecommendationsWithProductOrder(
  serviceId: string,
  productIdsInOrder: string[],
): string[] {
  const serviceSemantic = DEMO_SERVICE_PROFILES[serviceId];
  if (!serviceSemantic) return [];

  const products = productIdsInOrder
    .map((id) => {
      const profile = DEMO_PRODUCT_PROFILES[id];
      return profile ? { id, profile } : null;
    })
    .filter((row): row is { id: string; profile: (typeof DEMO_PRODUCT_PROFILES)[string] } =>
      Boolean(row),
    );

  return buildRankedRecommendationsForService(serviceSemantic, products).map((row) => row.productId);
}

export const DEMO_RECOMMENDATION_FIXTURE_VERSION = `${TAXONOMY_VERSION}:${SCHEMA_VERSION}`;
