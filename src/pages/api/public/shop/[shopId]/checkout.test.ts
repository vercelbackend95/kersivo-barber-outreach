import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUniqueShop = vi.fn();
const findManyProducts = vi.fn();
const orderCreate = vi.fn();
const orderUpdate = vi.fn();
const transaction = vi.fn();
const shopAcceptsPublicBookings = vi.fn();
const assertShopAcceptingPublicActivity = vi.fn();
const createRetailCheckoutSession = vi.fn();
const enforceIpRateLimit = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: { findUnique: (...args: unknown[]) => findUniqueShop(...args) },
    product: { findMany: (...args: unknown[]) => findManyProducts(...args) },
    order: {
      create: (...args: unknown[]) => orderCreate(...args),
      update: (...args: unknown[]) => orderUpdate(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

vi.mock('@/lib/setup/shopPublicBookingGate', () => ({
  shopAcceptsPublicBookings: (...args: unknown[]) => shopAcceptsPublicBookings(...args),
}));

vi.mock('@/lib/admin/shopPublicActivity', () => ({
  assertShopAcceptingPublicActivity: (...args: unknown[]) =>
    assertShopAcceptingPublicActivity(...args),
  ShopPublicActivityPausedError: class ShopPublicActivityPausedError extends Error {
    code = 'SHOP_PUBLIC_ACTIVITY_PAUSED';
    status = 422;
    constructor(message = 'Public activity paused') {
      super(message);
      this.name = 'ShopPublicActivityPausedError';
    }
  },
}));

vi.mock('@/lib/shop/stripeConnect', () => ({
  createRetailCheckoutSession: (...args: unknown[]) => createRetailCheckoutSession(...args),
}));

vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({
  enforceIpRateLimit: (...args: unknown[]) => enforceIpRateLimit(...args),
}));

vi.mock('@/lib/db/shopScope', () => ({
  DEMO_SHOP_ID: 'demo',
}));

import { ShopPublicActivityPausedError } from '@/lib/admin/shopPublicActivity';
import { POST } from './checkout';

function ctx(shopId: string, body: Record<string, unknown>) {
  return {
    params: { shopId },
    request: new Request(`https://kersivo.co.uk/api/public/shop/${shopId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  };
}

const readyShop = {
  id: 'shop_1',
  name: 'Fade Room',
  shopPaidAt: new Date('2026-07-01T00:00:00.000Z'),
  smsRemindersEnabled: true,
  retailEnabled: true,
  stripeConnectAccountId: 'acct_shop',
  stripeConnectChargesEnabled: true,
};

describe('POST /api/public/shop/[shopId]/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceIpRateLimit.mockResolvedValue(null);
    findUniqueShop.mockResolvedValue(readyShop);
    shopAcceptsPublicBookings.mockResolvedValue(true);
    assertShopAcceptingPublicActivity.mockResolvedValue(undefined);
    findManyProducts.mockResolvedValue([
      { id: 'prod_1', name: 'Clay', pricePence: 1500, imageUrl: null },
    ]);
    orderCreate.mockResolvedValue({
      id: 'ord_1',
      createdAt: new Date('2026-08-01T12:00:00.000Z'),
      reference: 'KRV-TEST01',
    });
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        order: { create: (...args: unknown[]) => orderCreate(...args) },
      }),
    );
    createRetailCheckoutSession.mockResolvedValue({
      id: 'cs_1',
      url: 'https://checkout.stripe.test/cs_1',
    });
    orderUpdate.mockResolvedValue({});
  });

  it('returns 404 for the BLACKLINE demo tenant', async () => {
    const res = await POST(
      ctx('blackline-barbers-demo', { items: [{ productId: 'prod_1', quantity: 1 }] }) as never,
    );
    expect(res.status).toBe(404);
    expect(createRetailCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns 403 when subscription entitlement is missing', async () => {
    shopAcceptsPublicBookings.mockResolvedValue(false);
    const res = await POST(ctx('shop_1', { items: [{ productId: 'prod_1', quantity: 1 }] }) as never);
    expect(res.status).toBe(403);
  });

  it('returns 422 when public activity is paused', async () => {
    assertShopAcceptingPublicActivity.mockRejectedValue(new ShopPublicActivityPausedError());
    const res = await POST(ctx('shop_1', { items: [{ productId: 'prod_1', quantity: 1 }] }) as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe('SHOP_PUBLIC_ACTIVITY_PAUSED');
  });

  it('returns 503 when retail is disabled', async () => {
    findUniqueShop.mockResolvedValue({ ...readyShop, retailEnabled: false });
    const res = await POST(ctx('shop_1', { items: [{ productId: 'prod_1', quantity: 1 }] }) as never);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.reason).toBe('retail_disabled');
  });

  it('returns 503 when Connect is not ready', async () => {
    findUniqueShop.mockResolvedValue({ ...readyShop, stripeConnectChargesEnabled: false });
    const res = await POST(ctx('shop_1', { items: [{ productId: 'prod_1', quantity: 1 }] }) as never);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.reason).toBe('connect_not_ready');
  });

  it('creates PENDING_PAYMENT order using DB prices and Connect checkout', async () => {
    const res = await POST(
      ctx('shop_1', {
        items: [{ productId: 'prod_1', quantity: 2, unitPricePence: 1 }],
      }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain('checkout.stripe.test');

    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING_PAYMENT',
          totalPence: 3000,
          stripeConnectAccountId: 'acct_shop',
          items: {
            create: [
              expect.objectContaining({
                productId: 'prod_1',
                unitPricePenceSnapshot: 1500,
                quantity: 2,
                lineTotalPence: 3000,
              }),
            ],
          },
        }),
      }),
    );

    expect(createRetailCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        shopConnectAccountId: 'acct_shop',
        orderId: 'ord_1',
        shopId: 'shop_1',
        lineItems: [
          expect.objectContaining({
            unitAmountPence: 1500,
            quantity: 2,
          }),
        ],
      }),
    );
  });
});
