import { prisma } from '@/lib/db/client';
import { withPrismaResilienceFallback } from '@/lib/db/resilience';
import { resolveShopId } from '@/lib/db/shopScope';
import type { CarouselProduct } from '@/lib/shop/carouselProducts';

const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  POMADES_AND_CLAYS: '/images/landing-retail-demo/pomade-jar.svg',
  STYLING: '/images/landing-retail-demo/styling-spray.svg',
  BEARD_CARE: '/images/landing-retail-demo/beard-oil.svg',
  HAIR_WASH: '/images/landing-retail-demo/styling-spray.svg',
  TOOLS: '/images/landing-retail-demo/pomade-jar.svg',
  GIFT_SETS: '/images/landing-retail-demo/beard-oil.svg',
};

const LANDING_DEMO_PRODUCTS: CarouselProduct[] = [
  {
    id: 'landing-demo-pomade',
    name: 'Pomade',
    category: 'POMADES_AND_CLAYS',
    pricePence: 1700,
    imageUrl: null,
  },
  {
    id: 'landing-demo-matte-clay',
    name: 'Matte Clay',
    category: 'POMADES_AND_CLAYS',
    pricePence: 1600,
    imageUrl: null,
  },
  {
    id: 'landing-demo-sea-salt-spray',
    name: 'Sea Salt Spray',
    category: 'STYLING',
    pricePence: 1400,
    imageUrl: null,
  },
];

function fallbackImageForCategory(category: string): string {
  return CATEGORY_FALLBACK_IMAGES[category] ?? '/images/landing-retail-demo/pomade-jar.svg';
}

async function fetchShopProductImagesByCategory(): Promise<Map<string, string[]>> {
  const { products } = await withPrismaResilienceFallback(
    'lib/shop/landingDemoCarouselProducts',
    async () => {
      const shopId = await resolveShopId();
      const products = await prisma.product.findMany({
        where: { shopId, active: true, imageUrl: { not: null } },
        orderBy: [{ sortOrder: 'asc' }, { featured: 'desc' }, { updatedAt: 'desc' }],
        select: {
          category: true,
          imageUrl: true,
        },
      });

      return { products };
    },
    { products: [] },
  );

  const byCategory = new Map<string, string[]>();

  for (const product of products) {
    const imageUrl = product.imageUrl?.trim();
    if (!imageUrl) continue;

    const existing = byCategory.get(product.category) ?? [];
    if (!existing.includes(imageUrl)) {
      existing.push(imageUrl);
      byCategory.set(product.category, existing);
    }
  }

  return byCategory;
}

function resolveImageForSlot(
  category: string,
  imagesByCategory: Map<string, string[]>,
  usedImages: Set<string>,
  fallbackPool: string[],
): string {
  const categoryImages = imagesByCategory.get(category) ?? [];
  const categoryMatch = categoryImages.find((url) => !usedImages.has(url));
  if (categoryMatch) {
    usedImages.add(categoryMatch);
    return categoryMatch;
  }

  const poolMatch = fallbackPool.find((url) => !usedImages.has(url));
  if (poolMatch) {
    usedImages.add(poolMatch);
    return poolMatch;
  }

  return fallbackImageForCategory(category);
}

export async function resolveLandingDemoCarouselProducts(): Promise<CarouselProduct[]> {
  const imagesByCategory = await fetchShopProductImagesByCategory();
  const fallbackPool = [...imagesByCategory.values()].flat();
  const usedImages = new Set<string>();

  return LANDING_DEMO_PRODUCTS.map((product) => ({
    ...product,
    imageUrl: resolveImageForSlot(product.category, imagesByCategory, usedImages, fallbackPool),
  }));
}

/** @deprecated Use resolveLandingDemoCarouselProducts for SSR with images. */
export function getLandingDemoCarouselProducts(): CarouselProduct[] {
  return LANDING_DEMO_PRODUCTS.map((product) => ({
    ...product,
    imageUrl: fallbackImageForCategory(product.category),
  }));
}
