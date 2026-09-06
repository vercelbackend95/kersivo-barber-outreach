import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecommendationJobStatus, RecommendationSetStatus } from '@prisma/client';

import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import { BLACKLINE_SHOP_ID } from '@/lib/demo/products';
import {
  PROMPT_VERSION,
  SCHEMA_VERSION,
  TAXONOMY_VERSION,
} from '@/lib/recommendations/constants';

import {
  decodeOverviewCursor,
  getRecommendationOpsShopDetail,
  listRecommendationOpsOverview,
} from './readModel';
import { OVERVIEW_MAX_SEARCH_LENGTH } from './types';

const NOW = new Date('2026-09-06T12:00:00.000Z');

function createCountingDb(shopCount: number) {
  const shops = Array.from({ length: shopCount }, (_, i) => ({
    id: `shop-${String(i).padStart(3, '0')}`,
    name: `Shop ${String(i).padStart(3, '0')}`,
    townCity: 'London',
    createdAt: NOW,
    shopPaidAt: NOW,
    smsRemindersEnabled: true,
    retailEnabled: true,
    stripeConnectAccountId: 'acct_xxx',
    stripeConnectChargesEnabled: true,
  }));

  let calls = 0;
  const track = <T>(fn: () => T | Promise<T>) => {
    calls += 1;
    return fn();
  };

  const db = {
    shopSettings: {
      findMany: () =>
        track(async () => shops),
      findUnique: ({ where }: { where: { id: string } }) =>
        track(async () => shops.find((s) => s.id === where.id) ?? null),
    },
    service: {
      groupBy: () =>
        track(async () =>
          shops.map((s) => ({ shopId: s.id, _count: { _all: 2 } })),
        ),
      findMany: ({ where }: { where: { shopId: string | { in: string[] }; isActive?: boolean } }) =>
        track(async () => {
          const ids = typeof where.shopId === 'string' ? [where.shopId] : where.shopId.in;
          return ids.flatMap((shopId) => [
            { id: `${shopId}-svc-1`, shopId, name: 'Cut', category: 'Hair' },
            { id: `${shopId}-svc-2`, shopId, name: 'Beard', category: 'Beard' },
          ]);
        }),
      count: () => track(async () => 2),
    },
    product: {
      groupBy: () =>
        track(async () =>
          shops.map((s) => ({ shopId: s.id, _count: { _all: 4 } })),
        ),
      findMany: () =>
        track(async () => [
          { id: 'p1', name: 'Clay', category: 'Styling', active: true },
        ]),
      count: () => track(async () => 4),
    },
    shopRecommendationState: {
      findMany: () =>
        track(async () =>
          shops.map((s) => ({
            shopId: s.id,
            catalogueVersion: 1,
            publishedCatalogueVersion: 1,
            publishedSetId: `${s.id}-set`,
            pendingCatalogueVersion: null,
            rebuildAfter: null,
            jobStatus: RecommendationJobStatus.IDLE,
            processingCatalogueVersion: null,
            processingLockId: null,
            processingLockExpiresAt: null,
            attemptCount: 0,
            nextAttemptAt: null,
            lastErrorCode: null,
            lastErrorAt: null,
            taxonomyVersion: TAXONOMY_VERSION,
            updatedAt: NOW,
          })),
        ),
      findUnique: ({ where }: { where: { shopId: string } }) =>
        track(async () => ({
          shopId: where.shopId,
          catalogueVersion: 1,
          publishedCatalogueVersion: 1,
          publishedSetId: `${where.shopId}-set`,
          pendingCatalogueVersion: null,
          rebuildAfter: null,
          jobStatus: RecommendationJobStatus.IDLE,
          processingCatalogueVersion: null,
          processingLockId: null,
          processingLockExpiresAt: null,
          attemptCount: 0,
          nextAttemptAt: null,
          lastErrorCode: null,
          lastErrorAt: null,
          taxonomyVersion: TAXONOMY_VERSION,
          updatedAt: NOW,
        })),
    },
    recommendationSet: {
      findMany: () =>
        track(async () =>
          shops.map((s) => ({
            id: `${s.id}-set`,
            shopId: s.id,
            catalogueVersion: 1,
            taxonomyVersion: TAXONOMY_VERSION,
            schemaVersion: SCHEMA_VERSION,
            status: RecommendationSetStatus.READY,
            modelId: 'gpt-4o-mini',
            rerankModelId: null,
            promptVersion: PROMPT_VERSION,
            buildStartedAt: NOW,
            buildFinishedAt: NOW,
            errorCode: null,
            stats: { serviceCount: 2, productCount: 4, itemCount: 4 },
            createdAt: NOW,
          })),
        ),
      findFirst: ({ where }: { where: { id: string; shopId: string } }) =>
        track(async () => ({
          id: where.id,
          shopId: where.shopId,
          catalogueVersion: 1,
          taxonomyVersion: TAXONOMY_VERSION,
          schemaVersion: SCHEMA_VERSION,
          status: RecommendationSetStatus.READY,
          modelId: 'gpt-4o-mini',
          rerankModelId: null,
          promptVersion: PROMPT_VERSION,
          buildStartedAt: NOW,
          buildFinishedAt: NOW,
          errorCode: null,
          stats: null,
          createdAt: NOW,
        })),
    },
    recommendationSetItem: {
      findMany: () =>
        track(async () =>
          shops.flatMap((s) => [
            {
              shopId: s.id,
              setId: `${s.id}-set`,
              serviceId: `${s.id}-svc-1`,
              productId: 'p1',
              rank: 1,
              deterministicScore: 0.9,
              rerankPosition: null,
              reasonCodes: [],
              confidenceGate: 0.8,
              product: { id: 'p1', name: 'Clay', category: 'Styling', active: true, shopId: s.id },
            },
            {
              shopId: s.id,
              setId: `${s.id}-set`,
              serviceId: `${s.id}-svc-1`,
              productId: 'p2',
              rank: 2,
              deterministicScore: 0.8,
              rerankPosition: null,
              reasonCodes: [],
              confidenceGate: 0.7,
              product: { id: 'p2', name: 'Old', category: 'Styling', active: false, shopId: s.id },
            },
          ]),
        ),
    },
    serviceSemanticProfile: {
      findMany: () => track(async () => []),
      count: () => track(async () => 0),
    },
    productSemanticProfile: {
      findMany: () => track(async () => []),
      count: () => track(async () => 0),
    },
  };

  return { db: db as never, getCalls: () => calls, shops };
}

