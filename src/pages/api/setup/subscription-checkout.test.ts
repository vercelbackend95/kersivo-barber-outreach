import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';

const createSaas = vi.fn();
const createLegalAcceptance = vi.fn();
const createSubscriptionCheckoutSession = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    saasSubscription: {
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
    createLegalAcceptance.mockReset();
    createSubscriptionCheckoutSession.mockReset();
    createSaas.mockResolvedValue({});
    createLegalAcceptance.mockResolvedValue({});
    createSubscriptionCheckoutSession.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.test/cs_test_1',
    });
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

  it('returns 400 when termsAccepted is the string "true"', async () => {
    const res = await POST(makeContext({ ...validBody, termsAccepted: 'true' }) as never);
    expect(res.status).toBe(400);
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it('creates checkout and records LegalAcceptance when termsAccepted is true', async () => {
    const res = await POST(makeContext(validBody) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe('https://checkout.stripe.test/cs_test_1');
    expect(createSubscriptionCheckoutSession).toHaveBeenCalledOnce();
    expect(createSubscriptionCheckoutSession.mock.calls[0][0].metadata).toMatchObject({
      terms_accepted: '1',
      terms_version: CURRENT_TERMS_VERSION,
    });
    expect(createLegalAcceptance).toHaveBeenCalledWith({
      data: expect.objectContaining({
        purpose: 'SAAS_CHECKOUT',
        termsVersion: CURRENT_TERMS_VERSION,
        email: 'alex@example.com',
        stripeSessionId: 'cs_test_1',
        ip: '203.0.113.10',
        userAgent: 'vitest',
      }),
    });
  });
});
