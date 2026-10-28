/**
 * Pure helpers for the BLACKLINE landing product rail.
 *
 * Client-safe: this module must not import Prisma, `@/lib/db/*` or anything that reads
 * `process.env` at load time, because the homepage demo carousel imports it in the browser
 * (see `src/components/landing/DeferredWidget.tsx`).
 */
import type { CarouselProduct } from '@/lib/shop/carouselProducts';
import type { DemoProduct } from './products';

/** Map BLACKLINE retail products onto the shared ProductRail product shape. */
export function toBlacklineCarouselProducts(products: readonly DemoProduct[]): CarouselProduct[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    pricePence: product.pricePence,
    imageUrl: product.image.src?.trim() ? product.image.src : null,
    available: true,
    requiresOptions: false,
  }));
}

const DEFAULT_LANDING_RAIL_COUNT = 10;

/** Featured first, then remaining catalogue order; unique IDs; capped for the landing rail. */
export function selectBlacklineLandingRailProducts(
  products: readonly DemoProduct[],
  limit = DEFAULT_LANDING_RAIL_COUNT,
): DemoProduct[] {
  const featured = products.filter((product) => product.featured);
  const rest = products.filter((product) => !product.featured);
  const seen = new Set<string>();
  const ordered: DemoProduct[] = [];

  for (const product of [...featured, ...rest]) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    ordered.push(product);
    if (ordered.length >= limit) break;
  }

  return ordered;
}
