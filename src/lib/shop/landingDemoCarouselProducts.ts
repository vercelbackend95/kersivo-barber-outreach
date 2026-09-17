import type { CarouselProduct } from '@/lib/shop/carouselProducts';
import {
  selectBlacklineLandingRailProducts,
  toBlacklineCarouselProducts,
} from '@/lib/demo/blacklineShop';
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
