import { describe, expect, it } from 'vitest';
import { buildSaasSubscriptionStripeMetadata } from './saasSubscription';

describe('buildSaasSubscriptionStripeMetadata', () => {
  it('includes checkoutAttemptId and omits direct PII and campaign attribution', () => {
    const metadata = buildSaasSubscriptionStripeMetadata({
      checkoutAttemptId: '550e8400-e29b-41d4-a716-446655440000',
      shopId: 'shop-1',
    });

    expect(metadata).toMatchObject({
      type: 'saas_subscription',
      checkoutAttemptId: '550e8400-e29b-41d4-a716-446655440000',
      shopId: 'shop-1',
    });
    expect(metadata).not.toHaveProperty('customerName');
    expect(metadata).not.toHaveProperty('email');
    expect(metadata).not.toHaveProperty('shopName');
    expect(metadata).not.toHaveProperty('shopSize');
    expect(metadata).not.toHaveProperty('currentStack');
    expect(metadata).not.toHaveProperty('townCity');
    expect(metadata).not.toHaveProperty('barbers');
    expect(metadata).not.toHaveProperty('monthly_amount');
    for (const key of [
      'gclid',
      'gbraid',
      'wbraid',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'ga_client_id',
    ]) {
      expect(metadata).not.toHaveProperty(key);
    }
  });
});
