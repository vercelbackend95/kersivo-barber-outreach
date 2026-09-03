import { randomUUID } from 'node:crypto';

import {
  RecommendationJobStatus,
  RecommendationSetStatus,
  type Prisma,
} from '@prisma/client';

import { prisma } from '@/lib/db/client';
import {
  JOB_BASE_BACKOFF_MS,
  JOB_MAX_BACKOFF_MS,
  MAX_JOB_ATTEMPTS,
  PROCESSING_LOCK_TTL_MS,
} from './constants';

function backoffMs(attempts: number): number {
  return Math.min(JOB_MAX_BACKOFF_MS, JOB_BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
}

export const STALE_BUILD_ERROR_CODE = 'STALE_BUILD';

export class StaleBuildError extends Error {
  readonly code = STALE_BUILD_ERROR_CODE;

  constructor(message = STALE_BUILD_ERROR_CODE) {
    super(message);
    this.name = 'StaleBuildError';
  }
}

type DbClient = Prisma.TransactionClient | typeof prisma;

export type OwnedWorkerContext = {
  shopId: string;
  lockId: string;
  targetVersion: number;
};

export function buildLockAcquireWhere(
  shopId: string,
  targetVersion: number,
  now: Date,
): Prisma.ShopRecommendationStateWhereInput {
  return {
    shopId,
    pendingCatalogueVersion: targetVersion,
    OR: [{ processingLockExpiresAt: null }, { processingLockExpiresAt: { lt: now } }],
  };
}

export function buildOwnedStateWhere({
  shopId,
  lockId,
  targetVersion,
}: OwnedWorkerContext): Prisma.ShopRecommendationStateWhereInput {
  return {
    shopId,
    processingLockId: lockId,
    processingCatalogueVersion: targetVersion,
    pendingCatalogueVersion: targetVersion,
    catalogueVersion: targetVersion,
  };
}

export function buildPublishClaimWhere(ctx: OwnedWorkerContext): Prisma.ShopRecommendationStateWhereInput {
  return buildOwnedStateWhere(ctx);
}

/** Lock release only — does not require current catalogue/pending versions. */
export function buildLockOwnerOnlyWhere({
  shopId,
  lockId,
  targetVersion,
}: OwnedWorkerContext): Prisma.ShopRecommendationStateWhereInput {
  return {
    shopId,
    processingLockId: lockId,
    processingCatalogueVersion: targetVersion,
  };
}

export type FailureClaimResult =
  | { outcome: 'claimed'; exhausted: boolean; attempts: number }
  | { outcome: 'stale'; exhausted: false; attempts: number };

async function runSerializable<T>(
  db: DbClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if ('$transaction' in db && typeof db.$transaction === 'function') {
    return db.$transaction(fn);
  }
  return fn(db as Prisma.TransactionClient);
}

export async function acquireShopLock(
  shopId: string,
  targetVersion: number,
  now = new Date(),
  db: DbClient = prisma,
): Promise<string | null> {
  const lockId = randomUUID();
  const expiresAt = new Date(now.getTime() + PROCESSING_LOCK_TTL_MS);

  const updated = await db.shopRecommendationState.updateMany({
    where: buildLockAcquireWhere(shopId, targetVersion, now),
    data: {
      processingLockId: lockId,
      processingLockExpiresAt: expiresAt,
      processingCatalogueVersion: targetVersion,
      jobStatus: RecommendationJobStatus.PROCESSING,
    },
  });

  return updated.count === 1 ? lockId : null;
}

export async function releaseOwnedLock(
  ctx: OwnedWorkerContext,
  db: DbClient = prisma,
): Promise<boolean> {
  const updated = await db.shopRecommendationState.updateMany({
    where: buildLockOwnerOnlyWhere(ctx),
    data: {
      processingLockId: null,
      processingLockExpiresAt: null,
      processingCatalogueVersion: null,
    },
  });
  return updated.count === 1;
}

/**
 * Atomically claim a current-version failure transition.
 * On zero-row claim, returns stale without mutating state (caller handles SUPERSEDED + lock release).
 */
export async function claimOwnedFailure(
  ctx: OwnedWorkerContext,
  setId: string | null,
  errorCode: string,
  db: DbClient = prisma,
): Promise<FailureClaimResult> {
  const boundedCode = errorCode.slice(0, 120);
  const now = new Date();

  const txResult = await runSerializable(db, async (tx) => {
    const state = await tx.shopRecommendationState.findUnique({
      where: { shopId: ctx.shopId },
      select: { attemptCount: true },
    });
    if (!state) {
      return { claimed: false as const, attempts: 0 };
    }

    const nextAttempts = state.attemptCount + 1;
    const exhausted = nextAttempts >= MAX_JOB_ATTEMPTS;

    const claimed = await tx.shopRecommendationState.updateMany({
      where: buildOwnedStateWhere(ctx),
      data: {
        attemptCount: nextAttempts,
        lastErrorCode: boundedCode,
        lastErrorAt: now,
        jobStatus: RecommendationJobStatus.FAILED,
        processingLockId: null,
        processingLockExpiresAt: null,
        processingCatalogueVersion: null,
        nextAttemptAt: exhausted ? null : new Date(now.getTime() + backoffMs(nextAttempts)),
      },
    });

    if (claimed.count !== 1) {
      return { claimed: false as const, attempts: state.attemptCount };
    }

    if (setId) {
      await markSetTerminal(setId, RecommendationSetStatus.FAILED, boundedCode, tx);
    }

    return { claimed: true as const, exhausted, attempts: nextAttempts };
  });

  if (!txResult.claimed) {
    return { outcome: 'stale', exhausted: false, attempts: txResult.attempts };
  }

  return {
    outcome: 'claimed',
    exhausted: txResult.exhausted,
    attempts: txResult.attempts,
  };
}

export async function markSetTerminal(
  setId: string,
  status: RecommendationSetStatus,
  errorCode: string | null,
  db: DbClient = prisma,
): Promise<void> {
  await db.recommendationSet.updateMany({
    where: { id: setId, status: RecommendationSetStatus.BUILDING },
    data: {
      status,
      buildFinishedAt: new Date(),
      errorCode,
    },
  });
}

export async function readShopState(
  shopId: string,
  db: DbClient = prisma,
): Promise<{
  catalogueVersion: number;
  pendingCatalogueVersion: number | null;
  attemptCount: number;
} | null> {
  return db.shopRecommendationState.findUnique({
    where: { shopId },
    select: {
      catalogueVersion: true,
      pendingCatalogueVersion: true,
      attemptCount: true,
    },
  });
}

export function isCatalogueStillCurrent(
  state: { catalogueVersion: number; pendingCatalogueVersion: number | null },
  targetVersion: number,
): boolean {
  return (
    state.catalogueVersion === targetVersion &&
    state.pendingCatalogueVersion === targetVersion
  );
}
