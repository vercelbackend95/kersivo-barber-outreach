import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecommendationJobStatus, RecommendationSetStatus, type Prisma } from '@prisma/client';

import { MAX_JOB_ATTEMPTS } from './constants';
import {
  buildLockOwnerOnlyWhere,
  buildOwnedStateWhere,
  claimOwnedFailure,
  releaseOwnedLock,
} from './workerOwnership';
import { createInMemoryRecommendationDb } from './testStateStore';

const shopFindMany = vi.fn();
const shopSettingsFindMany = vi.fn();
const stateFindUnique = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findMany: (...args: unknown[]) => shopSettingsFindMany(...args),
    },
    shopRecommendationState: {
      findMany: (...args: unknown[]) => shopFindMany(...args),
      findUnique: (...args: unknown[]) => stateFindUnique(...args),
    },
  },
}));

import { processDueRecommendationRebuilds } from './processor';

describe('processor failure lifecycle (Phase 3B)', () => {
  const ctx = { shopId: 'shop-1', lockId: 'lock-worker-2', targetVersion: 2 };

  beforeEach(() => {
    shopSettingsFindMany.mockResolvedValue([]);
    stateFindUnique.mockResolvedValue(null);
  });

  it('stale failure after catalogue bump marks SUPERSEDED and releases lock without attempt increment', async () => {
    const store = createInMemoryRecommendationDb({
      shop: {
        shopId: 'shop-1',
        catalogueVersion: 3,
        pendingCatalogueVersion: 3,
        processingLockId: 'lock-worker-2',
        processingLockExpiresAt: new Date('2026-09-02T12:30:00Z'),
        processingCatalogueVersion: 2,
        jobStatus: RecommendationJobStatus.PENDING,
        rebuildAfter: new Date('2026-09-02T12:05:00Z'),
        attemptCount: 1,
        nextAttemptAt: null,
        lastErrorCode: null,
        lastErrorAt: null,
      },
      sets: [{ id: 'set-1', status: RecommendationSetStatus.BUILDING, errorCode: null, buildFinishedAt: null }],
    });

    const failure = await claimOwnedFailure(ctx, 'set-1', 'MISSING_OPENAI_KEY', store.client as never);
    expect(failure.outcome).toBe('stale');
    expect(store.shop.attemptCount).toBe(1);

    await store.client.recommendationSet.updateMany({
      where: { id: 'set-1', status: RecommendationSetStatus.BUILDING },
      data: { status: RecommendationSetStatus.SUPERSEDED, errorCode: 'STALE_BUILD', buildFinishedAt: new Date() },
    });
    await releaseOwnedLock(ctx, store.client as never);

    expect(store.getSet('set-1')?.status).toBe(RecommendationSetStatus.SUPERSEDED);
    expect(store.shop.processingLockId).toBeNull();
    expect(store.shop.catalogueVersion).toBe(3);
    expect(store.shop.pendingCatalogueVersion).toBe(3);
    expect(store.shop.rebuildAfter).toEqual(new Date('2026-09-02T12:05:00Z'));
  });

  it('single-tx claim prevents orphan lock when catalogue advances during failure', async () => {
    const store = createInMemoryRecommendationDb({
      shop: {
        shopId: 'shop-1',
        catalogueVersion: 2,
        pendingCatalogueVersion: 2,
        processingLockId: 'lock-worker-2',
        processingLockExpiresAt: new Date('2026-09-02T12:30:00Z'),
        processingCatalogueVersion: 2,
        jobStatus: RecommendationJobStatus.PROCESSING,
        rebuildAfter: null,
        attemptCount: 0,
        nextAttemptAt: null,
        lastErrorCode: null,
        lastErrorAt: null,
      },
      sets: [{ id: 'set-1', status: RecommendationSetStatus.BUILDING, errorCode: null, buildFinishedAt: null }],
    });

    const ownedWhere = buildOwnedStateWhere(ctx);
    const originalUpdateMany = store.client.shopRecommendationState.updateMany.bind(
      store.client.shopRecommendationState,
    );
    let claimSeen = false;
    store.client.shopRecommendationState.updateMany = async (
      args: Prisma.ShopRecommendationStateUpdateManyArgs,
    ) => {
      const isFailureClaim =
        JSON.stringify(args.where) === JSON.stringify(ownedWhere) &&
        args.data &&
        'attemptCount' in args.data;
      if (!claimSeen && isFailureClaim) {
        claimSeen = true;
        store.mutateShop((state) => {
          state.catalogueVersion = 3;
          state.pendingCatalogueVersion = 3;
          state.rebuildAfter = new Date('2026-09-02T12:05:00Z');
        });
      }
      return originalUpdateMany(args);
    };

    const failure = await claimOwnedFailure(ctx, 'set-1', 'MISSING_OPENAI_KEY', store.client as never);
    expect(failure.outcome).toBe('stale');
    expect(store.shop.attemptCount).toBe(0);
    expect(store.getSet('set-1')?.status).toBe(RecommendationSetStatus.BUILDING);

    const released = await releaseOwnedLock(ctx, store.client as never);
    expect(released).toBe(true);
    expect(store.shop.processingLockId).toBeNull();
    expect(store.shop.pendingCatalogueVersion).toBe(3);
  });

  it('does not select exhausted FAILED rows in cron processor', async () => {
    shopFindMany.mockResolvedValue([]);
    await processDueRecommendationRebuilds(new Date('2026-09-02T13:00:00Z'));

    const where = shopFindMany.mock.calls[0]?.[0]?.where;
    const failedBranch = where.OR.find(
      (branch: { jobStatus?: string }) => branch.jobStatus === RecommendationJobStatus.FAILED,
    );
    expect(failedBranch).toMatchObject({
      jobStatus: RecommendationJobStatus.FAILED,
      attemptCount: { lt: MAX_JOB_ATTEMPTS },
    });
  });
});

describe('lock-owner release predicate usage', () => {
  it('release uses lock-owner-only where not full ownership where', async () => {
    const store = createInMemoryRecommendationDb({
      shop: {
        shopId: 'shop-1',
        catalogueVersion: 3,
        pendingCatalogueVersion: 3,
        processingLockId: 'lock-worker-2',
        processingLockExpiresAt: new Date('2026-09-02T12:30:00Z'),
        processingCatalogueVersion: 2,
        jobStatus: RecommendationJobStatus.PENDING,
        rebuildAfter: new Date('2026-09-02T12:05:00Z'),
        attemptCount: 0,
        nextAttemptAt: null,
        lastErrorCode: null,
        lastErrorAt: null,
      },
    });

    const ctx = { shopId: 'shop-1', lockId: 'lock-worker-2', targetVersion: 2 };
    await releaseOwnedLock(ctx, store.client as never);
    expect(store.updateManyCalls.at(-1)?.where).toEqual(buildLockOwnerOnlyWhere(ctx));
    expect(store.updateManyCalls.at(-1)?.where).not.toEqual(buildOwnedStateWhere(ctx));
  });
});
