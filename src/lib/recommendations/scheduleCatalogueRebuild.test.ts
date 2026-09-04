import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecommendationJobStatus } from '@prisma/client';

const upsert = vi.fn();
const findUniqueOrThrow = vi.fn();
const updateMany = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopRecommendationState: {
      upsert: (...args: unknown[]) => upsert(...args),
      findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrow(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
    },
  },
}));

import { REBUILD_DEBOUNCE_MS, TAXONOMY_VERSION } from './constants';
import { bumpCatalogueVersionOnce, scheduleCatalogueRebuild } from './scheduleCatalogueRebuild';

describe('scheduleCatalogueRebuild', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsert.mockResolvedValue({});
  });

  it('bumps catalogue version with CAS and preserves lock fields', async () => {
    const now = new Date('2026-09-02T12:00:00.000Z');
    const db = {
      shopRecommendationState: {
        upsert,
        findUniqueOrThrow,
        updateMany,
      },
    };

    findUniqueOrThrow.mockResolvedValue({ catalogueVersion: 3 });
    updateMany.mockResolvedValue({ count: 1 });

    await scheduleCatalogueRebuild('shop-abc', db as never, now);

    expect(updateMany).toHaveBeenCalledWith({
      where: { shopId: 'shop-abc', catalogueVersion: 3 },
      data: {
        catalogueVersion: 4,
        pendingCatalogueVersion: 4,
        rebuildAfter: new Date(now.getTime() + REBUILD_DEBOUNCE_MS),
        jobStatus: RecommendationJobStatus.PENDING,
        attemptCount: 0,
        nextAttemptAt: null,
        lastErrorCode: null,
        lastErrorAt: null,
        taxonomyVersion: TAXONOMY_VERSION,
      },
    });
    const data = updateMany.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data).not.toHaveProperty('processingLockId');
    expect(data).not.toHaveProperty('processingLockExpiresAt');
    expect(data).not.toHaveProperty('processingCatalogueVersion');
  });

  it('creates ShopRecommendationState with active TAXONOMY_VERSION', async () => {
    findUniqueOrThrow.mockResolvedValue({ catalogueVersion: 0 });
    updateMany.mockResolvedValue({ count: 1 });

    await scheduleCatalogueRebuild('shop-abc');

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          taxonomyVersion: '2026-09-v2',
        }),
      }),
    );
  });

  it('retries CAS when concurrent writers collide so versions become N+1 then N+2', async () => {
    const db = {
      shopRecommendationState: {
        upsert,
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({ catalogueVersion: 5 })
          .mockResolvedValueOnce({ catalogueVersion: 6 }),
        updateMany: vi
          .fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 }),
      },
    };

    const first = await bumpCatalogueVersionOnce('shop-abc', 5, db as never, new Date());
    expect(first).toEqual({ ok: false, reason: 'conflict_exhausted' });

    const second = await bumpCatalogueVersionOnce('shop-abc', 6, db as never, new Date());
    expect(second).toEqual({ ok: true, previousVersion: 6, nextVersion: 7 });
  });

  it('resets attempt budget on CAS bump while preserving live lock fields', async () => {
    const now = new Date('2026-09-02T12:00:00.000Z');
    const db = {
      shopRecommendationState: {
        upsert,
        findUniqueOrThrow,
        updateMany,
      },
    };

    findUniqueOrThrow.mockResolvedValue({ catalogueVersion: 2 });
    updateMany.mockResolvedValue({ count: 1 });

    await scheduleCatalogueRebuild('shop-abc', db as never, now);

    const data = updateMany.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.attemptCount).toBe(0);
    expect(data.nextAttemptAt).toBeNull();
    expect(data).not.toHaveProperty('processingLockId');
    expect(data).not.toHaveProperty('processingLockExpiresAt');
    expect(data).not.toHaveProperty('processingCatalogueVersion');
  });
});
