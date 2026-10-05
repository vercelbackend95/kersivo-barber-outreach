import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import { Prisma } from '@prisma/client';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';

const resolveAdminAccess = vi.fn();
const requirePermission = vi.fn();
const shopMeetsOnboardingCompletionRequirements = vi.fn();
const markOnboardingCompleted = vi.fn();
const findUniqueShop = vi.fn();
const globalShopCreate = vi.fn();
const globalShopUpdate = vi.fn();
const globalSubCreate = vi.fn();
const createSubscriptionCheckoutSession = vi.fn();
const retrieveCheckoutSession = vi.fn();
const recordTermsAcceptance = vi.fn();
const withLock = vi.fn();

const txShopFindUnique = vi.fn();
const txSubFindFirst = vi.fn();
const txSubFindUnique = vi.fn();
const txSubCreate = vi.fn();
const txSubDelete = vi.fn();
const txSubUpdateMany = vi.fn();

const ATTEMPT = '550e8400-e29b-41d4-a716-446655440000';
const FRESH_ATTEMPT = '660e8400-e29b-41d4-a716-446655440099';
const NOW = new Date();
const FUTURE = new Date(NOW.getTime() + 20 * 24 * 60 * 60 * 1000);
const PAST = new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000);

const tx = {
  shopSettings: {
    findUnique: (...args: unknown[]) => txShopFindUnique(...args),
  },
  saasSubscription: {
    findFirst: (...args: unknown[]) => txSubFindFirst(...args),
    findUnique: (...args: unknown[]) => txSubFindUnique(...args),
    create: (...args: unknown[]) => txSubCreate(...args),
    delete: (...args: unknown[]) => txSubDelete(...args),
    updateMany: (...args: unknown[]) => txSubUpdateMany(...args),
  },
};

