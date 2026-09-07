import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecommendationJobStatus } from '@prisma/client';

const findUniqueAudit = vi.fn();
const createAudit = vi.fn();
const findUniqueShop = vi.fn();
const serviceCount = vi.fn();
const productCount = vi.fn();
const transaction = vi.fn();
const scheduleCatalogueRebuild = vi.fn();
const retryFailedCatalogueRebuild = vi.fn();
const processShop = vi.fn();

vi.mock('@/lib/recommendations/scheduleCatalogueRebuild', () => ({
  scheduleCatalogueRebuild: (...args: unknown[]) => scheduleCatalogueRebuild(...args),
  retryFailedCatalogueRebuild: (...args: unknown[]) => retryFailedCatalogueRebuild(...args),
}));

vi.mock('@/lib/recommendations/processor', () => ({
  processShop: (...args: unknown[]) => processShop(...args),
  processDueRecommendationRebuilds: vi.fn(),
}));

import { executeOpsAction } from './executeOpsAction';

const KEY = '22222222-2222-4222-8222-222222222222';
const KEY2 = '33333333-3333-4333-8333-333333333333';
const operator = { userId: 'op1', email: 'hello@kersivo.co.uk' };

function eligibleShop(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shop_1',
    shopPaidAt: new Date('2026-01-01'),
    smsRemindersEnabled: true,
    retailEnabled: true,
    stripeConnectAccountId: 'acct_1',
    stripeConnectChargesEnabled: true,
    recommendationState: {
      jobStatus: RecommendationJobStatus.IDLE,
      catalogueVersion: 3,
      pendingCatalogueVersion: null,
      rebuildAfter: null,
      attemptCount: 0,
      processingLockExpiresAt: null,
    },
    recommendationControl: null,
    ...overrides,
  };
}

function buildTx(opts?: {
  claimCount?: number;
  pauseCount?: number;
  resumeCount?: number;
  control?: Record<string, unknown> | null;
  lastBuildActionAt?: Date | null;
}) {
  const claimCount = opts?.claimCount ?? 1;
  const pauseCount = opts?.pauseCount ?? 1;
  const resumeCount = opts?.resumeCount ?? 1;
  let lastBuildActionAt =
    opts?.lastBuildActionAt === undefined ? null : opts.lastBuildActionAt;
  let control =
    opts?.control === undefined
      ? {
          railPaused: false,
          railPausedAt: null,
          lastBuildActionAt,
        }
      : opts.control;

  return {
    recommendationOpsAction: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: createAudit,
    },
    shopRecommendationState: {
      findUnique: vi.fn().mockResolvedValue({
        jobStatus: RecommendationJobStatus.PENDING,
        catalogueVersion: 4,
        pendingCatalogueVersion: 4,
        rebuildAfter: new Date('2026-09-06T12:00:00.000Z'),
        attemptCount: 0,
        processingLockExpiresAt: null,
      }),
    },
    shopRecommendationControl: {
      findUnique: vi.fn().mockImplementation(async () => control),
      upsert: vi.fn().mockImplementation(async () => {
        if (!control) {
          control = {
            railPaused: false,
            railPausedAt: null,
            lastBuildActionAt: null,
          };
        }
        return control;
      }),
      update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        control = { ...(control ?? {}), ...data };
        return control;
      }),
      updateMany: vi.fn().mockImplementation(async ({ where, data }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        if ('lastBuildActionAt' in data || where.OR) {
          if (claimCount !== 1) {
            return { count: 0 };
          }
          lastBuildActionAt = (data.lastBuildActionAt as Date) ?? lastBuildActionAt;
          control = { ...(control ?? {}), lastBuildActionAt, ...data };
          return { count: 1 };
        }
        if (where.railPaused === false) {
          if (pauseCount !== 1) return { count: 0 };
          control = {
            railPaused: true,
            railPausedAt: data.railPausedAt,
            railPausedByUserId: data.railPausedByUserId,
            railPauseReason: data.railPauseReason,
            lastBuildActionAt,
          };
          return { count: 1 };
        }
        if (where.railPaused === true) {
          if (resumeCount !== 1) return { count: 0 };
          control = {
            railPaused: false,
            railPausedAt: null,
            railPausedByUserId: null,
            railPauseReason: null,
            lastBuildActionAt,
          };
          return { count: 1 };
        }
        return { count: 0 };
      }),
    },
  };
}

