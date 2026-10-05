import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.fn();
const findMany = vi.fn();
const update = vi.fn();
const count = vi.fn();
const findUniqueShop = vi.fn();
const updateShop = vi.fn();
const transaction = vi.fn();
const markShopPaid = vi.fn();
const markShopUnpaid = vi.fn();
const purgeShopData = vi.fn();
const beginShopPurgeGate = vi.fn();
const listPrivateBlobPathsForShopPurge = vi.fn();
const listPublicBlobUrlsForShopPurge = vi.fn();
const deletePrivateBlobPathsBestEffort = vi.fn();
const runPostCommitPublicBlobCleanup = vi.fn();
const recordAccountLifecycleEvent = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    saasSubscription: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      findMany: (...args: unknown[]) => findMany(...args),
      update: (...args: unknown[]) => update(...args),
      count: (...args: unknown[]) => count(...args),
    },
    shopSettings: {
      findUnique: (...args: unknown[]) => findUniqueShop(...args),
      update: (...args: unknown[]) => updateShop(...args),
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
  beginShopPurgeGate: (...args: unknown[]) => beginShopPurgeGate(...args),
  listPrivateBlobPathsForShopPurge: (...args: unknown[]) =>
    listPrivateBlobPathsForShopPurge(...args),
  listPublicBlobUrlsForShopPurge: (...args: unknown[]) => listPublicBlobUrlsForShopPurge(...args),
  deletePrivateBlobPathsBestEffort: (...args: unknown[]) =>
    deletePrivateBlobPathsBestEffort(...args),
  runPostCommitPublicBlobCleanup: (...args: unknown[]) => runPostCommitPublicBlobCleanup(...args),
}));

vi.mock('@/lib/setup/accountLifecycleAudit', () => ({
  ACCOUNT_LIFECYCLE_ACTIONS: {
    SHOP_PURGED_AFTER_RETENTION: 'SHOP_PURGED_AFTER_RETENTION',
  },
  recordAccountLifecycleEvent: (...args: unknown[]) => recordAccountLifecycleEvent(...args),
}));

import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
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
  lastStripeEventAt: null as Date | null,
  lastStripeEventId: null as string | null,
  postFullPlan: 'UNDECIDED' as const,
  postFullPlanChosenAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const PURGE_NOW = new Date('2026-08-15T00:00:00.000Z');
const ACTIVE_FUTURE_END = new Date('2026-09-15T00:00:00.000Z');

type PurgeWorld = {
  shop: Record<string, unknown> | null;
  openSubscriptions?: number;
  latest: Record<string, unknown> | null;
};

const departedShop = {
  id: 'shop-1',
  shopPaidAt: null,
  smsRemindersEnabled: false,
  freeBookingActivatedAt: null,
};

const expiredCanceledRow = {
  id: 'saas-1',
  status: 'CANCELED',
  currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
  pastDueSince: null,
  cancelAtPeriodEnd: false,
  postFullPlan: 'CHOICE_REQUIRED',
};

/**
 * Wire the eligibility reads (pre-gate on the global client, re-check on the tx client).
 * `inTx` overrides the world seen inside the purge transaction to simulate a concurrent change.
 */
function mockPurgeWorld(world: PurgeWorld, inTx: PurgeWorld = world) {
  findMany.mockResolvedValue([
    {
      id: 'saas-1',
      shopId: 'shop-1',
      customerEmail: 'owner@example.com',
      retentionEndsAt: new Date('2026-08-01T00:00:00.000Z'),
    },
  ]);
  findUniqueShop.mockResolvedValue(world.shop);
  count.mockResolvedValue(world.openSubscriptions ?? 0);
  findFirst.mockResolvedValue(world.latest);
  const tx = {
    shopSettings: { findUnique: vi.fn(async () => inTx.shop) },
    saasSubscription: {
      count: vi.fn(async () => inTx.openSubscriptions ?? 0),
      findFirst: vi.fn(async () => inTx.latest),
      update,
    },
  };
  transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => fn(tx));
  update.mockResolvedValue({ ...baseRecord, shopId: null });
  return tx;
}

