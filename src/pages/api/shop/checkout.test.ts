import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';

const resolveAdminAccess = vi.fn();
const createCheckoutSession = vi.fn();
const productFindMany = vi.fn();
const shopSettingsFindUnique = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
}));

vi.mock('@/lib/shop/stripe', () => ({
  createCheckoutSession: (...args: unknown[]) => createCheckoutSession(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    product: {
      findMany: (...args: unknown[]) => productFindMany(...args),
    },
    shopSettings: {
      findUnique: (...args: unknown[]) => shopSettingsFindUnique(...args),
    },
  },
}));

vi.mock('@/lib/shop/demoCatalog', () => ({
  getDemoCatalogProductById: vi.fn(() => {
    throw new Error('demo catalog must not be used by checkout');
  }),
  getDemoCatalogProducts: vi.fn(() => {
    throw new Error('demo catalog must not be used by checkout');
  }),
}));

vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({
  enforceIpRateLimit: vi.fn(async () => null),
}));

import { POST } from './checkout';

function makeContext(body: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/shop/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

const validPayload = {
  items: [{ productId: 'prod-1', quantity: 1 }],
};

describe('POST /api/shop/checkout', () => {
  beforeEach(() => {
    resolveAdminAccess.mockReset();
    createCheckoutSession.mockReset();
    productFindMany.mockReset();
    shopSettingsFindUnique.mockReset();
    shopSettingsFindUnique.mockResolvedValue({ publicActivityPaused: false });
  });

  it('returns 401 without an owner session and does not create a Stripe session', async () => {
    resolveAdminAccess.mockResolvedValue(null);

    const res = await POST(makeContext(validPayload) as never);
    expect(res.status).toBe(401);
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(productFindMany).not.toHaveBeenCalled();
  });

  it('returns 401 for secret/legacy access', async () => {
    resolveAdminAccess.mockResolvedValue({ via: 'secret', shopId: 'demo-shop' });

    const res = await POST(makeContext(validPayload) as never);
    expect(res.status).toBe(401);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it('creates a Stripe session for an owner session using their shop products', async () => {
    resolveAdminAccess.mockResolvedValue({ via: 'session', shopId: 'owner-shop-1' });
    productFindMany.mockResolvedValue([
      {
        id: 'prod-1',
        name: 'Clay',
        pricePence: 2000,
        imageUrl: null,
        active: true,
      },
    ]);
    createCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.test/session' });

    const res = await POST(makeContext(validPayload) as never);
    expect(res.status).toBe(200);
    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ shopId: 'owner-shop-1' }),
      }),
    );
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(createCheckoutSession.mock.calls[0][0].metadata.shopId).toBe('owner-shop-1');

    const json = await res.json();
    expect(json.url).toBe('https://checkout.stripe.test/session');
  });

  it('returns 422 when the barbershop is paused', async () => {
    resolveAdminAccess.mockResolvedValue({ via: 'session', shopId: 'owner-shop-1' });
    shopSettingsFindUnique.mockResolvedValue({ publicActivityPaused: true });

    const res = await POST(makeContext(validPayload) as never);
    expect(res.status).toBe(422);
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(productFindMany).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.code).toBe('SHOP_PUBLIC_ACTIVITY_PAUSED');
  });
});
