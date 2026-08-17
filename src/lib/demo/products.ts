import type { ProductCategory } from '@/lib/shop/productPresentation';
import { DEMO_SHOP_KEY } from './services';

export const BLACKLINE_SHOP_ID = DEMO_SHOP_KEY;
export const BLACKLINE_CART_STORAGE_KEY = `kersivo_shop_cart_v2:${BLACKLINE_SHOP_ID}`;
export const BLACKLINE_MAX_QUANTITY = 10;
export const BLACKLINE_CONFIRMATION_STORAGE_KEY = 'kersivo_blackline_demo_order_v1';

export type DemoProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  pricePence: number;
  featured: boolean;
  category: ProductCategory;
  sortOrder: number;
  active: boolean;
  image: {
    src: string;
    width: number;
    height: number;
    alt: string;
    sizes: string;
  };
};

const PRODUCT_IMAGE_SIZES = '(max-width: 639px) 92vw, (max-width: 1024px) 46vw, 720px';

export const DEMO_PRODUCTS: readonly DemoProduct[] = [
  {
    id: 'bl-product-ironclad-pomade',
    slug: 'ironclad-pomade',
    name: 'Ironclad Pomade',
    description: 'Firm hold pomade for sharp lines and longer-lasting structure. Light sheen, not greasy.',
    pricePence: 1900,
    featured: true,
    category: 'POMADES_AND_CLAYS',
    sortOrder: 0,
    active: true,
    image: {
      src: '/demo/products/ironclad-pomade.webp',
      width: 1254,
      height: 1254,
      alt: 'Graphite tin labelled Ironclad Pomade in the fictional BLACKLINE shop.',
      sizes: PRODUCT_IMAGE_SIZES,
    },
  },
  {
    id: 'bl-product-matte-pomade',
    slug: 'matte-pomade',
    name: 'Matte Pomade',
    description: 'Medium hold with a clean matte finish. Easy restyle through the day without shine.',
    pricePence: 1800,
    featured: false,
    category: 'POMADES_AND_CLAYS',
    sortOrder: 1,
    active: true,
    image: {
      src: '/demo/products/matte-pomade.webp',
      width: 1254,
      height: 1254,
      alt: 'Matte tin labelled North and Steel Matte Pomade in the fictional BLACKLINE shop.',
      sizes: PRODUCT_IMAGE_SIZES,
    },
  },
  {
    id: 'bl-product-beard-balm',
    slug: 'beard-balm',
    name: 'Beard Balm',
    description: 'Nourishing balm for shape and control. Softens coarser beards without a heavy cast.',
    pricePence: 1600,
    featured: true,
    category: 'BEARD_CARE',
    sortOrder: 2,
    active: true,
    image: {
      src: '/demo/products/beard-balm.webp',
      width: 1254,
      height: 1254,
      alt: 'Metal tin labelled Northline Beard Balm in the fictional BLACKLINE shop.',
      sizes: PRODUCT_IMAGE_SIZES,
    },
  },
  {
    id: 'bl-product-sea-salt-texture-spray',
    slug: 'sea-salt-texture-spray',
    name: 'Sea Salt Texture Spray',
    description: 'Beach-texture spray for grip and movement. Mist, scrunch, air-dry or blow-dry.',
    pricePence: 1400,
    featured: false,
    category: 'STYLING',
    sortOrder: 3,
    active: true,
    image: {
      src: '/demo/products/sea-salt-texture-spray.webp',
      width: 1122,
      height: 1402,
      alt: 'Black spray bottle labelled North and Steel Sea Salt Texture Spray in the fictional BLACKLINE shop.',
      sizes: PRODUCT_IMAGE_SIZES,
    },
  },
  {
    id: 'bl-product-beard-oil',
    slug: 'beard-oil',
    name: 'Beard Oil',
    description: 'Lightweight conditioning oil that softens hair and calms skin underneath.',
    pricePence: 2200,
    featured: false,
    category: 'BEARD_CARE',
    sortOrder: 4,
    active: true,
    image: {
      src: '/demo/products/beard-oil.webp',
      width: 1122,
      height: 1402,
      alt: 'Amber dropper bottle labelled North and Steel Beard Oil in the fictional BLACKLINE shop.',
      sizes: PRODUCT_IMAGE_SIZES,
    },
  },
  {
    id: 'bl-product-barber-wash',
    slug: 'barber-wash',
    name: 'Barber Wash',
    description: 'Barbershop-strength wash for product build-up. Leaves hair ready to style.',
    pricePence: 1500,
    featured: true,
    category: 'HAIR_WASH',
    sortOrder: 5,
    active: true,
    image: {
      src: '/demo/products/barber-wash.webp',
      width: 1254,
      height: 1254,
      alt: 'Black pump bottle labelled Barber Wash in the fictional BLACKLINE shop.',
      sizes: PRODUCT_IMAGE_SIZES,
    },
  },
  {
    id: 'bl-product-forge-styling-powder',
    slug: 'forge-styling-powder',
    name: 'Forge Styling Powder',
    description: 'Matte powder for root lift and grit. Tap on dry hair for instant texture.',
    pricePence: 1200,
    featured: false,
    category: 'STYLING',
    sortOrder: 6,
    active: true,
    image: {
      src: '/demo/products/forge-styling-powder.webp',
      width: 1254,
      height: 1254,
      alt: 'Black jar labelled Forge Styling Powder in the fictional BLACKLINE shop.',
      sizes: PRODUCT_IMAGE_SIZES,
    },
  },
] as const;

export const DEMO_FEATURED_PRODUCTS = DEMO_PRODUCTS.filter((product) => product.featured);

export const DEMO_PRODUCT_IDS = DEMO_PRODUCTS.map((product) => product.id);

const PRODUCT_BY_ID = new Map(DEMO_PRODUCTS.map((product) => [product.id, product]));
const PRODUCT_BY_SLUG = new Map(DEMO_PRODUCTS.map((product) => [product.slug, product]));

export function getDemoProductById(id: string): DemoProduct | null {
  return PRODUCT_BY_ID.get(id) ?? null;
}

export function getDemoProductBySlug(slug: string): DemoProduct | null {
  return PRODUCT_BY_SLUG.get(slug.trim().toLowerCase()) ?? null;
}

export function demoProductHref(id: string): string {
  return `/demo/shop/${encodeURIComponent(id)}`;
}

export function demoProductsMeta(products: readonly DemoProduct[] = DEMO_PRODUCTS) {
  const visible = products.filter((product) => product.active);
  const count = visible.length;
  return {
    count,
    countPadded: String(count).padStart(2, '0'),
    countLabel: `${String(count).padStart(2, '0')} PRODUCTS`,
  };
}

export function mergeBlacklineProductRow(row: {
  id: string;
  name: string;
  description: string | null;
  pricePence: number;
  imageUrl: string | null;
  active: boolean;
  featured: boolean;
  category: ProductCategory;
  sortOrder: number;
}): DemoProduct | null {
  const fixture = getDemoProductById(row.id);
  if (!fixture) return null;
  return {
    ...fixture,
    name: row.name,
    description: row.description?.trim() || fixture.description,
    pricePence: row.pricePence,
    featured: row.featured,
    category: row.category,
    sortOrder: row.sortOrder,
    active: row.active,
    image: {
      ...fixture.image,
      src: row.imageUrl?.startsWith('/demo/products/') ? row.imageUrl : fixture.image.src,
    },
  };
}
