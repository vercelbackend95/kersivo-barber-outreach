import { describe, expect, it } from 'vitest';

import {
  buildDetailUrl,
  filterProducts,
  filterServices,
  formatConfidence,
  formatDurationMs,
  formatScore,
  isOpsDetailPayload,
  recommendationVisibilityLabel,
  statsDisplayRows,
  type OpsShopDetail,
} from './detailClient';

function minimalDetail(): OpsShopDetail {
  return {
    overview: {
      shop: { id: 's1', name: 'Ace', townCity: 'London', createdAt: '2026-01-01T00:00:00.000Z' },
      retail: {
        paid: true,
        retailEnabled: true,
        connectAccountPresent: true,
        connectChargesEnabled: true,
        eligible: true,
        reason: 'ok',
      },
      catalogue: { activeServiceCount: 1, activeProductCount: 1 },
      state: {
        exists: true,
        catalogueVersion: 1,
        publishedCatalogueVersion: 1,
        pendingCatalogueVersion: null,
        rebuildAfter: null,
        jobStatus: 'IDLE',
        processingCatalogueVersion: null,
        processingLockExpiresAt: null,
        attemptCount: 0,
        nextAttemptAt: null,
        lastErrorCode: null,
        lastErrorAt: null,
        taxonomyVersion: 't',
        updatedAt: null,
      },
      publishedSet: null,
      stats: null,
      coverage: {
        activeServices: 1,
        servicesWithStoredItems: 1,
        servicesWithReadableRail: 1,
        totalStoredItems: 1,
        totalReadableActiveItems: 1,
      },
      health: {
        code: 'HEALTHY',
        severity: 'OK',
        reasonCodes: ['HEALTHY'],
        facts: {},
        generatedAt: '2026-09-06T12:00:00.000Z',
      },
    },
    recentSets: [],
    services: [
      {
        id: 'svc1',
        name: 'Cut',
        category: 'Hair',
        profilePresent: true,
        profileConfidence: 0.9,
        taxonomyVersion: 't',
        schemaVersion: 's',
        promptVersion: 'p',
        modelId: 'm',
        classifiedAt: null,
        profileMetadataCurrent: true,
        storedRecommendationCount: 1,
        readableActiveRecommendationCount: 1,
        railWillRender: true,
        recommendations: [
          {
            productId: 'p1',
            productName: 'Clay',
            productCategory: 'Styling',
            productActive: true,
            rank: 1,
            deterministicScore: 0.91,
            rerankPosition: null,
            reasonCodes: [],
            confidenceGate: 0.8,
            retainedByPublicReader: true,
          },
        ],
      },
      {
        id: 'svc2',
        name: 'Beard',
        category: 'Beard',
        profilePresent: false,
        profileConfidence: null,
        taxonomyVersion: null,
        schemaVersion: null,
        promptVersion: null,
        modelId: null,
        classifiedAt: null,
        profileMetadataCurrent: false,
        storedRecommendationCount: 0,
        readableActiveRecommendationCount: 0,
        railWillRender: false,
        recommendations: [],
      },
    ],
    products: [
      {
        id: 'p1',
        name: 'Clay',
        category: 'Styling',
        active: true,
        profilePresent: true,
        profileConfidence: 0.7,
        taxonomyVersion: 't',
        schemaVersion: 's',
        promptVersion: 'p',
        modelId: 'm',
        classifiedAt: null,
        profileMetadataCurrent: true,
      },
      {
        id: 'p2',
        name: 'Oil',
        category: 'Care',
        active: true,
        profilePresent: false,
        profileConfidence: null,
        taxonomyVersion: null,
        schemaVersion: null,
        promptVersion: null,
        modelId: null,
        classifiedAt: null,
        profileMetadataCurrent: false,
      },
    ],
    profileSummary: {
      activeServicesTotal: 2,
      activeServicesWithCurrentProfile: 1,
      activeProductsTotal: 2,
      activeProductsWithCurrentProfile: 1,
    },
    returned: { services: 2, products: 2 },
    truncation: { services: false, products: false },
  };
}

describe('detailClient', () => {
  it('builds encoded detail URL', () => {
    expect(buildDetailUrl('shop_a-1')).toBe('/api/ops/recommendations/shop_a-1');
  });

  it('validates success payload shape', () => {
    expect(
      isOpsDetailPayload({
        ok: true,
        generatedAt: 'x',
        data: minimalDetail(),
        nextCursor: null,
      }),
    ).toBe(true);
    expect(isOpsDetailPayload({ ok: true, data: { overview: {} } })).toBe(false);
    expect(isOpsDetailPayload({ ok: false, error: { code: 'NOT_FOUND' } })).toBe(false);
  });

  it('formats scores, confidence, duration, and stats whitelist', () => {
    expect(formatScore(0.9123)).toBe('0.91');
    expect(formatConfidence(0.8)).toBe('80%');
    expect(formatConfidence(true)).toBe('Pass');
    expect(
      formatDurationMs('2026-09-06T12:00:00.000Z', '2026-09-06T12:01:05.000Z'),
    ).toBe('1m 5s');
    expect(
      statsDisplayRows({
        serviceCount: 1,
        productCount: 2,
        itemCount: 3,
        rerankEligibleServiceCount: 0,
        rerankAttemptedServiceCount: 4,
        rerankAppliedServiceCount: 2,
        rerankFallbackServiceCount: 1,
        rerankSkippedInsufficientCandidatesCount: 0,
        rerankFallbackReasonCounts: {},
      }).map((r) => r.label),
    ).toEqual([
      'Services',
      'Products',
      'Items',
      'Rerank attempted',
      'Rerank applied',
      'Rerank fallback',
    ]);
  });

  it('filters services and products', () => {
    const d = minimalDetail();
    expect(filterServices(d.services, 'rail_visible', '').map((s) => s.id)).toEqual(['svc1']);
    expect(filterServices(d.services, 'no_rail', '').map((s) => s.id)).toEqual(['svc2']);
    expect(filterServices(d.services, 'profile_issue', '').map((s) => s.id)).toEqual(['svc2']);
    expect(filterServices(d.services, 'all', 'beard').map((s) => s.id)).toEqual(['svc2']);
    expect(filterProducts(d.products, 'current', '').map((p) => p.id)).toEqual(['p1']);
    expect(filterProducts(d.products, 'missing', '').map((p) => p.id)).toEqual(['p2']);
  });

  it('labels recommendation visibility', () => {
    expect(
      recommendationVisibilityLabel({
        productId: 'p',
        productName: 'X',
        productCategory: '',
        productActive: true,
        rank: 1,
        deterministicScore: 1,
        rerankPosition: null,
        reasonCodes: [],
        confidenceGate: null,
        retainedByPublicReader: true,
      }),
    ).toBe('Customer-visible');
    expect(
      recommendationVisibilityLabel({
        productId: 'p',
        productName: '(missing)',
        productCategory: '',
        productActive: false,
        rank: 1,
        deterministicScore: 1,
        rerankPosition: null,
        reasonCodes: [],
        confidenceGate: null,
        retainedByPublicReader: false,
      }),
    ).toContain('not customer-visible');
  });
});
