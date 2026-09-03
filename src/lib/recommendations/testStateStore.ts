import {
  RecommendationJobStatus,
  RecommendationSetStatus,
  type Prisma,
} from '@prisma/client';

export type InMemoryShopState = {
  shopId: string;
  catalogueVersion: number;
  pendingCatalogueVersion: number | null;
  processingLockId: string | null;
  processingLockExpiresAt: Date | null;
  processingCatalogueVersion: number | null;
  jobStatus: RecommendationJobStatus;
  rebuildAfter: Date | null;
  attemptCount: number;
  nextAttemptAt: Date | null;
  lastErrorCode: string | null;
  lastErrorAt: Date | null;
};

export type InMemoryRecommendationSet = {
  id: string;
  status: RecommendationSetStatus;
  errorCode: string | null;
  buildFinishedAt: Date | null;
};

function matchesEq<T>(actual: T, expected: T | undefined): boolean {
  return expected === undefined || actual === expected;
}

function matchesWhere(
  state: InMemoryShopState,
  where: Prisma.ShopRecommendationStateWhereInput,
): boolean {
  if (!matchesEq(state.shopId, where.shopId as string | undefined)) return false;
  if (!matchesEq(state.processingLockId, where.processingLockId as string | null | undefined)) {
    return false;
  }
  if (
    !matchesEq(
      state.processingCatalogueVersion,
      where.processingCatalogueVersion as number | null | undefined,
    )
  ) {
    return false;
  }
  if (!matchesEq(state.catalogueVersion, where.catalogueVersion as number | undefined)) {
    return false;
  }
  if (
    !matchesEq(
      state.pendingCatalogueVersion,
      where.pendingCatalogueVersion as number | null | undefined,
    )
  ) {
    return false;
  }

  if (where.attemptCount && typeof where.attemptCount === 'object' && 'lt' in where.attemptCount) {
    if (state.attemptCount >= (where.attemptCount.lt as number)) return false;
  }

  if (where.nextAttemptAt && typeof where.nextAttemptAt === 'object' && 'lte' in where.nextAttemptAt) {
    const bound = where.nextAttemptAt.lte as Date;
    if (state.nextAttemptAt === null || state.nextAttemptAt > bound) return false;
  }

  if (
    where.pendingCatalogueVersion &&
    typeof where.pendingCatalogueVersion === 'object' &&
    'not' in where.pendingCatalogueVersion
  ) {
    if (state.pendingCatalogueVersion === null) return false;
  }

  if (where.rebuildAfter && typeof where.rebuildAfter === 'object' && 'lte' in where.rebuildAfter) {
    const bound = where.rebuildAfter.lte as Date;
    if (state.rebuildAfter === null || state.rebuildAfter > bound) return false;
  }

  if (where.jobStatus && !matchesEq(state.jobStatus, where.jobStatus as RecommendationJobStatus)) {
    return false;
  }

  if (where.OR) {
    const now = new Date();
    const orMatch = where.OR.some((clause) => {
      if (typeof clause !== 'object' || !clause) return false;
      if ('processingLockExpiresAt' in clause && clause.processingLockExpiresAt === null) {
        return state.processingLockExpiresAt === null;
      }
      if (
        'processingLockExpiresAt' in clause &&
        typeof clause.processingLockExpiresAt === 'object' &&
        clause.processingLockExpiresAt &&
        'lt' in clause.processingLockExpiresAt
      ) {
        return (
          state.processingLockExpiresAt !== null &&
          state.processingLockExpiresAt < (clause.processingLockExpiresAt.lt as Date)
        );
      }
      return false;
    });
    if (!orMatch) return false;
  }

  return true;
}

type ShopRecommendationStateFindUniqueArgs = {
  where: { shopId: string };
  select?: {
    attemptCount?: boolean;
    catalogueVersion?: boolean;
    pendingCatalogueVersion?: boolean;
  };
};

type RecommendationSetUpdateManyArgs = {
  where: { id: string; status?: RecommendationSetStatus };
  data: {
    status?: RecommendationSetStatus;
    buildFinishedAt?: Date;
    errorCode?: string | null;
  };
};

