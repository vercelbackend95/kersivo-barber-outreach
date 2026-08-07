import { describe, it, expect, vi } from 'vitest';
import type { SaasSubscriptionStatus } from '@prisma/client';
import {
  assertClaimEntitlement,
  SUBSCRIPTION_NOT_ACTIVE_CODE,
} from './claimPaidSubscriptionEntitlement';
import type { StripeSession, StripeSubscription } from '@/lib/shop/stripe';

function session(overrides: Partial<StripeSession> = {}): StripeSession {
  return {
    id: 'cs_test_1',
    payment_status: 'paid',
    customer_email: 'alex@example.com',
    metadata: { type: 'saas_subscription' },
    subscription: 'sub_live_1',
    ...overrides,
  } as StripeSession;
}

function activeRecord(
  overrides: Partial<{
    status: SaasSubscriptionStatus;
    currentPeriodEnd: Date | null;
    pastDueSince: Date | null;
    cancelAtPeriodEnd: boolean;
    stripeSubscriptionId: string | null;
  }> = {},
) {
  return {
    status: 'ACTIVE' as SaasSubscriptionStatus,
    currentPeriodEnd: new Date(Date.now() + 7 * 86400000),
    pastDueSince: null as Date | null,
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: 'sub_live_1' as string | null,
    ...overrides,
  };
}

describe('assertClaimEntitlement', () => {
  it('allows ACTIVE with valid period', async () => {
    const result = await assertClaimEntitlement({
      record: activeRecord(),
      session: session(),
    });
    expect(result).toEqual({ ok: true });
  });

  it('denies CANCELED', async () => {
    const result = await assertClaimEntitlement({
      record: activeRecord({ status: 'CANCELED' }),
      session: session(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(SUBSCRIPTION_NOT_ACTIVE_CODE);
  });

  it('denies SUSPENDED', async () => {
    const result = await assertClaimEntitlement({
      record: activeRecord({ status: 'SUSPENDED' }),
      session: session(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(SUBSCRIPTION_NOT_ACTIVE_CODE);
  });

  it('denies expired currentPeriodEnd', async () => {
    const result = await assertClaimEntitlement({
      record: activeRecord({
        currentPeriodEnd: new Date(Date.now() - 86400000),
      }),
      session: session(),
      now: new Date(),
    });
    expect(result.ok).toBe(false);
  });

  it('allows PAST_DUE inside grace', async () => {
    const now = new Date('2026-08-07T12:00:00.000Z');
    const result = await assertClaimEntitlement({
      record: activeRecord({
        status: 'PAST_DUE',
        pastDueSince: new Date('2026-08-05T12:00:00.000Z'),
      }),
      session: session(),
      now,
    });
    expect(result).toEqual({ ok: true });
  });

  it('denies PAST_DUE after grace', async () => {
    const now = new Date('2026-08-07T12:00:00.000Z');
    const result = await assertClaimEntitlement({
      record: activeRecord({
        status: 'PAST_DUE',
        pastDueSince: new Date('2026-07-20T12:00:00.000Z'),
      }),
      session: session(),
      now,
    });
    expect(result.ok).toBe(false);
  });

  it('PENDING with live active Stripe subscription is allowed', async () => {
    const retrieve = vi.fn(async () =>
      ({
        id: 'sub_live_1',
        status: 'active',
        cancel_at_period_end: false,
        items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400 }] },
      }) as unknown as StripeSubscription,
    );
    const result = await assertClaimEntitlement({
      record: activeRecord({ status: 'PENDING', stripeSubscriptionId: null }),
      session: session({ subscription: 'sub_live_1' }),
      retrieveSubscriptionFn: retrieve,
    });
    expect(result).toEqual({ ok: true });
    expect(retrieve).toHaveBeenCalledWith('sub_live_1');
  });

  it('PENDING with canceled live Stripe subscription is denied', async () => {
    const retrieve = vi.fn(async () =>
      ({
        id: 'sub_live_1',
        status: 'canceled',
        cancel_at_period_end: false,
        items: { data: [] },
      }) as unknown as StripeSubscription,
    );
    const result = await assertClaimEntitlement({
      record: activeRecord({ status: 'PENDING', stripeSubscriptionId: 'sub_live_1' }),
      session: session(),
      retrieveSubscriptionFn: retrieve,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(SUBSCRIPTION_NOT_ACTIVE_CODE);
  });

  it('PENDING without subscription id is denied', async () => {
    const result = await assertClaimEntitlement({
      record: activeRecord({ status: 'PENDING', stripeSubscriptionId: null }),
      session: session({ subscription: null }),
    });
    expect(result.ok).toBe(false);
  });

  it('PENDING retrieve failure returns lookup failed', async () => {
    const retrieve = vi.fn(async () => {
      throw new Error('stripe down');
    });
    const result = await assertClaimEntitlement({
      record: activeRecord({ status: 'PENDING' }),
      session: session(),
      retrieveSubscriptionFn: retrieve,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('STRIPE_SUBSCRIPTION_LOOKUP_FAILED');
  });
});
