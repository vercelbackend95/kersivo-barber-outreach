import { beforeEach, describe, expect, it, vi } from 'vitest';

const getBlacklineRetailProducts = vi.fn();
const enforceIpRateLimit = vi.fn();

vi.mock('@/lib/demo/blacklineShop', () => ({
  getBlacklineRetailProducts: (...args: unknown[]) => getBlacklineRetailProducts(...args),
}));

vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({
  enforceIpRateLimit: (...args: unknown[]) => enforceIpRateLimit(...args),
}));

import { POST } from './complete';

function ctx(body: Record<string, unknown>) {
  return {
    request: new Request('https://kersivo.co.uk/api/demo/shop/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  };
}

describe('POST /api/demo/shop/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceIpRateLimit.mockResolvedValue(null);
    getBlacklineRetailProducts.mockResolvedValue([
      {
        id: 'bl-product-ironclad-pomade',
        name: 'Ironclad Pomade',
        pricePence: 1900,
        active: true,
        image: { src: '/demo/products/ironclad-pomade.webp' },
      },
    ]);
  });

  it('recalculates the subtotal and does not create a live order', async () => {
    const res = await POST(
      ctx({
        items: [{ productId: 'bl-product-ironclad-pomade', quantity: 2, unitPricePence: 1 }],
      }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.order.totalPence).toBe(3800);
    expect(body.order.collectionMethod).toBe('Collect in shop');
    expect(getBlacklineRetailProducts).toHaveBeenCalledOnce();
  });

  it('rejects an empty bag, invalid quantity, and foreign catalog ids', async () => {
    expect((await POST(ctx({ items: [] }) as never)).status).toBe(400);
    expect(
      (await POST(ctx({ items: [{ productId: 'bl-product-ironclad-pomade', quantity: 99 }] }) as never)).status,
    ).toBe(400);
    expect(
      (await POST(ctx({ items: [{ productId: 'demo-product-matte-pomade', quantity: 1 }] }) as never)).status,
    ).toBe(400);
  });
});
