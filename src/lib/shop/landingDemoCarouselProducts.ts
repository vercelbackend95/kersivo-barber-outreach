import type { CarouselProduct } from '@/lib/shop/carouselProducts';
// Client-safe imports only: DeferredWidget loads this module in the browser (no Prisma, no db).
import { HERITAGE_PRODUCTS, type HeritageProduct } from '@/lib/demo/heritage/data';

const LANDING_RAIL_COUNT = 10;

/** Heritage Grooming's shelf for the landing retail rail: the featured six first, then shelf order. */
function selectHeritageLandingRailProducts(limit = LANDING_RAIL_COUNT): HeritageProduct[] {
  const featured = HERITAGE_PRODUCTS.filter((product) => product.featured);
  const rest = HERITAGE_PRODUCTS.filter((product) => !product.featured);
  return [...featured, ...rest].slice(0, limit);
}

function resolveHeritageLandingCarouselProducts(): CarouselProduct[] {
  return selectHeritageLandingRailProducts().map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    pricePence: product.pricePence,
    imageUrl: product.imageSrc,
    available: true,
    requiresOptions: false,
  }));
}

export async function resolveLandingDemoCarouselProducts(): Promise<CarouselProduct[]> {
  return resolveHeritageLandingCarouselProducts();
}

/** @deprecated Use resolveLandingDemoCarouselProducts for SSR with images. */
export function getLandingDemoCarouselProducts(): CarouselProduct[] {
  return resolveHeritageLandingCarouselProducts();
}
