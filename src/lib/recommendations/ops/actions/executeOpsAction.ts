import type { Prisma, PrismaClient } from '@prisma/client';
import { Prisma as PrismaNS } from '@prisma/client';

import { isDemoShopId, canSellRetail } from '@/lib/shop/cardPaymentsGate';
import {
  retryFailedCatalogueRebuild,
  scheduleCatalogueRebuild,
} from '@/lib/recommendations/scheduleCatalogueRebuild';

import {
  OPS_REBUILD_COOLDOWN_MS,
  type OpsActionErrorCode,
  type OpsActionOperator,
  type OpsActionRequest,
  type OpsActionResult,
  type OpsActionStateSnapshot,
  type OpsRecommendationAction,
  type OpsRecommendationOutcome,
} from './types';

type Db = PrismaClient | Prisma.TransactionClient;

function boundReason(reason: string | undefined): string | null {
  if (!reason) return null;
  return reason.slice(0, 500);
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function hasLiveLock(expiresAt: Date | null | undefined, now: Date): boolean {
  return expiresAt != null && expiresAt.getTime() > now.getTime();
}

function snapshotFromState(
  state: {
    jobStatus: string;
    catalogueVersion: number;
    pendingCatalogueVersion: number | null;
    rebuildAfter: Date | null;
    attemptCount: number;
    processingLockExpiresAt: Date | null;
  } | null,
  control: { railPaused: boolean; railPausedAt: Date | null } | null,
  now: Date,
): OpsActionStateSnapshot {
  return {
    jobStatus: state?.jobStatus ?? null,
    catalogueVersion: state?.catalogueVersion ?? null,
    pendingCatalogueVersion: state?.pendingCatalogueVersion ?? null,
    rebuildAfter: iso(state?.rebuildAfter),
    attemptCount: state?.attemptCount ?? null,
    hasLiveProcessingLock: state ? hasLiveLock(state.processingLockExpiresAt, now) : false,
    railPaused: control?.railPaused ?? false,
    railPausedAt: iso(control?.railPausedAt),
  };
}

function idempotencyKeyReusedResult(): OpsActionResult {
  return {
    ok: false,
    httpStatus: 409,
    error: { code: 'IDEMPOTENCY_KEY_REUSED' },
  };
}

function fingerprintsMatch(
  row: { shopIdSnapshot: string; action: string; actorUserId: string },
  fingerprint: { shopId: string; action: string; actorUserId: string },
): boolean {
  return (
    row.shopIdSnapshot === fingerprint.shopId &&
    row.action === fingerprint.action &&
    row.actorUserId === fingerprint.actorUserId
  );
}

function resolveIdempotencyRow(
  row: {
    id: string;
    shopIdSnapshot: string;
    action: string;
    actorUserId: string;
    outcome: string;
    errorCode: string | null;
    afterState: Prisma.JsonValue | null;
  },
  fingerprint: { shopId: string; action: string; actorUserId: string },
): OpsActionResult {
  if (!fingerprintsMatch(row, fingerprint)) {
    return idempotencyKeyReusedResult();
  }
  return replayFromRow(row);
}

function replayFromRow(row: {
  id: string;
  action: string;
  outcome: string;
  errorCode: string | null;
  afterState: Prisma.JsonValue | null;
}): OpsActionResult {
  const outcome = row.outcome as OpsRecommendationOutcome;
  const state =
    row.afterState && typeof row.afterState === 'object' && !Array.isArray(row.afterState)
      ? (row.afterState as OpsActionStateSnapshot & { retryAfterSeconds?: number })
      : {};

  if (outcome === 'QUEUED' || outcome === 'APPLIED') {
    return {
      ok: true,
      httpStatus: outcome === 'QUEUED' ? 202 : 200,
      data: {
        actionId: row.id,
        action: row.action as OpsRecommendationAction,
        outcome,
        replayed: true,
        queued: outcome === 'QUEUED',
        state,
      },
    };
  }

  const code = (row.errorCode as OpsActionErrorCode) || 'CONFLICT';
  let httpStatus: 400 | 404 | 409 | 429 | 500 = 409;
  if (code === 'COOLDOWN') httpStatus = 429;
  else if (code === 'NOT_FOUND') httpStatus = 404;
  else if (
    code === 'INELIGIBLE' ||
    code === 'INSUFFICIENT_CATALOGUE' ||
    code === 'INVALID_BODY'
  ) {
    httpStatus = 400;
  } else if (code === 'INTERNAL_ERROR' || outcome === 'FAILED') {
    httpStatus = 500;
  }

  return {
    ok: false,
    httpStatus,
    error: {
      code,
      ...(code === 'COOLDOWN' && typeof state.retryAfterSeconds === 'number'
        ? { retryAfterSeconds: state.retryAfterSeconds }
        : {}),
    },
    actionId: row.id,
  };
}

async function createAudit(
  db: Db,
  input: {
    idempotencyKey: string;
    shopId: string | null;
    shopIdSnapshot: string;
    actor: OpsActionOperator;
    action: OpsRecommendationAction;
    outcome: OpsRecommendationOutcome;
    reason?: string;
    errorCode?: string | null;
    beforeState: OpsActionStateSnapshot | null;
    afterState: Prisma.InputJsonValue | typeof PrismaNS.JsonNull | null;
  },
) {
  return db.recommendationOpsAction.create({
    data: {
      idempotencyKey: input.idempotencyKey,
      shopId: input.shopId,
      shopIdSnapshot: input.shopIdSnapshot,
      actorUserId: input.actor.userId,
      actorEmail: input.actor.email.slice(0, 320),
      action: input.action,
      outcome: input.outcome,
      reason: boundReason(input.reason),
      errorCode: input.errorCode ?? null,
      beforeState: input.beforeState ?? PrismaNS.JsonNull,
      afterState: input.afterState ?? PrismaNS.JsonNull,
    },
  });
}

async function handleUniqueConflict(
  db: PrismaClient,
  idempotencyKey: string,
  fingerprint: { shopId: string; action: string; actorUserId: string },
): Promise<OpsActionResult | null> {
  const again = await db.recommendationOpsAction.findUnique({
    where: { idempotencyKey },
  });
  return again ? resolveIdempotencyRow(again, fingerprint) : null;
}

async function ensureControlRow(tx: Db, shopId: string): Promise<void> {
  await tx.shopRecommendationControl.upsert({
    where: { shopId },
    create: {
      shopId,
      railPaused: false,
    },
    update: {},
  });
}

async function claimBuildCooldown(
  tx: Db,
  shopId: string,
  now: Date,
): Promise<{ claimed: true } | { claimed: false; retryAfterSeconds: number }> {
  const cutoff = new Date(now.getTime() - OPS_REBUILD_COOLDOWN_MS);
  const claimed = await tx.shopRecommendationControl.updateMany({
    where: {
      shopId,
      OR: [{ lastBuildActionAt: null }, { lastBuildActionAt: { lt: cutoff } }],
    },
    data: { lastBuildActionAt: now },
  });
  if (claimed.count === 1) return { claimed: true };

  const current = await tx.shopRecommendationControl.findUnique({
    where: { shopId },
    select: { lastBuildActionAt: true },
  });
  const lastAt = current?.lastBuildActionAt;
  const elapsed = lastAt ? now.getTime() - lastAt.getTime() : 0;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((OPS_REBUILD_COOLDOWN_MS - elapsed) / 1000),
  );
  return { claimed: false, retryAfterSeconds };
}

