import { describe, expect, it } from 'vitest';
import { buildSetupDepositStripeMetadata } from './plans';

describe('buildSetupDepositStripeMetadata', () => {
  it('keeps plan/type and omits direct PII, amount package keys, and campaign attribution', () => {
    const metadata = buildSetupDepositStripeMetadata('launch');

    expect(metadata).toMatchObject({
      type: 'setup_deposit',
      plan: 'launch',
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
