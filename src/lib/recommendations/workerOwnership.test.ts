import { describe, expect, it } from 'vitest';
import { RecommendationJobStatus, RecommendationSetStatus } from '@prisma/client';

import {
  buildLockAcquireWhere,
  buildLockOwnerOnlyWhere,
  buildOwnedStateWhere,
  claimOwnedFailure,
  isCatalogueStillCurrent,
  releaseOwnedLock,
} from './workerOwnership';
import { MAX_JOB_ATTEMPTS } from './constants';
import { createInMemoryRecommendationDb } from './testStateStore';

const debounceAt = new Date('2026-09-02T12:05:00Z');

function v3WithWorker2Lock() {
  return createInMemoryRecommendationDb({
    shop: {
      shopId: 'shop-1',
      catalogueVersion: 3,
      pendingCatalogueVersion: 3,
      processingLockId: 'lock-worker-2',
      processingLockExpiresAt: new Date('2026-09-02T12:30:00Z'),
      processingCatalogueVersion: 2,
      jobStatus: RecommendationJobStatus.PENDING,
      rebuildAfter: debounceAt,
      attemptCount: 0,
      nextAttemptAt: null,
      lastErrorCode: null,
      lastErrorAt: null,
    },
  });
}

describe('workerOwnership predicates', () => {
  const ctx = { shopId: 'shop-1', lockId: 'lock-worker-2', targetVersion: 2 };

  it('does not allow lock steal when a newer catalogue version is pending', () => {
    const where = buildLockAcquireWhere('shop-1', 3, new Date('2026-09-02T12:00:00Z'));
    expect(where).toEqual({
      shopId: 'shop-1',
      pendingCatalogueVersion: 3,
      OR: [{ processingLockExpiresAt: null }, { processingLockExpiresAt: { lt: new Date('2026-09-02T12:00:00Z') } }],
    });
    expect(JSON.stringify(where)).not.toContain('processingCatalogueVersion');
  });

  it('requires exact lock ownership for worker mutations', () => {
    expect(buildOwnedStateWhere({ shopId: 'shop-1', lockId: 'lock-a', targetVersion: 4 })).toEqual({
      shopId: 'shop-1',
      processingLockId: 'lock-a',
      processingCatalogueVersion: 4,
      pendingCatalogueVersion: 4,
      catalogueVersion: 4,
    });
  });

  it('lock-owner-only predicate omits catalogue and pending versions', () => {
    expect(buildLockOwnerOnlyWhere(ctx)).toEqual({
      shopId: 'shop-1',
      processingLockId: 'lock-worker-2',
      processingCatalogueVersion: 2,
    });
  });

  it('detects when catalogue has moved forward', () => {
    expect(isCatalogueStillCurrent({ catalogueVersion: 5, pendingCatalogueVersion: 5 }, 4)).toBe(false);
    expect(isCatalogueStillCurrent({ catalogueVersion: 4, pendingCatalogueVersion: 4 }, 4)).toBe(true);
  });
});

