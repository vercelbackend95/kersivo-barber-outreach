import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';

const resolveAdminAccess = vi.fn();
const requirePermission = vi.fn();
const requireVerifiedEmail = vi.fn();
const retrieveCheckoutSession = vi.fn();
const markShopPaid = vi.fn();
const findUnique = vi.fn();
const updateMany = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
  requireVerifiedEmail: (...args: unknown[]) => requireVerifiedEmail(...args),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    saasSubscription: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
    },
  },
}));

vi.mock('@/lib/shop/stripe', () => ({
  retrieveCheckoutSession: (...args: unknown[]) => retrieveCheckoutSession(...args),
}));

vi.mock('@/lib/shop/markShopPaid', () => ({
  markShopPaid: (...args: unknown[]) => markShopPaid(...args),
}));

vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({
  enforceIpRateLimit: vi.fn(async () => null),
}));

import { POST } from './claim-paid-subscription';

const OWNER = {
  shopId: 'shop_owner',
  userId: 'user_1',
  userName: 'Alex',
  userEmail: 'alex@example.com',
  emailVerified: true,
  userImage: null,
  via: 'session' as const,
  role: 'OWNER' as const,
  memberId: 'mem_1',
  barberId: null,
  permissions: ['billing.manage'] as const,
};

function makeContext(body: unknown): APIContext {
  return {
    request: new Request('https://kersivo.test/api/setup/claim-paid-subscription', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

function paidSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cs_test_1',
    payment_status: 'paid',
    customer_email: 'alex@example.com',
    customer_details: { email: 'alex@example.com' },
    metadata: { type: 'saas_subscription', email: 'alex@example.com' },
    ...overrides,
  };
}

describe('POST /api/setup/claim-paid-subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAdminAccess.mockResolvedValue(OWNER);
    requirePermission.mockReturnValue(null);
    requireVerifiedEmail.mockReturnValue(null);
    markShopPaid.mockResolvedValue(undefined);
  });

  it('returns 401 when not signed in', async () => {
    resolveAdminAccess.mockResolvedValue(null);
    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(401);
  });

  it('returns 403 without billing.manage', async () => {
    requirePermission.mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden', permission: 'billing.manage' }), {
        status: 403,
      }),
    );
    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(403);
  });

  it('denies wrong email', async () => {
    retrieveCheckoutSession.mockResolvedValue(
      paidSession({
        customer_email: 'other@example.com',
        customer_details: { email: 'other@example.com' },
        metadata: { type: 'saas_subscription', email: 'other@example.com' },
      }),
    );
    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('EMAIL_MISMATCH');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('denies unpaid Stripe session', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession({ payment_status: 'unpaid' }));
    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(400);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('claims guest paid subscription with matching email', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession());
    findUnique.mockResolvedValue({
      id: 'sub_1',
      shopId: null,
      stripeSessionId: 'cs_test_1',
    });
    updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.claimed).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'sub_1', shopId: null },
      data: { shopId: 'shop_owner' },
    });
    expect(markShopPaid).toHaveBeenCalledWith('shop_owner');
  });

  it('is idempotent when already owned by this shop', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession());
    findUnique.mockResolvedValue({
      id: 'sub_1',
      shopId: 'shop_owner',
      stripeSessionId: 'cs_test_1',
    });

    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotent).toBe(true);
    expect(body.claimed).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('denies stealing a subscription owned by another shop', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession());
    findUnique.mockResolvedValue({
      id: 'sub_1',
      shopId: 'shop_other',
      stripeSessionId: 'cs_test_1',
    });

    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('ALREADY_OWNED');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('handles race when another shop claims first', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession());
    findUnique
      .mockResolvedValueOnce({
        id: 'sub_1',
        shopId: null,
        stripeSessionId: 'cs_test_1',
      })
      .mockResolvedValueOnce({ shopId: 'shop_other' });
    updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('CLAIM_RACE');
    expect(markShopPaid).not.toHaveBeenCalled();
  });
});
