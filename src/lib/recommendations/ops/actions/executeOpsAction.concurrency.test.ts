import { describe, expect, it } from 'vitest';
import { RecommendationJobStatus } from '@prisma/client';

import {
  retryFailedCatalogueRebuild,
  scheduleCatalogueRebuild,
} from '@/lib/recommendations/scheduleCatalogueRebuild';

import { executeOpsAction } from './executeOpsAction';
import { createOpsPrismaSimulator } from './opsPrismaSimulator';

const KEY_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const KEY_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const KEY_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const operator = { userId: 'op1', email: 'hello@kersivo.co.uk' };
const operator2 = { userId: 'op2', email: 'ops2@kersivo.co.uk' };
const now = new Date('2026-09-06T12:00:00.000Z');

describe('executeOpsAction concurrency (stateful simulator)', () => {
  it('1. two concurrent REBUILD requests: one QUEUED, one COOLDOWN, catalogue bumped once', async () => {
    const sim = createOpsPrismaSimulator({
      state: { catalogueVersion: 3, jobStatus: RecommendationJobStatus.IDLE },
    });

    const [a, b] = await Promise.all([
      executeOpsAction(
        {
          shopId: 'shop_1',
          operator,
          request: { action: 'REBUILD', idempotencyKey: KEY_A },
        },
        { db: sim.db as never, now },
      ),
      executeOpsAction(
        {
          shopId: 'shop_1',
          operator,
          request: { action: 'REBUILD', idempotencyKey: KEY_B },
        },
        { db: sim.db as never, now },
      ),
    ]);

    const outcomes = [a, b];
    const queued = outcomes.filter((r) => r.ok && r.data.outcome === 'QUEUED');
    const cooldown = outcomes.filter((r) => !r.ok && r.error.code === 'COOLDOWN');
    expect(queued).toHaveLength(1);
    expect(cooldown).toHaveLength(1);
    expect(sim.states.get('shop_1')?.catalogueVersion).toBe(4);
    expect(sim.controls.get('shop_1')?.lastBuildActionAt?.getTime()).toBe(now.getTime());
  });

  it('2. concurrent REBUILD and RETRY_FAILED share one cooldown claim', async () => {
    const sim = createOpsPrismaSimulator({
      state: {
        catalogueVersion: 5,
        pendingCatalogueVersion: 5,
        jobStatus: RecommendationJobStatus.FAILED,
        attemptCount: 2,
      },
    });

    const [rebuild, retry] = await Promise.all([
      executeOpsAction(
        {
          shopId: 'shop_1',
          operator,
          request: { action: 'REBUILD', idempotencyKey: KEY_A },
        },
        { db: sim.db as never, now },
      ),
      executeOpsAction(
        {
          shopId: 'shop_1',
          operator,
          request: { action: 'RETRY_FAILED', idempotencyKey: KEY_B },
        },
        { db: sim.db as never, now },
      ),
    ]);

    const accepted = [rebuild, retry].filter((r) => r.ok);
    const rejected = [rebuild, retry].filter((r) => !r.ok && r.error.code === 'COOLDOWN');
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it('3. two concurrent PAUSE_RAIL: one APPLIED, one conflict', async () => {
    const sim = createOpsPrismaSimulator({ control: null });

    const [a, b] = await Promise.all([
      executeOpsAction(
        {
          shopId: 'shop_1',
          operator,
          request: { action: 'PAUSE_RAIL', idempotencyKey: KEY_A, reason: 'Pause A' },
        },
        { db: sim.db as never, now },
      ),
      executeOpsAction(
        {
          shopId: 'shop_1',
          operator,
          request: { action: 'PAUSE_RAIL', idempotencyKey: KEY_B, reason: 'Pause B' },
        },
        { db: sim.db as never, now },
      ),
    ]);

    const applied = [a, b].filter((r) => r.ok && r.data.outcome === 'APPLIED');
    const conflict = [a, b].filter((r) => !r.ok && r.error.code === 'ALREADY_PAUSED');
    expect(applied).toHaveLength(1);
    expect(conflict).toHaveLength(1);
    expect(sim.controls.get('shop_1')?.railPaused).toBe(true);

    const conflictAudit = [...sim.actions.values()].find((x) => x.outcome === 'CONFLICT');
    expect(conflictAudit?.errorCode).toBe('ALREADY_PAUSED');
  });

  it('4. two concurrent RESUME_RAIL: one APPLIED, one conflict', async () => {
    const sim = createOpsPrismaSimulator({
      control: {
        railPaused: true,
        railPausedAt: new Date('2026-09-06T11:00:00.000Z'),
        railPausedByUserId: 'op1',
        railPauseReason: 'Earlier',
      },
    });

    const [a, b] = await Promise.all([
      executeOpsAction(
        {
          shopId: 'shop_1',
          operator,
          request: { action: 'RESUME_RAIL', idempotencyKey: KEY_A, reason: 'Resume A' },
        },
        { db: sim.db as never, now },
      ),
      executeOpsAction(
        {
          shopId: 'shop_1',
          operator,
          request: { action: 'RESUME_RAIL', idempotencyKey: KEY_B, reason: 'Resume B' },
        },
        { db: sim.db as never, now },
      ),
    ]);

    const applied = [a, b].filter((r) => r.ok && r.data.outcome === 'APPLIED');
    const conflict = [a, b].filter((r) => !r.ok && r.error.code === 'ALREADY_ACTIVE');
    expect(applied).toHaveLength(1);
    expect(conflict).toHaveLength(1);
    expect(sim.controls.get('shop_1')?.railPaused).toBe(false);
  });

  it('5. identical idempotency fingerprint replays stored response', async () => {
    const sim = createOpsPrismaSimulator();
    const first = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'REBUILD', idempotencyKey: KEY_A, reason: 'first' },
      },
      { db: sim.db as never, now },
    );
    expect(first.ok).toBe(true);

    const second = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'REBUILD', idempotencyKey: KEY_A, reason: 'different reason ok' },
      },
      { db: sim.db as never, now },
    );
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.data.replayed).toBe(true);
      expect(second.data.actionId).toBe(first.data.actionId);
    }
    expect(sim.states.get('shop_1')?.catalogueVersion).toBe(4);
  });

  it('6. same key with another shop returns IDEMPOTENCY_KEY_REUSED', async () => {
    const sim = createOpsPrismaSimulator();
    await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'REBUILD', idempotencyKey: KEY_A },
      },
      { db: sim.db as never, now },
    );

    const reused = await executeOpsAction(
      {
        shopId: 'shop_other',
        operator,
        request: { action: 'REBUILD', idempotencyKey: KEY_A },
      },
      { db: sim.db as never, now },
    );
    expect(reused.ok).toBe(false);
    if (!reused.ok) {
      expect(reused.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
      expect(reused.actionId).toBeUndefined();
    }
  });

  it('7. same key with another action returns IDEMPOTENCY_KEY_REUSED', async () => {
    const sim = createOpsPrismaSimulator();
    await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'REBUILD', idempotencyKey: KEY_A },
      },
      { db: sim.db as never, now },
    );

    const reused = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'RETRY_FAILED', idempotencyKey: KEY_A },
      },
      { db: sim.db as never, now },
    );
    expect(reused.ok).toBe(false);
    if (!reused.ok) expect(reused.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('8. same key with another actor returns IDEMPOTENCY_KEY_REUSED', async () => {
    const sim = createOpsPrismaSimulator();
    await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'REBUILD', idempotencyKey: KEY_A },
      },
      { db: sim.db as never, now },
    );

    const reused = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator: operator2,
        request: { action: 'REBUILD', idempotencyKey: KEY_A },
      },
      { db: sim.db as never, now },
    );
    expect(reused.ok).toBe(false);
    if (!reused.ok) expect(reused.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('9a. P2002 recovery mismatch returns IDEMPOTENCY_KEY_REUSED after real throw', async () => {
    const sim = createOpsPrismaSimulator({ state: { catalogueVersion: 3 } });
    const winner = await sim.db.recommendationOpsAction.create({
      data: {
        idempotencyKey: KEY_C,
        shopId: 'shop_1',
        shopIdSnapshot: 'shop_1',
        actorUserId: 'winner',
        actorEmail: 'winner@kersivo.co.uk',
        action: 'REBUILD',
        outcome: 'QUEUED',
        reason: null,
        errorCode: null,
        beforeState: null,
        afterState: { catalogueVersion: 4 },
      },
    });
    const winnerSnapshot = { ...winner };
    sim.hideActionByKey.add(KEY_C);

    const result = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'REBUILD', idempotencyKey: KEY_C },
      },
      { db: sim.db as never, now },
    );

    expect(sim.p2002ThrownCount).toBe(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
      expect(result.actionId).toBeUndefined();
    }
    expect(sim.actions.get(KEY_C)).toEqual(winnerSnapshot);
    expect(sim.states.get('shop_1')?.catalogueVersion).toBe(3);
    // Cooldown claim must not survive rollback (no control row or null timestamp).
    expect(sim.controls.get('shop_1')?.lastBuildActionAt ?? null).toBeNull();
  });

  it('9b. P2002 recovery match replays winning response once', async () => {
    const sim = createOpsPrismaSimulator({ state: { catalogueVersion: 3 } });
    const winner = await sim.db.recommendationOpsAction.create({
      data: {
        idempotencyKey: KEY_C,
        shopId: 'shop_1',
        shopIdSnapshot: 'shop_1',
        actorUserId: operator.userId,
        actorEmail: operator.email,
        action: 'REBUILD',
        outcome: 'QUEUED',
        reason: null,
        errorCode: null,
        beforeState: null,
        afterState: { catalogueVersion: 4, jobStatus: 'PENDING' },
      },
    });
    sim.hideActionByKey.add(KEY_C);

    const result = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'REBUILD', idempotencyKey: KEY_C },
      },
      { db: sim.db as never, now },
    );

    expect(sim.p2002ThrownCount).toBe(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.replayed).toBe(true);
      expect(result.data.actionId).toBe(winner.id);
      expect(result.data.outcome).toBe('QUEUED');
    }
    expect(sim.states.get('shop_1')?.catalogueVersion).toBe(3);
    expect([...sim.actions.values()].filter((a) => a.idempotencyKey === KEY_C)).toHaveLength(1);
  });

  it('audit ALREADY_PAUSED afterState reflects railPaused true', async () => {
    const sim = createOpsPrismaSimulator({
      control: {
        railPaused: true,
        railPausedAt: new Date('2026-09-06T11:00:00.000Z'),
        railPausedByUserId: 'op1',
        railPauseReason: 'Earlier',
      },
    });
    const result = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'PAUSE_RAIL', idempotencyKey: KEY_A, reason: 'Again' },
      },
      { db: sim.db as never, now },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ALREADY_PAUSED');
    const audit = [...sim.actions.values()].find((a) => a.errorCode === 'ALREADY_PAUSED');
    expect(audit?.afterState).toMatchObject({ railPaused: true });
  });

  it('audit ALREADY_ACTIVE afterState reflects railPaused false', async () => {
    const sim = createOpsPrismaSimulator({ control: null });
    const result = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'RESUME_RAIL', idempotencyKey: KEY_A, reason: 'Resume' },
      },
      { db: sim.db as never, now },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ALREADY_ACTIVE');
    const audit = [...sim.actions.values()].find((a) => a.errorCode === 'ALREADY_ACTIVE');
    expect(audit?.afterState).toMatchObject({ railPaused: false });
  });

  it('audit RETRY conflict afterState reflects authoritative job state', async () => {
    const sim = createOpsPrismaSimulator({
      state: {
        catalogueVersion: 5,
        pendingCatalogueVersion: 5,
        jobStatus: RecommendationJobStatus.IDLE,
        attemptCount: 0,
      },
    });
    const result = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'RETRY_FAILED', idempotencyKey: KEY_A },
      },
      { db: sim.db as never, now },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONFLICT');
    const audit = [...sim.actions.values()].find((a) => a.errorCode === 'CONFLICT');
    expect(audit?.afterState).toMatchObject({
      jobStatus: RecommendationJobStatus.IDLE,
      catalogueVersion: 5,
      pendingCatalogueVersion: 5,
    });
  });

  it('cooldown audit retains retryAfterSeconds with snapshot', async () => {
    const sim = createOpsPrismaSimulator({
      control: {
        lastBuildActionAt: new Date('2026-09-06T11:58:00.000Z'),
      },
      state: { catalogueVersion: 3, jobStatus: RecommendationJobStatus.IDLE },
    });
    const result = await executeOpsAction(
      {
        shopId: 'shop_1',
        operator,
        request: { action: 'REBUILD', idempotencyKey: KEY_A },
      },
      { db: sim.db as never, now },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('COOLDOWN');
      expect(result.error.retryAfterSeconds).toBeGreaterThan(0);
    }
    const audit = [...sim.actions.values()].find((a) => a.errorCode === 'COOLDOWN');
    expect(audit?.afterState).toMatchObject({
      retryAfterSeconds: expect.any(Number),
      catalogueVersion: 3,
      railPaused: false,
    });
  });
});

