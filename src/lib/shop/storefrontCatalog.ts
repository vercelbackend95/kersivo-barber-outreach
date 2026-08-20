import { formatDemoPriceGbp } from '@/lib/demo/services';
import type { DemoProduct } from '@/lib/demo/products';
import type { CarouselProduct } from '@/lib/shop/carouselProducts';
import type { DemoCatalogProduct } from '@/lib/shop/demoCatalog';
import { formatGbp } from '@/lib/shop/money';
import {
  CATEGORY_LABELS,
  PRODUCT_CATEGORY_VALUES,
  isProductCategory,
  type ProductCategory,
} from '@/lib/shop/productPresentation';

export const STOREFRONT_ALL_CATEGORY = 'ALL';
export const STOREFRONT_PAGE_SIZE = 24;
export const STOREFRONT_SORT_MIN_COUNT = 8;
export const STOREFRONT_SORTS = ['recommended', 'price-asc', 'price-desc', 'name'] as const;
export type StorefrontSort = (typeof STOREFRONT_SORTS)[number];

export type StorefrontPriceFormat = 'gbp' | 'demo';

export type StorefrontAvailability = 'all' | 'available';

export type StorefrontQuery = {
  category: string;
  q: string;
  sort: StorefrontSort;
  availability: StorefrontAvailability;
};

export type StorefrontFocalPoint = {
  x: number;
  y: number;
};

export type StorefrontImage = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  /** Percentages 0–100; used by featured full-bleed cover crop. */
  focalPoint?: StorefrontFocalPoint;
};

export type StorefrontProduct = {
  id: string;
  name: string;
  description: string;
  pricePence: number;
  image: StorefrontImage;
  category: ProductCategory;
  featured: boolean;
  sortOrder: number;
  active: boolean;
  available: boolean;
  requiresOptions: boolean;
};

export type StorefrontProductSource = {
  id: string;
  name: string;
  description?: string | null;
  pricePence: number;
  category: string;
  featured?: boolean;
  sortOrder?: number;
  active?: boolean;
  requiresOptions?: boolean;
  imageUrl?: string | null;
  image?: {
    src: string;
    alt?: string;
    width?: number;
    height?: number;
    sizes?: string;
    focalPoint?: StorefrontFocalPoint;
  };
};

export type StorefrontCategoryOption = {
  value: typeof STOREFRONT_ALL_CATEGORY | ProductCategory;
  label: string;
  count: number;
};

const CATEGORY_ORDER = [...PRODUCT_CATEGORY_VALUES];

export function formatStorefrontPrice(
  pence: number,
  format: StorefrontPriceFormat = 'gbp',
): string {
  return format === 'demo' ? formatDemoPriceGbp(pence) : formatGbp(pence);
}

export function storefrontProductHref(prefix: string, id: string): string {
  const base = prefix.replace(/\/+$/, '');
  return `${base}/${encodeURIComponent(id)}`;
}

export function parseStorefrontCategoryParam(
  param: string | null | undefined,
  validValues: Iterable<string>,
): string {
  const allowed = new Set(validValues);
  const value = param?.trim() || STOREFRONT_ALL_CATEGORY;
  return allowed.has(value) ? value : STOREFRONT_ALL_CATEGORY;
}

export function parseStorefrontSortParam(param: string | null | undefined): StorefrontSort {
  const value = param?.trim() as StorefrontSort | undefined;
  return value && STOREFRONT_SORTS.includes(value) ? value : 'recommended';
}

export function parseStorefrontAvailabilityParam(
  param: string | null | undefined,
): StorefrontAvailability {
  return param === 'available' ? 'available' : 'all';
}

export function parseStorefrontQuery(
  search: { get(name: string): string | null },
  validCategories: Iterable<string>,
): StorefrontQuery {
  return {
    category: parseStorefrontCategoryParam(search.get('category'), validCategories),
    q: (search.get('q') ?? '').trim(),
    sort: parseStorefrontSortParam(search.get('sort')),
    availability: parseStorefrontAvailabilityParam(search.get('availability')),
  };
}