describe('executeOpsAction', () => {
  let db: {
    recommendationOpsAction: {
      findUnique: typeof findUniqueAudit;
      create: typeof createAudit;
    };
    shopSettings: { findUnique: typeof findUniqueShop };
    service: { count: typeof serviceCount };
    product: { count: typeof productCount };
    $transaction: typeof transaction;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueAudit.mockResolvedValue(null);
    createAudit.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'audit_1',
      ...data,
    }));
    findUniqueShop.mockResolvedValue(eligibleShop());
    serviceCount.mockResolvedValue(2);
    productCount.mockResolvedValue(3);
    scheduleCatalogueRebuild.mockResolvedValue(undefined);
    retryFailedCatalogueRebuild.mockResolvedValue({ ok: true });
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(buildTx()));

    db = {
      recommendationOpsAction: {
        findUnique: findUniqueAudit,
        create: createAudit,
      },
      shopSettings: { findUnique: findUniqueShop },
      service: { count: serviceCount },
      product: { count: productCount },
      $transaction: transaction,
    };
  });

  it('replays idempotent key when fingerprint matches', async () => {
    findUniqueAudit.mockResolvedValue({
      id: 'audit_old',
      shopIdSnapshot: 'shop_1',
      action: 'REBUILD',
      actorUserId: 'op1',
      outcome: 'QUEUED',
      errorCode: null,
      afterState: { catalogueVersion: 4 },
    });

    const result = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'REBUILD', idempotencyKey: KEY },
      },
      { db: db as never },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.replayed).toBe(true);
      expect(result.data.actionId).toBe('audit_old');
    }
    expect(scheduleCatalogueRebuild).not.toHaveBeenCalled();
  });

  it('rejects idempotency key reuse with mismatched fingerprint', async () => {
    findUniqueAudit.mockResolvedValue({
      id: 'audit_old',
      shopIdSnapshot: 'shop_1',
      action: 'REBUILD',
      actorUserId: 'other',
      outcome: 'QUEUED',
      errorCode: null,
      afterState: { catalogueVersion: 4 },
    });

    const result = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'REBUILD', idempotencyKey: KEY },
      },
      { db: db as never },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
      expect(result.actionId).toBeUndefined();
    }
  });

  it('queues REBUILD immediately without calling processShop', async () => {
    const now = new Date('2026-09-06T12:00:00.000Z');
    const result = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'REBUILD', idempotencyKey: KEY },
      },
      { db: db as never, now },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.httpStatus).toBe(202);
      expect(result.data.queued).toBe(true);
      expect(result.data.outcome).toBe('QUEUED');
    }
    expect(scheduleCatalogueRebuild).toHaveBeenCalledWith(
      'shop_1',
      expect.anything(),
      now,
      { due: 'immediate' },
    );
    expect(processShop).not.toHaveBeenCalled();
  });

  it('rejects ineligible and insufficient catalogue', async () => {
    findUniqueShop.mockResolvedValue(
      eligibleShop({ retailEnabled: false, stripeConnectChargesEnabled: false }),
    );
    const ineligible = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'REBUILD', idempotencyKey: KEY },
      },
      { db: db as never },
    );
    expect(ineligible.ok).toBe(false);
    if (!ineligible.ok) expect(ineligible.error.code).toBe('INELIGIBLE');

    findUniqueShop.mockResolvedValue(eligibleShop());
    productCount.mockResolvedValue(1);
    const insufficient = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'REBUILD', idempotencyKey: KEY2 },
      },
      { db: db as never },
    );
    expect(insufficient.ok).toBe(false);
    if (!insufficient.ok) expect(insufficient.error.code).toBe('INSUFFICIENT_CATALOGUE');
  });

  it('enforces shared rebuild/retry cooldown via atomic claim', async () => {
    const now = new Date('2026-09-06T12:00:00.000Z');
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(
        buildTx({
          claimCount: 0,
          lastBuildActionAt: new Date('2026-09-06T11:58:00.000Z'),
          control: {
            railPaused: false,
            railPausedAt: null,
            lastBuildActionAt: new Date('2026-09-06T11:58:00.000Z'),
          },
        }),
      ),
    );
    const result = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'RETRY_FAILED', idempotencyKey: KEY },
      },
      { db: db as never, now },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.httpStatus).toBe(429);
      expect(result.error.code).toBe('COOLDOWN');
      expect(result.error.retryAfterSeconds).toBeGreaterThan(0);
    }
    expect(retryFailedCatalogueRebuild).not.toHaveBeenCalled();
  });

  it('retries failed build and returns conflict when CAS misses', async () => {
    const now = new Date('2026-09-06T12:00:00.000Z');
    retryFailedCatalogueRebuild.mockResolvedValue({ ok: true });
    const ok = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'RETRY_FAILED', idempotencyKey: KEY },
      },
      { db: db as never, now },
    );
    expect(ok.ok).toBe(true);

    retryFailedCatalogueRebuild.mockResolvedValue({ ok: false, reason: 'conflict' });
    const conflict = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'RETRY_FAILED', idempotencyKey: KEY2 },
      },
      { db: db as never, now },
    );
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.error.code).toBe('CONFLICT');
  });

  it('pauses rails with conflict when already paused', async () => {
    const now = new Date('2026-09-06T12:00:00.000Z');
    const paused = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: {
          action: 'PAUSE_RAIL',
          idempotencyKey: KEY,
          reason: 'Emergency pause',
        },
      },
      { db: db as never, now },
    );
    expect(paused.ok).toBe(true);
    if (paused.ok) {
      expect(paused.httpStatus).toBe(200);
      expect(paused.data.outcome).toBe('APPLIED');
    }

    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(buildTx({ pauseCount: 0, control: { railPaused: true, railPausedAt: now } })),
    );

    const already = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: {
          action: 'PAUSE_RAIL',
          idempotencyKey: KEY2,
          reason: 'Again',
        },
      },
      { db: db as never, now },
    );
    expect(already.ok).toBe(false);
    if (!already.ok) expect(already.error.code).toBe('ALREADY_PAUSED');
  });

  it('rejects demo shops as NOT_FOUND without scheduling', async () => {
    const result = await executeOpsAction(
      {
        shopId: 'demo-shop',
        operator,
        request: { action: 'REBUILD', idempotencyKey: KEY },
      },
      { db: db as never },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND');
    expect(scheduleCatalogueRebuild).not.toHaveBeenCalled();
  });
});
