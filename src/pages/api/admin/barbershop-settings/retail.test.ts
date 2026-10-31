import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminContext = vi.fn();
const requirePermission = vi.fn();
const requireAdminProductCapability = vi.fn();
const shopFindUnique = vi.fn();
const shopUpdate = vi.fn();
const productCount = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: (...args: unknown[]) => requireAdminContext(...args),
}));
vi.mock('@/lib/admin/rbac/can', () => ({
  accessCan: () => true,
  requireAnyPermission: () => null,
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));
vi.mock('@/lib/admin/productCapability', () => ({
  requireAdminProductCapability: (...args: unknown[]) => requireAdminProductCapability(...args),
}));
vi.mock('@/lib/setup/siteUrl', () => ({ getPublicSiteUrl: () => 'https://kersivo.co.uk' }));
vi.mock('@/lib/shop/paidShop', () => ({ isPaidShop: () => true }));
vi.mock('@/lib/shop/cardPaymentsGate', () => ({
  canSellRetail: () => false,
  evaluateRetailSelling: () => ({ ok: false, reason: 'retail_disabled' }),
}));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...args: unknown[]) => shopFindUnique(...args),
      update: (...args: unknown[]) => shopUpdate(...args),
    },
    product: { count: (...args: unknown[]) => productCount(...args) },
  },
}));

import { PATCH } from './retail';

beforeEach(() => {
  requireAdminContext.mockReset().mockResolvedValue({ shopId: 'shop_1', via: 'session' });
  requirePermission.mockReset().mockReturnValue(null);
  requireAdminProductCapability.mockReset().mockResolvedValue(null);
  shopFindUnique.mockReset().mockResolvedValue({
    id: 'shop_1',
    shopPaidAt: new Date(),
    smsRemindersEnabled: true,
    stripeConnectAccountId: 'acct_1',
    stripeConnectChargesEnabled: true,
    retailEnabled: false,
  });
  shopUpdate.mockReset();
  productCount.mockReset().mockResolvedValue(0);
});

function patch(body: unknown) {
  return PATCH({
    request: new Request('http://localhost/api/admin/barbershop-settings/retail', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as never);
}

describe('PATCH /api/admin/barbershop-settings/retail', () => {
  it('refuses retailEnabled=true when the shop has no active product', async () => {
    const response = await patch({ retailEnabled: true });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('at least one active product');
    expect(shopUpdate).not.toHaveBeenCalled();
  });

  it('allows retailEnabled=true when at least one product is active', async () => {
    productCount.mockResolvedValueOnce(1);
    shopUpdate.mockResolvedValueOnce({
      id: 'shop_1',
      retailEnabled: true,
      shopPaidAt: new Date(),
      smsRemindersEnabled: true,
      stripeConnectAccountId: 'acct_1',
      stripeConnectChargesEnabled: true,
    });
    const response = await patch({ retailEnabled: true });
    expect(response.status).toBe(200);
    expect(shopUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { retailEnabled: true } }));
  });

  it('allows turning retail off without a product', async () => {
    shopUpdate.mockResolvedValueOnce({
      id: 'shop_1',
      retailEnabled: false,
      shopPaidAt: new Date(),
      smsRemindersEnabled: true,
      stripeConnectAccountId: 'acct_1',
      stripeConnectChargesEnabled: true,
    });
    const response = await patch({ retailEnabled: false });
    expect(response.status).toBe(200);
    expect(productCount).not.toHaveBeenCalled();
  });
});
