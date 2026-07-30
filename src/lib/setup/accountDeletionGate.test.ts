import { describe, it, expect } from 'vitest';
import {
  assertAccountDeletionAllowed,
  collectBlockingShops,
  subscriptionBlocksAccountDeletion,
} from './accountDeletionGate';

describe('accountDeletionGate', () => {
  it('blocks ACTIVE, PAST_DUE, SUSPENDED', () => {
    expect(subscriptionBlocksAccountDeletion({ status: 'ACTIVE' })).toBe(true);
    expect(subscriptionBlocksAccountDeletion({ status: 'PAST_DUE' })).toBe(true);
    expect(subscriptionBlocksAccountDeletion({ status: 'SUSPENDED' })).toBe(true);
  });

  it('blocks PENDING only when Stripe subscription id exists', () => {
    expect(
      subscriptionBlocksAccountDeletion({ status: 'PENDING', stripeSubscriptionId: null }),
    ).toBe(false);
    expect(
      subscriptionBlocksAccountDeletion({
        status: 'PENDING',
        stripeSubscriptionId: 'sub_123',
      }),
    ).toBe(true);
  });

  it('allows CANCELED and empty PENDING', () => {
    expect(subscriptionBlocksAccountDeletion({ status: 'CANCELED' })).toBe(false);
    const gate = assertAccountDeletionAllowed([
      {
        shopId: 'shop-1',
        status: 'CANCELED',
        stripeSubscriptionId: 'sub_old',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      },
    ]);
    expect(gate.allowed).toBe(true);
  });

  it('returns blocking shops for sole-owner ACTIVE sub', () => {
    const shops = collectBlockingShops([
      {
        shopId: 'shop-1',
        status: 'ACTIVE',
        stripeSubscriptionId: 'sub_1',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
      },
      {
        shopId: 'shop-2',
        status: 'CANCELED',
        stripeSubscriptionId: 'sub_2',
      },
    ]);
    expect(shops).toHaveLength(1);
    expect(shops[0]?.shopId).toBe('shop-1');
    expect(shops[0]?.cancelAtPeriodEnd).toBe(true);
    expect(shops[0]?.currentPeriodEnd).toBe('2026-08-01T00:00:00.000Z');
  });

  it('assertAccountDeletionAllowed returns 409 payload shape', () => {
    const gate = assertAccountDeletionAllowed([
      { shopId: 'shop-a', status: 'PAST_DUE', stripeSubscriptionId: 'sub_a' },
    ]);
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) {
      expect(gate.shops[0]?.status).toBe('PAST_DUE');
    }
  });
});