vi.mock('@/lib/recommendations/ai/classify', () => ({
  resolveRecommendationModel: () => 'gpt-4o-mini',
}));

describe('listRecommendationOpsOverview bulk loading', () => {
  it('keeps Prisma call count bounded for 1 and 50 shops', async () => {
    const one = createCountingDb(1);
    await listRecommendationOpsOverview({ now: NOW, limit: 100, db: one.db });
    const calls1 = one.getCalls();

    const fifty = createCountingDb(50);
    await listRecommendationOpsOverview({ now: NOW, limit: 100, db: fifty.db });
    const calls50 = fifty.getCalls();

    // Evidence for review package (stable bulk pipeline).
    // eslint-disable-next-line no-console
    console.log(`OVERVIEW_PRISMA_CALLS shop1=${calls1} shop50=${calls50}`);

    expect(calls1).toBeLessThanOrEqual(10);
    expect(calls50).toBeLessThanOrEqual(10);
    expect(Math.abs(calls50 - calls1)).toBeLessThanOrEqual(1);
    expect(calls1).toBe(7);
    expect(calls50).toBe(7);
  });

  it('excludes demo ids in shop query and never leaks Stripe account ids', async () => {
    const { db, shops } = createCountingDb(1);
    const findMany = vi.fn(async (args: { where: { id: { notIn: string[] } } }) => {
      expect(args.where.id.notIn).toEqual(
        expect.arrayContaining([DEMO_SHOP_ID, BLACKLINE_SHOP_ID]),
      );
      return shops;
    });
    (db as { shopSettings: { findMany: unknown } }).shopSettings.findMany = findMany;
    const result = await listRecommendationOpsOverview({
      now: NOW,
      limit: 10,
      db,
    });
    expect(findMany).toHaveBeenCalled();
    expect(result.shops).toHaveLength(shops.length);
    expect(JSON.stringify(result)).not.toContain('acct_xxx');
  });

  it('rejects oversized search', async () => {
    const { db } = createCountingDb(1);
    await expect(
      listRecommendationOpsOverview({
        now: NOW,
        search: 'x'.repeat(OVERVIEW_MAX_SEARCH_LENGTH + 1),
        db,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_QUERY' });
  });

  it('paginates with stable cursor decode', () => {
    expect(decodeOverviewCursor('not-valid')).toBeNull();
  });
});

describe('getRecommendationOpsShopDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for demo shops', async () => {
    expect(await getRecommendationOpsShopDetail(DEMO_SHOP_ID, NOW)).toBeNull();
  });

  it('reports real totals vs returned counts and scopes inactive retention', async () => {
    const { db } = createCountingDb(1);
    const detail = await getRecommendationOpsShopDetail('shop-000', NOW, db);
    expect(detail).not.toBeNull();
    expect(detail!.profileSummary.activeServicesTotal).toBe(2);
    expect(detail!.profileSummary.activeProductsTotal).toBe(4);
    expect(detail!.returned.services).toBeLessThanOrEqual(detail!.profileSummary.activeServicesTotal);
    expect(detail!.overview.catalogue.activeServiceCount).toBe(2);
    const recs = detail!.services[0]?.recommendations ?? [];
    const inactive = recs.find((r) => r.productId === 'p2');
    if (inactive) {
      expect(inactive.retainedByPublicReader).toBe(false);
    }
    expect(JSON.stringify(detail)).not.toContain('acct_xxx');
  });

  it('blocks cross-shop product metadata leakage', async () => {
    const { db } = createCountingDb(1);
    const foreignName = 'ForeignSecretPomade';
    const foreignCategory = 'SecretCategory';
    (db as {
      recommendationSetItem: { findMany: unknown };
    }).recommendationSetItem.findMany = async () => [
      {
        shopId: 'shop-000',
        setId: 'shop-000-set',
        serviceId: 'shop-000-svc-1',
        productId: 'foreign-p1',
        rank: 1,
        deterministicScore: 0.9,
        rerankPosition: null,
        reasonCodes: [],
        confidenceGate: 0.8,
        product: {
          id: 'foreign-p1',
          name: foreignName,
          category: foreignCategory,
          active: true,
          shopId: 'other-shop',
        },
      },
      {
        shopId: 'shop-000',
        setId: 'shop-000-set',
        serviceId: 'shop-000-svc-1',
        productId: 'p1',
        rank: 2,
        deterministicScore: 0.8,
        rerankPosition: null,
        reasonCodes: [],
        confidenceGate: 0.7,
        product: {
          id: 'p1',
          name: 'Clay',
          category: 'Styling',
          active: true,
          shopId: 'shop-000',
        },
      },
    ];

    const detail = await getRecommendationOpsShopDetail('shop-000', NOW, db);
    expect(detail).not.toBeNull();
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain(foreignName);
    expect(serialized).not.toContain(foreignCategory);

    const recs = detail!.services[0]?.recommendations ?? [];
    const leaked = recs.find((r) => r.productId === 'foreign-p1');
    expect(leaked).toMatchObject({
      productName: '(missing)',
      productCategory: '',
      productActive: false,
      retainedByPublicReader: false,
    });
    expect(detail!.services[0]?.readableActiveRecommendationCount).toBe(1);
    expect(detail!.overview.coverage.totalReadableActiveItems).toBe(1);
  });
});
