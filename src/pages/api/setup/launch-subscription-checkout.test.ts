import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import { Prisma } from '@prisma/client';

const resolveAdminAccess = vi.fn();
const requirePermission = vi.fn();
const findUniqueShop = vi.fn();
const findFirstOpen = vi.fn();
const findUniqueSaas = vi.fn();
const createSaas = vi.fn();
const deleteSaas = vi.fn();
const createLegalAcceptance = vi.fn();
const createSubscriptionCheckoutSession = vi.fn();
const retrieveCheckoutSession = vi.fn();
const withLock = vi.fn(async (_shopId: string, fn: () => Promise<unknown>) => fn());

const ATTEMPT = '550e8400-e29b-41d4-a716-446655440000';
const FRESH_ATTEMPT = '660e8400-e29b-41d4-a716-446655440099';

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
      findFirst: (...args: unknown[]) => findFirstOpen(...args),
      findUnique: (...args: unknown[]) => findUniqueSaas(...args),
      create: (...args: unknown[]) => createSaas(...args),
      delete: (...args: unknown[]) => deleteSaas(...args),
    },
    legalAcceptance: {
      create: (...args: unknown[]) => createLegalAcceptance(...args),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

vi.mock('@/lib/setup/saasCheckoutGuard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/setup/saasCheckoutGuard')>(
    '@/lib/setup/saasCheckoutGuard',
  );
  return {
    ...actual,
    withSaasShopCheckoutLock: (...args: unknown[]) => withLock(...(args as [string, () => Promise<unknown>])),
  };
});

