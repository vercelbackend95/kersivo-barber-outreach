import type { Prisma } from '@prisma/client';
import { RecommendationJobStatus } from '@prisma/client';

import { prisma } from '@/lib/db/client';
import { REBUILD_DEBOUNCE_MS, TAXONOMY_VERSION } from './constants';

type DbClient = Prisma.TransactionClient | typeof prisma;

const MAX_CAS_RETRIES = 8;

export type ScheduleCatalogueRebuildOpts = {
  /** Default `debounced` preserves product/service edit behaviour. */
  due?: 'debounced' | 'immediate';
};

function rebuildAfterFromNow(now: Date, due: 'debounced' | 'immediate'): Date {
  if (due === 'immediate') return new Date(now.getTime());
  return new Date(now.getTime() + REBUILD_DEBOUNCE_MS);
}

export async function ensureShopRecommendationState(
  shopId: string,
  db: DbClient = prisma,
): Promise<void> {
  await db.shopRecommendationState.upsert({
    where: { shopId },
    create: {
      shopId,
      taxonomyVersion: TAXONOMY_VERSION,
      jobStatus: RecommendationJobStatus.IDLE,
    },
    update: {},
  });
}

export type BumpCatalogueVersionResult =
  | { ok: true; previousVersion: number; nextVersion: number }
  | { ok: false; reason: 'conflict_exhausted' };

/**
 * Optimistic compare-and-swap bump. Does not touch worker lock fields.
 */
export async function bumpCatalogueVersionOnce(
  shopId: string,
  observedVersion: number,
  db: DbClient,
  now: Date,
  opts: ScheduleCatalogueRebuildOpts = {},
): Promise<BumpCatalogueVersionResult> {
  const due = opts.due ?? 'debounced';
  const nextVersion = observedVersion + 1;
  const updated = await db.shopRecommendationState.updateMany({
    where: { shopId, catalogueVersion: observedVersion },
    data: {
      catalogueVersion: nextVersion,
      pendingCatalogueVersion: nextVersion,
      rebuildAfter: rebuildAfterFromNow(now, due),
      jobStatus: RecommendationJobStatus.PENDING,
      attemptCount: 0,
      nextAttemptAt: null,
      lastErrorCode: null,
      lastErrorAt: null,
      taxonomyVersion: TAXONOMY_VERSION,
    },
  });

  if (updated.count === 1) {
    return { ok: true, previousVersion: observedVersion, nextVersion };
  }
  return { ok: false, reason: 'conflict_exhausted' };
}

/**
 * Bump catalogue version and schedule a rebuild.
 * Default due=`debounced` for normal product/service edits.
 * Operator REBUILD uses due=`immediate` (rebuildAfter = now).
 * Safe to call inside an existing transaction.
 */
export async function scheduleCatalogueRebuild(
  shopId: string,
  db: DbClient = prisma,
  now = new Date(),
  opts: ScheduleCatalogueRebuildOpts = {},
): Promise<void> {
  await ensureShopRecommendationState(shopId, db);

  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt += 1) {
    const state = await db.shopRecommendationState.findUniqueOrThrow({
      where: { shopId },
      select: { catalogueVersion: true },
    });

    const result = await bumpCatalogueVersionOnce(
      shopId,
      state.catalogueVersion,
      db,
      now,
      opts,
    );
    if (result.ok) return;
  }

  throw new Error('CATALOGUE_VERSION_CAS_EXHAUSTED');
}

export type RetryFailedCatalogueRebuildResult =
  | { ok: true }
  | { ok: false; reason: 'conflict' };

function isClearLockTuple(state: {
  processingLockId: string | null;
  processingCatalogueVersion: number | null;
  processingLockExpiresAt: Date | null;
}): boolean {
  return (
    state.processingLockId == null &&
    state.processingCatalogueVersion == null &&
    state.processingLockExpiresAt == null
  );
}

function isExpiredCompleteLockTuple(
  state: {
    processingLockId: string | null;
    processingCatalogueVersion: number | null;
    processingLockExpiresAt: Date | null;
  },
  now: Date,
): boolean {
  return (
    state.processingLockId != null &&
    state.processingCatalogueVersion != null &&
    state.processingLockExpiresAt != null &&
    state.processingLockExpiresAt.getTime() < now.getTime()
  );
}

/**
 * Requeue the same pending catalogue version after FAILED without bumping version.
 * Fail-closed: rejects wrong job state, version mismatch, partial locks, or a live lock.
 * Never calls processShop / OpenAI.
 */
export async function retryFailedCatalogueRebuild(
  shopId: string,
  db: DbClient = prisma,
  now = new Date(),
): Promise<RetryFailedCatalogueRebuildResult> {
  const observed = await db.shopRecommendationState.findUnique({
    where: { shopId },
    select: {
      jobStatus: true,
      catalogueVersion: true,
      pendingCatalogueVersion: true,
      attemptCount: true,
      processingLockId: true,
      processingCatalogueVersion: true,
      processingLockExpiresAt: true,
    },
  });

  if (!observed) return { ok: false, reason: 'conflict' };

  if (
    observed.jobStatus !== RecommendationJobStatus.FAILED ||
    observed.pendingCatalogueVersion == null ||
    observed.pendingCatalogueVersion !== observed.catalogueVersion
  ) {
    return { ok: false, reason: 'conflict' };
  }

  const lockClear = isClearLockTuple(observed);
  const lockExpiredComplete = isExpiredCompleteLockTuple(observed, now);
  if (!lockClear && !lockExpiredComplete) {
    return { ok: false, reason: 'conflict' };
  }

  const updated = await db.shopRecommendationState.updateMany({
    where: {
      shopId,
      jobStatus: RecommendationJobStatus.FAILED,
      catalogueVersion: observed.catalogueVersion,
      pendingCatalogueVersion: observed.pendingCatalogueVersion,
      attemptCount: observed.attemptCount,
      processingLockId: observed.processingLockId,
      processingCatalogueVersion: observed.processingCatalogueVersion,
      processingLockExpiresAt: observed.processingLockExpiresAt,
    },
    data: {
      jobStatus: RecommendationJobStatus.PENDING,
      rebuildAfter: now,
      attemptCount: 0,
      nextAttemptAt: null,
      lastErrorCode: null,
      lastErrorAt: null,
      processingLockId: null,
      processingCatalogueVersion: null,
      processingLockExpiresAt: null,
    },
  });

  if (updated.count === 1) return { ok: true };
  return { ok: false, reason: 'conflict' };
}