const STATE_SELECT = {
  jobStatus: true,
  catalogueVersion: true,
  pendingCatalogueVersion: true,
  rebuildAfter: true,
  attemptCount: true,
  processingLockExpiresAt: true,
} as const;

async function readAuthoritativeSnapshot(
  tx: Db,
  shopId: string,
  now: Date,
): Promise<OpsActionStateSnapshot> {
  const [afterState, control] = await Promise.all([
    tx.shopRecommendationState.findUnique({
      where: { shopId },
      select: STATE_SELECT,
    }),
    tx.shopRecommendationControl.findUnique({
      where: { shopId },
      select: { railPaused: true, railPausedAt: true },
    }),
  ]);
  return snapshotFromState(afterState, control, now);
}

export type ExecuteOpsActionDeps = {
  db: PrismaClient;
  now?: Date;
};

/**
 * Execute a Smart Retail operator action with idempotency, cooldown, and audit.
 * Never calls processShop / OpenAI.
 */
export async function executeOpsAction(
  input: {
    shopId: string;
    operator: OpsActionOperator;
    request: OpsActionRequest;
  },
  deps: ExecuteOpsActionDeps,
): Promise<OpsActionResult> {
  const { shopId, operator, request } = input;
  const db = deps.db;
  const now = deps.now ?? new Date();
  const fingerprint = {
    shopId,
    action: request.action,
    actorUserId: operator.userId,
  };

  const existing = await db.recommendationOpsAction.findUnique({
    where: { idempotencyKey: request.idempotencyKey },
  });
  if (existing) {
    return resolveIdempotencyRow(existing, fingerprint);
  }

  const reject = async (
    errorCode: OpsActionErrorCode,
    httpStatus: 400 | 404 | 409 | 429 | 500,
    opts?: {
      shopIdForFk?: string | null;
      before?: OpsActionStateSnapshot | null;
      after?: Prisma.InputJsonValue | null;
      outcome?: OpsRecommendationOutcome;
    },
  ): Promise<OpsActionResult> => {
    try {
      const row = await createAudit(db, {
        idempotencyKey: request.idempotencyKey,
        shopId: opts?.shopIdForFk === undefined ? shopId : opts.shopIdForFk,
        shopIdSnapshot: shopId,
        actor: operator,
        action: request.action,
        outcome:
          opts?.outcome ??
          (errorCode === 'CONFLICT' ||
          errorCode === 'ALREADY_PAUSED' ||
          errorCode === 'ALREADY_ACTIVE'
            ? 'CONFLICT'
            : 'REJECTED'),
        reason: request.reason,
        errorCode,
        beforeState: opts?.before ?? null,
        afterState: opts?.after ?? null,
      });
      return {
        ok: false,
        httpStatus,
        error: {
          code: errorCode,
          ...(errorCode === 'COOLDOWN' &&
          opts?.after &&
          typeof opts.after === 'object' &&
          opts.after !== null &&
          'retryAfterSeconds' in opts.after
            ? {
                retryAfterSeconds: Number(
                  (opts.after as { retryAfterSeconds: number }).retryAfterSeconds,
                ),
              }
            : {}),
        },
        actionId: row.id,
      };
    } catch (err) {
      if (err instanceof PrismaNS.PrismaClientKnownRequestError && err.code === 'P2002') {
        const replay = await handleUniqueConflict(db, request.idempotencyKey, fingerprint);
        if (replay) return replay;
      }
      return { ok: false, httpStatus: 500, error: { code: 'INTERNAL_ERROR' } };
    }
  };

  if (isDemoShopId(shopId)) {
    return reject('NOT_FOUND', 404, { shopIdForFk: null });
  }

  try {
    const shop = await db.shopSettings.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        shopPaidAt: true,
        smsRemindersEnabled: true,
        retailEnabled: true,
        stripeConnectAccountId: true,
        stripeConnectChargesEnabled: true,
        recommendationState: {
          select: STATE_SELECT,
        },
        recommendationControl: {
          select: {
            railPaused: true,
            railPausedAt: true,
            railPausedByUserId: true,
            railPauseReason: true,
            lastBuildActionAt: true,
          },
        },
      },
    });

    if (!shop) {
      return reject('NOT_FOUND', 404, { shopIdForFk: null });
    }

    const [activeServiceCount, activeProductCount] = await Promise.all([
      db.service.count({ where: { shopId, isActive: true } }),
      db.product.count({ where: { shopId, active: true } }),
    ]);

    const before = snapshotFromState(shop.recommendationState, shop.recommendationControl, now);

    if (request.action === 'REBUILD') {
      if (!canSellRetail(shop)) {
        return reject('INELIGIBLE', 400, { before, after: before });
      }
      if (activeServiceCount < 1 || activeProductCount < 2) {
        return reject('INSUFFICIENT_CATALOGUE', 400, { before, after: before });
      }

      return await db.$transaction(async (tx) => {
        const authoritative = await tx.recommendationOpsAction.findUnique({
          where: { idempotencyKey: request.idempotencyKey },
        });
        if (authoritative) {
          return resolveIdempotencyRow(authoritative, fingerprint);
        }

        await ensureControlRow(tx, shopId);
        const claim = await claimBuildCooldown(tx, shopId, now);
        if (!claim.claimed) {
          const after = {
            ...(await readAuthoritativeSnapshot(tx, shopId, now)),
            retryAfterSeconds: claim.retryAfterSeconds,
          };
          const row = await createAudit(tx, {
            idempotencyKey: request.idempotencyKey,
            shopId,
            shopIdSnapshot: shopId,
            actor: operator,
            action: 'REBUILD',
            outcome: 'REJECTED',
            reason: request.reason,
            errorCode: 'COOLDOWN',
            beforeState: before,
            afterState: after,
          });
          return {
            ok: false as const,
            httpStatus: 429 as const,
            error: {
              code: 'COOLDOWN' as const,
              retryAfterSeconds: claim.retryAfterSeconds,
            },
            actionId: row.id,
          };
        }

        await scheduleCatalogueRebuild(shopId, tx, now, { due: 'immediate' });
        const after = await readAuthoritativeSnapshot(tx, shopId, now);
        const row = await createAudit(tx, {
          idempotencyKey: request.idempotencyKey,
          shopId,
          shopIdSnapshot: shopId,
          actor: operator,
          action: 'REBUILD',
          outcome: 'QUEUED',
          reason: request.reason,
          beforeState: before,
          afterState: after,
        });
        return {
          ok: true as const,
          httpStatus: 202 as const,
          data: {
            actionId: row.id,
            action: 'REBUILD' as const,
            outcome: 'QUEUED' as const,
            replayed: false,
            queued: true,
            state: after,
          },
        };
      });
    }

    if (request.action === 'RETRY_FAILED') {
      return await db.$transaction(async (tx) => {
        const authoritative = await tx.recommendationOpsAction.findUnique({
          where: { idempotencyKey: request.idempotencyKey },
        });
        if (authoritative) {
          return resolveIdempotencyRow(authoritative, fingerprint);
        }

        await ensureControlRow(tx, shopId);
        const controlBeforeClaim = await tx.shopRecommendationControl.findUnique({
          where: { shopId },
          select: { lastBuildActionAt: true },
        });
        const claim = await claimBuildCooldown(tx, shopId, now);
        if (!claim.claimed) {
          const after = {
            ...(await readAuthoritativeSnapshot(tx, shopId, now)),
            retryAfterSeconds: claim.retryAfterSeconds,
          };
          const row = await createAudit(tx, {
            idempotencyKey: request.idempotencyKey,
            shopId,
            shopIdSnapshot: shopId,
            actor: operator,
            action: 'RETRY_FAILED',
            outcome: 'REJECTED',
            reason: request.reason,
            errorCode: 'COOLDOWN',
            beforeState: before,
            afterState: after,
          });
          return {
            ok: false as const,
            httpStatus: 429 as const,
            error: {
              code: 'COOLDOWN' as const,
              retryAfterSeconds: claim.retryAfterSeconds,
            },
            actionId: row.id,
          };
        }

        const retry = await retryFailedCatalogueRebuild(shopId, tx, now);
        if (!retry.ok) {
          // CONFLICT is not an accepted build action — restore prior cooldown timestamp.
          await tx.shopRecommendationControl.update({
            where: { shopId },
            data: { lastBuildActionAt: controlBeforeClaim?.lastBuildActionAt ?? null },
          });
          const after = await readAuthoritativeSnapshot(tx, shopId, now);
          const row = await createAudit(tx, {
            idempotencyKey: request.idempotencyKey,
            shopId,
            shopIdSnapshot: shopId,
            actor: operator,
            action: 'RETRY_FAILED',
            outcome: 'CONFLICT',
            reason: request.reason,
            errorCode: 'CONFLICT',
            beforeState: before,
            afterState: after,
          });
          return {
            ok: false as const,
            httpStatus: 409 as const,
            error: { code: 'CONFLICT' as const },
            actionId: row.id,
          };
        }
        const after = await readAuthoritativeSnapshot(tx, shopId, now);
        const row = await createAudit(tx, {
          idempotencyKey: request.idempotencyKey,
          shopId,
          shopIdSnapshot: shopId,
          actor: operator,
          action: 'RETRY_FAILED',
          outcome: 'QUEUED',
          reason: request.reason,
          beforeState: before,
          afterState: after,
        });
        return {
          ok: true as const,
          httpStatus: 202 as const,
          data: {
            actionId: row.id,
            action: 'RETRY_FAILED' as const,
            outcome: 'QUEUED' as const,
            replayed: false,
            queued: true,
            state: after,
          },
        };
      });
    }

    if (request.action === 'PAUSE_RAIL') {
      return await db.$transaction(async (tx) => {
        const authoritative = await tx.recommendationOpsAction.findUnique({
          where: { idempotencyKey: request.idempotencyKey },
        });
        if (authoritative) {
          return resolveIdempotencyRow(authoritative, fingerprint);
        }

        await ensureControlRow(tx, shopId);
        const paused = await tx.shopRecommendationControl.updateMany({
          where: { shopId, railPaused: false },
          data: {
            railPaused: true,
            railPausedAt: now,
            railPausedByUserId: operator.userId,
            railPauseReason: boundReason(request.reason),
          },
        });

        if (paused.count !== 1) {
          const after = await readAuthoritativeSnapshot(tx, shopId, now);
          const row = await createAudit(tx, {
            idempotencyKey: request.idempotencyKey,
            shopId,
            shopIdSnapshot: shopId,
            actor: operator,
            action: 'PAUSE_RAIL',
            outcome: 'CONFLICT',
            reason: request.reason,
            errorCode: 'ALREADY_PAUSED',
            beforeState: before,
            afterState: after,
          });
          return {
            ok: false as const,
            httpStatus: 409 as const,
            error: { code: 'ALREADY_PAUSED' as const },
            actionId: row.id,
          };
        }

        const after = await readAuthoritativeSnapshot(tx, shopId, now);
        const row = await createAudit(tx, {
          idempotencyKey: request.idempotencyKey,
          shopId,
          shopIdSnapshot: shopId,
          actor: operator,
          action: 'PAUSE_RAIL',
          outcome: 'APPLIED',
          reason: request.reason,
          beforeState: before,
          afterState: after,
        });
        return {
          ok: true as const,
          httpStatus: 200 as const,
          data: {
            actionId: row.id,
            action: 'PAUSE_RAIL' as const,
            outcome: 'APPLIED' as const,
            replayed: false,
            queued: false,
            state: after,
          },
        };
      });
    }

    // RESUME_RAIL
    return await db.$transaction(async (tx) => {
      const authoritative = await tx.recommendationOpsAction.findUnique({
        where: { idempotencyKey: request.idempotencyKey },
      });
      if (authoritative) {
        return resolveIdempotencyRow(authoritative, fingerprint);
      }

      await ensureControlRow(tx, shopId);
      const resumed = await tx.shopRecommendationControl.updateMany({
        where: { shopId, railPaused: true },
        data: {
          railPaused: false,
          railPausedAt: null,
          railPausedByUserId: null,
          railPauseReason: null,
        },
      });

      if (resumed.count !== 1) {
        const after = await readAuthoritativeSnapshot(tx, shopId, now);
        const row = await createAudit(tx, {
          idempotencyKey: request.idempotencyKey,
          shopId,
          shopIdSnapshot: shopId,
          actor: operator,
          action: 'RESUME_RAIL',
          outcome: 'CONFLICT',
          reason: request.reason,
          errorCode: 'ALREADY_ACTIVE',
          beforeState: before,
          afterState: after,
        });
        return {
          ok: false as const,
          httpStatus: 409 as const,
          error: { code: 'ALREADY_ACTIVE' as const },
          actionId: row.id,
        };
      }

      const after = await readAuthoritativeSnapshot(tx, shopId, now);
      const row = await createAudit(tx, {
        idempotencyKey: request.idempotencyKey,
        shopId,
        shopIdSnapshot: shopId,
        actor: operator,
        action: 'RESUME_RAIL',
        outcome: 'APPLIED',
        reason: request.reason,
        beforeState: before,
        afterState: after,
      });
      return {
        ok: true as const,
        httpStatus: 200 as const,
        data: {
          actionId: row.id,
          action: 'RESUME_RAIL' as const,
          outcome: 'APPLIED' as const,
          replayed: false,
          queued: false,
          state: after,
        },
      };
    });
  } catch (err) {
    if (err instanceof PrismaNS.PrismaClientKnownRequestError && err.code === 'P2002') {
      const replay = await handleUniqueConflict(db, request.idempotencyKey, fingerprint);
      if (replay) return replay;
    }

    try {
      const row = await createAudit(db, {
        idempotencyKey: request.idempotencyKey,
        shopId,
        shopIdSnapshot: shopId,
        actor: operator,
        action: request.action,
        outcome: 'FAILED',
        reason: request.reason,
        errorCode: 'INTERNAL_ERROR',
        beforeState: null,
        afterState: null,
      });
      return {
        ok: false,
        httpStatus: 500,
        error: { code: 'INTERNAL_ERROR' },
        actionId: row.id,
      };
    } catch (inner) {
      if (
        inner instanceof PrismaNS.PrismaClientKnownRequestError &&
        inner.code === 'P2002'
      ) {
        const replay = await handleUniqueConflict(db, request.idempotencyKey, fingerprint);
        if (replay) return replay;
      }
      return { ok: false, httpStatus: 500, error: { code: 'INTERNAL_ERROR' } };
    }
  }
}
