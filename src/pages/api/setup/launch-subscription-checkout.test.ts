import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';

const resolveAdminAccess = vi.fn();
const requirePermission = vi.fn();
const findUniqueShop = vi.fn();
const findFirstPending = vi.fn();
const createSaas = vi.fn();
const createLegalAcceptance = vi.fn();
const createSubscriptionCheckoutSession = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...args: unknown[]) => findUniqueShop(...args),
    },
    saasSubscription: {
      findFirst: (...args: unknown[]) => findFirstPending(...args),
      create: (...args: unknown[]) => createSaas(...args),
    },
    legalAcceptance: {
      create: (...args: unknown[]) => createLegalAcceptance(...args),
    },
  },
}));

vi.mock('@/lib/shop/stripe', () => ({
  createSubscriptionCheckoutSession: (...args: unknown[]) =>
    createSubscriptionCheckoutSession(...args),
}));

vi.mock('@/lib/setup/siteUrl', () => ({
  getPublicSiteUrl: () => 'https://kersivo.test',
}));

vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({
  enforceIpRateLimit: vi.fn(async () => null),
}));

import { POST } from './launch-subscription-checkout';
import { CURRENT_TERMS_VERSION } from '@/lib/legal/termsVersion';
import { TERMS_ACCEPTANCE_REQUIRED_MESSAGE } from '@/lib/legal/requireTermsAcceptance';

function makeContext(body: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/setup/launch-subscription-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'user-agent': 'vitest-launch',
      },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

describe('POST /api/setup/launch-subscription-checkout', () => {
  beforeEach(() => {
    resolveAdminAccess.mockReset();
    requirePermission.mockReset();
    findUniqueShop.mockReset();
    findFirstPending.mockReset();
    createSaas.mockReset();
    createLegalAcceptance.mockReset();
    createSubscriptionCheckoutSession.mockReset();
    requirePermission.mockReturnValue(null);
    resolveAdminAccess.mockResolvedValue({
      via: 'session',
      shopId: 'shop-1',
      userId: 'user-1',
      userEmail: 'owner@example.com',
      userName: 'Owner Name',
      role: 'OWNER',
    });
    findUniqueShop.mockResolvedValue({
      onboardingCompleted: true,
      name: 'Fade Studio',
      _count: { barbers: 2 },
    });
    findFirstPending.mockResolvedValue(null);
    createSaas.mockResolvedValue({});
    createLegalAcceptance.mockResolvedValue({});
    createSubscriptionCheckoutSession.mockResolvedValue({
      id: 'cs_launch_1',
      url: 'https://checkout.stripe.test/cs_launch_1',
    });
  });

  it('returns 400 without termsAccepted and does not create a Stripe session', async () => {
    const res = await POST(makeContext({ attribution: {} }) as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe(TERMS_ACCEPTANCE_REQUIRED_MESSAGE);
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
    expect(createLegalAcceptance).not.toHaveBeenCalled();
  });

  it('records LegalAcceptance with userId and shopId when termsAccepted is true', async () => {
    const res = await POST(makeContext({ termsAccepted: true }) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe('https://checkout.stripe.test/cs_launch_1');
    expect(createSubscriptionCheckoutSession).toHaveBeenCalledOnce();
    expect(createLegalAcceptance).toHaveBeenCalledWith({
      data: expect.objectContaining({
        purpose: 'SAAS_CHECKOUT',
        termsVersion: CURRENT_TERMS_VERSION,
        email: 'owner@example.com',
        userId: 'user-1',
        shopId: 'shop-1',
        stripeSessionId: 'cs_launch_1',
        userAgent: 'vitest-launch',
      }),
    });
  });
});
