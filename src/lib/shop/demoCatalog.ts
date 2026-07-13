/**
 * Static demo retail catalog for /shop, landing RETAIL PREVIEW, and admin-demo.
 * Images live under /public/images/demoshop — no Neon product reads.
 */

export type DemoProductCategory =
  | 'POMADES_AND_CLAYS'
  | 'BEARD_CARE'
  | 'HAIR_WASH'
  | 'STYLING'
  | 'TOOLS'
  | 'GIFT_SETS';

export type DemoCatalogProduct = {
  id: string;
  name: string;
  description: string;
  pricePence: number;
  imageUrl: string;
  active: boolean;
  featured: boolean;
  category: DemoProductCategory;
  sortOrder: number;
  updatedAt: string;
};

const UPDATED_AT = '2026-07-13T12:00:00.000Z';

export const DEMO_CATALOG_PRODUCTS: DemoCatalogProduct[] = [
  {
    id: 'demo-product-matte-pomade',
    name: 'Matte Pomade',
    description: 'Medium hold with a clean matte finish. Easy restyle through the day without shine.',
    pricePence: 1800,
    imageUrl: '/images/demoshop/matte-pomade.png',
    active: true,
    featured: true,
    category: 'POMADES_AND_CLAYS',
    sortOrder: 0,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'demo-product-ironclad-pomade',
    name: 'Ironclad Pomade',
    description: 'Firm hold pomade for sharp lines and longer-lasting structure. Light sheen, not greasy.',
    pricePence: 1900,
    imageUrl: '/images/demoshop/ironclad-pomade.png',
    active: true,
    featured: false,
    category: 'POMADES_AND_CLAYS',
    sortOrder: 1,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'demo-product-beard-oil',
    name: 'Beard Oil',
    description: 'Lightweight conditioning oil that softens hair and calms skin underneath.',
    pricePence: 2200,
    imageUrl: '/images/demoshop/beard-oil.png',
    active: true,
    featured: true,
    category: 'BEARD_CARE',
    sortOrder: 2,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'demo-product-beard-balm',
    name: 'Beard Balm',
    description: 'Nourishing balm for shape and control. Softens coarser beards without a heavy cast.',
    pricePence: 1600,
    imageUrl: '/images/demoshop/beard-balm.png',
    active: true,
    featured: false,
    category: 'BEARD_CARE',
    sortOrder: 3,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'demo-product-holloway-beard-conditioner',
    name: 'Holloway Beard Conditioner',
    description: 'Rinse-out conditioner for thicker beards. Smooths flyaways and reduces itch.',
    pricePence: 1800,
    imageUrl: '/images/demoshop/holloway-beard-conditioner.png',
    active: true,
    featured: false,
    category: 'BEARD_CARE',
    sortOrder: 4,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'demo-product-daily-wash',
    name: 'Daily Wash',
    description: 'Gentle everyday shampoo that cleans without stripping. Fresh, light finish.',
    pricePence: 1400,
    imageUrl: '/images/demoshop/daily-wash.png',
    active: true,
    featured: false,
    category: 'HAIR_WASH',
    sortOrder: 5,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'demo-product-barber-wash',
    name: 'Barber Wash',
    description: 'Barbershop-strength wash for product build-up. Leaves hair ready to style.',
    pricePence: 1500,
    imageUrl: '/images/demoshop/barber-wash.png',
    active: true,
    featured: false,
    category: 'HAIR_WASH',
    sortOrder: 6,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'demo-product-sea-salt-texture-spray',
    name: 'Sea Salt Texture Spray',
    description: 'Beach-texture spray for grip and movement. Mist, scrunch, air-dry or blow-dry.',
    pricePence: 1400,
    imageUrl: '/images/demoshop/sea-salt-texture-spray.png',
    active: true,
    featured: true,
    category: 'STYLING',
    sortOrder: 7,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'demo-product-hartwell-sea-salt-spray',
    name: 'Hartwell Sea Salt Spray',
    description: 'Fine-mist salt spray for natural volume and separation. Works on short and mid lengths.',
    pricePence: 1500,
    imageUrl: '/images/demoshop/hartwell-sea-salt-texture-spray.png',
    active: true,
    featured: false,
    category: 'STYLING',
    sortOrder: 8,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'demo-product-forge-styling-powder',
    name: 'Forge Styling Powder',
    description: 'Matte powder for root lift and grit. Tap on dry hair for instant texture.',
    pricePence: 1200,
    imageUrl: '/images/demoshop/forge-styling-powder.png',
    active: true,
    featured: false,
    category: 'STYLING',
    sortOrder: 9,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'demo-product-barber-fade-comb',
    name: 'Barber Fade Comb',
    description: 'Carbon-style fade comb for clean clipper-over-comb work and precise blending.',
    pricePence: 900,
    imageUrl: '/images/demoshop/barber-fade-comb.png',
    active: true,
    featured: false,
    category: 'TOOLS',
    sortOrder: 10,
    updatedAt: UPDATED_AT,
  },
];

export function getDemoCatalogProducts(options?: { activeOnly?: boolean }): DemoCatalogProduct[] {
  const activeOnly = options?.activeOnly !== false;
  const products = activeOnly
    ? DEMO_CATALOG_PRODUCTS.filter((product) => product.active)
    : [...DEMO_CATALOG_PRODUCTS];
  return products.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function getDemoCatalogProductById(id: string): DemoCatalogProduct | null {
  return DEMO_CATALOG_PRODUCTS.find((product) => product.id === id) ?? null;
}

export function getDemoCatalogRelatedProducts(
  product: DemoCatalogProduct,
  limit: number,
): DemoCatalogProduct[] {
  const sameCategory = getDemoCatalogProducts().filter(
    (item) => item.id !== product.id && item.category === product.category,
  );
  if (sameCategory.length >= limit) return sameCategory.slice(0, limit);

  const fillers = getDemoCatalogProducts().filter(
    (item) => item.id !== product.id && !sameCategory.some((row) => row.id === item.id),
  );
  return [...sameCategory, ...fillers].slice(0, limit);
}
