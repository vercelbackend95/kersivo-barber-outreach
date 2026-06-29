import { prisma } from '@/lib/db/client';
import { withPrismaResilienceFallback } from '@/lib/db/resilience';
import { resolveShopId } from '@/lib/db/shopScope';

export const MIN_CAROUSEL_ITEMS = 10;

export type CarouselProduct = {
  id: string;
  name: string;
  category: string;
  pricePence: number;
  imageUrl: string | null;
};

export const CATEGORY_LABELS: Record<string, string> = {
  POMADES_AND_CLAYS: 'Pomades',
  BEARD_CARE: 'Beard',
  HAIR_WASH: 'Wash',
  STYLING: 'Styling',
  TOOLS: 'Tools',
  GIFT_SETS: 'Sets',
};

export function expandCarouselProducts(products: CarouselProduct[]): CarouselProduct[] {
  if (products.length === 0) {
    return [];
  }

  if (products.length < MIN_CAROUSEL_ITEMS) {
    return Array.from({ length: MIN_CAROUSEL_ITEMS }, (_, index) => products[index % products.length]);
  }

  return products;
}

export async function fetchCarouselProducts(): Promise<CarouselProduct[]> {
  const { products } = await withPrismaResilienceFallback(
    'lib/shop/carouselProducts',
    async () => {
      const shopId = await resolveShopId();
      const products = await prisma.product.findMany({
        where: { shopId, active: true },
        orderBy: [{ sortOrder: 'asc' }, { featured: 'desc' }, { updatedAt: 'desc' }],
        take: 10,
        select: {
          id: true,
          name: true,
          category: true,
          pricePence: true,
          imageUrl: true,
        },
      });

      return { products };
    },
    { products: [] },
  );

  return expandCarouselProducts(products);
}
