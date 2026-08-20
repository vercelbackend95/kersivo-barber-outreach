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
    focalPoint?: { x: number; y: number };
  };
};

const PRODUCT_IMAGE_SIZES = '(max-width: 639px) 92vw, (max-width: 1024px) 46vw, 720px';

function packshot(
  src: string,
  alt: string,
  width: number,
  height: number,
  focalPoint?: { x: number; y: number },
): DemoProduct['image'] {
  return { src, width, height, alt, sizes: PRODUCT_IMAGE_SIZES, ...(focalPoint ? { focalPoint } : {}) };
}

function untitled(name: string): DemoProduct['image'] {
  return {
    src: '',
    width: 1200,
    height: 1200,
    alt: `${name} in the fictional BLACKLINE shop.`,
    sizes: PRODUCT_IMAGE_SIZES,
  };
}

type ProductDraft = Omit<DemoProduct, 'image'> & { image: DemoProduct['image'] };

export const DEMO_PRODUCTS: readonly DemoProduct[] = [
  {
    id: 'bl-product-ironclad-pomade',
    slug: 'ironclad-pomade',
    name: 'Ironclad Pomade',
    description: 'Firm hold pomade for sharp lines and longer-lasting structure. Light sheen, not greasy.',
    pricePence: 1900,
    featured: true,
    category: 'STYLING',
    sortOrder: 0,
    active: true,
    image: packshot(
      '/demo/products/ironclad-pomade.webp',
      'Graphite tin labelled Ironclad Pomade in the fictional BLACKLINE shop.',
      1254,
      1254,
    ),
  },
  {
    id: 'bl-product-beard-balm',
    slug: 'beard-balm',
    name: 'Beard Balm',
    description: 'Nourishing balm for shape and control. Softens coarser beards without a heavy cast.',
    pricePence: 1600,
    featured: true,
    category: 'BEARD_CARE',
    sortOrder: 1,
    active: true,
    image: packshot(
      '/demo/products/beard-balm.webp',
      'Metal tin labelled Northline Beard Balm in the fictional BLACKLINE shop.',
      1254,
      1254,
    ),
  },
  {
    id: 'bl-product-barber-wash',
    slug: 'barber-wash',
    name: 'Barber Wash',
    description: 'Barbershop-strength wash for product build-up. Leaves hair ready to style.',
    pricePence: 1500,
    featured: true,
    category: 'HAIR_WASH',
    sortOrder: 2,
    active: true,
    image: packshot(
      '/demo/products/barber-wash.webp',
      'Black pump bottle labelled Barber Wash in the fictional BLACKLINE shop.',
      1254,
      1254,
      { x: 50, y: 44 },
    ),
  },
  {
    id: 'bl-product-essential-styling-set',
    slug: 'essential-styling-set',
    name: 'Essential Styling Set',
    description: 'Pomade, powder and a pocket comb packed for the chair or the kit bag.',
    pricePence: 3200,
    featured: true,
    category: 'GIFT_SETS',
    sortOrder: 3,
    active: true,
    image: untitled('Essential Styling Set'),
  },
  {
    id: 'bl-product-matte-pomade',
    slug: 'matte-pomade',
    name: 'Matte Pomade',
    description: 'Medium hold with a clean matte finish. Easy restyle through the day without shine.',
    pricePence: 1800,
    featured: false,
    category: 'STYLING',
    sortOrder: 4,
    active: true,
    image: packshot(
      '/demo/products/matte-pomade.webp',
      'Matte tin labelled North and Steel Matte Pomade in the fictional BLACKLINE shop.',
      1254,
      1254,
    ),
  },
  {
    id: 'bl-product-sea-salt-texture-spray',
    slug: 'sea-salt-texture-spray',
    name: 'Sea Salt Texture Spray',
    description: 'Beach-texture spray for grip and movement. Mist, scrunch, air-dry or blow-dry.',
    pricePence: 1400,
    featured: false,
    category: 'STYLING',
    sortOrder: 5,
    active: true,
    image: packshot(
      '/demo/products/sea-salt-texture-spray.webp',
      'Black spray bottle labelled North and Steel Sea Salt Texture Spray in the fictional BLACKLINE shop.',
      1122,
      1402,
    ),
  },
  {
    id: 'bl-product-beard-oil',
    slug: 'beard-oil',
    name: 'Beard Oil',
    description: 'Lightweight conditioning oil that softens hair and calms skin underneath.',
    pricePence: 2200,
    featured: false,
    category: 'BEARD_CARE',
    sortOrder: 6,
    active: true,
    image: packshot(
      '/demo/products/beard-oil.webp',
      'Amber dropper bottle labelled North and Steel Beard Oil in the fictional BLACKLINE shop.',
      1122,
      1402,
    ),
  },
  {
    id: 'bl-product-forge-styling-powder',
    slug: 'forge-styling-powder',
    name: 'Forge Styling Powder',
    description: 'Matte powder for root lift and grit. Tap on dry hair for instant texture.',
    pricePence: 1200,
    featured: false,
    category: 'STYLING',
    sortOrder: 7,
    active: true,
    image: packshot(
      '/demo/products/forge-styling-powder.webp',
      'Black jar labelled Forge Styling Powder in the fictional BLACKLINE shop.',
      1254,
      1254,
    ),
  },
  {
    id: 'bl-product-fibre-paste',
    slug: 'fibre-paste',
    name: 'Fibre Paste',
    description: 'Workable fibre for separation and a natural finish. Restyles with a little heat.',
    pricePence: 1600,
    featured: false,
    category: 'STYLING',
    sortOrder: 8,
    active: true,
    image: untitled('Fibre Paste'),
  },
  {
    id: 'bl-product-matte-clay',
    slug: 'matte-clay',
    name: 'Matte Clay',
    description: 'High-hold clay with a dry, low-shine finish for cropped cuts.',
    pricePence: 1700,
    featured: false,
    category: 'STYLING',
    sortOrder: 9,
    active: true,
    image: untitled('Matte Clay'),
  },
  {
    id: 'bl-product-styling-cream',
    slug: 'styling-cream',
    name: 'Styling Cream',
    description: 'Soft cream for control without crunch. Suits longer hair and a natural part.',
    pricePence: 1500,
    featured: false,
    category: 'STYLING',
    sortOrder: 10,
    active: true,
    image: untitled('Styling Cream'),
  },
  {
    id: 'bl-product-daily-conditioner',
    slug: 'daily-conditioner',
    name: 'Daily Conditioner',
    description: 'Everyday conditioner that detangles without weighing the cut down.',
    pricePence: 1500,
    featured: false,
    category: 'HAIR_WASH',
    sortOrder: 11,
    active: true,
    image: untitled('Daily Conditioner'),
  },
  {
    id: 'bl-product-scalp-scrub',
    slug: 'scalp-scrub',
    name: 'Scalp Scrub',
    description: 'Weekly scrub to lift product build-up and refresh the scalp.',
    pricePence: 1800,
    featured: false,
    category: 'HAIR_WASH',
    sortOrder: 12,
    active: true,
    image: untitled('Scalp Scrub'),
  },
  {
    id: 'bl-product-clarifying-rinse',
    slug: 'clarifying-rinse',
    name: 'Clarifying Rinse',
    description: 'A sharp rinse when pomade and powder have stacked through the week.',
    pricePence: 1400,
    featured: false,
    category: 'HAIR_WASH',
    sortOrder: 13,
    active: true,
    image: untitled('Clarifying Rinse'),
  },
  {
    id: 'bl-product-beard-wash',
    slug: 'beard-wash',
    name: 'Beard Wash',
    description: 'Gentle wash for facial hair that does not strip the skin underneath.',
    pricePence: 1500,
    featured: false,
    category: 'BEARD_CARE',
    sortOrder: 14,
    active: true,
    image: untitled('Beard Wash'),
  },
  {
    id: 'bl-product-beard-butter',
    slug: 'beard-butter',
    name: 'Beard Butter',
    description: 'Richer leave-in butter for longer beards that need overnight softness.',
    pricePence: 1800,
    featured: false,
    category: 'BEARD_CARE',
    sortOrder: 15,
    active: true,
    image: untitled('Beard Butter'),
  },
  {
    id: 'bl-product-moustache-wax',
    slug: 'moustache-wax',
    name: 'Moustache Wax',
    description: 'Small-tin wax for a tidy moustache and a controlled curl.',
    pricePence: 1100,
    featured: false,
    category: 'BEARD_CARE',
    sortOrder: 16,
    active: true,
    image: untitled('Moustache Wax'),
  },
  {
    id: 'bl-product-shave-cream',
    slug: 'shave-cream',
    name: 'Shave Cream',
    description: 'Close-shave cream for razor work. Simple product, one formula, collect in shop.',
    pricePence: 1600,
    featured: false,
    category: 'SHAVE_AND_SKIN',
    sortOrder: 17,
    active: true,
    image: untitled('Shave Cream'),
  },
  {
    id: 'bl-product-aftershave-balm',
    slug: 'aftershave-balm',
    name: 'Aftershave Balm',
    description: 'Alcohol-free balm to calm skin after a hot towel shave.',
    pricePence: 1700,
    featured: false,
    category: 'SHAVE_AND_SKIN',
    sortOrder: 18,
    active: true,
    image: untitled('Aftershave Balm'),
  },
  {
    id: 'bl-product-face-wash',
    slug: 'face-wash',
    name: 'Face Wash',
    description: 'Daily face wash that rinses clean without tightness.',
    pricePence: 1400,
    featured: false,
    category: 'SHAVE_AND_SKIN',
    sortOrder: 19,
    active: true,
    image: untitled('Face Wash'),
  },
  {
    id: 'bl-product-daily-moisturiser',
    slug: 'daily-moisturiser',
    name: 'Daily Moisturiser',
    description: 'Light moisturiser for skin that sees clippers, towels and product.',
    pricePence: 1800,
    featured: false,
    category: 'SHAVE_AND_SKIN',
    sortOrder: 20,
    active: true,
    image: untitled('Daily Moisturiser'),
  },
  {
    id: 'bl-product-cutting-comb',
    slug: 'cutting-comb',
    name: 'Cutting Comb',
    description: 'Heat-resistant comb for the chair and the kit. One size, no options.',
    pricePence: 900,
    featured: false,
    category: 'TOOLS',
    sortOrder: 21,
    active: true,
    image: untitled('Cutting Comb'),
  },
  {
    id: 'bl-product-boar-brush',
    slug: 'boar-brush',
    name: 'Boar Bristle Brush',
    description: 'Club brush for finish work and laying a pomade cut.',
    pricePence: 2200,
    featured: false,
    category: 'TOOLS',
    sortOrder: 22,
    active: true,
    image: untitled('Boar Bristle Brush'),
  },
  {
    id: 'bl-product-neck-duster',
    slug: 'neck-duster',
    name: 'Neck Duster',
    description: 'Soft duster for the finish. The same tool the chair uses.',
    pricePence: 1300,
    featured: false,
    category: 'TOOLS',
    sortOrder: 23,
    active: true,
    image: untitled('Neck Duster'),
  },
  {
    id: 'bl-product-clipper-guard-set',
    slug: 'clipper-guard-set',
    name: 'Clipper Guard Set',
    description: 'Numbered guards for home tidy-ups between appointments.',
    pricePence: 1900,
    featured: false,
    category: 'TOOLS',
    sortOrder: 24,
    active: true,
    image: untitled('Clipper Guard Set'),
  },
  {
    id: 'bl-product-barber-cape',
    slug: 'barber-cape',
    name: 'Barber Cape',
    description: 'Lightweight cape that packs small. Collect from the shop.',
    pricePence: 2400,
    featured: false,
    category: 'TOOLS',
    sortOrder: 25,
    active: true,
    image: untitled('Barber Cape'),
  },
  {
    id: 'bl-product-beard-kit',
    slug: 'beard-kit',
    name: 'Beard Kit',
    description: 'Wash, oil and balm together for a full beard routine.',
    pricePence: 4200,
    featured: false,
    category: 'GIFT_SETS',
    sortOrder: 26,
    active: true,
    image: untitled('Beard Kit'),
  },
  {
    id: 'bl-product-travel-grooming-set',
    slug: 'travel-grooming-set',
    name: 'Travel Grooming Set',
    description: 'Wash, cream and a comb sized for a week away.',
    pricePence: 2800,
    featured: false,
    category: 'GIFT_SETS',
    sortOrder: 27,
    active: true,
    image: untitled('Travel Grooming Set'),
  },
  {
    id: 'bl-product-shop-gift-box',
    slug: 'shop-gift-box',
    name: 'Shop Gift Box',
    description: 'A ready-to-collect box: styling, wash and a finishing tool.',
    pricePence: 4500,
    featured: false,
    category: 'GIFT_SETS',
    sortOrder: 28,
    active: true,
    image: untitled('Shop Gift Box'),
  },
  {
    id: 'bl-product-hot-towel-kit',
    slug: 'hot-towel-kit',
    name: 'Hot Towel Home Kit',
    description: 'Shave cream and aftershave balm for a slower shave at home.',
    pricePence: 2800,
    featured: false,
    category: 'GIFT_SETS',
    sortOrder: 29,
    active: true,
    image: untitled('Hot Towel Home Kit'),
  },
] as const satisfies readonly ProductDraft[];

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

export function resolveBlacklineSeedImageUrl(
  current: string | null | undefined,
  fixtureSrc: string,
): string | null {
  const existing = current?.trim() || '';
  const fixture = fixtureSrc.trim();
  if (existing && !existing.startsWith('/demo/products/')) return existing;
  return fixture || existing || null;
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
  const dbImage = row.imageUrl?.trim() || '';
  const src = dbImage || fixture.image.src;
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
      src,
    },
  };
}
