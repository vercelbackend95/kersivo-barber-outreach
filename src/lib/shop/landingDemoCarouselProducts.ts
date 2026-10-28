import type { CarouselProduct } from '@/lib/shop/carouselProducts';
// Client-safe import: this module is loaded in the browser by DeferredWidget, so it must not
// pull in blacklineShop.ts (which imports the Prisma client).
import {
  selectBlacklineLandingRailProducts,
  toBlacklineCarouselProducts,
} from '@/lib/demo/blacklineLandingRail';
import { DEMO_PRODUCTS } from '@/lib/demo/products';

function resolveBlacklineLandingCarouselProducts(): CarouselProduct[] {
  return toBlacklineCarouselProducts(selectBlacklineLandingRailProducts(DEMO_PRODUCTS));
}

export async function resolveLandingDemoCarouselProducts(): Promise<CarouselProduct[]> {
  return resolveBlacklineLandingCarouselProducts();
}

/** @deprecated Use resolveLandingDemoCarouselProducts for SSR with images. */
export function getLandingDemoCarouselProducts(): CarouselProduct[] {
  return resolveBlacklineLandingCarouselProducts();
}
