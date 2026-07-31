import { describe, expect, it } from 'vitest';
import { getSubscriptionCurrentPeriodEnd } from './stripe';

const AUG_2026 = Math.floor(new Date('2026-08-01T00:00:00.000Z').getTime() / 1000);
const SEP_2026 = Math.floor(new Date('2026-09-01T00:00:00.000Z').getTime() / 1000);

describe('getSubscriptionCurrentPeriodEnd', () => {
  it('reads the root field on pre-basil payloads', () => {
    expect(getSubscriptionCurrentPeriodEnd({ current_period_end: AUG_2026 })).toBe(AUG_2026);
  });

  it('falls back to subscription items on 2025-03-31.basil and later', () => {
    expect(
      getSubscriptionCurrentPeriodEnd({
        current_period_end: null,
        items: { data: [{ current_period_end: AUG_2026 }] },
      }),
    ).toBe(AUG_2026);
  });

  it('takes the latest item so entitlement is not cut short', () => {
    expect(
      getSubscriptionCurrentPeriodEnd({
        items: { data: [{ current_period_end: AUG_2026 }, { current_period_end: SEP_2026 }] },
      }),
    ).toBe(SEP_2026);
  });

  it('prefers the root field when both shapes are present', () => {
    expect(
      getSubscriptionCurrentPeriodEnd({
        current_period_end: AUG_2026,
        items: { data: [{ current_period_end: SEP_2026 }] },
      }),
    ).toBe(AUG_2026);
  });

  it('returns null when no period is available', () => {
    expect(getSubscriptionCurrentPeriodEnd({})).toBeNull();
    expect(getSubscriptionCurrentPeriodEnd({ current_period_end: null, items: null })).toBeNull();
    expect(getSubscriptionCurrentPeriodEnd({ items: { data: [] } })).toBeNull();
    expect(getSubscriptionCurrentPeriodEnd({ items: { data: [{ current_period_end: null }] } })).toBeNull();
  });
});
