import { describe, expect, it, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { createSubscriptionCheckoutSession } from './stripe';

describe('createSubscriptionCheckoutSession idempotency', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' }),
    });
  });

  it('sets Idempotency-Key when provided', async () => {
    await createSubscriptionCheckoutSession({
      customerEmail: 'a@b.com',
      successUrl: 'https://kersivo.test/ok',
      cancelUrl: 'https://kersivo.test/cancel',
      productId: 'saas-subscription',
      name: 'Kersivo — monthly subscription',
      unitAmount: 3900,
      metadata: { type: 'saas_subscription' },
      idempotencyKey: 'kersivo_saas_subscription_checkout_abc',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('kersivo_saas_subscription_checkout_abc');
  });

  it('omits Idempotency-Key when not provided', async () => {
    await createSubscriptionCheckoutSession({
      customerEmail: 'a@b.com',
      successUrl: 'https://kersivo.test/ok',
      cancelUrl: 'https://kersivo.test/cancel',
      productId: 'saas-subscription',
      name: 'Kersivo — monthly subscription',
      unitAmount: 3900,
      metadata: { type: 'saas_subscription' },
    });

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBeUndefined();
  });
});
