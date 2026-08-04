import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import { Prisma } from '@prisma/client';

const resolveAdminAccess = vi.fn();
const requirePermission = vi.fn();
const findUniqueShop = vi.fn();
const createSubscriptionCheckoutSession = vi.fn();
const retrieveCheckoutSession = vi.fn();
const recordTermsAcceptance = vi.fn();
const withLock = vi.fn();

const txFindFirst = vi.fn();
const txFindUnique = vi.fn();
const txCreate = vi.fn();
const txDelete = vi.fn();

const globalFindFirst = vi.fn();
const globalFindUnique = vi.fn();
const globalCreate = vi.fn();
const globalDelete = vi.fn();

const ATTEMPT = '550e8400-e29b-41d4-a716-446655440000';
const FRESH_ATTEMPT = '660e8400-e29b-41d4-a716-446655440099';

const tx = {
  saasSubscription: {
    findFirst: (...args: unknown[]) => txFindFirst(...args),
    findUnique: (...args: unknown[]) => txFindUnique(...args),
    create: (...args: unknown[]) => txCreate(...args),
    delete: (...args: unknown[]) => txDelete(...args),
  },
};

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
      findFirst: (...args: unknown[]) => globalFindFirst(...args),
      findUnique: (...args: unknown[]) => globalFindUnique(...args),
      create: (...args: unknown[]) => globalCreate(...args),
      delete: (...args: unknown[]) => globalDelete(...args),
    },
  },
}));

vi.mock('@/lib/setup/saasCheckoutGuard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/setup/saasCheckoutGuard')>(
    '@/lib/setup/saasCheckoutGuard',
  );
  return {
    ...actual,
    withSaasShopCheckoutLock: (...args: unknown[]) =>
      withLock(...(args as [string, (tx: unknown) => Promise<unknown>])),
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

vi.mock('@/lib/legal/requireTermsAcceptance', async () => {
  const actual = await vi.importActual<typeof import('@/lib/legal/requireTermsAcceptance')>(
    '@/lib/legal/requireTermsAcceptance',
  );
  return {
    ...actual,
    recordTermsAcceptance: (...args: unknown[]) => recordTermsAcceptance(...args),
  };
});

import { POST } from './launch-subscription-checkout';
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
    txFindFirst.mockReset();
    txFindUnique.mockReset();
    txCreate.mockReset();
    txDelete.mockReset();
    globalFindFirst.mockReset();
    globalFindUnique.mockReset();
    globalCreate.mockReset();
    globalDelete.mockReset();
    createSubscriptionCheckoutSession.mockReset();
    retrieveCheckoutSession.mockReset();
    recordTermsAcceptance.mockReset();
    withLock.mockReset();
    withLock.mockImplementation(async (_shopId: string, fn: (client: unknown) => Promise<unknown>) =>
      fn(tx),
    );
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
    txFindFirst.mockResolvedValue(null);
    txFindUnique.mockResolvedValue(null);
    txCreate.mockResolvedValue({});
    txDelete.mockResolvedValue({});
    recordTermsAcceptance.mockResolvedValue(undefined);
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

  it('returns 400 without termsAccepted', async () => {
    const res = await POST(makeContext({ checkoutAttemptId: ATTEMPT }) as never);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe(TERMS_ACCEPTANCE_REQUIRED_MESSAGE);
  });

  it.each(['ACTIVE', 'PAST_DUE', 'SUSPENDED'] as const)(
    'returns SUBSCRIPTION_ALREADY_EXISTS for %s via tx with zero Stripe calls',
    async (status) => {
      txFindFirst.mockResolvedValue({
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
      expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
      expect(txFindFirst).toHaveBeenCalled();
      expect(globalFindFirst).not.toHaveBeenCalled();
    },
  );

  it('creates PENDING and Terms via tx', async () => {
    const res = await POST(
      makeContext({ termsAccepted: true, checkoutAttemptId: ATTEMPT }) as never,
    );
    expect(res.status).toBe(200);
    expect(txCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        shopId: 'shop-1',
        checkoutAttemptId: ATTEMPT,
        status: 'PENDING',
      }),
    });
    expect(globalCreate).not.toHaveBeenCalled();
    expect(recordTermsAcceptance).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'owner@example.com',
        userId: 'user-1',
        shopId: 'shop-1',
        stripeSessionId: 'cs_launch_1',
        db: tx,
      }),
    );
    expect(recordTermsAcceptance.mock.calls[0][0].db).toBe(tx);
  });

  it('reuses PENDING open session via tx lookup', async () => {
    txFindFirst.mockResolvedValue({
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
    expect(body.reused).toBe(true);
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
    expect(txFindFirst).toHaveBeenCalled();
  });

  it('expired PENDING with same attempt returns rotateAttempt after tx delete', async () => {
    txFindFirst.mockResolvedValue({
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
    expect(txDelete).toHaveBeenCalledWith({ where: { id: 'sub_p' } });
    expect(globalDelete).not.toHaveBeenCalled();
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it('expired PENDING + delete failure returns CHECKOUT_RELEASE_FAILED', async () => {
    txFindFirst.mockResolvedValue({
      id: 'sub_p',
      status: 'PENDING',
      stripeSessionId: 'cs_exp',
      checkoutAttemptId: ATTEMPT,
    });
    retrieveCheckoutSession.mockResolvedValue({ id: 'cs_exp', status: 'expired' });
    txDelete.mockRejectedValueOnce(new Error('delete failed'));

    const res = await POST(
      makeContext({ termsAccepted: true, checkoutAttemptId: ATTEMPT }) as never,
    );
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe('CHECKOUT_RELEASE_FAILED');
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
    expect(txCreate).not.toHaveBeenCalled();
  });

  it('expired PENDING with fresh attempt creates a new session after tx delete', async () => {
    txFindFirst.mockResolvedValue({
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
    expect(txDelete).toHaveBeenCalled();
    expect(createSubscriptionCheckoutSession).toHaveBeenCalledOnce();
    expect(txCreate.mock.calls[0][0].data.checkoutAttemptId).toBe(FRESH_ATTEMPT);
  });

  it('on Terms failure does not return Stripe URL', async () => {
    recordTermsAcceptance.mockRejectedValueOnce(new Error('terms db down'));
    const res = await POST(
      makeContext({ termsAccepted: true, checkoutAttemptId: ATTEMPT }) as never,
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.url).toBeUndefined();
  });

  it('on P2002 race reuses winning session via tx', async () => {
    txCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    txFindUnique
      .mockResolvedValueOnce(null) // by attempt before create
      .mockResolvedValueOnce({ stripeSessionId: 'cs_winner', status: 'PENDING' });
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
    expect(globalFindUnique).not.toHaveBeenCalled();
  });

  it('acquires shop lock before status re-check', async () => {
    await POST(makeContext({ termsAccepted: true, checkoutAttemptId: ATTEMPT }) as never);
    expect(withLock).toHaveBeenCalledWith('shop-1', expect.any(Function));
    expect(withLock.mock.invocationCallOrder[0]).toBeLessThan(
      txFindFirst.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
  });
});
