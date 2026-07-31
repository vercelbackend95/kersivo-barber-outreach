import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';

const resolveAdminAccess = vi.fn();
const requirePermission = vi.fn();
const findFirst = vi.fn();
const findUniqueShop = vi.fn();
const updateSub = vi.fn();
const createBillingPortalSession = vi.fn();

const { EMAIL_VERIFICATION_REQUIRED_MESSAGE } = vi.hoisted(() => ({
  EMAIL_VERIFICATION_REQUIRED_MESSAGE:
    'Verify your email address before continuing. Check your inbox for a verification link.',
}));

vi.mock('@/lib/admin/auth', () => ({
  EMAIL_VERIFICATION_REQUIRED_MESSAGE,
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
  requireVerifiedEmail: (access: { via: string; emailVerified?: boolean }) => {
    if (access.via !== 'session') return null;
    if (access.emailVerified) return null;
    return new Response(
      JSON.stringify({
        error: EMAIL_VERIFICATION_REQUIRED_MESSAGE,
        code: 'EMAIL_NOT_VERIFIED',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  },
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

  it('returns 403 when the session email is not verified', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-attacker',
      role: 'OWNER',
      emailVerified: false,
      userEmail: 'victim@example.com',
    });

    const res = await POST(makeContext() as never);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(body.error).toBe(EMAIL_VERIFICATION_REQUIRED_MESSAGE);
    expect(findFirst).not.toHaveBeenCalled();
    expect(createBillingPortalSession).not.toHaveBeenCalled();
  });

  it('returns 404 when no Stripe customer is on file', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      role: 'OWNER',
      emailVerified: true,
    });
    findFirst.mockResolvedValue(null);
    findUniqueShop.mockResolvedValue({ owner: { email: 'owner@example.com' } });

    const res = await POST(makeContext() as never);
    expect(res.status).toBe(404);
    expect(createBillingPortalSession).not.toHaveBeenCalled();
  });

  it('returns portal url for an active subscription with customer id', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      role: 'OWNER',
      emailVerified: true,
    });
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

  it('email fallback only looks for orphan subscriptions (shopId null)', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-attacker',
      role: 'OWNER',
      emailVerified: true,
    });
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    findUniqueShop.mockResolvedValue({ owner: { email: 'victim@example.com' } });

    const res = await POST(makeContext() as never);
    expect(res.status).toBe(404);

    expect(findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          shopId: null,
          customerEmail: { equals: 'victim@example.com', mode: 'insensitive' },
        }),
      }),
    );
    expect(createBillingPortalSession).not.toHaveBeenCalled();
  });

  it('claims an orphan subscription for the current shop then opens the portal', async () => {
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      role: 'OWNER',
      emailVerified: true,
    });
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'saas-orphan',
      stripeCustomerId: 'cus_orphan',
      shopId: null,
    });
    findUniqueShop.mockResolvedValue({ owner: { email: 'owner@example.com' } });
    createBillingPortalSession.mockResolvedValue({
      id: 'bps_2',
      url: 'https://billing.stripe.test/orphan',
    });

    const res = await POST(makeContext() as never);
    expect(res.status).toBe(200);
    expect(updateSub).toHaveBeenCalledWith({
      where: { id: 'saas-orphan' },
      data: { shopId: 'shop-1' },
    });
    expect(createBillingPortalSession).toHaveBeenCalledWith({
      customerId: 'cus_orphan',
      returnUrl: 'https://kersivo.test/admin',
    });
  });
});