describe('retryFailedCatalogueRebuild lock matrix', () => {
  it('10. rejects malformed partial lock tuples', async () => {
    const nowLocal = new Date('2026-09-06T12:00:00.000Z');
    const base = {
      catalogueVersion: 4,
      pendingCatalogueVersion: 4,
      jobStatus: RecommendationJobStatus.FAILED,
      attemptCount: 1,
    };

    const cases = [
      {
        processingLockId: 'lock1',
        processingCatalogueVersion: null,
        processingLockExpiresAt: null,
      },
      {
        processingLockId: null,
        processingCatalogueVersion: 4,
        processingLockExpiresAt: null,
      },
      {
        processingLockId: null,
        processingCatalogueVersion: null,
        processingLockExpiresAt: new Date('2026-09-06T11:00:00.000Z'),
      },
      {
        processingLockId: 'lock1',
        processingCatalogueVersion: 4,
        processingLockExpiresAt: null,
      },
    ];

    for (const lock of cases) {
      const sim = createOpsPrismaSimulator({ state: { ...base, ...lock } });
      const result = await retryFailedCatalogueRebuild('shop_1', sim.db as never, nowLocal);
      expect(result).toEqual({ ok: false, reason: 'conflict' });
    }
  });

  it('11. expired complete lock tuple can be cleared and retried', async () => {
    const nowLocal = new Date('2026-09-06T12:00:00.000Z');
    const sim = createOpsPrismaSimulator({
      state: {
        catalogueVersion: 4,
        pendingCatalogueVersion: 4,
        jobStatus: RecommendationJobStatus.FAILED,
        attemptCount: 3,
        processingLockId: 'lock-old',
        processingCatalogueVersion: 4,
        processingLockExpiresAt: new Date('2026-09-06T11:59:00.000Z'),
      },
    });

    const result = await retryFailedCatalogueRebuild('shop_1', sim.db as never, nowLocal);
    expect(result).toEqual({ ok: true });
    const state = sim.states.get('shop_1')!;
    expect(state.jobStatus).toBe(RecommendationJobStatus.PENDING);
    expect(state.pendingCatalogueVersion).toBe(4);
    expect(state.catalogueVersion).toBe(4);
    expect(state.attemptCount).toBe(0);
    expect(state.rebuildAfter?.getTime()).toBe(nowLocal.getTime());
    expect(state.processingLockId).toBeNull();
    expect(state.processingCatalogueVersion).toBeNull();
    expect(state.processingLockExpiresAt).toBeNull();
  });

  it('12. a live lock cannot be stolen', async () => {
    const nowLocal = new Date('2026-09-06T12:00:00.000Z');
    const sim = createOpsPrismaSimulator({
      state: {
        catalogueVersion: 4,
        pendingCatalogueVersion: 4,
        jobStatus: RecommendationJobStatus.FAILED,
        attemptCount: 1,
        processingLockId: 'live',
        processingCatalogueVersion: 4,
        processingLockExpiresAt: new Date('2026-09-06T12:05:00.000Z'),
      },
    });

    const result = await retryFailedCatalogueRebuild('shop_1', sim.db as never, nowLocal);
    expect(result).toEqual({ ok: false, reason: 'conflict' });
    expect(sim.states.get('shop_1')?.processingLockId).toBe('live');
  });

  it('13. concurrent retry state change loses the full CAS', async () => {
    const nowLocal = new Date('2026-09-06T12:00:00.000Z');
    const sim = createOpsPrismaSimulator({
      state: {
        catalogueVersion: 4,
        pendingCatalogueVersion: 4,
        jobStatus: RecommendationJobStatus.FAILED,
        attemptCount: 2,
      },
    });

    const originalFind = sim.db.shopRecommendationState.findUnique.bind(
      sim.db.shopRecommendationState,
    );
    let observedOnce = false;
    sim.db.shopRecommendationState.findUnique = async (args: {
      where: { shopId: string };
      select?: Record<string, boolean>;
    }) => {
      const row = await originalFind(args);
      if (!observedOnce && row) {
        observedOnce = true;
        // Concurrent mutation after observe, before CAS
        const state = sim.states.get('shop_1')!;
        state.attemptCount = 9;
      }
      return row;
    };

    const result = await retryFailedCatalogueRebuild('shop_1', sim.db as never, nowLocal);
    expect(result).toEqual({ ok: false, reason: 'conflict' });
    expect(sim.states.get('shop_1')?.attemptCount).toBe(9);
    expect(sim.states.get('shop_1')?.jobStatus).toBe(RecommendationJobStatus.FAILED);
  });

  it('clear lock (all null) can retry', async () => {
    const nowLocal = new Date('2026-09-06T12:00:00.000Z');
    const sim = createOpsPrismaSimulator({
      state: {
        catalogueVersion: 7,
        pendingCatalogueVersion: 7,
        jobStatus: RecommendationJobStatus.FAILED,
        attemptCount: 1,
      },
    });
    const result = await retryFailedCatalogueRebuild('shop_1', sim.db as never, nowLocal);
    expect(result).toEqual({ ok: true });
  });

  it('rejects pending !== catalogueVersion', async () => {
    const sim = createOpsPrismaSimulator({
      state: {
        catalogueVersion: 7,
        pendingCatalogueVersion: 6,
        jobStatus: RecommendationJobStatus.FAILED,
      },
    });
    expect(await retryFailedCatalogueRebuild('shop_1', sim.db as never, now)).toEqual({
      ok: false,
      reason: 'conflict',
    });
  });
});

describe('scheduleCatalogueRebuild with simulator', () => {
  it('bumps once under concurrent operator rebuilds (via executeOpsAction)', async () => {
    const sim = createOpsPrismaSimulator({ state: { catalogueVersion: 10 } });
    await scheduleCatalogueRebuild('shop_1', sim.db as never, now, { due: 'immediate' });
    expect(sim.states.get('shop_1')?.catalogueVersion).toBe(11);
  });
});
