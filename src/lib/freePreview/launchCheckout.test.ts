import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolvePreviewRequestByToken = vi.fn();
const findShop = vi.fn();
const upsertOnboarding = vi.fn(async () => ({}));
const createEvent = vi.fn(async () => ({}));
const findSaas = vi.fn(async () => null);
const findFirstSaas = vi.fn(async () => null);
const createSaas = vi.fn(async () => ({}));
const createSubscriptionCheckoutSession = vi.fn();
const recordTermsAcceptance = vi.fn();

vi.mock('./previewAccess', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./previewAccess')>()),
  resolvePreviewRequestByToken: (...a: unknown[]) => resolvePreviewRequestByToken(...a),
}));
vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: { findUnique: (...a: unknown[]) => findShop(...a) },
    clientOnboarding: { upsert: (...a: unknown[]) => upsertOnboarding(...(a as [])) },
    previewRequestEvent: { create: () => createEvent() },
    saasSubscription: {
      findUnique: () => findSaas(),
      findFirst: () => findFirstSaas(),
      create: (...a: unknown[]) => createSaas(...(a as [])),
      delete: vi.fn(),
    },
  },
}));
vi.mock('@/lib/shop/stripe', () => ({
  createSubscriptionCheckoutSession: (...a: unknown[]) => createSubscriptionCheckoutSession(...a),
  retrieveCheckoutSession: vi.fn(),
}));
vi.mock('@/lib/legal/requireTermsAcceptance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/legal/requireTermsAcceptance')>()),
  recordTermsAcceptance: (...a: unknown[]) => recordTermsAcceptance(...a),
}));
vi.mock('@/lib/setup/siteUrl', () => ({ getPublicSiteUrl: () => 'https://kersivo.co.uk' }));

import { SAAS_MONTHLY_PENCE } from '@/lib/seo/defaults';
import { startPreviewLaunchCheckout } from './launchCheckout';

const TOKEN = 'B'.repeat(43);
const ATTEMPT = '550e8400-e29b-41d4-a716-446655440000';
const NOW = new Date('2026-11-01T10:00:00Z');

const ready = {
  id: 'req_1',
  publicToken: TOKEN,
  status: 'READY',
  firstName: 'Sam',
  email: 'Sam@Example.com',
  shopName: 'Sharp Cuts',
  townCity: 'Leeds',
  instagramUrl: null,
  websiteUrl: null,
  hasOwnDomain: 'no',
  barberCount: '2-3',
  currentBookingSystem: 'booksy',
  draftShopId: 'shop_draft',
  expiresAt: new Date('2026-11-30T10:00:00Z'),
  previewReadyAt: new Date('2026-10-31T10:00:00Z'),
  convertedAt: null,
  changesRequestedAt: null,
};

function start(
  overrides: Partial<Parameters<typeof startPreviewLaunchCheckout>[0]> = {},
) {
  return startPreviewLaunchCheckout({
    request: new Request('https://kersivo.co.uk/api/free-preview/x/checkout', { method: 'POST' }),
    token: TOKEN,
    name: 'Sam Barber',
    checkoutAttemptId: ATTEMPT,
    domainMode: 'KERSIVO_REGISTER',
    domain: 'sharpcuts.co.uk',
    domainRegistrationAuthorised: true,
    now: NOW,
    ...overrides,
  });
}

describe('startPreviewLaunchCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolvePreviewRequestByToken.mockResolvedValue({ ...ready });
    findShop.mockResolvedValue({ ownerUserId: null });
    createSubscriptionCheckoutSession.mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
  });

  it('uses the existing Full KERSIVO price with the request email and preview + draft shop ids in metadata', async () => {
    const res = await start();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' });

    const params = createSubscriptionCheckoutSession.mock.calls[0]![0] as Record<string, unknown>;
    expect(params).toMatchObject({
      customerEmail: 'sam@example.com',
      productId: 'saas-subscription',
      name: 'Kersivo — monthly subscription',
      unitAmount: SAAS_MONTHLY_PENCE,
      successUrl: 'https://kersivo.co.uk/setup/success?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: `https://kersivo.co.uk/preview/${TOKEN}`,
    });
    expect(params.metadata).toMatchObject({
      type: 'saas_subscription',
      checkoutAttemptId: ATTEMPT,
      shopId: 'shop_draft',
      previewRequestId: 'req_1',
      domainMode: 'KERSIVO_REGISTER',
      preferredDomain: 'sharpcuts.co.uk',
    });
    expect(upsertOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopId: 'shop_draft' },
        create: expect.objectContaining({
          preferredDomain1: 'sharpcuts.co.uk',
          preferredDomain2: null,
          preferredDomain3: null,
          domainRegistrationAuthorised: true,
        }),
      }),
    );
    expect(createSaas).toHaveBeenCalledWith({
      data: expect.objectContaining({ shopId: 'shop_draft', customerEmail: 'sam@example.com', status: 'PENDING' }),
    });
    expect(recordTermsAcceptance).toHaveBeenCalledTimes(1);
    expect(createEvent).toHaveBeenCalledTimes(1);
  });

  it('refuses checkout without a domain decision or register authorisation and never calls Stripe', async () => {
    expect(
      (await start({ domain: '', domainRegistrationAuthorised: true })).status,
    ).toBe(400);
    expect(
      (
        await start({
          domainMode: 'KERSIVO_REGISTER',
          domain: 'sharpcuts.co.uk',
          domainRegistrationAuthorised: false,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await start({
          domainMode: 'KERSIVO_REGISTER',
          domain: 'sharpcuts.uk.com',
          domainRegistrationAuthorised: true,
        })
      ).status,
    ).toBe(400);
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
    expect(upsertOnboarding).not.toHaveBeenCalled();
  });

  it('returns a uniform 404 for unknown tokens and never calls Stripe', async () => {
    resolvePreviewRequestByToken.mockResolvedValue(null);
    expect((await start()).status).toBe(404);
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it('refuses expired, unsent, converted or already-owned previews without calling Stripe', async () => {
    resolvePreviewRequestByToken.mockResolvedValue({ ...ready, expiresAt: new Date('2026-10-31T00:00:00Z') });
    expect((await start()).status).toBe(409);
    resolvePreviewRequestByToken.mockResolvedValue({ ...ready, status: 'IN_PROGRESS' });
    expect((await start()).status).toBe(409);
    resolvePreviewRequestByToken.mockResolvedValue({ ...ready, status: 'CONVERTED' });
    expect(await (await start()).json()).toMatchObject({ code: 'ALREADY_CONVERTED', redirectTo: '/admin' });
    resolvePreviewRequestByToken.mockResolvedValue({ ...ready });
    findShop.mockResolvedValue({ ownerUserId: 'user_9' });
    expect((await start()).status).toBe(409);
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });
});