vi.mock('@/lib/admin/auth', () => ({
  resolveAdminAccess: (...args: unknown[]) => resolveAdminAccess(...args),
  requireVerifiedEmail: (access: { via: string; emailVerified: boolean }) =>
    access.via === 'session' && !access.emailVerified
      ? new Response(JSON.stringify({ code: 'EMAIL_NOT_VERIFIED' }), { status: 403 })
      : null,
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));

vi.mock('@/lib/admin/onboarding', () => ({
  shopMeetsOnboardingCompletionRequirements: (...args: unknown[]) =>
    shopMeetsOnboardingCompletionRequirements(...args),
  markOnboardingCompleted: (...args: unknown[]) => markOnboardingCompleted(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...args: unknown[]) => findUniqueShop(...args),
      create: (...args: unknown[]) => globalShopCreate(...args),
      update: (...args: unknown[]) => globalShopUpdate(...args),
    },
    saasSubscription: {
      create: (...args: unknown[]) => globalSubCreate(...args),
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
      withLock(...(args as [string, (client: unknown) => Promise<unknown>])),
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

import { POST } from './upgrade-checkout';
import { TERMS_ACCEPTANCE_REQUIRED_MESSAGE } from '@/lib/legal/requireTermsAcceptance';

type SubRow = {
  status: string;
  currentPeriodEnd?: Date | null;
  pastDueSince?: Date | null;
  cancelAtPeriodEnd?: boolean;
};

type OpenRow = {
  id: string;
  status: string;
  stripeSessionId: string;
  checkoutAttemptId: string | null;
  shopSize?: string;
  currentStack?: string;
};

let shopRow: Record<string, unknown> | null;
let latestSubscription: SubRow | null;
let openSubscription: OpenRow | null;

function freeShop() {
  return {
    id: 'shop-1',
    shopPaidAt: null,
    smsRemindersEnabled: false,
    freeBookingActivatedAt: new Date('2026-09-01T10:00:00Z'),
  };
}

function setupShop() {
  return { ...freeShop(), freeBookingActivatedAt: null };
}

function sessionAccess(overrides: Record<string, unknown> = {}) {
  return {
    via: 'session',
    shopId: 'shop-1',
    userId: 'user-1',
    userEmail: 'Owner@Example.com',
    userName: 'Owner Name',
    emailVerified: true,
    role: 'OWNER',
    ...overrides,
  };
}

function makeContext(body: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/admin/subscription/upgrade-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'user-agent': 'vitest-upgrade' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

async function post(body: unknown = { termsAccepted: true, checkoutAttemptId: ATTEMPT }) {
  const res = await POST(makeContext(body) as never);
  return { res, body: (await res.json()) as Record<string, unknown> };
}

function expectNoCheckoutSideEffects() {
  expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  expect(txSubCreate).not.toHaveBeenCalled();
  expect(recordTermsAcceptance).not.toHaveBeenCalled();
}

describe('POST /api/admin/subscription/upgrade-checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shopRow = freeShop();
    latestSubscription = null;
    openSubscription = null;

    resolveAdminAccess.mockResolvedValue(sessionAccess());
    requirePermission.mockReturnValue(null);
    shopMeetsOnboardingCompletionRequirements.mockResolvedValue(true);
    markOnboardingCompleted.mockResolvedValue(undefined);
    findUniqueShop.mockResolvedValue({
      onboardingCompleted: true,
      name: 'Fade Studio',
      _count: { barbers: 3 },
    });
    withLock.mockImplementation(async (_shopId: string, fn: (client: unknown) => Promise<unknown>) =>
      fn(tx),
    );
    txShopFindUnique.mockImplementation(async () => shopRow);
    txSubFindFirst.mockImplementation(async (args: { where: { status: unknown } }) => {
      const status = args.where.status as { not?: string; in?: string[] };
      if (status.not === 'PENDING') return latestSubscription;
      if (!openSubscription) return null;
      return status.in?.includes(openSubscription.status) ? openSubscription : null;
    });
    txSubFindUnique.mockResolvedValue(null);
    txSubCreate.mockResolvedValue({});
    txSubDelete.mockResolvedValue({});
    txSubUpdateMany.mockResolvedValue({ count: 1 });
    recordTermsAcceptance.mockResolvedValue(undefined);
    createSubscriptionCheckoutSession.mockResolvedValue({
      id: 'cs_upgrade_1',
      url: 'https://checkout.stripe.test/cs_upgrade_1',
    });
  });

  describe('who may upgrade', () => {
    it('A: Free Booking owner starts a checkout for the same shop', async () => {
      const { res, body } = await post();
      expect(res.status).toBe(200);
      expect(body).toEqual({
        ok: true,
        url: 'https://checkout.stripe.test/cs_upgrade_1',
        reused: false,
        state: 'open',
      });
      expect(withLock).toHaveBeenCalledWith('shop-1', expect.any(Function));
      expect(txSubCreate).toHaveBeenCalledTimes(1);
    });

    it('B: SETUP owner may choose Full directly; setup completes without Starter activation', async () => {
      shopRow = setupShop();
      findUniqueShop.mockResolvedValue({
        onboardingCompleted: false,
        name: 'Fade Studio',
        _count: { barbers: 6 },
      });
      const { res } = await post();
      expect(res.status).toBe(200);
      expect(shopMeetsOnboardingCompletionRequirements).toHaveBeenCalledWith('shop-1');
      expect(markOnboardingCompleted).toHaveBeenCalledWith('shop-1');
      expect(txSubCreate).toHaveBeenCalledTimes(1);
      expect(globalShopUpdate).not.toHaveBeenCalled();
      expect(shopRow?.freeBookingActivatedAt).toBeNull();
    });

    it('B: SETUP without finished shop/team/services/hours cannot start checkout', async () => {
      shopRow = setupShop();
      findUniqueShop.mockResolvedValue({
        onboardingCompleted: false,
        name: 'Fade Studio',
        _count: { barbers: 0 },
      });
      shopMeetsOnboardingCompletionRequirements.mockResolvedValue(false);
      const { res, body } = await post();
      expect(res.status).toBe(400);
      expect(body.code).toBe('ONBOARDING_INCOMPLETE');
      expect(markOnboardingCompleted).not.toHaveBeenCalled();
      expect(withLock).not.toHaveBeenCalled();
      expectNoCheckoutSideEffects();
    });

    it('C: FULL_KERSIVO (active subscription) never starts a second subscription', async () => {
      latestSubscription = { status: 'ACTIVE', currentPeriodEnd: FUTURE };
      const { res, body } = await post();
      expect(res.status).toBe(409);
      expect(body.code).toBe('SUBSCRIPTION_ALREADY_EXISTS');
      expect(body.redirectTo).toBe('/admin');
      expectNoCheckoutSideEffects();
    });

    it('C: legacy paid shop (shopPaidAt, no subscription row) resolves FULL and is blocked', async () => {
      shopRow = { ...freeShop(), shopPaidAt: new Date('2026-01-01T00:00:00Z') };
      const { res, body } = await post();
      expect(res.status).toBe(409);
      expect(body.code).toBe('SUBSCRIPTION_ALREADY_EXISTS');
      expectNoCheckoutSideEffects();
    });

    it('D: a barber without billing.manage is denied', async () => {
      resolveAdminAccess.mockResolvedValue(sessionAccess({ role: 'BARBER' }));
      requirePermission.mockReturnValue(
        new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
      );
      const { res } = await post();
      expect(res.status).toBe(403);
      expect(requirePermission).toHaveBeenCalledWith(expect.anything(), 'billing.manage');
      expect(withLock).not.toHaveBeenCalled();
      expectNoCheckoutSideEffects();
    });

    it('E: an unverified account email is denied', async () => {
      resolveAdminAccess.mockResolvedValue(sessionAccess({ emailVerified: false }));
      const { res, body } = await post();
      expect(res.status).toBe(403);
      expect(body.code).toBe('EMAIL_NOT_VERIFIED');
      expect(withLock).not.toHaveBeenCalled();
      expectNoCheckoutSideEffects();
    });

    it('returns 401 without any session', async () => {
      resolveAdminAccess.mockResolvedValue(null);
      const { res } = await post();
      expect(res.status).toBe(401);
      expectNoCheckoutSideEffects();
    });

    it.each([
      ['guest preview', { via: 'preview' }],
      ['secret access', { via: 'secret' }],
      ['legacy cookie', { via: 'legacy-cookie' }],
      ['demo shop session', { shopId: DEMO_SHOP_ID }],
    ])('F: %s cannot use the upgrade endpoint', async (_label, overrides) => {
      resolveAdminAccess.mockResolvedValue(sessionAccess(overrides));
      const { res, body } = await post();
      expect(res.status).toBe(403);
      expect(body.code).toBe('UPGRADE_NOT_AVAILABLE');
      expect(withLock).not.toHaveBeenCalled();
      expectNoCheckoutSideEffects();
    });
  });

  describe('same shop, same records', () => {
    it('G/I: the PENDING row belongs to the signed-in shop and no shop is created', async () => {
      await post();
      expect(txSubCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shopId: 'shop-1',
          checkoutAttemptId: ATTEMPT,
          stripeSessionId: 'cs_upgrade_1',
          status: 'PENDING',
          customerEmail: 'owner@example.com',
          customerName: 'Owner Name',
          shopName: 'Fade Studio',
          monthlyPence: 3900,
        }),
      });
      expect(globalShopCreate).not.toHaveBeenCalled();
      expect(globalShopUpdate).not.toHaveBeenCalled();
      expect(globalSubCreate).not.toHaveBeenCalled();
    });

    it('H: Stripe metadata carries the same shopId and attempt via the shared builder, £39/month', async () => {
      await post();
      expect(createSubscriptionCheckoutSession).toHaveBeenCalledTimes(1);
      const args = createSubscriptionCheckoutSession.mock.calls[0][0];
      expect(args.metadata).toMatchObject({
        type: 'saas_subscription',
        shopId: 'shop-1',
        checkoutAttemptId: ATTEMPT,
        source: 'admin_upgrade',
        terms_accepted: '1',
      });
      expect(args.unitAmount).toBe(3900);
      expect(args.customerEmail).toBe('owner@example.com');
      expect(args.idempotencyKey).toBe(`kersivo_saas_subscription_checkout_${ATTEMPT}`);
      expect(args.successUrl).toBe(
        'https://kersivo.test/setup/success?session_id={CHECKOUT_SESSION_ID}',
      );
      expect(args.cancelUrl).toBe('https://kersivo.test/setup/cancel');
    });

    it('returns an onboarding-started Full checkout to the plan choice if Stripe is cancelled', async () => {
      await post({
        termsAccepted: true,
        checkoutAttemptId: ATTEMPT,
        returnToOnboarding: true,
      });

      expect(createSubscriptionCheckoutSession).toHaveBeenCalledTimes(1);
      const args = createSubscriptionCheckoutSession.mock.calls[0][0];
      expect(args.cancelUrl).toBe('https://kersivo.test/admin/onboarding');
    });

    it('records SAAS_CHECKOUT Terms with user, email, shop, Stripe session and request', async () => {
      await post();
      expect(recordTermsAcceptance).toHaveBeenCalledTimes(1);
      const input = recordTermsAcceptance.mock.calls[0][0];
      expect(input).toMatchObject({
        purpose: 'SAAS_CHECKOUT',
        email: 'owner@example.com',
        userId: 'user-1',
        shopId: 'shop-1',
        stripeSessionId: 'cs_upgrade_1',
      });
      expect(input.purpose).not.toBe('FREE_BOOKING_ACTIVATION');
      expect(input.request).toBeInstanceOf(Request);
      expect(input.db).toBe(tx);
    });
  });

  describe('existing checkout attempts', () => {
    it('J: an open PENDING checkout is reused without a new session, row or Terms record', async () => {
      openSubscription = {
        id: 'sub_p',
        status: 'PENDING',
        stripeSessionId: 'cs_open',
        checkoutAttemptId: ATTEMPT,
      };
      retrieveCheckoutSession.mockResolvedValue({
        id: 'cs_open',
        status: 'open',
        url: 'https://checkout.stripe.test/cs_open',
      });
      const { res, body } = await post();
      expect(res.status).toBe(200);
      expect(body).toMatchObject({ ok: true, reused: true, url: 'https://checkout.stripe.test/cs_open' });
      expectNoCheckoutSideEffects();
    });

    it('K: an expired PENDING with the same attempt is released and the client rotates', async () => {
      openSubscription = {
        id: 'sub_p',
        status: 'PENDING',
        stripeSessionId: 'cs_exp',
        checkoutAttemptId: ATTEMPT,
      };
      retrieveCheckoutSession.mockResolvedValue({ id: 'cs_exp', status: 'expired' });
      const { res, body } = await post();
      expect(res.status).toBe(409);
      expect(body).toMatchObject({ code: 'CHECKOUT_ATTEMPT_EXPIRED', rotateAttempt: true });
      expect(txSubDelete).toHaveBeenCalledWith({ where: { id: 'sub_p' } });
      expectNoCheckoutSideEffects();
    });

    it('K: after rotation, a fresh attempt releases the expired row and creates exactly one new PENDING', async () => {
      openSubscription = {
        id: 'sub_p',
        status: 'PENDING',
        stripeSessionId: 'cs_exp',
        checkoutAttemptId: ATTEMPT,
      };
      retrieveCheckoutSession.mockResolvedValue({ id: 'cs_exp', status: 'expired' });
      const { res } = await post({ termsAccepted: true, checkoutAttemptId: FRESH_ATTEMPT });
      expect(res.status).toBe(200);
      expect(txSubDelete).toHaveBeenCalledWith({ where: { id: 'sub_p' } });
      expect(txSubCreate).toHaveBeenCalledTimes(1);
      expect(txSubCreate.mock.calls[0][0].data.checkoutAttemptId).toBe(FRESH_ATTEMPT);
    });

    it('Q: an idempotent retry reuses the first checkout — one PENDING row, one Terms record', async () => {
      const first = await post();
      expect(first.res.status).toBe(200);

      openSubscription = {
        id: 'sub_new',
        status: 'PENDING',
        stripeSessionId: 'cs_upgrade_1',
        checkoutAttemptId: ATTEMPT,
      };
      retrieveCheckoutSession.mockResolvedValue({
        id: 'cs_upgrade_1',
        status: 'open',
        url: 'https://checkout.stripe.test/cs_upgrade_1',
      });
      const second = await post();
      expect(second.body).toMatchObject({ ok: true, reused: true });
      expect(txSubCreate).toHaveBeenCalledTimes(1);
      expect(createSubscriptionCheckoutSession).toHaveBeenCalledTimes(1);
      expect(recordTermsAcceptance).toHaveBeenCalledTimes(1);
    });

    it('Q: a concurrent create (P2002) reuses the winning checkout instead of a duplicate', async () => {
      txSubCreate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      txSubFindUnique.mockImplementation(async (args: { where: { checkoutAttemptId?: string } }) =>
        args.where.checkoutAttemptId === ATTEMPT && txSubCreate.mock.calls.length > 0
          ? { stripeSessionId: 'cs_winner', status: 'PENDING' }
          : null,
      );
      retrieveCheckoutSession.mockResolvedValue({
        id: 'cs_winner',
        status: 'open',
        url: 'https://checkout.stripe.test/cs_winner',
      });
      const { res, body } = await post();
      expect(res.status).toBe(200);
      expect(body).toMatchObject({ reused: true, url: 'https://checkout.stripe.test/cs_winner' });
      expect(recordTermsAcceptance).not.toHaveBeenCalled();
    });
  });

  describe('subscription lifecycle states', () => {
    it('L: ACTIVE blocks a new checkout', async () => {
      latestSubscription = { status: 'ACTIVE', currentPeriodEnd: FUTURE, cancelAtPeriodEnd: false };
      const { res, body } = await post();
      expect(res.status).toBe(409);
      expect(body.code).toBe('SUBSCRIPTION_ALREADY_EXISTS');
      expectNoCheckoutSideEffects();
    });

    it('L: a stale ACTIVE row (period end passed, no webhook yet) still blocks a duplicate', async () => {
      latestSubscription = { status: 'ACTIVE', currentPeriodEnd: PAST };
      openSubscription = {
        id: 'sub_a',
        status: 'ACTIVE',
        stripeSessionId: 'cs_a',
        checkoutAttemptId: 'old',
      };
      const { res, body } = await post();
      expect(res.status).toBe(409);
      expect(body.code).toBe('SUBSCRIPTION_ALREADY_EXISTS');
      expectNoCheckoutSideEffects();
    });

    it.each([
      ['PAST_DUE within grace', { status: 'PAST_DUE', currentPeriodEnd: FUTURE, pastDueSince: NOW }],
      ['PAST_DUE after grace', { status: 'PAST_DUE', currentPeriodEnd: FUTURE, pastDueSince: PAST }],
      ['SUSPENDED', { status: 'SUSPENDED', currentPeriodEnd: FUTURE }],
    ])('M: %s blocks and points to billing recovery', async (_label, sub) => {
      latestSubscription = sub;
      const { res, body } = await post();
      expect(res.status).toBe(409);
      expect(body).toMatchObject({ code: 'BILLING_RECOVERY_REQUIRED', billingPortal: true });
      expectNoCheckoutSideEffects();
    });

    it('N: cancelAtPeriodEnd before the period ends is still Full — no checkout', async () => {
      latestSubscription = { status: 'ACTIVE', currentPeriodEnd: FUTURE, cancelAtPeriodEnd: true };
      const { res, body } = await post();
      expect(res.status).toBe(409);
      expect(body.code).toBe('SUBSCRIPTION_ALREADY_EXISTS');
      expectNoCheckoutSideEffects();
    });

    it('O: an ended CANCELED subscription may start a new checkout, despite a stale shopPaidAt', async () => {
      shopRow = { ...freeShop(), shopPaidAt: new Date('2026-01-01T00:00:00Z') };
      latestSubscription = { status: 'CANCELED', currentPeriodEnd: PAST };
      const { res } = await post();
      expect(res.status).toBe(200);
      expect(txSubCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('strict input', () => {
    it.each([
      ['missing', { checkoutAttemptId: ATTEMPT }],
      ['string "true"', { termsAccepted: 'true', checkoutAttemptId: ATTEMPT }],
      ['false', { termsAccepted: false, checkoutAttemptId: ATTEMPT }],
    ])('P: termsAccepted %s is rejected', async (_label, payload) => {
      const { res, body } = await post(payload);
      expect(res.status).toBe(400);
      expect(body.error).toBe(TERMS_ACCEPTANCE_REQUIRED_MESSAGE);
      expect(withLock).not.toHaveBeenCalled();
      expectNoCheckoutSideEffects();
    });

    it('P: an invalid checkoutAttemptId is rejected', async () => {
      const { res } = await post({ termsAccepted: true, checkoutAttemptId: 'not-a-uuid' });
      expect(res.status).toBe(400);
      expect(withLock).not.toHaveBeenCalled();
      expectNoCheckoutSideEffects();
    });
  });
});
