import { SHOP_FILTER_LABELS } from '@/lib/shop/productPresentation';
import { getDemoCatalogProducts } from '@/lib/shop/demoCatalog';

export const MIN_CAROUSEL_ITEMS = 10;

export type CarouselProduct = {
  id: string;
  name: string;
  category: string;
  pricePence: number;
  imageUrl: string | null;
  available?: boolean;
  requiresOptions?: boolean;
};

export const CATEGORY_LABELS: Record<string, string> = { ...SHOP_FILTER_LABELS };

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
  const products = getDemoCatalogProducts().map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    pricePence: product.pricePence,
    imageUrl: product.imageUrl,
  }));

  return expandCarouselProducts(products);
}