export function storefrontQuerySearch(query: Partial<StorefrontQuery> = {}): string {
  const params = new URLSearchParams();
  if (query.category && query.category !== STOREFRONT_ALL_CATEGORY) {
    params.set('category', query.category);
  }
  if (query.q?.trim()) params.set('q', query.q.trim());
  if (query.sort && query.sort !== 'recommended') params.set('sort', query.sort);
  if (query.availability === 'available') params.set('availability', 'available');
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export function storefrontCategorySearch(category: string): string {
  return storefrontQuerySearch({ category });
}

export function storefrontLoadedStorageKey(shopKey: string, query: StorefrontQuery): string {
  return `kersivo.storefront.loaded:${shopKey}:${storefrontQuerySearch(query) || 'all'}`;
}

function resolveCategory(value: string): ProductCategory {
  return isProductCategory(value) ? value : 'STYLING';
}

export function clampStorefrontFocalPoint(
  focalPoint?: StorefrontFocalPoint | null,
): StorefrontFocalPoint {
  const clamp = (value: unknown, fallback: number) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(100, Math.max(0, n));
  };
  return {
    x: clamp(focalPoint?.x, 50),
    y: clamp(focalPoint?.y, 50),
  };
}

function resolveImage(source: StorefrontProductSource): StorefrontImage {
  if (source.image?.src) {
    const image: StorefrontImage = {
      src: source.image.src,
      alt: source.image.alt?.trim() || source.name,
      width: source.image.width,
      height: source.image.height,
      sizes: source.image.sizes,
    };
    if (source.image.focalPoint) {
      image.focalPoint = clampStorefrontFocalPoint(source.image.focalPoint);
    }
    return image;
  }

  return {
    src: source.imageUrl?.trim() || '',
    alt: source.name,
  };
}

export function toStorefrontProduct(source: StorefrontProductSource): StorefrontProduct {
  const active = source.active !== false;
  return {
    id: source.id,
    name: source.name,
    description: source.description?.trim() || '',
    pricePence: source.pricePence,
    image: resolveImage(source),
    category: resolveCategory(source.category),
    featured: Boolean(source.featured),
    sortOrder: source.sortOrder ?? 0,
    active,
    available: active,
    requiresOptions: Boolean(source.requiresOptions),
  };
}

export function storefrontProductFromPrisma(source: StorefrontProductSource): StorefrontProduct {
  return toStorefrontProduct(source);
}

export function storefrontProductFromDemo(product: DemoProduct): StorefrontProduct {
  return toStorefrontProduct({
    id: product.id,
    name: product.name,
    description: product.description,
    pricePence: product.pricePence,
    category: product.category,
    featured: product.featured,
    sortOrder: product.sortOrder,
    active: product.active,
    image: product.image,
  });
}

export function storefrontProductFromCatalog(product: DemoCatalogProduct): StorefrontProduct {
  return toStorefrontProduct({
    id: product.id,
    name: product.name,
    description: product.description,
    pricePence: product.pricePence,
    category: product.category,
    featured: product.featured,
    sortOrder: product.sortOrder,
    active: product.active,
    imageUrl: product.imageUrl,
  });
}

export function visibleProducts(list: readonly StorefrontProduct[]): StorefrontProduct[] {
  return list.filter((product) => product.active);
}

