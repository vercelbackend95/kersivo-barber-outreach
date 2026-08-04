import { describe, expect, it } from 'vitest';
import { buildSaasSubscriptionStripeMetadata } from './saasSubscription';

describe('buildSaasSubscriptionStripeMetadata', () => {
  it('includes checkoutAttemptId', () => {
    const metadata = buildSaasSubscriptionStripeMetadata({
      customerName: 'Alex',
      email: 'alex@example.com',
      shopName: 'Fade Studio',
      shopSize: '1-2',
      currentStack: 'landing',
      checkoutAttemptId: '550e8400-e29b-41d4-a716-446655440000',
      shopId: 'shop-1',
    });

    expect(metadata).toMatchObject({
      type: 'saas_subscription',
      checkoutAttemptId: '550e8400-e29b-41d4-a716-446655440000',
      shopId: 'shop-1',
    });
  });
});
