import type { PrismaClient, RecommendationSetStatus } from '@prisma/client';

import { prisma as defaultPrisma } from '@/lib/db/client';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import { BLACKLINE_SHOP_ID } from '@/lib/demo/products';
import {
  MAX_JOB_ATTEMPTS,
  PROMPT_VERSION,
  SCHEMA_VERSION,
  TAXONOMY_VERSION,
} from '@/lib/recommendations/constants';
import { resolveRecommendationModel } from '@/lib/recommendations/ai/classify';
import { evaluateRetailSelling, isDemoShopId } from '@/lib/shop/cardPaymentsGate';
import { isPaidShop } from '@/lib/shop/paidShop';

import {
  deriveRecommendationHealthForShop,
  serviceRailWillRender,
} from './deriveRecommendationHealth';
import { sanitizeRecommendationSetStats } from './sanitizeStats';
import type {
  DeriveRecommendationHealthInput,
  RecommendationOpsShopOverview,
  RecommendationStateHealthView,
} from './types';
import {
  OVERVIEW_MAX_CURSOR_LENGTH,
  OVERVIEW_MAX_SEARCH_LENGTH,
} from './types';

export const OVERVIEW_DEFAULT_LIMIT = 25;
export const OVERVIEW_MAX_LIMIT = 100;
export const DETAIL_MAX_SERVICES = 200;
export const DETAIL_MAX_PRODUCTS = 500;
export const DETAIL_MAX_RECENT_SETS = 10;

const DEMO_IDS = [DEMO_SHOP_ID, BLACKLINE_SHOP_ID] as const;

export type OverviewListInput = {
  limit?: number;
  cursor?: string | null;
  search?: string | null;
  now?: Date;
  /** Test hook: inject Prisma client / proxy to count queries. */
  db?: PrismaClient;
};

export type OverviewListResult = {
  generatedAt: string;
  shops: RecommendationOpsShopOverview[];
  nextCursor: string | null;
};

type CursorPayload = { name: string; id: string };

type ShopRow = {
  id: string;
  name: string;
  townCity: string | null;
  createdAt: Date;
  shopPaidAt: Date | null;
  smsRemindersEnabled: boolean;
  retailEnabled: boolean;
  stripeConnectAccountId: string | null;
  stripeConnectChargesEnabled: boolean;
};

type SetRow = {
  id: string;
  shopId: string;
  catalogueVersion: number;
  taxonomyVersion: string;
  schemaVersion: string;
  status: RecommendationSetStatus;
  modelId: string | null;
  rerankModelId: string | null;
  promptVersion: string;
  buildStartedAt: Date;
  buildFinishedAt: Date | null;
  errorCode: string | null;
  stats: unknown;
};

type StateRow = {
  shopId: string;
  catalogueVersion: number;
  publishedCatalogueVersion: number;
  publishedSetId: string | null;
  pendingCatalogueVersion: number | null;
  rebuildAfter: Date | null;
  jobStatus: RecommendationStateHealthView['jobStatus'];
  processingCatalogueVersion: number | null;
  processingLockId: string | null;
  processingLockExpiresAt: Date | null;
  attemptCount: number;
  nextAttemptAt: Date | null;
  lastErrorCode: string | null;
  lastErrorAt: Date | null;
  taxonomyVersion: string;
  updatedAt: Date;
};

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeOverviewCursor(raw: string): CursorPayload | null {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as CursorPayload).name !== 'string' ||
      typeof (parsed as CursorPayload).id !== 'string'
    ) {
      return null;
    }
    return { name: (parsed as CursorPayload).name, id: (parsed as CursorPayload).id };
  } catch {
    return null;
  }
}

function clampLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit)) return OVERVIEW_DEFAULT_LIMIT;
  return Math.min(OVERVIEW_MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function invalidQuery(): never {
  throw Object.assign(new Error('INVALID_QUERY'), { code: 'INVALID_QUERY' });
}

function profileMetadataCurrent(meta: {
  taxonomyVersion: string;
  schemaVersion: string;
  promptVersion: string;
  modelId: string;
}): boolean {
  return (
    meta.taxonomyVersion === TAXONOMY_VERSION &&
    meta.schemaVersion === SCHEMA_VERSION &&
    meta.promptVersion === PROMPT_VERSION &&
    meta.modelId === resolveRecommendationModel()
  );
}

function computeCoverageFromItems(
  shopId: string,
  activeServiceIds: string[],
  items: Array<{
    shopId: string;
    setId: string;
    serviceId: string;
    productId: string;
    product: { id: string; active: boolean; shopId: string } | null;
  }>,
  publishedSetId: string | null,
): {
  servicesWithStoredItems: number;
  servicesWithReadableRail: number;
  totalStoredItems: number;
  totalReadableActiveItems: number;
} {
  if (!publishedSetId || activeServiceIds.length === 0) {
    return {
      servicesWithStoredItems: 0,
      servicesWithReadableRail: 0,
      totalStoredItems: 0,
      totalReadableActiveItems: 0,
    };
  }

  const activeSet = new Set(activeServiceIds);
  const storedByService = new Map<string, number>();
  const readableByService = new Map<string, number>();
  let totalStored = 0;
  let totalReadable = 0;

  for (const item of items) {
    if (item.shopId !== shopId || item.setId !== publishedSetId) continue;
    if (!activeSet.has(item.serviceId)) continue;
    totalStored += 1;
    storedByService.set(item.serviceId, (storedByService.get(item.serviceId) ?? 0) + 1);
    const retained =
      item.product &&
      item.product.shopId === shopId &&
      item.product.active === true &&
      item.product.id === item.productId;
    if (retained) {
      totalReadable += 1;
      readableByService.set(item.serviceId, (readableByService.get(item.serviceId) ?? 0) + 1);
    }
  }

  let servicesWithReadableRail = 0;
  for (const serviceId of activeServiceIds) {
    if (serviceRailWillRender(readableByService.get(serviceId) ?? 0)) {
      servicesWithReadableRail += 1;
    }
  }

  return {
    servicesWithStoredItems: storedByService.size,
    servicesWithReadableRail,
    totalStoredItems: totalStored,
    totalReadableActiveItems: totalReadable,
  };
}

function assembleOverview(input: {
  shop: ShopRow;
  now: Date;
  activeServiceCount: number;
  activeProductCount: number;
  state: StateRow | null;
  publishedSet: SetRow | null;
  activeServiceIds: string[];
  coverageItems: Array<{
    shopId: string;
    setId: string;
    serviceId: string;
    productId: string;
    product: { id: string; active: boolean; shopId: string } | null;
  }>;
}): RecommendationOpsShopOverview {
  const { shop, now, state, publishedSet } = input;
  const retailEval = evaluateRetailSelling(shop);
  const paid = isPaidShop(shop);

  // Same-shop published set only
  const safePublished =
    state?.publishedSetId &&
    publishedSet &&
    publishedSet.id === state.publishedSetId &&
    publishedSet.shopId === shop.id
      ? publishedSet
      : null;

  const coverage = computeCoverageFromItems(
    shop.id,
    input.activeServiceIds,
    input.coverageItems,
    safePublished?.id ?? null,
  );

  const stateView: RecommendationStateHealthView | null = state
    ? {
        catalogueVersion: state.catalogueVersion,
        publishedCatalogueVersion: state.publishedCatalogueVersion,
        publishedSetId: state.publishedSetId,
        pendingCatalogueVersion: state.pendingCatalogueVersion,
        rebuildAfter: state.rebuildAfter,
        jobStatus: state.jobStatus,
        processingLockExpiresAt: state.processingLockExpiresAt,
        processingLockId: state.processingLockId,
        attemptCount: state.attemptCount,
        nextAttemptAt: state.nextAttemptAt,
        taxonomyVersion: state.taxonomyVersion,
        updatedAt: state.updatedAt,
      }
    : null;

  const healthInput: DeriveRecommendationHealthInput = {
    retail: retailEval,
    activeServiceCount: input.activeServiceCount,
    activeProductCount: input.activeProductCount,
    state: stateView,
    publishedSet: safePublished
      ? {
          id: safePublished.id,
          shopId: safePublished.shopId,
          status: safePublished.status,
          catalogueVersion: safePublished.catalogueVersion,
          taxonomyVersion: safePublished.taxonomyVersion,
          schemaVersion: safePublished.schemaVersion,
          promptVersion: safePublished.promptVersion,
          modelId: safePublished.modelId,
        }
      : state?.publishedSetId
        ? null
        : null,
    servicesWithReadableRail: coverage.servicesWithReadableRail,
    activeServicesConsidered: input.activeServiceCount,
    currentTaxonomyVersion: TAXONOMY_VERSION,
    currentSchemaVersion: SCHEMA_VERSION,
    currentPromptVersion: PROMPT_VERSION,
    currentModelId: resolveRecommendationModel(),
    maxJobAttempts: MAX_JOB_ATTEMPTS,
  };

  // If pointer exists but set missing/wrong-shop, publishedSet stays null → INVALID path
  const health = deriveRecommendationHealthForShop(shop.id, healthInput, now);
  const stats = safePublished ? sanitizeRecommendationSetStats(safePublished.stats) : null;

  return {
    shop: {
      id: shop.id,
      name: shop.name,
      townCity: shop.townCity,
      createdAt: shop.createdAt.toISOString(),
    },
    retail: {
      paid,
      retailEnabled: shop.retailEnabled,
      connectAccountPresent: Boolean(shop.stripeConnectAccountId?.trim()),
      connectChargesEnabled: shop.stripeConnectChargesEnabled,
      eligible: retailEval.ok,
      reason: retailEval.reason,
    },
    catalogue: {
      activeServiceCount: input.activeServiceCount,
      activeProductCount: input.activeProductCount,
    },
    state: {
      exists: state != null,
      catalogueVersion: state?.catalogueVersion ?? null,
      publishedCatalogueVersion: state?.publishedCatalogueVersion ?? null,
      pendingCatalogueVersion: state?.pendingCatalogueVersion ?? null,
      rebuildAfter: iso(state?.rebuildAfter),
      jobStatus: state?.jobStatus ?? null,
      processingCatalogueVersion: state?.processingCatalogueVersion ?? null,
      processingLockExpiresAt: iso(state?.processingLockExpiresAt),
      attemptCount: state?.attemptCount ?? null,
      nextAttemptAt: iso(state?.nextAttemptAt),
      lastErrorCode: state?.lastErrorCode ?? null,
      lastErrorAt: iso(state?.lastErrorAt),
      taxonomyVersion: state?.taxonomyVersion ?? null,
      updatedAt: iso(state?.updatedAt),
    },
    publishedSet: safePublished
      ? {
          id: safePublished.id,
          catalogueVersion: safePublished.catalogueVersion,
          taxonomyVersion: safePublished.taxonomyVersion,
          schemaVersion: safePublished.schemaVersion,
          status: safePublished.status,
          modelId: safePublished.modelId,
          rerankModelId: safePublished.rerankModelId,
          promptVersion: safePublished.promptVersion,
          buildStartedAt: safePublished.buildStartedAt.toISOString(),
          buildFinishedAt: iso(safePublished.buildFinishedAt),
          errorCode: safePublished.errorCode,
        }
      : null,
    stats,
    coverage: {
      activeServices: input.activeServiceCount,
      servicesWithStoredItems: coverage.servicesWithStoredItems,
      servicesWithReadableRail: coverage.servicesWithReadableRail,
      totalStoredItems: coverage.totalStoredItems,
      totalReadableActiveItems: coverage.totalReadableActiveItems,
    },
    health,
  };
}

export async function listRecommendationOpsOverview(
  input: OverviewListInput = {},
): Promise<OverviewListResult> {
  const db = input.db ?? defaultPrisma;
  const now = input.now ?? new Date();
  const limit = clampLimit(input.limit);

  if (input.search != null && input.search.length > OVERVIEW_MAX_SEARCH_LENGTH) {
    invalidQuery();
  }
  if (input.cursor != null && input.cursor.length > OVERVIEW_MAX_CURSOR_LENGTH) {
    invalidQuery();
  }

  const search = input.search?.trim() ? input.search.trim() : null;
  if (search && search.length > OVERVIEW_MAX_SEARCH_LENGTH) invalidQuery();

  let cursor: CursorPayload | null = null;
  if (input.cursor) {
    cursor = decodeOverviewCursor(input.cursor);
    if (!cursor) invalidQuery();
  }

  // 1) Paginated shops (demo excluded in WHERE)
  const rows = await db.shopSettings.findMany({
    where: {
      id: { notIn: [...DEMO_IDS] },
      ...(search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
      ...(cursor
        ? {
            OR: [
              { name: { gt: cursor.name } },
              { AND: [{ name: cursor.name }, { id: { gt: cursor.id } }] },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      townCity: true,
      createdAt: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      retailEnabled: true,
      stripeConnectAccountId: true,
      stripeConnectChargesEnabled: true,
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    take: limit + 1,
  });

  const page = rows.slice(0, limit) as ShopRow[];
  const shopIds = page.map((s) => s.id);

  if (shopIds.length === 0) {
    return { generatedAt: now.toISOString(), shops: [], nextCursor: null };
  }

  // 2–6) Fixed bulk queries (does not grow with shop count on the page)
  const [serviceCounts, productCounts, states, activeServices] = await Promise.all([
    db.service.groupBy({
      by: ['shopId'],
      where: { shopId: { in: shopIds }, isActive: true },
      _count: { _all: true },
    }),
    db.product.groupBy({
      by: ['shopId'],
      where: { shopId: { in: shopIds }, active: true },
      _count: { _all: true },
    }),
    db.shopRecommendationState.findMany({
      where: { shopId: { in: shopIds } },
    }),
    db.service.findMany({
      where: { shopId: { in: shopIds }, isActive: true },
      select: { id: true, shopId: true },
    }),
  ]);

  const stateByShop = new Map(states.map((s) => [s.shopId, s as StateRow]));
  const publishedPairs = states
    .filter((s) => s.publishedSetId)
    .map((s) => ({ shopId: s.shopId, id: s.publishedSetId as string }));

  // 7) Published sets keyed by same-shop id pairs
  const publishedSets =
    publishedPairs.length === 0
      ? []
      : await db.recommendationSet.findMany({
          where: {
            OR: publishedPairs.map((p) => ({ id: p.id, shopId: p.shopId })),
          },
        });

  const setsByShop = new Map<string, Map<string, SetRow>>();
  for (const s of publishedSets) {
    const row = s as SetRow;
    let inner = setsByShop.get(row.shopId);
    if (!inner) {
      inner = new Map();
      setsByShop.set(row.shopId, inner);
    }
    inner.set(row.id, row);
  }

  const publishedSetIds = [
    ...new Set(
      publishedPairs
        .filter((p) => setsByShop.get(p.shopId)?.has(p.id))
        .map((p) => p.id),
    ),
  ];

  // 8) Coverage items for published sets on this page
  const coverageItems =
    publishedSetIds.length === 0
      ? []
      : await db.recommendationSetItem.findMany({
          where: {
            shopId: { in: shopIds },
            setId: { in: publishedSetIds },
          },
          select: {
            shopId: true,
            setId: true,
            serviceId: true,
            productId: true,
            product: { select: { id: true, active: true, shopId: true } },
          },
        });

  const serviceCountByShop = new Map(
    serviceCounts.map((r) => [r.shopId, r._count._all]),
  );
  const productCountByShop = new Map(
    productCounts.map((r) => [r.shopId, r._count._all]),
  );
  const servicesByShop = new Map<string, string[]>();
  for (const svc of activeServices) {
    const list = servicesByShop.get(svc.shopId) ?? [];
    list.push(svc.id);
    servicesByShop.set(svc.shopId, list);
  }

  const shops: RecommendationOpsShopOverview[] = page.map((shop) => {
    const state = stateByShop.get(shop.id) ?? null;
    const publishedSet =
      state?.publishedSetId != null
        ? setsByShop.get(shop.id)?.get(state.publishedSetId) ?? null
        : null;
    return assembleOverview({
      shop,
      now,
      activeServiceCount: serviceCountByShop.get(shop.id) ?? 0,
      activeProductCount: productCountByShop.get(shop.id) ?? 0,
      state,
      publishedSet,
      activeServiceIds: servicesByShop.get(shop.id) ?? [],
      coverageItems,
    });
  });

  const hasMore = rows.length > limit;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ name: last.name, id: last.id }) : null;

  return {
    generatedAt: now.toISOString(),
    shops,
    nextCursor,
  };
}

export type RecommendationOpsShopDetail = {
  overview: RecommendationOpsShopOverview;
  recentSets: Array<{
    id: string;
    catalogueVersion: number;
    taxonomyVersion: string;
    schemaVersion: string;
    status: RecommendationSetStatus;
    modelId: string | null;
    rerankModelId: string | null;
    promptVersion: string;
    buildStartedAt: string;
    buildFinishedAt: string | null;
    errorCode: string | null;
    stats: ReturnType<typeof sanitizeRecommendationSetStats>;
  }>;
  services: Array<{
    id: string;
    name: string;
    category: string | null;
    profilePresent: boolean;
    profileConfidence: number | null;
    taxonomyVersion: string | null;
    schemaVersion: string | null;
    promptVersion: string | null;
    modelId: string | null;
    classifiedAt: string | null;
    profileMetadataCurrent: boolean;
    storedRecommendationCount: number;
    readableActiveRecommendationCount: number;
    railWillRender: boolean;
    recommendations: Array<{
      productId: string;
      productName: string;
      productCategory: string;
      productActive: boolean;
      rank: number;
      deterministicScore: number;
      rerankPosition: number | null;
      reasonCodes: string[];
      confidenceGate: number;
      retainedByPublicReader: boolean;
    }>;
  }>;
  products: Array<{
    id: string;
    name: string;
    category: string;
    active: boolean;
    profilePresent: boolean;
    profileConfidence: number | null;
    taxonomyVersion: string | null;
    schemaVersion: string | null;
    promptVersion: string | null;
    modelId: string | null;
    classifiedAt: string | null;
    profileMetadataCurrent: boolean;
  }>;
  profileSummary: {
    activeServicesTotal: number;
    activeServicesWithCurrentProfile: number;
    activeProductsTotal: number;
    activeProductsWithCurrentProfile: number;
  };
  returned: {
    services: number;
    products: number;
  };
  truncation: {
    services: boolean;
    products: boolean;
  };
};

export async function getRecommendationOpsShopDetail(
  shopId: string,
  now: Date = new Date(),
  db: PrismaClient = defaultPrisma,
): Promise<RecommendationOpsShopDetail | null> {
  if (!shopId || isDemoShopId(shopId)) return null;

  const shop = await db.shopSettings.findUnique({
    where: { id: shopId },
    select: {
      id: true,
      name: true,
      townCity: true,
      createdAt: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      retailEnabled: true,
      stripeConnectAccountId: true,
      stripeConnectChargesEnabled: true,
    },
  });
  if (!shop || isDemoShopId(shop.id)) return null;

  const modelId = resolveRecommendationModel();

  const [
    activeServiceCount,
    activeProductCount,
    state,
    serviceRows,
    productRows,
    recentSets,
    servicesWithCurrentProfile,
    productsWithCurrentProfile,
  ] = await Promise.all([
    db.service.count({ where: { shopId, isActive: true } }),
    db.product.count({ where: { shopId, active: true } }),
    db.shopRecommendationState.findUnique({ where: { shopId } }),
    db.service.findMany({
      where: { shopId, isActive: true },
      select: { id: true, name: true, category: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      take: DETAIL_MAX_SERVICES + 1,
    }),
    db.product.findMany({
      where: { shopId, active: true },
      select: { id: true, name: true, category: true, active: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      take: DETAIL_MAX_PRODUCTS + 1,
    }),
    db.recommendationSet.findMany({
      where: { shopId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: DETAIL_MAX_RECENT_SETS,
    }),
    db.serviceSemanticProfile.count({
      where: {
        shopId,
        taxonomyVersion: TAXONOMY_VERSION,
        schemaVersion: SCHEMA_VERSION,
        promptVersion: PROMPT_VERSION,
        modelId,
        service: { isActive: true, shopId },
      },
    }),
    db.productSemanticProfile.count({
      where: {
        shopId,
        taxonomyVersion: TAXONOMY_VERSION,
        schemaVersion: SCHEMA_VERSION,
        promptVersion: PROMPT_VERSION,
        modelId,
        product: { active: true, shopId },
      },
    }),
  ]);

  const servicesTruncated = serviceRows.length > DETAIL_MAX_SERVICES;
  const productsTruncated = productRows.length > DETAIL_MAX_PRODUCTS;
  const services = serviceRows.slice(0, DETAIL_MAX_SERVICES);
  const products = productRows.slice(0, DETAIL_MAX_PRODUCTS);
  const returnedServiceIds = services.map((s) => s.id);
  const returnedProductIds = products.map((p) => p.id);

  let publishedSet: SetRow | null = null;
  if (state?.publishedSetId) {
    publishedSet = (await db.recommendationSet.findFirst({
      where: { id: state.publishedSetId, shopId },
    })) as SetRow | null;
  }

  const allActiveServiceIds = await db.service.findMany({
    where: { shopId, isActive: true },
    select: { id: true },
  });

  const [serviceProfiles, productProfiles, publishedItems] = await Promise.all([
    returnedServiceIds.length
      ? db.serviceSemanticProfile.findMany({
          where: { shopId, serviceId: { in: returnedServiceIds } },
          select: {
            serviceId: true,
            confidence: true,
            taxonomyVersion: true,
            schemaVersion: true,
            promptVersion: true,
            modelId: true,
            classifiedAt: true,
          },
        })
      : Promise.resolve([]),
    returnedProductIds.length
      ? db.productSemanticProfile.findMany({
          where: { shopId, productId: { in: returnedProductIds } },
          select: {
            productId: true,
            confidence: true,
            taxonomyVersion: true,
            schemaVersion: true,
            promptVersion: true,
            modelId: true,
            classifiedAt: true,
          },
        })
      : Promise.resolve([]),
    publishedSet
      ? db.recommendationSetItem.findMany({
          where: { shopId, setId: publishedSet.id },
          select: {
            shopId: true,
            setId: true,
            serviceId: true,
            productId: true,
            rank: true,
            deterministicScore: true,
            rerankPosition: true,
            reasonCodes: true,
            confidenceGate: true,
            product: {
              select: { id: true, name: true, category: true, active: true, shopId: true },
            },
          },
          orderBy: [{ serviceId: 'asc' }, { rank: 'asc' }],
        })
      : Promise.resolve([]),
  ]);

  const overview = assembleOverview({
    shop: shop as ShopRow,
    now,
    activeServiceCount,
    activeProductCount,
    state: state as StateRow | null,
    publishedSet,
    activeServiceIds: allActiveServiceIds.map((s) => s.id),
    coverageItems: publishedItems.map((i) => ({
      shopId: i.shopId,
      setId: i.setId,
      serviceId: i.serviceId,
      productId: i.productId,
      product: i.product,
    })),
  });

  const serviceProfileById = new Map(serviceProfiles.map((p) => [p.serviceId, p]));
  const productProfileById = new Map(productProfiles.map((p) => [p.productId, p]));
  const itemsByService = new Map<string, typeof publishedItems>();
  for (const item of publishedItems) {
    const list = itemsByService.get(item.serviceId) ?? [];
    list.push(item);
    itemsByService.set(item.serviceId, list);
  }

  const serviceDtos = services.map((svc) => {
    const profile = serviceProfileById.get(svc.id);
    const recs = (itemsByService.get(svc.id) ?? []).map((item) => {
      const sameShopProduct = Boolean(
        item.product &&
          item.product.id === item.productId &&
          item.product.shopId === shopId,
      );
      if (!sameShopProduct) {
        return {
          productId: item.productId,
          productName: '(missing)',
          productCategory: '',
          productActive: false,
          rank: item.rank,
          deterministicScore: item.deterministicScore,
          rerankPosition: item.rerankPosition,
          reasonCodes: item.reasonCodes,
          confidenceGate: item.confidenceGate,
          retainedByPublicReader: false,
        };
      }
      const retainedByPublicReader = item.product!.active === true;
      return {
        productId: item.productId,
        productName: item.product!.name,
        productCategory: item.product!.category,
        productActive: item.product!.active === true,
        rank: item.rank,
        deterministicScore: item.deterministicScore,
        rerankPosition: item.rerankPosition,
        reasonCodes: item.reasonCodes,
        confidenceGate: item.confidenceGate,
        retainedByPublicReader,
      };
    });
    const readableActiveRecommendationCount = recs.filter((r) => r.retainedByPublicReader).length;
    return {
      id: svc.id,
      name: svc.name,
      category: svc.category,
      profilePresent: Boolean(profile),
      profileConfidence: profile?.confidence ?? null,
      taxonomyVersion: profile?.taxonomyVersion ?? null,
      schemaVersion: profile?.schemaVersion ?? null,
      promptVersion: profile?.promptVersion ?? null,
      modelId: profile?.modelId ?? null,
      classifiedAt: iso(profile?.classifiedAt),
      profileMetadataCurrent: profile ? profileMetadataCurrent(profile) : false,
      storedRecommendationCount: recs.length,
      readableActiveRecommendationCount,
      railWillRender: serviceRailWillRender(readableActiveRecommendationCount),
      recommendations: recs,
    };
  });

  const productDtos = products.map((prod) => {
    const profile = productProfileById.get(prod.id);
    return {
      id: prod.id,
      name: prod.name,
      category: prod.category,
      active: prod.active,
      profilePresent: Boolean(profile),
      profileConfidence: profile?.confidence ?? null,
      taxonomyVersion: profile?.taxonomyVersion ?? null,
      schemaVersion: profile?.schemaVersion ?? null,
      promptVersion: profile?.promptVersion ?? null,
      modelId: profile?.modelId ?? null,
      classifiedAt: iso(profile?.classifiedAt),
      profileMetadataCurrent: profile ? profileMetadataCurrent(profile) : false,
    };
  });

  return {
    overview,
    recentSets: recentSets.map((set) => ({
      id: set.id,
      catalogueVersion: set.catalogueVersion,
      taxonomyVersion: set.taxonomyVersion,
      schemaVersion: set.schemaVersion,
      status: set.status,
      modelId: set.modelId,
      rerankModelId: set.rerankModelId,
      promptVersion: set.promptVersion,
      buildStartedAt: set.buildStartedAt.toISOString(),
      buildFinishedAt: iso(set.buildFinishedAt),
      errorCode: set.errorCode,
      stats: sanitizeRecommendationSetStats(set.stats),
    })),
    services: serviceDtos,
    products: productDtos,
    profileSummary: {
      activeServicesTotal: activeServiceCount,
      activeServicesWithCurrentProfile: servicesWithCurrentProfile,
      activeProductsTotal: activeProductCount,
      activeProductsWithCurrentProfile: productsWithCurrentProfile,
    },
    returned: {
      services: serviceDtos.length,
      products: productDtos.length,
    },
    truncation: {
      services: servicesTruncated,
      products: productsTruncated,
    },
  };
}
