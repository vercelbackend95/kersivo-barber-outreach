import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import { Prisma } from '@prisma/client';

const createSaas = vi.fn();
const findUniqueSaas = vi.fn();
const createLegalAcceptance = vi.fn();
const createSubscriptionCheckoutSession = vi.fn();
const retrieveCheckoutSession = vi.fn();

const ATTEMPT = '550e8400-e29b-41d4-a716-446655440000';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    saasSubscription: {
      create: (...args: unknown[]) => createSaas(...args),
      findUnique: (...args: unknown[]) => findUniqueSaas(...args),
    },
    legalAcceptance: {
      create: (...args: unknown[]) => createLegalAcceptance(...args),
    },
  },
}));

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

import { POST } from './subscription-checkout';
import { CURRENT_TERMS_VERSION } from '@/lib/legal/termsVersion';
import { TERMS_ACCEPTANCE_REQUIRED_MESSAGE } from '@/lib/legal/requireTermsAcceptance';

const validBody = {
  name: 'Alex Owner',
  email: 'alex@example.com',
  shopName: 'Fade Studio',
  shopSize: '1-2',
  currentStack: 'landing',
  termsAccepted: true,
  checkoutAttemptId: ATTEMPT,
};

function makeContext(body: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/setup/subscription-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'user-agent': 'vitest',
        'x-forwarded-for': '203.0.113.10',
      },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

describe('POST /api/setup/subscription-checkout', () => {
  beforeEach(() => {
    createSaas.mockReset();
    findUniqueSaas.mockReset();
    createLegalAcceptance.mockReset();
    createSubscriptionCheckoutSession.mockReset();
    retrieveCheckoutSession.mockReset();
    findUniqueSaas.mockResolvedValue(null);
    createSaas.mockResolvedValue({});
    createLegalAcceptance.mockResolvedValue({});
    createSubscriptionCheckoutSession.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.test/cs_test_1',
    });
  });

  it('returns 400 without checkoutAttemptId', async () => {
    const { checkoutAttemptId: _omit, ...rest } = validBody;
    const res = await POST(makeContext(rest) as never);
    expect(res.status).toBe(400);
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid checkoutAttemptId', async () => {
    const res = await POST(makeContext({ ...validBody, checkoutAttemptId: 'bad' }) as never);
    expect(res.status).toBe(400);
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns 400 without termsAccepted and does not create a Stripe session', async () => {
    const { termsAccepted: _omit, ...withoutTerms } = validBody;
    const res = await POST(makeContext(withoutTerms) as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe(TERMS_ACCEPTANCE_REQUIRED_MESSAGE);
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
    expect(createLegalAcceptance).not.toHaveBeenCalled();
  });

  it('creates one session and PENDING with attempt id + metadata', async () => {
    const res = await POST(makeContext(validBody) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      url: 'https://checkout.stripe.test/cs_test_1',
      reused: false,
      state: 'open',
    });
    expect(createSubscriptionCheckoutSession).toHaveBeenCalledOnce();
    expect(createSubscriptionCheckoutSession.mock.calls[0][0]).toMatchObject({
      idempotencyKey: `kersivo_saas_subscription_checkout_${ATTEMPT}`,
      metadata: expect.objectContaining({
        checkoutAttemptId: ATTEMPT,
        terms_accepted: '1',
        terms_version: CURRENT_TERMS_VERSION,
      }),
    });
    expect(createSaas).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stripeSessionId: 'cs_test_1',
        checkoutAttemptId: ATTEMPT,
        status: 'PENDING',
        customerEmail: 'alex@example.com',
        shopName: 'Fade Studio',
      }),
    });
  });

  it('reuses open session for the same attempt without creating another', async () => {
    findUniqueSaas.mockResolvedValue({
      id: 'sub_1',
      stripeSessionId: 'cs_existing',
      customerEmail: 'alex@example.com',
      shopName: 'Fade Studio',
      status: 'PENDING',
    });
    retrieveCheckoutSession.mockResolvedValue({
      id: 'cs_existing',
      status: 'open',
      url: 'https://checkout.stripe.test/cs_existing',
    });

    const res = await POST(makeContext(validBody) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      reused: true,
      state: 'open',
      url: 'https://checkout.stripe.test/cs_existing',
    });
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
    expect(createSaas).not.toHaveBeenCalled();
  });

  it('returns success url for complete/paid session', async () => {
    findUniqueSaas.mockResolvedValue({
      id: 'sub_1',
      stripeSessionId: 'cs_paid',
      customerEmail: 'alex@example.com',
      shopName: 'Fade Studio',
      status: 'PENDING',
    });
    retrieveCheckoutSession.mockResolvedValue({
      id: 'cs_paid',
      status: 'complete',
      payment_status: 'paid',
    });

    const res = await POST(makeContext(validBody) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      reused: true,
      state: 'complete',
      url: '/setup/success?session_id=cs_paid',
    });
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns CHECKOUT_ATTEMPT_EXPIRED for expired session', async () => {
    findUniqueSaas.mockResolvedValue({
      id: 'sub_1',
      stripeSessionId: 'cs_exp',
      customerEmail: 'alex@example.com',
      shopName: 'Fade Studio',
      status: 'PENDING',
    });
    retrieveCheckoutSession.mockResolvedValue({
      id: 'cs_exp',
      status: 'expired',
    });

    const res = await POST(makeContext(validBody) as never);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toMatchObject({
      code: 'CHECKOUT_ATTEMPT_EXPIRED',
      rotateAttempt: true,
    });
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns 503 and does not create a session when Stripe lookup fails', async () => {
    findUniqueSaas.mockResolvedValue({
      id: 'sub_1',
      stripeSessionId: 'cs_bad',
      customerEmail: 'alex@example.com',
      shopName: 'Fade Studio',
      status: 'PENDING',
    });
    retrieveCheckoutSession.mockRejectedValue(new Error('stripe down'));

    const res = await POST(makeContext(validBody) as never);
    expect(res.status).toBe(503);
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it('allows same email with a new attempt id (multi-location)', async () => {
    const otherAttempt = '660e8400-e29b-41d4-a716-446655440099';
    findUniqueSaas.mockResolvedValue(null);

    const res = await POST(
      makeContext({ ...validBody, checkoutAttemptId: otherAttempt, shopName: 'Second Shop' }) as never,
    );
    expect(res.status).toBe(200);
    expect(createSubscriptionCheckoutSession).toHaveBeenCalledOnce();
    expect(createSaas.mock.calls[0][0].data.checkoutAttemptId).toBe(otherAttempt);
  });

  it('on P2002 loads winner and reuses session', async () => {
    createSaas.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    findUniqueSaas
      .mockResolvedValueOnce(null) // initial by attempt
      .mockResolvedValueOnce({
        stripeSessionId: 'cs_winner',
      });
    retrieveCheckoutSession.mockResolvedValue({
      id: 'cs_winner',
      status: 'open',
      url: 'https://checkout.stripe.test/cs_winner',
    });

    const res = await POST(makeContext(validBody) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reused).toBe(true);
    expect(body.url).toBe('https://checkout.stripe.test/cs_winner');
  });

  it('does not return Stripe URL when PENDING create fails non-uniquely', async () => {
    createSaas.mockRejectedValueOnce(new Error('db down'));
    const res = await POST(makeContext(validBody) as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.url).toBeUndefined();
  });
});