describe('releaseOwnedLock with in-memory state', () => {
  const ctx = { shopId: 'shop-1', lockId: 'lock-worker-2', targetVersion: 2 };

  it('releases worker-2 lock on v3 state without changing version, pending, status or debounce', async () => {
    const store = v3WithWorker2Lock();
    expect(buildOwnedStateWhere(ctx)).not.toEqual(expect.objectContaining({ catalogueVersion: 3 }));

    const released = await releaseOwnedLock(ctx, store.client as never);
    expect(released).toBe(true);
    expect(store.shop).toMatchObject({
      catalogueVersion: 3,
      pendingCatalogueVersion: 3,
      jobStatus: RecommendationJobStatus.PENDING,
      rebuildAfter: debounceAt,
      processingLockId: null,
      processingLockExpiresAt: null,
      processingCatalogueVersion: null,
    });
    expect(store.updateManyCalls[0]?.where).toEqual(buildLockOwnerOnlyWhere(ctx));
  });

  it('does not clear a replacement lock owned by worker-3', async () => {
    const store = createInMemoryRecommendationDb({
      shop: {
        shopId: 'shop-1',
        catalogueVersion: 3,
        pendingCatalogueVersion: 3,
        processingLockId: 'lock-worker-3',
        processingLockExpiresAt: new Date('2026-09-02T12:30:00Z'),
        processingCatalogueVersion: 3,
        jobStatus: RecommendationJobStatus.PROCESSING,
        rebuildAfter: debounceAt,
        attemptCount: 0,
        nextAttemptAt: null,
        lastErrorCode: null,
        lastErrorAt: null,
      },
    });

    const released = await releaseOwnedLock(ctx, store.client as never);
    expect(released).toBe(false);
    expect(store.shop.processingLockId).toBe('lock-worker-3');
  });

  it('allows version 3 to acquire immediately after stale worker releases old lock', async () => {
    const store = v3WithWorker2Lock();
    const now = new Date('2026-09-02T12:06:00Z');

    await releaseOwnedLock(ctx, store.client as never);

    const acquireWhere = buildLockAcquireWhere('shop-1', 3, now);
    const acquired = await store.client.shopRecommendationState.updateMany({
      where: acquireWhere,
      data: {
        processingLockId: 'lock-worker-3',
        processingLockExpiresAt: new Date(now.getTime() + 60_000),
        processingCatalogueVersion: 3,
        jobStatus: RecommendationJobStatus.PROCESSING,
      },
    });
    expect(acquired.count).toBe(1);
    expect(store.shop.processingLockId).toBe('lock-worker-3');
    expect(store.shop.processingCatalogueVersion).toBe(3);
  });
});

describe('claimOwnedFailure with in-memory state', () => {
  const ctx = { shopId: 'shop-1', lockId: 'lock-worker-2', targetVersion: 2 };

  it('claims first failure with retry scheduled and lock cleared', async () => {
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

    const result = await claimOwnedFailure(ctx, 'set-1', 'MISSING_OPENAI_KEY', store.client as never);
    expect(result).toEqual({ outcome: 'claimed', exhausted: false, attempts: 1 });
    expect(store.shop.attemptCount).toBe(1);
    expect(store.shop.nextAttemptAt).toBeInstanceOf(Date);
    expect(store.shop.processingLockId).toBeNull();
    expect(store.getSet('set-1')?.status).toBe(RecommendationSetStatus.FAILED);
    expect(store.updateManyCalls[0]?.where).toEqual(buildOwnedStateWhere(ctx));
  });

  it('exhausts retries with nextAttemptAt null at MAX_JOB_ATTEMPTS', async () => {
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
        attemptCount: MAX_JOB_ATTEMPTS - 1,
        nextAttemptAt: null,
        lastErrorCode: 'OLD',
        lastErrorAt: new Date('2026-09-02T11:00:00Z'),
      },
      sets: [{ id: 'set-1', status: RecommendationSetStatus.BUILDING, errorCode: null, buildFinishedAt: null }],
    });

    const result = await claimOwnedFailure(ctx, 'set-1', 'MISSING_OPENAI_KEY', store.client as never);
    expect(result).toEqual({
      outcome: 'claimed',
      exhausted: true,
      attempts: MAX_JOB_ATTEMPTS,
    });
    expect(store.shop.nextAttemptAt).toBeNull();
    expect(store.shop.attemptCount).toBe(MAX_JOB_ATTEMPTS);
  });

  it('returns stale without consuming attempts when catalogue advanced', async () => {
    const store = createInMemoryRecommendationDb({
      shop: {
        shopId: 'shop-1',
        catalogueVersion: 3,
        pendingCatalogueVersion: 3,
        processingLockId: 'lock-worker-2',
        processingLockExpiresAt: new Date('2026-09-02T12:30:00Z'),
        processingCatalogueVersion: 2,
        jobStatus: RecommendationJobStatus.PENDING,
        rebuildAfter: debounceAt,
        attemptCount: 2,
        nextAttemptAt: null,
        lastErrorCode: null,
        lastErrorAt: null,
      },
    });

    const result = await claimOwnedFailure(ctx, 'set-1', 'MISSING_OPENAI_KEY', store.client as never);
    expect(result).toEqual({ outcome: 'stale', exhausted: false, attempts: 2 });
    expect(store.shop.attemptCount).toBe(2);
    expect(store.shop.processingLockId).toBe('lock-worker-2');
  });
});

describe('job status constants', () => {
  it('uses pending for scheduled rebuilds', () => {
    expect(RecommendationJobStatus.PENDING).toBe('PENDING');
  });
});
