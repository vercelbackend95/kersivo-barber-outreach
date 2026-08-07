import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';

const resolveAdminAccess = vi.fn();
const requirePermission = vi.fn();
const requireVerifiedEmail = vi.fn();
const retrieveCheckoutSession = vi.fn();
const retrieveSubscription = vi.fn();
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
  retrieveSubscription: (...args: unknown[]) => retrieveSubscription(...args),
  getSubscriptionCurrentPeriodEnd: (sub: {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  }) => {
    if (typeof sub.current_period_end === 'number') return sub.current_period_end;
    const ends = (sub.items?.data ?? [])
      .map((i) => i.current_period_end)
      .filter((v): v is number => typeof v === 'number');
    return ends.length ? Math.max(...ends) : null;
  },
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
    subscription: 'sub_live_1',
    ...overrides,
  };
}

function activeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    shopId: null,
    stripeSessionId: 'cs_test_1',
    status: 'ACTIVE',
    currentPeriodEnd: new Date(Date.now() + 7 * 86400000),
    pastDueSince: null,
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: 'sub_live_1',
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
    findUnique.mockResolvedValue(activeSub());
    updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.claimed).toBe(true);
    expect(markShopPaid).toHaveBeenCalledWith('shop_owner');
  });

  it('does not report success when markShopPaid fails after claim', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession());
    findUnique.mockResolvedValue(activeSub());
    updateMany.mockResolvedValue({ count: 1 });
    markShopPaid.mockRejectedValue(new Error('db down'));

    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe('MARK_SHOP_PAID_FAILED');
    expect(body.ok).toBeUndefined();
  });

  it('heals markShopPaid on already-owned idempotent retry', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession());
    findUnique.mockResolvedValue(activeSub({ shopId: 'shop_owner' }));

    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotent).toBe(true);
    expect(markShopPaid).toHaveBeenCalledWith('shop_owner');
  });

  it('denies already-owned CANCELED without calling markShopPaid', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession());
    findUnique.mockResolvedValue(
      activeSub({ shopId: 'shop_owner', status: 'CANCELED' }),
    );

    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('SUBSCRIPTION_NOT_ACTIVE');
    expect(markShopPaid).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('denies CANCELED guest claim', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession());
    findUnique.mockResolvedValue(activeSub({ status: 'CANCELED' }));

    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('SUBSCRIPTION_NOT_ACTIVE');
    expect(updateMany).not.toHaveBeenCalled();
    expect(markShopPaid).not.toHaveBeenCalled();
  });

  it('denies SUSPENDED guest claim', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession());
    findUnique.mockResolvedValue(activeSub({ status: 'SUSPENDED' }));

    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(403);
    expect(markShopPaid).not.toHaveBeenCalled();
  });

  it('allows PAST_DUE inside grace', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession());
    findUnique.mockResolvedValue(
      activeSub({
        status: 'PAST_DUE',
        pastDueSince: new Date(Date.now() - 2 * 86400000),
      }),
    );
    updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(200);
    expect(markShopPaid).toHaveBeenCalled();
  });

  it('denies PAST_DUE after grace', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession());
    findUnique.mockResolvedValue(
      activeSub({
        status: 'PAST_DUE',
        pastDueSince: new Date(Date.now() - 10 * 86400000),
      }),
    );

    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(403);
    expect(markShopPaid).not.toHaveBeenCalled();
  });

  it('PENDING with live active Stripe sub is allowed', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession());
    findUnique.mockResolvedValue(activeSub({ status: 'PENDING' }));
    retrieveSubscription.mockResolvedValue({
      id: 'sub_live_1',
      status: 'active',
      cancel_at_period_end: false,
      current_period_end: Math.floor(Date.now() / 1000) + 86400,
    });
    updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(200);
    expect(retrieveSubscription).toHaveBeenCalledWith('sub_live_1');
    expect(markShopPaid).toHaveBeenCalled();
  });

  it('PENDING with canceled live Stripe sub is denied', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession());
    findUnique.mockResolvedValue(activeSub({ status: 'PENDING' }));
    retrieveSubscription.mockResolvedValue({
      id: 'sub_live_1',
      status: 'canceled',
      cancel_at_period_end: false,
    });

    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('SUBSCRIPTION_NOT_ACTIVE');
    expect(markShopPaid).not.toHaveBeenCalled();
  });

  it('denies stealing a subscription owned by another shop', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession());
    findUnique.mockResolvedValue(activeSub({ shopId: 'shop_other' }));

    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('ALREADY_OWNED');
    expect(updateMany).not.toHaveBeenCalled();
    expect(markShopPaid).not.toHaveBeenCalled();
  });

  it('handles race when another shop claims first', async () => {
    retrieveCheckoutSession.mockResolvedValue(paidSession());
    findUnique
      .mockResolvedValueOnce(activeSub())
      .mockResolvedValueOnce({ shopId: 'shop_other' });
    updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('CLAIM_RACE');
    expect(markShopPaid).not.toHaveBeenCalled();
  });
});