describe('saasSubscriptionLifecycle WP-I', () => {
  beforeEach(() => {
    findFirst.mockReset();
    findMany.mockReset();
    update.mockReset();
    count.mockReset();
    findUniqueShop.mockReset();
    updateShop.mockReset();
    updateShop.mockResolvedValue({});
    transaction.mockReset();
    markShopPaid.mockReset();
    markShopUnpaid.mockReset();
    purgeShopData.mockReset();
    beginShopPurgeGate.mockReset();
    listPrivateBlobPathsForShopPurge.mockReset();
    listPublicBlobUrlsForShopPurge.mockReset();
    deletePrivateBlobPathsBestEffort.mockReset();
    runPostCommitPublicBlobCleanup.mockReset();
    recordAccountLifecycleEvent.mockReset();
    beginShopPurgeGate.mockResolvedValue({ alreadyStarted: false });
    listPrivateBlobPathsForShopPurge.mockResolvedValue([]);
    listPublicBlobUrlsForShopPurge.mockResolvedValue([]);
    deletePrivateBlobPathsBestEffort.mockResolvedValue(undefined);
    runPostCommitPublicBlobCleanup.mockResolvedValue({
      collected: { attempted: 0, deleted: 0, failed: 0, skippedCrossShop: 0, skippedInvalid: 0 },
      sweep: {
        attempted: 0,
        deleted: 0,
        failed: 0,
        skippedCrossShop: 0,
        skippedInvalid: 0,
        pages: 0,
        listFailed: false,
      },
    });
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

  it('C: purges a genuinely departed shop after retentionEndsAt', async () => {
    const tx = mockPurgeWorld({ shop: departedShop, latest: expiredCanceledRow });

    const result = await purgeShopsAfterRetentionEnds(PURGE_NOW);
    expect(result.purged).toBe(1);
    expect(tx.saasSubscription.findFirst).toHaveBeenCalled();
    expect(beginShopPurgeGate).toHaveBeenCalledWith('shop-1');
    expect(listPrivateBlobPathsForShopPurge).toHaveBeenCalledWith('shop-1');
    expect(listPublicBlobUrlsForShopPurge).toHaveBeenCalledWith('shop-1');
    expect(purgeShopData).toHaveBeenCalled();
    expect(deletePrivateBlobPathsBestEffort).toHaveBeenCalled();
    expect(runPostCommitPublicBlobCleanup).toHaveBeenCalledWith('shop-1', []);
    expect(recordAccountLifecycleEvent).toHaveBeenCalled();
  });

  it('records retention purge lifecycle even when post-commit cleanup throws', async () => {
    mockPurgeWorld({ shop: departedShop, latest: expiredCanceledRow });
    runPostCommitPublicBlobCleanup.mockRejectedValueOnce(new Error('cleanup boom'));

    const result = await purgeShopsAfterRetentionEnds(PURGE_NOW);
    expect(result.purged).toBe(1);
    expect(recordAccountLifecycleEvent).toHaveBeenCalled();
  });

  it('C: an explicit LEAVE choice is purged even for a former Starter shop', async () => {
    mockPurgeWorld({
      shop: { ...departedShop, freeBookingActivatedAt: new Date('2026-05-01T00:00:00.000Z') },
      latest: { ...expiredCanceledRow, postFullPlan: 'LEAVE' },
    });
    expect((await purgeShopsAfterRetentionEnds(PURGE_NOW)).purged).toBe(1);
    expect(purgeShopData).toHaveBeenCalled();
  });

  function expectNoPurge() {
    expect(beginShopPurgeGate).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(purgeShopData).not.toHaveBeenCalled();
    expect(recordAccountLifecycleEvent).not.toHaveBeenCalled();
  }

  it('A: expired canceled Full + active Starter (explicit choice) → no purge', async () => {
    mockPurgeWorld({
      shop: { ...departedShop, freeBookingActivatedAt: new Date('2026-05-01T00:00:00.000Z') },
      latest: { ...expiredCanceledRow, postFullPlan: 'STARTER' },
    });
    expect((await purgeShopsAfterRetentionEnds(PURGE_NOW)).purged).toBe(0);
    expectNoPurge();
  });

  it('A: expired canceled Full + Starter used before Full, no plan recorded → no purge (fail closed)', async () => {
    for (const postFullPlan of ['UNDECIDED', 'CHOICE_REQUIRED']) {
      mockPurgeWorld({
        shop: { ...departedShop, freeBookingActivatedAt: new Date('2026-05-01T00:00:00.000Z') },
        latest: { ...expiredCanceledRow, postFullPlan },
      });
      expect((await purgeShopsAfterRetentionEnds(PURGE_NOW)).purged).toBe(0);
    }
    expectNoPurge();
  });

  it('B: expired canceled Full + current active Full (newer subscription) → no purge', async () => {
    mockPurgeWorld({
      shop: departedShop,
      openSubscriptions: 1,
      latest: { ...expiredCanceledRow, id: 'saas-2', status: 'ACTIVE', currentPeriodEnd: ACTIVE_FUTURE_END },
    });
    expect((await purgeShopsAfterRetentionEnds(PURGE_NOW)).purged).toBe(0);
    expectNoPurge();
  });

  it('B: a newer canceled-but-still-paid-through Full row also blocks purge of the old row', async () => {
    mockPurgeWorld({
      shop: departedShop,
      latest: { ...expiredCanceledRow, id: 'saas-2', currentPeriodEnd: ACTIVE_FUTURE_END },
    });
    expect((await purgeShopsAfterRetentionEnds(PURGE_NOW)).purged).toBe(0);
    expectNoPurge();
  });

  it('D: a historical canceled subscription alone is not purge authority', async () => {
    // Open subscription (e.g. PAST_DUE / SUSPENDED / PENDING) present for the shop.
    mockPurgeWorld({ shop: departedShop, openSubscriptions: 1, latest: expiredCanceledRow });
    expect((await purgeShopsAfterRetentionEnds(PURGE_NOW)).purged).toBe(0);
    expectNoPurge();
  });

  it('D: demo / showcase shops are protected even with an expired canceled row', async () => {
    mockPurgeWorld({ shop: { ...departedShop, id: DEMO_SHOP_ID }, latest: expiredCanceledRow });
    findMany.mockResolvedValue([
      { id: 'saas-1', shopId: DEMO_SHOP_ID, customerEmail: 'x@example.com', retentionEndsAt: PURGE_NOW },
    ]);
    expect((await purgeShopsAfterRetentionEnds(PURGE_NOW)).purged).toBe(0);
    expect(findUniqueShop).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expectNoPurge();
  });

  it('D: shop changes after the gate (e.g. Starter chosen) → in-transaction recheck aborts and releases the gate', async () => {
    const tx = mockPurgeWorld(
      { shop: departedShop, latest: expiredCanceledRow },
      { shop: departedShop, latest: { ...expiredCanceledRow, postFullPlan: 'STARTER' } },
    );

    const result = await purgeShopsAfterRetentionEnds(PURGE_NOW);

    expect(result.purged).toBe(0);
    expect(beginShopPurgeGate).toHaveBeenCalledWith('shop-1');
    expect(tx.saasSubscription.findFirst).toHaveBeenCalled();
    expect(purgeShopData).not.toHaveBeenCalled();
    expect(tx.saasSubscription.update).not.toHaveBeenCalled();
    expect(updateShop).toHaveBeenCalledWith({ where: { id: 'shop-1' }, data: { purgeStartedAt: null } });
    expect(recordAccountLifecycleEvent).not.toHaveBeenCalled();
  });

  it('D: aborted recheck does not release a gate opened by an earlier run', async () => {
    beginShopPurgeGate.mockResolvedValue({ alreadyStarted: true });
    mockPurgeWorld(
      { shop: departedShop, latest: expiredCanceledRow },
      { shop: departedShop, latest: expiredCanceledRow, openSubscriptions: 1 },
    );
    expect((await purgeShopsAfterRetentionEnds(PURGE_NOW)).purged).toBe(0);
    expect(updateShop).not.toHaveBeenCalled();
  });

  it('unlinks the row without purging when the shop no longer exists', async () => {
    mockPurgeWorld({ shop: null, latest: null });
    expect((await purgeShopsAfterRetentionEnds(PURGE_NOW)).purged).toBe(0);
    expect(update).toHaveBeenCalledWith({ where: { id: 'saas-1' }, data: { shopId: null } });
    expectNoPurge();
  });

  it('webhook: Full canceled with no choice marks the row CHOICE_REQUIRED', async () => {
    findFirst.mockResolvedValue(baseRecord);
    update.mockResolvedValue({ ...baseRecord, status: 'CANCELED', postFullPlan: 'CHOICE_REQUIRED' });

    await applyStripeSubscriptionToSaasRecord({
      id: 'sub_1',
      status: 'canceled',
      cancel_at_period_end: false,
      canceled_at: Math.floor(new Date('2026-07-20T00:00:00.000Z').getTime() / 1000),
      customer: 'cus_1',
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ postFullPlan: 'CHOICE_REQUIRED' }) }),
    );
  });

  it('webhook: an explicit choice (STARTER / LEAVE) is never overwritten on cancel', async () => {
    for (const postFullPlan of ['STARTER', 'LEAVE'] as const) {
      update.mockReset();
      findFirst.mockResolvedValue({ ...baseRecord, postFullPlan });
      update.mockResolvedValue({ ...baseRecord, status: 'CANCELED', postFullPlan });
      await applyStripeSubscriptionToSaasRecord({
        id: 'sub_1',
        status: 'canceled',
        cancel_at_period_end: false,
        canceled_at: Math.floor(new Date('2026-07-20T00:00:00.000Z').getTime() / 1000),
        customer: 'cus_1',
      });
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.not.objectContaining({ postFullPlan: expect.anything() }) }),
      );
    }
  });

  it('webhook: non-cancel updates never touch postFullPlan', async () => {
    findFirst.mockResolvedValue(baseRecord);
    update.mockResolvedValue(baseRecord);
    await applyStripeSubscriptionToSaasRecord({
      id: 'sub_1',
      status: 'past_due',
      cancel_at_period_end: false,
      customer: 'cus_1',
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.not.objectContaining({ postFullPlan: expect.anything() }) }),
    );
  });

  it('does not purge when retention is still open', async () => {
    const now = new Date('2026-07-20T00:00:00.000Z');
    findMany.mockResolvedValue([]);
    const result = await purgeShopsAfterRetentionEnds(now);
    expect(result.purged).toBe(0);
    expect(purgeShopData).not.toHaveBeenCalled();
  });

  it('skips stale invoice.payment_failed without markShopUnpaid', async () => {
    const newer = new Date('2026-07-20T12:00:00.000Z');
    const older = new Date('2026-07-19T12:00:00.000Z');
    findFirst.mockResolvedValue({
      ...baseRecord,
      lastStripeEventAt: newer,
      lastStripeEventId: 'evt_newer',
    });

    const result = await applyInvoicePaymentFailed({
      stripeSubscriptionId: 'sub_1',
      eventCreatedAt: older,
      eventId: 'evt_old_fail',
    });

    expect(result.skipped).toBe('stale_event');
    expect(result.record?.status).toBe('ACTIVE');
    expect(update).not.toHaveBeenCalled();
    expect(markShopUnpaid).not.toHaveBeenCalled();
    expect(markShopPaid).not.toHaveBeenCalled();
  });

  it('applies in-order invoice.payment_failed and stamps lastStripeEventAt', async () => {
    const now = new Date('2026-07-15T12:00:00.000Z');
    const eventAt = new Date('2026-07-15T11:00:00.000Z');
    findFirst.mockResolvedValue({
      ...baseRecord,
      lastStripeEventAt: new Date('2026-07-14T00:00:00.000Z'),
    });
    update.mockResolvedValue({
      ...baseRecord,
      status: 'PAST_DUE',
      pastDueSince: now,
      lastStripeEventAt: eventAt,
      lastStripeEventId: 'evt_fail',
    });

    const result = await applyInvoicePaymentFailed({
      stripeSubscriptionId: 'sub_1',
      now,
      eventCreatedAt: eventAt,
      eventId: 'evt_fail',
    });

    expect(result.skipped).toBeUndefined();
    expect(result.record?.status).toBe('PAST_DUE');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastStripeEventAt: eventAt,
          lastStripeEventId: 'evt_fail',
        }),
      }),
    );
  });

  it('allows equal-timestamp lifecycle events through', async () => {
    const sameSecond = new Date('2026-07-15T12:00:00.000Z');
    findFirst.mockResolvedValue({
      ...baseRecord,
      status: 'PAST_DUE',
      pastDueSince: new Date('2026-07-10T12:00:00.000Z'),
      lastStripeEventAt: sameSecond,
      lastStripeEventId: 'evt_a',
    });
    update.mockResolvedValue({
      ...baseRecord,
      status: 'ACTIVE',
      pastDueSince: null,
      lastStripeEventAt: sameSecond,
      lastStripeEventId: 'evt_b',
    });

    const result = await applyInvoicePaid({
      stripeSubscriptionId: 'sub_1',
      eventCreatedAt: sameSecond,
      eventId: 'evt_b',
    });

    expect(result.skipped).toBeUndefined();
    expect(result.record?.status).toBe('ACTIVE');
    expect(update).toHaveBeenCalled();
  });

  it('keeps API-driven sync without eventCreatedAt unstamped', async () => {
    findFirst.mockResolvedValue({
      ...baseRecord,
      lastStripeEventAt: new Date('2026-07-20T00:00:00.000Z'),
    });
    update.mockResolvedValue({
      ...baseRecord,
      status: 'CANCELED',
      canceledAt: new Date('2026-07-20T00:00:00.000Z'),
      retentionEndsAt: new Date('2026-08-19T00:00:00.000Z'),
    });

    await applyStripeSubscriptionToSaasRecord({
      id: 'sub_1',
      status: 'canceled',
      cancel_at_period_end: false,
      canceled_at: Math.floor(new Date('2026-07-20T00:00:00.000Z').getTime() / 1000),
      customer: 'cus_1',
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          lastStripeEventAt: expect.anything(),
        }),
      }),
    );
  });
});
