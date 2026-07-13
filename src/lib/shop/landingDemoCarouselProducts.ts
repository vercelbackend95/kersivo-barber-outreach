import type { CarouselProduct } from '@/lib/shop/carouselProducts';
import { getDemoCatalogProducts } from '@/lib/shop/demoCatalog';

export async function resolveLandingDemoCarouselProducts(): Promise<CarouselProduct[]> {
  return getDemoCatalogProducts().map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    pricePence: product.pricePence,
    imageUrl: product.imageUrl,
  }));
}

/** @deprecated Use resolveLandingDemoCarouselProducts for SSR with images. */
export function getLandingDemoCarouselProducts(): CarouselProduct[] {
  return getDemoCatalogProducts().map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    pricePence: product.pricePence,
    imageUrl: product.imageUrl,
  }));
}
