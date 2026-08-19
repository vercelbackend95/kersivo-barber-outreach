import { describe, expect, it } from 'vitest';
import { seedBlacklineDemoCatalog } from './blacklineShop';
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