export type InMemoryRecommendationDbClient = {
  shopRecommendationState: {
    findUnique: (
      args: ShopRecommendationStateFindUniqueArgs,
    ) => Promise<InMemoryShopState | Record<string, unknown> | null>;
    findMany: (args: {
      where: Prisma.ShopRecommendationStateWhereInput;
    }) => Promise<InMemoryShopState[]>;
    updateMany: (
      args: Prisma.ShopRecommendationStateUpdateManyArgs,
    ) => Promise<{ count: number }>;
  };
  recommendationSet: {
    updateMany: (args: RecommendationSetUpdateManyArgs) => Promise<{ count: number }>;
  };
  $transaction: <T>(fn: (tx: InMemoryRecommendationDbClient) => Promise<T>) => Promise<T>;
};

export function createInMemoryRecommendationDb(initial: {
  shop: InMemoryShopState;
  sets?: InMemoryRecommendationSet[];
}) {
  const shop = { ...initial.shop };
  const sets = new Map((initial.sets ?? []).map((set) => [set.id, { ...set }]));
  const updateManyCalls: Array<{
    where: Prisma.ShopRecommendationStateWhereInput;
    data: Prisma.ShopRecommendationStateUpdateManyMutationInput;
  }> = [];

  const client: InMemoryRecommendationDbClient = {
    shopRecommendationState: {
      findUnique: async ({
        where,
        select,
      }: ShopRecommendationStateFindUniqueArgs) => {
        if (where.shopId !== shop.shopId) return null;
        if (!select) return { ...shop };
        const row: Record<string, unknown> = {};
        if (select.attemptCount) row.attemptCount = shop.attemptCount;
        if (select.catalogueVersion) row.catalogueVersion = shop.catalogueVersion;
        if (select.pendingCatalogueVersion) row.pendingCatalogueVersion = shop.pendingCatalogueVersion;
        return row;
      },
      findMany: async ({ where }: { where: Prisma.ShopRecommendationStateWhereInput }) => {
        return matchesWhere(shop, where) ? [{ ...shop }] : [];
      },
      updateMany: async (args: Prisma.ShopRecommendationStateUpdateManyArgs) => {
        const { where, data } = args;
        if (!where || !data) return { count: 0 };

        updateManyCalls.push({ where, data });
        if (!matchesWhere(shop, where)) return { count: 0 };

        if (data.catalogueVersion !== undefined) shop.catalogueVersion = data.catalogueVersion as number;
        if (data.pendingCatalogueVersion !== undefined) {
          shop.pendingCatalogueVersion = data.pendingCatalogueVersion as number | null;
        }
        if (data.processingLockId !== undefined) shop.processingLockId = data.processingLockId as string | null;
        if (data.processingLockExpiresAt !== undefined) {
          shop.processingLockExpiresAt = data.processingLockExpiresAt as Date | null;
        }
        if (data.processingCatalogueVersion !== undefined) {
          shop.processingCatalogueVersion = data.processingCatalogueVersion as number | null;
        }
        if (data.jobStatus !== undefined) shop.jobStatus = data.jobStatus as RecommendationJobStatus;
        if (data.rebuildAfter !== undefined) shop.rebuildAfter = data.rebuildAfter as Date | null;
        if (data.attemptCount !== undefined) shop.attemptCount = data.attemptCount as number;
        if (data.nextAttemptAt !== undefined) shop.nextAttemptAt = data.nextAttemptAt as Date | null;
        if (data.lastErrorCode !== undefined) shop.lastErrorCode = data.lastErrorCode as string | null;
        if (data.lastErrorAt !== undefined) shop.lastErrorAt = data.lastErrorAt as Date | null;

        return { count: 1 };
      },
    },
    recommendationSet: {
      updateMany: async ({
        where,
        data,
      }: RecommendationSetUpdateManyArgs) => {
        const set = sets.get(where.id);
        if (!set) return { count: 0 };
        if (where.status && set.status !== where.status) return { count: 0 };
        if (data.status !== undefined) set.status = data.status;
        if (data.buildFinishedAt !== undefined) set.buildFinishedAt = data.buildFinishedAt;
        if (data.errorCode !== undefined) set.errorCode = data.errorCode;
        return { count: 1 };
      },
    },
    $transaction: async <T>(fn: (tx: InMemoryRecommendationDbClient) => Promise<T>) => fn(client),
  };

  return {
    client,
    mutateShop(fn: (state: InMemoryShopState) => void) {
      fn(shop);
    },
    get shop() {
      return { ...shop };
    },
    getSet(id: string) {
      const set = sets.get(id);
      return set ? { ...set } : null;
    },
    updateManyCalls,
  };
}
