import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.fn();
const findMany = vi.fn();
const update = vi.fn();
const findUniqueShop = vi.fn();
const transaction = vi.fn();
const markShopPaid = vi.fn();
const markShopUnpaid = vi.fn();
const purgeShopData = vi.fn();
const recordAccountLifecycleEvent = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    saasSubscription: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      findMany: (...args: unknown[]) => findMany(...args),
      update: (...args: unknown[]) => update(...args),
    },
    shopSettings: {
      findUnique: (...args: unknown[]) => findUniqueShop(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

vi.mock('@/lib/shop/markShopPaid', () => ({
  markShopPaid: (...args: unknown[]) => markShopPaid(...args),
  markShopUnpaid: (...args: unknown[]) => markShopUnpaid(...args),
}));

vi.mock('@/lib/setup/purgeShopData', () => ({
  purgeShopData: (...args: unknown[]) => purgeShopData(...args),
}));

vi.mock('@/lib/setup/accountLifecycleAudit', () => ({
  ACCOUNT_LIFECYCLE_ACTIONS: {
    SHOP_PURGED_AFTER_RETENTION: 'SHOP_PURGED_AFTER_RETENTION',
  },
  recordAccountLifecycleEvent: (...args: unknown[]) => recordAccountLifecycleEvent(...args),
}));

import {
  applyInvoicePaid,
  applyInvoicePaymentFailed,
  applyStripeSubscriptionToSaasRecord,
  purgeShopsAfterRetentionEnds,
  suspendPastDueSubscriptionsPastGrace,
} from './saasSubscriptionLifecycle';

/** Rolling future date: a fixed literal silently expires and breaks entitlement assertions. */
const FUTURE_PERIOD_END = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

const baseRecord = {
  id: 'saas-1',
  stripeSessionId: 'cs_1',
  stripeSubscriptionId: 'sub_1',
  stripeCustomerId: 'cus_1',
  shopId: 'shop-1',
  status: 'ACTIVE' as const,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: FUTURE_PERIOD_END,
  canceledAt: null,
  pastDueSince: null,
  suspendedAt: null,
  retentionEndsAt: null,
  dataExportDownloadedAt: null,
  customerName: 'Owner',
  customerEmail: 'owner@example.com',
  shopName: 'Shop',
  shopSize: '1-2',
  currentStack: 'none',
  monthlyPence: 3900,
  currency: 'gbp',
  activatedAt: new Date('2026-07-01T00:00:00.000Z'),
  customerEmailSentAt: null,
  internalEmailSentAt: null,
  onboardingSubmittedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('saasSubscriptionLifecycle WP-I', () => {
  beforeEach(() => {
    findFirst.mockReset();
    findMany.mockReset();
    update.mockReset();
    findUniqueShop.mockReset();
    transaction.mockReset();
    markShopPaid.mockReset();
    markShopUnpaid.mockReset();
    purgeShopData.mockReset();
    recordAccountLifecycleEvent.mockReset();
  });

  it('sets pastDueSince once on payment_failed and keeps paid in grace', async () => {
    const now = new Date('2026-07-15T12:00:00.000Z');
    findFirst.mockResolvedValue(baseRecord);
    update.mockResolvedValue({
      ...baseRecord,
      status: 'PAST_DUE',
      pastDueSince: now,
    });

    const result = await applyInvoicePaymentFailed({
      stripeSubscriptionId: 'sub_1',
      now,
    });

    expect(result.record?.status).toBe('PAST_DUE');
    expect(markShopPaid).toHaveBeenCalled();
  });

  it('clears pastDue and restores ACTIVE on invoice paid', async () => {
    findFirst.mockResolvedValue({
      ...baseRecord,
      status: 'PAST_DUE',
      pastDueSince: new Date('2026-07-10T12:00:00.000Z'),
    });
    update.mockResolvedValue({
      ...baseRecord,
      status: 'ACTIVE',
      pastDueSince: null,
    });

    const result = await applyInvoicePaid({ stripeSubscriptionId: 'sub_1' });
    expect(result.record?.status).toBe('ACTIVE');
    expect(markShopPaid).toHaveBeenCalled();
  });

  it('maps Stripe canceled via applyStripeSubscriptionToSaasRecord', async () => {
    findFirst.mockResolvedValue(baseRecord);
    update.mockResolvedValue({
      ...baseRecord,
      status: 'CANCELED',
      cancelAtPeriodEnd: false,
      canceledAt: new Date('2026-07-20T00:00:00.000Z'),
      retentionEndsAt: new Date('2026-08-19T00:00:00.000Z'),
    });

    const result = await applyStripeSubscriptionToSaasRecord({
      id: 'sub_1',
      status: 'canceled',
      cancel_at_period_end: false,
      canceled_at: Math.floor(new Date('2026-07-20T00:00:00.000Z').getTime() / 1000),
      current_period_end: Math.floor(new Date('2026-08-01T00:00:00.000Z').getTime() / 1000),
      customer: 'cus_1',
    });

    expect(result.record?.status).toBe('CANCELED');
    expect(markShopUnpaid).toHaveBeenCalled();
  });

  it('reads the renewal date from subscription items on clover payloads', async () => {
    findFirst.mockResolvedValue(baseRecord);
    update.mockResolvedValue({ ...baseRecord, currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z') });

    await applyStripeSubscriptionToSaasRecord({
      id: 'sub_1',
      status: 'active',
      cancel_at_period_end: false,
      items: {
        data: [{ current_period_end: Math.floor(new Date('2026-09-01T00:00:00.000Z').getTime() / 1000) }],
      },
      customer: 'cus_1',
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z') }),
      }),
    );
  });

  it('suspends PAST_DUE past grace', async () => {
    const now = new Date('2026-07-20T12:00:00.000Z');
    findMany.mockResolvedValue([
      {
        id: 'saas-1',
        shopId: 'shop-1',
        activatedAt: baseRecord.activatedAt,
        currentPeriodEnd: baseRecord.currentPeriodEnd,
        pastDueSince: new Date('2026-07-10T12:00:00.000Z'),
      },
    ]);
    update.mockResolvedValue({
      ...baseRecord,
      status: 'SUSPENDED',
      suspendedAt: now,
      pastDueSince: new Date('2026-07-10T12:00:00.000Z'),
    });

    const result = await suspendPastDueSubscriptionsPastGrace(now);
    expect(result.suspended).toBe(1);
    expect(markShopUnpaid).toHaveBeenCalledWith('shop-1');
  });

  it('purges shop after retentionEndsAt', async () => {
    const now = new Date('2026-08-15T00:00:00.000Z');
    findMany.mockResolvedValue([
      {
        id: 'saas-1',
        shopId: 'shop-1',
        customerEmail: 'owner@example.com',
        retentionEndsAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    ]);
    findUniqueShop.mockResolvedValue({ id: 'shop-1' });
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        saasSubscription: { update },
      };
      await fn(tx);
    });
    update.mockResolvedValue({ ...baseRecord, shopId: null });

    const result = await purgeShopsAfterRetentionEnds(now);
    expect(result.purged).toBe(1);
    expect(purgeShopData).toHaveBeenCalled();
    expect(recordAccountLifecycleEvent).toHaveBeenCalled();
  });

  it('does not purge when retention is still open', async () => {
    const now = new Date('2026-07-20T00:00:00.000Z');
    findMany.mockResolvedValue([]);
    const result = await purgeShopsAfterRetentionEnds(now);
    expect(result.purged).toBe(0);
    expect(purgeShopData).not.toHaveBeenCalled();
  });
});
