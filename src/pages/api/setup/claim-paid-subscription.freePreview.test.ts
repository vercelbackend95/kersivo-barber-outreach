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
const findPreviewRequest = vi.fn();
const adoptPreviewDraftShop = vi.fn();

vi.mock('@/lib/freePreview/conversion', () => ({
  adoptPreviewDraftShop: (...args: unknown[]) => adoptPreviewDraftShop(...args),
}));

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
    previewRequest: { findUnique: (...args: unknown[]) => findPreviewRequest(...args) },
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

describe('POST /api/setup/claim-paid-subscription — free preview adoption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAdminAccess.mockResolvedValue(OWNER);
    requirePermission.mockReturnValue(null);
    requireVerifiedEmail.mockReturnValue(null);
    markShopPaid.mockResolvedValue(undefined);
    retrieveCheckoutSession.mockResolvedValue(paidSession());
    retrieveSubscription.mockResolvedValue({ id: 'sub_live_1', status: 'active', current_period_end: Math.floor(Date.now() / 1000) + 86400 });
    findUnique.mockResolvedValue(activeSub({ shopId: 'shop_draft' }));
    findPreviewRequest.mockResolvedValue({ id: 'req_1' });
    adoptPreviewDraftShop.mockResolvedValue({ ok: true, shopId: 'shop_draft', adopted: true });
  });

  it('adopts the preview draft shop into the buyer account and sends them to the shortened onboarding', async () => {
    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, shopId: 'shop_draft', redirectTo: '/admin/preview-launch' });
    expect(adoptPreviewDraftShop).toHaveBeenCalledWith({
      draftShopId: 'shop_draft',
      userId: 'user_1',
      currentShopId: 'shop_owner',
      checkoutEmail: 'alex@example.com',
    });
    expect(markShopPaid).toHaveBeenCalledWith('shop_draft');
  });

  it('still refuses ALREADY_OWNED when the other shop is not a preview draft (unchanged behaviour)', async () => {
    findPreviewRequest.mockResolvedValue(null);
    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'ALREADY_OWNED' });
    expect(adoptPreviewDraftShop).not.toHaveBeenCalled();
  });

  it('does not adopt when the email on the paid checkout differs from the signed-in user', async () => {
    retrieveCheckoutSession.mockResolvedValue(
      paidSession({ customer_email: 'other@example.com', customer_details: { email: 'other@example.com' } }),
    );
    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(403);
    expect(adoptPreviewDraftShop).not.toHaveBeenCalled();
  });

  it('does not adopt when the subscription is no longer active', async () => {
    findUnique.mockResolvedValue(activeSub({ shopId: 'shop_draft', status: 'CANCELED' }));
    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(403);
    expect(adoptPreviewDraftShop).not.toHaveBeenCalled();
  });

  it('explains when the account already has a real workspace', async () => {
    adoptPreviewDraftShop.mockResolvedValue({ ok: false, code: 'CURRENT_SHOP_NOT_EMPTY' });
    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'PREVIEW_ADOPTION_BLOCKED' });
    expect(markShopPaid).not.toHaveBeenCalled();
  });

  it('is idempotent after adoption: the retry keeps the redirect', async () => {
    resolveAdminAccess.mockResolvedValue({ ...OWNER, shopId: 'shop_draft' });
    const res = await POST(makeContext({ stripeSessionId: 'cs_test_1' }) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, idempotent: true, redirectTo: '/admin/preview-launch' });
    expect(adoptPreviewDraftShop).not.toHaveBeenCalled();
  });
});
