import { describe, expect, it } from 'vitest';
import { DEMO_SHOP_ID } from '../db/shopScope';
import { isPaidShop } from './paidShop';
import {
  graceEndsAt,
  saasSubscriptionAllowsDataExport,
  saasSubscriptionGrantsAccess,
} from '../setup/saasEntitlement';

describe('saasSubscriptionGrantsAccess (WP-I grace)', () => {
  const now = new Date('2026-07-15T12:00:00.000Z');

  it('grants ACTIVE before period end', () => {
    expect(
      saasSubscriptionGrantsAccess(
        { status: 'ACTIVE', currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z') },
        now,
      ),
    ).toBe(true);
  });

  it('grants PAST_DUE within 7-day grace', () => {
    expect(
      saasSubscriptionGrantsAccess(
        {
          status: 'PAST_DUE',
          currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
          pastDueSince: new Date('2026-07-14T12:00:00.000Z'),
        },
        now,
      ),
    ).toBe(true);
  });

  it('denies PAST_DUE after grace window', () => {
    expect(
      saasSubscriptionGrantsAccess(
        {
          status: 'PAST_DUE',
          currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
          pastDueSince: new Date('2026-07-01T12:00:00.000Z'),
        },
        now,
      ),
    ).toBe(false);
    expect(graceEndsAt(new Date('2026-07-01T12:00:00.000Z')).getTime()).toBeLessThan(now.getTime());
  });

  it('denies SUSPENDED and CANCELED', () => {
    expect(
      saasSubscriptionGrantsAccess(
        { status: 'SUSPENDED', currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z') },
        now,
      ),
    ).toBe(false);
    expect(saasSubscriptionGrantsAccess({ status: 'CANCELED', currentPeriodEnd: null }, now)).toBe(false);
  });
});

describe('saasSubscriptionAllowsDataExport', () => {
  const now = new Date('2026-07-15T12:00:00.000Z');

  it('allows during paid grace and active', () => {
    expect(
      saasSubscriptionAllowsDataExport({
        status: 'ACTIVE',
        currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
      }, now),
    ).toBe(true);
  });

  it('allows during SUSPENDED and CANCELED within retention', () => {
    expect(
      saasSubscriptionAllowsDataExport({
        status: 'SUSPENDED',
        currentPeriodEnd: null,
      }, now),
    ).toBe(true);
    expect(
      saasSubscriptionAllowsDataExport({
        status: 'CANCELED',
        currentPeriodEnd: null,
        canceledAt: new Date('2026-07-01T00:00:00.000Z'),
        retentionEndsAt: new Date('2026-07-31T00:00:00.000Z'),
      }, now),
    ).toBe(true);
  });

  it('denies after retention or when already consumed', () => {
    expect(
      saasSubscriptionAllowsDataExport({
        status: 'CANCELED',
        currentPeriodEnd: null,
        retentionEndsAt: new Date('2026-07-01T00:00:00.000Z'),
      }, now),
    ).toBe(false);
    expect(
      saasSubscriptionAllowsDataExport({
        status: 'ACTIVE',
        currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
        dataExportDownloadedAt: new Date('2026-07-10T00:00:00.000Z'),
      }, now),
    ).toBe(false);
  });
});

describe('isPaidShop with subscription entitlement', () => {
  const now = new Date('2026-07-15T12:00:00.000Z');

  it('rejects demo shop even with subscription', () => {
    expect(
      isPaidShop(
        { id: DEMO_SHOP_ID, shopPaidAt: new Date() },
        { status: 'ACTIVE', currentPeriodEnd: null },
        now,
      ),
    ).toBe(false);
  });

  it('uses subscription entitlement over sticky shopPaidAt', () => {
    expect(
      isPaidShop(
        { id: 's1', shopPaidAt: new Date() },
        { status: 'SUSPENDED', currentPeriodEnd: null },
        now,
      ),
    ).toBe(false);
  });

  it('falls back to shopPaidAt when no subscription row', () => {
    expect(isPaidShop({ id: 's1', shopPaidAt: new Date() }, null, now)).toBe(true);
  });
});
