import type { Prisma } from '@prisma/client';
import { RecommendationJobStatus } from '@prisma/client';

import { prisma } from '@/lib/db/client';
import { REBUILD_DEBOUNCE_MS, TAXONOMY_VERSION } from './constants';

type DbClient = Prisma.TransactionClient | typeof prisma;

const MAX_CAS_RETRIES = 8;

function rebuildAfterFromNow(now = new Date()): Date {
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
): Promise<BumpCatalogueVersionResult> {
  const nextVersion = observedVersion + 1;
  const updated = await db.shopRecommendationState.updateMany({
    where: { shopId, catalogueVersion: observedVersion },
    data: {
      catalogueVersion: nextVersion,
      pendingCatalogueVersion: nextVersion,
      rebuildAfter: rebuildAfterFromNow(now),
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
 * Bump catalogue version and schedule a debounced rebuild.
 * Safe to call inside an existing transaction.
 */
export async function scheduleCatalogueRebuild(
  shopId: string,
  db: DbClient = prisma,
  now = new Date(),
): Promise<void> {
  await ensureShopRecommendationState(shopId, db);

  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt += 1) {
    const state = await db.shopRecommendationState.findUniqueOrThrow({
      where: { shopId },
      select: { catalogueVersion: true },
    });

    const result = await bumpCatalogueVersionOnce(shopId, state.catalogueVersion, db, now);
    if (result.ok) return;
  }

  throw new Error('CATALOGUE_VERSION_CAS_EXHAUSTED');
}