vi.mock('@/lib/shop/stripe', () => ({
  createSubscriptionCheckoutSession: (...args: unknown[]) =>
    createSubscriptionCheckoutSession(...args),
  retrieveCheckoutSession: (...args: unknown[]) => retrieveCheckoutSession(...args),
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
    findFirstOpen.mockReset();
    findUniqueSaas.mockReset();
    createSaas.mockReset();
    deleteSaas.mockReset();
    createLegalAcceptance.mockReset();
    createSubscriptionCheckoutSession.mockReset();
    retrieveCheckoutSession.mockReset();
    withLock.mockClear();
    withLock.mockImplementation(async (_shopId: string, fn: () => Promise<unknown>) => fn());
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
    findFirstOpen.mockResolvedValue(null);
    findUniqueSaas.mockResolvedValue(null);
    createSaas.mockResolvedValue({});
    deleteSaas.mockResolvedValue({});
    createLegalAcceptance.mockResolvedValue({});
    createSubscriptionCheckoutSession.mockResolvedValue({
      id: 'cs_launch_1',
      url: 'https://checkout.stripe.test/cs_launch_1',
    });
  });

  it('returns 401 without session', async () => {
    resolveAdminAccess.mockResolvedValue(null);
    const res = await POST(makeContext({ termsAccepted: true, checkoutAttemptId: ATTEMPT }) as never);
    expect(res.status).toBe(401);
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns 403 without billing.manage', async () => {
    requirePermission.mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    );
    const res = await POST(makeContext({ termsAccepted: true, checkoutAttemptId: ATTEMPT }) as never);
    expect(res.status).toBe(403);
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns 400 without termsAccepted and does not create a Stripe session', async () => {
    const res = await POST(makeContext({ checkoutAttemptId: ATTEMPT }) as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe(TERMS_ACCEPTANCE_REQUIRED_MESSAGE);
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns 400 without checkoutAttemptId', async () => {
    const res = await POST(makeContext({ termsAccepted: true }) as never);
    expect(res.status).toBe(400);
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it.each(['ACTIVE', 'PAST_DUE', 'SUSPENDED'] as const)(
    'returns SUBSCRIPTION_ALREADY_EXISTS for %s with zero Stripe calls',
    async (status) => {
      findFirstOpen.mockResolvedValue({
        id: 'sub_1',
        status,
        stripeSessionId: 'cs_old',
        checkoutAttemptId: 'old',
      });

      const res = await POST(
        makeContext({ termsAccepted: true, checkoutAttemptId: ATTEMPT }) as never,
      );
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.code).toBe('SUBSCRIPTION_ALREADY_EXISTS');
      expect(body.redirectTo).toBe('/admin');
      expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
      expect(withLock).toHaveBeenCalled();
    },
  );

  it('allows checkout after CANCELED', async () => {
    findFirstOpen.mockResolvedValue(null); // open filter excludes CANCELED
    const res = await POST(
      makeContext({ termsAccepted: true, checkoutAttemptId: ATTEMPT }) as never,
    );
    expect(res.status).toBe(200);
    expect(createSubscriptionCheckoutSession).toHaveBeenCalledOnce();
    expect(createSaas).toHaveBeenCalledWith({
      data: expect.objectContaining({
        shopId: 'shop-1',
        checkoutAttemptId: ATTEMPT,
        status: 'PENDING',
      }),
    });
  });

  it('reuses PENDING open session', async () => {
    findFirstOpen.mockResolvedValue({
      id: 'sub_p',
      status: 'PENDING',
      stripeSessionId: 'cs_pending',
      checkoutAttemptId: ATTEMPT,
      shopSize: '1-2',
      currentStack: 'kersivo-preview',
    });
    retrieveCheckoutSession.mockResolvedValue({
      id: 'cs_pending',
      status: 'open',
      url: 'https://checkout.stripe.test/cs_pending',
    });

    const res = await POST(
      makeContext({ termsAccepted: true, checkoutAttemptId: ATTEMPT }) as never,
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reused).toBe(true);
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns success url for PENDING complete/paid', async () => {
    findFirstOpen.mockResolvedValue({
      id: 'sub_p',
      status: 'PENDING',
      stripeSessionId: 'cs_done',
      checkoutAttemptId: ATTEMPT,
    });
    retrieveCheckoutSession.mockResolvedValue({
      id: 'cs_done',
      status: 'complete',
      payment_status: 'paid',
    });

    const res = await POST(
      makeContext({ termsAccepted: true, checkoutAttemptId: ATTEMPT }) as never,
    );
    const body = await res.json();
    expect(body.state).toBe('complete');
    expect(body.url).toBe('/setup/success?session_id=cs_done');
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it('expired PENDING with same attempt returns rotateAttempt', async () => {
    findFirstOpen.mockResolvedValue({
      id: 'sub_p',
      status: 'PENDING',
      stripeSessionId: 'cs_exp',
      checkoutAttemptId: ATTEMPT,
    });
    retrieveCheckoutSession.mockResolvedValue({ id: 'cs_exp', status: 'expired' });

    const res = await POST(
      makeContext({ termsAccepted: true, checkoutAttemptId: ATTEMPT }) as never,
    );
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe('CHECKOUT_ATTEMPT_EXPIRED');
    expect(deleteSaas).toHaveBeenCalledWith({ where: { id: 'sub_p' } });
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it('expired PENDING with fresh attempt creates a new session', async () => {
    findFirstOpen.mockResolvedValue({
      id: 'sub_p',
      status: 'PENDING',
      stripeSessionId: 'cs_exp',
      checkoutAttemptId: ATTEMPT,
      shopSize: '1-2',
      currentStack: 'kersivo-preview',
    });
    retrieveCheckoutSession.mockResolvedValue({ id: 'cs_exp', status: 'expired' });

    const res = await POST(
      makeContext({ termsAccepted: true, checkoutAttemptId: FRESH_ATTEMPT }) as never,
    );
    expect(res.status).toBe(200);
    expect(deleteSaas).toHaveBeenCalled();
    expect(createSubscriptionCheckoutSession).toHaveBeenCalledOnce();
    expect(createSaas.mock.calls[0][0].data.checkoutAttemptId).toBe(FRESH_ATTEMPT);
  });

  it('returns 503 without new session when PENDING lookup fails', async () => {
    findFirstOpen.mockResolvedValue({
      id: 'sub_p',
      status: 'PENDING',
      stripeSessionId: 'cs_bad',
      checkoutAttemptId: ATTEMPT,
    });
    retrieveCheckoutSession.mockRejectedValue(new Error('stripe down'));

    const res = await POST(
      makeContext({ termsAccepted: true, checkoutAttemptId: ATTEMPT }) as never,
    );
    expect(res.status).toBe(503);
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it('acquires shop lock before status re-check', async () => {
    await POST(makeContext({ termsAccepted: true, checkoutAttemptId: ATTEMPT }) as never);
    expect(withLock).toHaveBeenCalledWith('shop-1', expect.any(Function));
    expect(withLock.mock.invocationCallOrder[0]).toBeLessThan(
      findFirstOpen.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
  });

  it('on P2002 race reuses winning session', async () => {
    createSaas.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    findUniqueSaas
      .mockResolvedValueOnce(null) // by attempt before create
      .mockResolvedValueOnce({ stripeSessionId: 'cs_winner' });
    retrieveCheckoutSession.mockResolvedValue({
      id: 'cs_winner',
      status: 'open',
      url: 'https://checkout.stripe.test/cs_winner',
    });

    const res = await POST(
      makeContext({ termsAccepted: true, checkoutAttemptId: ATTEMPT }) as never,
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reused).toBe(true);
  });

  it('records LegalAcceptance with userId and shopId when creating', async () => {
    const res = await POST(
      makeContext({ termsAccepted: true, checkoutAttemptId: ATTEMPT }) as never,
    );
    expect(res.status).toBe(200);
    expect(createLegalAcceptance).toHaveBeenCalledWith({
      data: expect.objectContaining({
        purpose: 'SAAS_CHECKOUT',
        termsVersion: CURRENT_TERMS_VERSION,
        email: 'owner@example.com',
        userId: 'user-1',
        shopId: 'shop-1',
        stripeSessionId: 'cs_launch_1',
      }),
    });
  });
});
