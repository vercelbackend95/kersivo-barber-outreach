import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';

const resolveAdminAccess = vi.fn();
const requirePermission = vi.fn();
const findFirst = vi.fn();
const findUniqueShop = vi.fn();
const updateSub = vi.fn();
const createBillingPortalSession = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    saasSubscription: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      update: (...args: unknown[]) => updateSub(...args),
    },
    shopSettings: {
      findUnique: (...args: unknown[]) => findUniqueShop(...args),
    },
  },
}));

vi.mock('@/lib/shop/stripe', () => ({
  createBillingPortalSession: (...args: unknown[]) => createBillingPortalSession(...args),
}));

vi.mock('@/lib/setup/siteUrl', () => ({
  getPublicSiteUrl: () => 'https://kersivo.test',
}));

import { POST } from './billing-portal';

function makeContext(): APIContext {
  return {
    request: new Request('http://localhost/api/setup/billing-portal', { method: 'POST' }),
  } as unknown as APIContext;
}

describe('POST /api/setup/billing-portal', () => {
  beforeEach(() => {
    resolveAdminAccess.mockReset();
    requirePermission.mockReset();
    findFirst.mockReset();
    findUniqueShop.mockReset();
    updateSub.mockReset();
    createBillingPortalSession.mockReset();
    requirePermission.mockReturnValue(null);
  });

  it('returns 401 without an owner session', async () => {
    resolveAdminAccess.mockResolvedValue(null);
    const res = await POST(makeContext() as never);
    expect(res.status).toBe(401);
    expect(createBillingPortalSession).not.toHaveBeenCalled();
  });

  it('returns 404 when no Stripe customer is on file', async () => {
    resolveAdminAccess.mockResolvedValue({ via: 'session', shopId: 'shop-1', role: 'OWNER' });
    findFirst.mockResolvedValue(null);
    findUniqueShop.mockResolvedValue({ owner: { email: 'owner@example.com' } });

    const res = await POST(makeContext() as never);
    expect(res.status).toBe(404);
    expect(createBillingPortalSession).not.toHaveBeenCalled();
  });

  it('returns portal url for an active subscription with customer id', async () => {
    resolveAdminAccess.mockResolvedValue({ via: 'session', shopId: 'shop-1', role: 'OWNER' });
    findFirst.mockResolvedValue({ stripeCustomerId: 'cus_123' });
    createBillingPortalSession.mockResolvedValue({
      id: 'bps_1',
      url: 'https://billing.stripe.test/session',
    });

    const res = await POST(makeContext() as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe('https://billing.stripe.test/session');
    expect(createBillingPortalSession).toHaveBeenCalledWith({
      customerId: 'cus_123',
      returnUrl: 'https://kersivo.test/admin',
    });
  });
});
