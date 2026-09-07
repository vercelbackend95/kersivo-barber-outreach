/**
 * Deterministic in-memory Prisma stub for ops action concurrency tests.
 * Serializes $transaction through a promise chain; updateMany applies predicates.
 */

import { Prisma as PrismaNS, RecommendationJobStatus } from '@prisma/client';

export type SimControl = {
  shopId: string;
  railPaused: boolean;
  railPausedAt: Date | null;
  railPausedByUserId: string | null;
  railPauseReason: string | null;
  lastBuildActionAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SimState = {
  shopId: string;
  catalogueVersion: number;
  pendingCatalogueVersion: number | null;
  jobStatus: RecommendationJobStatus;
  rebuildAfter: Date | null;
  attemptCount: number;
  nextAttemptAt: Date | null;
  lastErrorCode: string | null;
  lastErrorAt: Date | null;
  processingLockId: string | null;
  processingCatalogueVersion: number | null;
  processingLockExpiresAt: Date | null;
  taxonomyVersion: string;
};

export type SimAction = {
  id: string;
  idempotencyKey: string;
  shopId: string | null;
  shopIdSnapshot: string;
  actorUserId: string;
  actorEmail: string;
  action: string;
  outcome: string;
  reason: string | null;
  errorCode: string | null;
  beforeState: unknown;
  afterState: unknown;
  createdAt: Date;
};

export type SimShop = {
  id: string;
  shopPaidAt: Date | null;
  smsRemindersEnabled: boolean;
  retailEnabled: boolean;
  stripeConnectAccountId: string | null;
  stripeConnectChargesEnabled: boolean;
};

function p2002(): never {
  throw new PrismaNS.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function matchesExact<T>(observed: T, expected: T): boolean {
  if (observed instanceof Date && expected instanceof Date) {
    return observed.getTime() === expected.getTime();
  }
  return observed === expected;
}

function matchWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  for (const [key, pred] of Object.entries(where)) {
    if (key === 'OR' && Array.isArray(pred)) {
      if (!pred.some((branch) => matchWhere(row, branch as Record<string, unknown>))) {
        return false;
      }
      continue;
    }
    const value = row[key];
    if (pred && typeof pred === 'object' && !(pred instanceof Date) && !Array.isArray(pred)) {
      const p = pred as Record<string, unknown>;
      if ('not' in p) {
        if (p.not === null) {
          if (value == null) return false;
        } else if (value === p.not) {
          return false;
        }
        continue;
      }
      if ('lt' in p) {
        const lt = p.lt as Date | number;
        if (value == null) return false;
        if (value instanceof Date && lt instanceof Date) {
          if (!(value.getTime() < lt.getTime())) return false;
        } else if (!(Number(value) < Number(lt))) {
          return false;
        }
        continue;
      }
      if ('in' in p && Array.isArray(p.in)) {
        if (!p.in.includes(value)) return false;
        continue;
      }
    }
    if (!matchesExact(value, pred)) return false;
  }
  return true;
}

let idSeq = 0;
function nextId(prefix: string): string {
  idSeq += 1;
  return `${prefix}_${idSeq}`;
}

export function createOpsPrismaSimulator(opts?: {
  shop?: Partial<SimShop>;
  state?: Partial<SimState>;
  control?: Partial<SimControl> | null;
  serviceCount?: number;
  productCount?: number;
}) {
  idSeq = 0;
  const shopId = opts?.shop?.id ?? 'shop_1';
  const shops = new Map<string, SimShop>([
    [
      shopId,
      {
        id: shopId,
        shopPaidAt: new Date('2026-01-01'),
        smsRemindersEnabled: true,
        retailEnabled: true,
        stripeConnectAccountId: 'acct_1',
        stripeConnectChargesEnabled: true,
        ...opts?.shop,
      },
    ],
  ]);

  const states = new Map<string, SimState>();
  if (opts?.state !== null) {
    states.set(shopId, {
      shopId,
      catalogueVersion: 3,
      pendingCatalogueVersion: null,
      jobStatus: RecommendationJobStatus.IDLE,
      rebuildAfter: null,
      attemptCount: 0,
      nextAttemptAt: null,
      lastErrorCode: null,
      lastErrorAt: null,
      processingLockId: null,
      processingCatalogueVersion: null,
      processingLockExpiresAt: null,
      taxonomyVersion: '2026-09-v2',
      ...opts?.state,
    });
  }

  const controls = new Map<string, SimControl>();
  if (opts?.control !== null && opts?.control !== undefined) {
    controls.set(shopId, {
      shopId,
      railPaused: false,
      railPausedAt: null,
      railPausedByUserId: null,
      railPauseReason: null,
      lastBuildActionAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      ...opts.control,
    });
  }

  const actions = new Map<string, SimAction>();
  const actionsById = new Map<string, SimAction>();
  let serviceCount = opts?.serviceCount ?? 2;
  let productCount = opts?.productCount ?? 3;

  /** Keys hidden from all findUnique clients (root + in-tx) until cleared. */
  const hideActionByKey = new Set<string>();
  const hooks = {
    p2002ThrownCount: 0,
  };

  let txChain: Promise<unknown> = Promise.resolve();

  function controlApi() {
    return {
      async findUnique({ where, select }: { where: { shopId: string }; select?: Record<string, boolean> }) {
        const row = controls.get(where.shopId) ?? null;
        if (!row || !select) return row;
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(select)) {
          if (v) out[k] = (row as Record<string, unknown>)[k];
        }
        return out;
      },
      async upsert({
        where,
        create,
        update,
      }: {
        where: { shopId: string };
        create: Partial<SimControl> & { shopId: string };
        update: Partial<SimControl>;
      }) {
        const existing = controls.get(where.shopId);
        if (!existing) {
          const row: SimControl = {
            shopId: create.shopId,
            railPaused: create.railPaused ?? false,
            railPausedAt: create.railPausedAt ?? null,
            railPausedByUserId: create.railPausedByUserId ?? null,
            railPauseReason: create.railPauseReason ?? null,
            lastBuildActionAt: create.lastBuildActionAt ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          controls.set(where.shopId, row);
          return row;
        }
        Object.assign(existing, update, { updatedAt: new Date() });
        return existing;
      },
      async update({ where, data }: { where: { shopId: string }; data: Partial<SimControl> }) {
        const row = controls.get(where.shopId);
        if (!row) throw new Error('control missing');
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
      async updateMany({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<SimControl>;
      }) {
        const shop = String(where.shopId);
        const row = controls.get(shop);
        if (!row || !matchWhere(row as unknown as Record<string, unknown>, where)) {
          return { count: 0 };
        }
        Object.assign(row, data, { updatedAt: new Date() });
        return { count: 1 };
      },
    };
  }

  function stateApi() {
    return {
      async findUnique({
        where,
        select,
      }: {
        where: { shopId: string };
        select?: Record<string, boolean>;
      }) {
        const row = states.get(where.shopId) ?? null;
        if (!row || !select) return row;
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(select)) {
          if (v) out[k] = (row as Record<string, unknown>)[k];
        }
        return out;
      },
      async findUniqueOrThrow({
        where,
        select,
      }: {
        where: { shopId: string };
        select?: Record<string, boolean>;
      }) {
        const row = await this.findUnique({ where, select });
        if (!row) throw new Error('state missing');
        return row;
      },
      async upsert({
        where,
        create,
      }: {
        where: { shopId: string };
        create: Partial<SimState> & { shopId: string };
        update: Record<string, unknown>;
      }) {
        if (!states.has(where.shopId)) {
          states.set(where.shopId, {
            catalogueVersion: 0,
            pendingCatalogueVersion: null,
            jobStatus: RecommendationJobStatus.IDLE,
            rebuildAfter: null,
            attemptCount: 0,
            nextAttemptAt: null,
            lastErrorCode: null,
            lastErrorAt: null,
            processingLockId: null,
            processingCatalogueVersion: null,
            processingLockExpiresAt: null,
            taxonomyVersion: create.taxonomyVersion ?? '2026-09-v2',
            ...create,
            shopId: create.shopId,
          });
        }
        return states.get(where.shopId);
      },
      async updateMany({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) {
        const shop = String(where.shopId);
        const row = states.get(shop);
        if (!row || !matchWhere(row as unknown as Record<string, unknown>, where)) {
          return { count: 0 };
        }
        Object.assign(row, data);
        return { count: 1 };
      },
    };
  }

  function actionApi() {
    return {
      async findUnique({ where }: { where: { idempotencyKey: string } }) {
        if (hideActionByKey.has(where.idempotencyKey)) return null;
        return actions.get(where.idempotencyKey) ?? null;
      },
      async create({ data }: { data: Omit<SimAction, 'id' | 'createdAt'> & { id?: string } }) {
        if (actions.has(data.idempotencyKey)) {
          hooks.p2002ThrownCount += 1;
          // Winning row becomes visible to post-rollback recovery lookups.
          hideActionByKey.delete(data.idempotencyKey);
          p2002();
        }
        const row: SimAction = {
          id: data.id ?? nextId('audit'),
          idempotencyKey: data.idempotencyKey,
          shopId: data.shopId,
          shopIdSnapshot: data.shopIdSnapshot,
          actorUserId: data.actorUserId,
          actorEmail: data.actorEmail,
          action: data.action,
          outcome: data.outcome,
          reason: data.reason ?? null,
          errorCode: data.errorCode ?? null,
          beforeState: data.beforeState,
          afterState: data.afterState,
          createdAt: new Date(),
        };
        actions.set(row.idempotencyKey, row);
        actionsById.set(row.id, row);
        return row;
      },
    };
  }

  type SimClient = {
    recommendationOpsAction: ReturnType<typeof actionApi>;
    shopRecommendationControl: ReturnType<typeof controlApi>;
    shopRecommendationState: ReturnType<typeof stateApi>;
    shopSettings: {
      findUnique: (args: {
        where: { id: string };
        select?: Record<string, unknown>;
      }) => Promise<Record<string, unknown> | null>;
    };
    service: { count: () => Promise<number> };
    product: { count: () => Promise<number> };
    $transaction: <T>(fn: (tx: SimClient) => Promise<T>) => Promise<T>;
  };

  function buildClient(): SimClient {
    const control = controlApi();
    const state = stateApi();
    const action = actionApi();
    const client: SimClient = {
      recommendationOpsAction: action,
      shopRecommendationControl: control,
      shopRecommendationState: state,
      shopSettings: {
        async findUnique({
          where,
          select,
        }: {
          where: { id: string };
          select?: Record<string, unknown>;
        }) {
          const shop = shops.get(where.id);
          if (!shop) return null;
          const base: Record<string, unknown> = { ...shop };
          if (select && typeof select === 'object') {
            if ('recommendationState' in select) {
              base.recommendationState = states.get(shop.id) ?? null;
            }
            if ('recommendationControl' in select) {
              base.recommendationControl = controls.get(shop.id) ?? null;
            }
          }
          return base;
        },
      },
      service: {
        async count() {
          return serviceCount;
        },
      },
      product: {
        async count() {
          return productCount;
        },
      },
      async $transaction<T>(fn: (tx: SimClient) => Promise<T>): Promise<T> {
        const run = txChain.then(async () => {
          const controlSnap = new Map(
            [...controls.entries()].map(([k, v]) => [k, { ...v }]),
          );
          const stateSnap = new Map(
            [...states.entries()].map(([k, v]) => [k, { ...v }]),
          );
          const actionSnap = new Map(
            [...actions.entries()].map(([k, v]) => [k, { ...v }]),
          );
          const actionIdSnap = new Map(
            [...actionsById.entries()].map(([k, v]) => [k, { ...v }]),
          );
          try {
            const tx = buildClient();
            tx.$transaction = async <U>(inner: (t: SimClient) => Promise<U>) =>
              inner(tx);
            return await fn(tx);
          } catch (err) {
            controls.clear();
            for (const [k, v] of controlSnap) controls.set(k, v);
            states.clear();
            for (const [k, v] of stateSnap) states.set(k, v);
            actions.clear();
            for (const [k, v] of actionSnap) actions.set(k, v);
            actionsById.clear();
            for (const [k, v] of actionIdSnap) actionsById.set(k, v);
            throw err;
          }
        });
        txChain = run.then(
          () => undefined,
          () => undefined,
        );
        return run as Promise<T>;
      },
    };
    return client;
  }

  const db = buildClient();

  return {
    db,
    controls,
    states,
    actions,
    hideActionByKey,
    get p2002ThrownCount() {
      return hooks.p2002ThrownCount;
    },
    setServiceCount(n: number) {
      serviceCount = n;
    },
    setProductCount(n: number) {
      productCount = n;
    },
  };
}
