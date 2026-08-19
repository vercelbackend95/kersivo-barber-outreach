import { describe, expect, it } from 'vitest';
import { overlayBlacklineRetailProducts, seedBlacklineDemoCatalog } from './blacklineShop';
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
  it('upserts the isolated tenant and thirty products without duplicates', async () => {
    const client = createMemoryClient();
    await seedBlacklineDemoCatalog(client as never);
    await seedBlacklineDemoCatalog(client as never);

    expect(client.shops.size).toBe(1);
    expect(client.shops.get(BLACKLINE_SHOP_ID)?.id).toBe(BLACKLINE_SHOP_ID);
    expect(client.shops.get(BLACKLINE_SHOP_ID)?.retailEnabled).toBe(false);
    expect(client.products.size).toBe(DEMO_PRODUCTS.length);
    expect(client.products.size).toBe(30);
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
    expect(client.products.get('bl-product-shave-cream')?.imageUrl).toBeNull();
  });
});

describe('overlayBlacklineRetailProducts', () => {
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

  it('keeps all Live fixture products when Prisma only has the seven packshots', () => {
    const seven = DEMO_PRODUCTS.filter((product) => product.image.src).map((product) => ({
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
    expect(products).toHaveLength(30);
    expect(products.map((product) => product.id).sort()).toEqual(
      DEMO_PRODUCTS.filter((product) => product.active)
        .map((product) => product.id)
        .sort(),
    );
    expect(products.map((product) => product.id).sort()).toEqual(
      blacklineShopProductsResponse.products.map((row) => row.id).sort(),
    );
  });

  it('overlays a later uploaded image and leaves untitled src empty', () => {
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
    expect(products.find((product) => product.id === 'bl-product-shave-cream')?.image.src).toBe('');
    expect(products.every((product) => !product.image.src.startsWith('http://placehold'))).toBe(true);
  });
});
