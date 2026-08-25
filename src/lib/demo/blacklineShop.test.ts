import { describe, expect, it } from 'vitest';
import { overlayBlacklineRetailProducts, seedBlacklineDemoCatalog, selectBlacklineLandingRailProducts, toBlacklineCarouselProducts } from './blacklineShop';
import { blacklineShopProductsResponse } from '@/lib/admin/blacklineDemoFixtures/catalog';
import { BLACKLINE_SHOP_ID, DEMO_PRODUCTS } from './products';

function createMemoryClient() {
  const shops = new Map<string, Record<string, unknown>>();
  const products = new Map<string, Record<string, unknown>>();

  return {
    shops,
    products,
    shopSettings: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { id: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const current = shops.get(where.id);
        const next = current ? { ...current, ...update } : { ...create };
        shops.set(where.id, next);
        return next;
      },
    },
    product: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const current = products.get(where.id);
        return current ? { imageUrl: current.imageUrl ?? null } : null;
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { id: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const current = products.get(where.id);
        const next = current ? { ...current, ...update, id: where.id } : { ...create };
        products.set(where.id, next);
        return next;
      },
    },
  };
}

describe('BLACKLINE product seed', () => {
  it('upserts the isolated tenant and twenty-nine products without duplicates', async () => {
    const client = createMemoryClient();
    await seedBlacklineDemoCatalog(client as never);
    await seedBlacklineDemoCatalog(client as never);

    expect(client.shops.size).toBe(1);
    expect(client.shops.get(BLACKLINE_SHOP_ID)?.id).toBe(BLACKLINE_SHOP_ID);
    expect(client.shops.get(BLACKLINE_SHOP_ID)?.retailEnabled).toBe(false);
    expect(client.products.size).toBe(DEMO_PRODUCTS.length);
    expect(client.products.size).toBe(29);
    expect([...client.products.values()].every((product) => product.shopId === BLACKLINE_SHOP_ID)).toBe(true);
    expect([...client.products.keys()].some((id) => id.startsWith('demo-product-'))).toBe(false);
    expect(new Set([...client.products.values()].map((product) => product.sortOrder)).size).toBe(
      DEMO_PRODUCTS.length,
    );
  });

  it('does not overwrite a later admin upload with an empty fixture image', async () => {
    const client = createMemoryClient();
    client.products.set('bl-product-ironclad-pomade', {
      id: 'bl-product-ironclad-pomade',
      shopId: BLACKLINE_SHOP_ID,
      imageUrl: 'https://cdn.example/custom-ironclad.jpg',
    });

    await seedBlacklineDemoCatalog(client as never);

    expect(client.products.get('bl-product-ironclad-pomade')?.imageUrl).toBe(
      'https://cdn.example/custom-ironclad.jpg',
    );
    expect(client.products.get('bl-product-shave-cream')?.imageUrl).toBe('/demo/products/shave-cream.webp');
  });
});

describe('overlayBlacklineRetailProducts', () => {
  const LEGACY_DB_PACKSHOT_IDS = [
    'bl-product-ironclad-pomade',
    'bl-product-beard-balm',
    'bl-product-barber-wash',
    'bl-product-matte-pomade',
    'bl-product-sea-salt-texture-spray',
    'bl-product-beard-oil',
    'bl-product-forge-styling-powder',
  ] as const;
  const packshotRow = {
    id: 'bl-product-ironclad-pomade',
    name: 'Ironclad Pomade',
    description: 'Firm hold.',
    pricePence: 1900,
    imageUrl: '/demo/products/ironclad-pomade.webp',
    active: true,
    featured: true,
    category: 'STYLING' as const,
    sortOrder: 0,
  };

  it('keeps all Live fixture products when Prisma only has the seven legacy packshots', () => {
    const seven = DEMO_PRODUCTS.filter((product) =>
      (LEGACY_DB_PACKSHOT_IDS as readonly string[]).includes(product.id),
    ).map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      pricePence: product.pricePence,
      imageUrl: product.image.src,
      active: true,
      featured: product.featured,
      category: product.category,
      sortOrder: product.sortOrder,
    }));
    expect(seven).toHaveLength(7);

    const products = overlayBlacklineRetailProducts(seven);
    expect(products).toHaveLength(29);
    expect(products.map((product) => product.id).sort()).toEqual(
      DEMO_PRODUCTS.filter((product) => product.active)
        .map((product) => product.id)
        .sort(),
    );
    expect(products.map((product) => product.id).sort()).toEqual(
      blacklineShopProductsResponse.products.map((row) => row.id).sort(),
    );
  });

  it('overlays a later uploaded image and falls back to fixture packshots', () => {
    const products = overlayBlacklineRetailProducts([
      { ...packshotRow, imageUrl: 'https://cdn.example/custom-ironclad.jpg' },
      {
        id: 'bl-product-shave-cream',
        name: 'Shave Cream',
        description: '',
        pricePence: 1400,
        imageUrl: null,
        active: true,
        featured: false,
        category: 'SHAVE_AND_SKIN',
        sortOrder: 17,
      },
    ]);

    expect(products.find((product) => product.id === 'bl-product-ironclad-pomade')?.image.src).toBe(
      'https://cdn.example/custom-ironclad.jpg',
    );
    expect(products.find((product) => product.id === 'bl-product-shave-cream')?.image.src).toBe(
      '/demo/products/shave-cream.webp',
    );
    expect(products.every((product) => !product.image.src.startsWith('http://placehold'))).toBe(true);
  });

  it('maps featured retail products to carousel shape without empty image URLs', () => {
    const featured = DEMO_PRODUCTS.filter((product) => product.featured);
    const carousel = toBlacklineCarouselProducts(featured);

    expect(carousel).toHaveLength(4);
    expect(carousel.map((product) => product.id)).toEqual(featured.map((product) => product.id));
    for (const product of carousel) {
      expect(product.imageUrl === null || product.imageUrl.length > 0).toBe(true);
      expect(product.imageUrl).not.toBe('');
      expect(product.available).toBe(true);
      expect(product.requiresOptions).toBe(false);
    }
    const stylingSet = carousel.find((product) => product.id === 'bl-product-essential-styling-set');
    expect(stylingSet?.imageUrl).toBe('/demo/products/essential-styling-set.webp');
    expect(stylingSet?.pricePence).toBe(3800);
  });

  it('selects ten unique landing rail products with featured first', () => {
    const active = DEMO_PRODUCTS.filter((product) => product.active);
    const selected = selectBlacklineLandingRailProducts(active, 10);
    const featuredIds = active.filter((product) => product.featured).map((product) => product.id);

    expect(selected).toHaveLength(10);
    expect(new Set(selected.map((product) => product.id)).size).toBe(10);
    expect(selected.slice(0, featuredIds.length).map((product) => product.id)).toEqual(featuredIds);
  });
});
