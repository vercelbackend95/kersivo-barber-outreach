import { describe, expect, it } from 'vitest';
import { buildSetupDepositStripeMetadata } from './plans';

describe('buildSetupDepositStripeMetadata', () => {
  it('keeps plan/type and omits direct PII and amount package keys', () => {
    const metadata = buildSetupDepositStripeMetadata('launch', {
      gclid: 'g1',
      utm_campaign: 'spring',
    });

    expect(metadata).toMatchObject({
      type: 'setup_deposit',
      plan: 'launch',
      gclid: 'g1',
      utm_campaign: 'spring',
    });
    for (const key of [
      'customerName',
      'email',
      'shopName',
      'shopSize',
      'currentStack',
      'townCity',
      'barbers',
      'package',
      'package_name',
      'total_setup_amount',
      'deposit_amount',
      'remaining_amount',
    ]) {
      expect(metadata).not.toHaveProperty(key);
    }
  });
});