export function featuredProducts(list: readonly StorefrontProduct[]): StorefrontProduct[] {
  return visibleProducts(list)
    .filter((product) => product.featured)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function searchStorefrontProducts(
  list: readonly StorefrontProduct[],
  q: string,
): StorefrontProduct[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [...list];
  return list.filter((product) => {
    const haystack = `${product.name} ${product.description} ${CATEGORY_LABELS[product.category]}`.toLowerCase();
    return haystack.includes(needle);
  });
}

export function filterByAvailability(
  list: readonly StorefrontProduct[],
  availability: StorefrontAvailability = 'all',
): StorefrontProduct[] {
  if (availability !== 'available') return [...list];
  return list.filter((product) => product.available);
}

export function collectStorefrontProducts(
  list: readonly StorefrontProduct[],
  query: StorefrontQuery,
): StorefrontProduct[] {
  const byCategory = filterByCategory(list, query.category);
  const byAvailability = filterByAvailability(byCategory, query.availability);
  const searched = searchStorefrontProducts(byAvailability, query.q);
  return sortStorefrontProducts(searched, query.sort);
}

export function paginateStorefrontProducts(
  list: readonly StorefrontProduct[],
  loadedCount: number,
  pageSize = STOREFRONT_PAGE_SIZE,
): { visible: StorefrontProduct[]; loadedCount: number; total: number; hasMore: boolean } {
  const total = list.length;
  const count = Math.min(Math.max(pageSize, loadedCount), total);
  return {
    visible: list.slice(0, count),
    loadedCount: count,
    total,
    hasMore: count < total,
  };
}

export type RelatedStorefrontProductsOptions = {
  limit?: number;
  /** When true, pad with other categories after same-category matches. */
  fill?: boolean;
};

export function relatedStorefrontProducts(
  list: readonly StorefrontProduct[],
  productId: string,
  limitOrOptions: number | RelatedStorefrontProductsOptions = 4,
): StorefrontProduct[] {
  const options: RelatedStorefrontProductsOptions =
    typeof limitOrOptions === 'number' ? { limit: limitOrOptions } : limitOrOptions;
  const limit = options.limit ?? 4;
  const fill = options.fill === true;

  const current = list.find((product) => product.id === productId);
  if (!current) return [];

  const active = visibleProducts(list);
  const sortRelated = (a: StorefrontProduct, b: StorefrontProduct) =>
    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

  const sameCategory = active
    .filter((product) => product.id !== productId && product.category === current.category)
    .sort(sortRelated);

  if (!fill || sameCategory.length >= limit) {
    return sameCategory.slice(0, limit);
  }

  const sameIds = new Set(sameCategory.map((product) => product.id));
  const fillers = active
    .filter((product) => product.id !== productId && !sameIds.has(product.id))
    .sort(sortRelated);

  return [...sameCategory, ...fillers].slice(0, limit);
}

/** Map storefront catalog products into the ProductRail / CarouselProduct shape. */
export function storefrontProductToCarousel(product: StorefrontProduct): CarouselProduct {
  const src = product.image?.src?.trim() ?? '';
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    pricePence: product.pricePence,
    imageUrl: src.length > 0 ? src : null,
    available: product.available,
    requiresOptions: product.requiresOptions,
  };
}

export function visibleCategories(list: readonly StorefrontProduct[]): ProductCategory[] {
  const counts = new Map<ProductCategory, number>();
  for (const product of visibleProducts(list)) {
    counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
  }
  return CATEGORY_ORDER.filter((category) => (counts.get(category) ?? 0) > 0);
}

export function storefrontCategoryOptions(list: readonly StorefrontProduct[]): StorefrontCategoryOption[] {
  const visible = visibleProducts(list);
  const options: StorefrontCategoryOption[] = [
    {
      value: STOREFRONT_ALL_CATEGORY,
      label: 'All products',
      count: visible.length,
    },
  ];

  for (const category of visibleCategories(list)) {
    options.push({
      value: category,
      label: CATEGORY_LABELS[category],
      count: visible.filter((product) => product.category === category).length,
    });
  }

  return options;
}

export function filterByCategory(
  list: readonly StorefrontProduct[],
  category: string,
): StorefrontProduct[] {
  const visible = visibleProducts(list);
  if (!category || category === STOREFRONT_ALL_CATEGORY) return visible;
  const resolved = resolveCategory(category);
  return visible.filter((product) => product.category === resolved);
}

export function sortStorefrontProducts(
  list: readonly StorefrontProduct[],
  sort: StorefrontSort = 'recommended',
): StorefrontProduct[] {
  const next = [...list];
  next.sort((a, b) => {
    if (sort === 'price-asc') return a.pricePence - b.pricePence || a.name.localeCompare(b.name);
    if (sort === 'price-desc') return b.pricePence - a.pricePence || a.name.localeCompare(b.name);
    if (sort === 'name') return a.name.localeCompare(b.name);
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  });
  return next;
}

export function shopInitial(shopName: string | null | undefined): string {
  const trimmed = shopName?.trim() ?? '';
  return (trimmed.charAt(0) || 'S').toUpperCase();
}

export function productInitials(name: string | null | undefined): string {
  const words = (name?.trim() ?? '').split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]!.charAt(0)}${words[1]!.charAt(0)}`.toUpperCase();
  }
  const compact = words[0] ?? '';
  if (compact.length >= 2) return compact.slice(0, 2).toUpperCase();
  return (compact.charAt(0) || 'BL').toUpperCase();
}
