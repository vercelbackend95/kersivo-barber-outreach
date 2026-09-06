import { describe, expect, it } from 'vitest';

import {
  buildOverviewUrl,
  classifyOpsFetchError,
  computePageSummary,
  filterShops,
  healthCodeLabel,
  reasonShortLabel,
  severityLabel,
  shopMatchesFilter,
  userMessageForFetchError,
  type OpsShopOverview,
} from './overviewClient';

function shop(partial: {
  id: string;
  code: string;
  severity: string;
  readable?: number;
  active?: number;
}): OpsShopOverview {
  return {
    shop: {
      id: partial.id,
      name: `Shop ${partial.id}`,
      townCity: 'London',
      createdAt: '2026-09-01T00:00:00.000Z',
    },
    retail: {
      paid: true,
      retailEnabled: true,
      connectAccountPresent: true,
      connectChargesEnabled: true,
      eligible: partial.code !== 'NOT_RETAIL_ELIGIBLE',
      reason: 'ok',
    },
    catalogue: { activeServiceCount: partial.active ?? 5, activeProductCount: 4 },
    state: {
      exists: true,
      catalogueVersion: 2,
      publishedCatalogueVersion: 2,
      pendingCatalogueVersion: null,
      rebuildAfter: null,
      jobStatus: 'IDLE',
      processingCatalogueVersion: null,
      processingLockExpiresAt: null,
      attemptCount: 0,
      nextAttemptAt: null,
      lastErrorCode: null,
      lastErrorAt: null,
      taxonomyVersion: 't1',
      updatedAt: '2026-09-06T12:00:00.000Z',
    },
    publishedSet: null,
    stats: null,
    coverage: {
      activeServices: partial.active ?? 5,
      servicesWithStoredItems: partial.readable ?? 0,
      servicesWithReadableRail: partial.readable ?? 0,
      totalStoredItems: 0,
      totalReadableActiveItems: 0,
    },
    health: {
      code: partial.code,
      severity: partial.severity,
      reasonCodes: [partial.code],
      facts: {},
      generatedAt: '2026-09-06T12:00:00.000Z',
    },
  };
}

describe('overviewClient presentation', () => {
  it('maps health codes to human labels', () => {
    expect(healthCodeLabel('HEALTHY')).toBe('Healthy');
    expect(healthCodeLabel('PENDING')).toBe('Build queued');
    expect(healthCodeLabel('PENDING_OVERDUE')).toBe('Build overdue');
    expect(healthCodeLabel('PROCESSING')).toBe('Building');
    expect(healthCodeLabel('FAILED_EXHAUSTED')).toBe('Build failed — retries exhausted');
    expect(healthCodeLabel('READY_NO_RAILS')).toBe('No customer-visible rails');
    expect(healthCodeLabel('NOT_RETAIL_ELIGIBLE')).toBe('Retail not eligible');
  });

  it('maps severity labels', () => {
    expect(severityLabel('OK')).toBe('Healthy');
    expect(severityLabel('WARNING')).toBe('Warning');
    expect(severityLabel('CRITICAL')).toBe('Critical');
    expect(severityLabel('INFO')).toBe('Info');
  });

  it('computes page-level summary counts', () => {
    const shops = [
      shop({ id: '1', code: 'HEALTHY', severity: 'OK', readable: 3, active: 5 }),
      shop({ id: '2', code: 'STALE', severity: 'WARNING', readable: 1, active: 4 }),
      shop({ id: '3', code: 'FAILED_EXHAUSTED', severity: 'CRITICAL', readable: 0, active: 2 }),
    ];
    expect(computePageSummary(shops)).toEqual({
      shopsOnPage: 3,
      healthy: 1,
      needsAttention: 2,
      railsVisibleServices: 4,
      activeServicesOnPage: 11,
    });
  });

  it('applies each client filter', () => {
    const shops = [
      shop({ id: 'h', code: 'HEALTHY', severity: 'OK', readable: 2, active: 2 }),
      shop({ id: 'w', code: 'STALE', severity: 'WARNING', readable: 1, active: 2 }),
      shop({ id: 'b', code: 'PENDING', severity: 'INFO', readable: 0, active: 2 }),
      shop({ id: 'n', code: 'READY_NO_RAILS', severity: 'WARNING', readable: 0, active: 2 }),
      shop({ id: 'e', code: 'NOT_RETAIL_ELIGIBLE', severity: 'INFO', readable: 0, active: 0 }),
      shop({ id: 'z', code: 'READY_PARTIAL', severity: 'INFO', readable: 0, active: 3 }),
    ];
    expect(filterShops(shops, 'all')).toHaveLength(6);
    expect(filterShops(shops, 'needs_attention').map((s) => s.shop.id)).toEqual(['w', 'n']);
    expect(filterShops(shops, 'healthy').map((s) => s.shop.id)).toEqual(['h']);
    expect(filterShops(shops, 'building').map((s) => s.shop.id)).toEqual(['b']);
    expect(filterShops(shops, 'no_rails').map((s) => s.shop.id).sort()).toEqual([
      'b',
      'e',
      'n',
      'z',
    ]);
    expect(filterShops(shops, 'not_eligible').map((s) => s.shop.id)).toEqual(['e']);
    expect(shopMatchesFilter(shops[0]!, 'healthy')).toBe(true);
  });

  it('builds search request URLs', () => {
    expect(buildOverviewUrl({ q: 'Ace', limit: 100 })).toBe(
      '/api/ops/recommendations?limit=100&q=Ace',
    );
    expect(buildOverviewUrl({ cursor: 'abc', limit: 100 })).toBe(
      '/api/ops/recommendations?limit=100&cursor=abc',
    );
    expect(buildOverviewUrl({ q: '  ', limit: 100 })).toBe(
      '/api/ops/recommendations?limit=100',
    );
  });

  it('sanitizes fetch error messages', () => {
    expect(classifyOpsFetchError(401)).toBe('unauthorized');
    expect(classifyOpsFetchError(403, 'FORBIDDEN')).toBe('forbidden');
    expect(classifyOpsFetchError(503)).toBe('unconfigured');
    expect(classifyOpsFetchError(500)).toBe('server');
    expect(classifyOpsFetchError(null)).toBe('network');
    expect(userMessageForFetchError('server')).not.toMatch(/stack|prisma|secret|DATABASE/i);
    expect(userMessageForFetchError('network')).not.toContain('TypeError');
  });

  it('prefers secondary reason labels over duplicating health code', () => {
    expect(reasonShortLabel(['STALE', 'model_mismatch'], 'STALE')).toBe('Model mismatch');
    expect(reasonShortLabel(['STALE', 'prompt_mismatch'], 'STALE')).toBe('Prompt mismatch');
    expect(reasonShortLabel(['NOT_RETAIL_ELIGIBLE', 'retail_retail_disabled'], 'NOT_RETAIL_ELIGIBLE')).toBe(
      'Retail disabled',
    );
    expect(
      reasonShortLabel(['PENDING_OVERDUE', 'pending_missing_rebuild_after'], 'PENDING_OVERDUE'),
    ).toBe('Missing rebuild schedule');
    expect(reasonShortLabel(['FAILED_RETRYING', 'retry_overdue'], 'FAILED_RETRYING')).toBe(
      'Retry overdue',
    );
    expect(reasonShortLabel(['HEALTHY', 'all_service_rails_ok'], 'HEALTHY')).toBe('All rails OK');
    expect(reasonShortLabel(['HEALTHY'], 'HEALTHY')).toBe('Healthy');
    expect(reasonShortLabel([], 'STALE')).toBe('Published recommendations are outdated');
  });
});
