/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RecommendationOpsShopDetail from './RecommendationOpsShopDetail';
import type { OpsShopDetail } from '@/lib/recommendations/ops/detailClient';

const here = dirname(fileURLToPath(import.meta.url));

function detail(): OpsShopDetail {
  return {
    overview: {
      shop: { id: 'shop_1', name: 'Ace Cuts', townCity: 'Leeds', createdAt: '2026-01-01T00:00:00.000Z' },
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
        taxonomyVersion: 't',
        updatedAt: '2026-09-06T11:00:00.000Z',
      },
      publishedSet: {
        id: 'set1',
        catalogueVersion: 2,
        taxonomyVersion: 't',
        schemaVersion: 's',
        status: 'READY',
        modelId: 'gpt',
        rerankModelId: null,
        promptVersion: 'p',
        buildStartedAt: '2026-09-06T10:00:00.000Z',
        buildFinishedAt: '2026-09-06T10:01:00.000Z',
        errorCode: null,
      },
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
        reasonCodes: ['HEALTHY', 'all_service_rails_ok'],
        facts: {},
        generatedAt: '2026-09-06T12:00:00.000Z',
      },
    },
    recentSets: [
      {
        id: 'set1',
        catalogueVersion: 2,
        taxonomyVersion: 't',
        schemaVersion: 's',
        status: 'READY',
        modelId: 'gpt',
        rerankModelId: null,
        promptVersion: 'p',
        buildStartedAt: '2026-09-06T10:00:00.000Z',
        buildFinishedAt: '2026-09-06T10:01:00.000Z',
        errorCode: null,
        stats: {
          serviceCount: 1,
          productCount: 1,
          itemCount: 1,
          rerankEligibleServiceCount: 0,
          rerankAttemptedServiceCount: 0,
          rerankAppliedServiceCount: 0,
          rerankFallbackServiceCount: 0,
          rerankSkippedInsufficientCandidatesCount: 0,
          rerankFallbackReasonCounts: {},
        },
      },
    ],
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
            deterministicScore: 0.9,
            rerankPosition: null,
            reasonCodes: [],
            confidenceGate: 0.8,
            retainedByPublicReader: true,
          },
        ],
      },
    ],
    products: [
      {
        id: 'p1',
        name: 'Clay',
        category: 'Styling',
        active: true,
        profilePresent: true,
        profileConfidence: 0.8,
        taxonomyVersion: 't',
        schemaVersion: 's',
        promptVersion: 'p',
        modelId: 'm',
        classifiedAt: null,
        profileMetadataCurrent: true,
      },
    ],
    profileSummary: {
      activeServicesTotal: 1,
      activeServicesWithCurrentProfile: 1,
      activeProductsTotal: 1,
      activeProductsWithCurrentProfile: 1,
    },
    returned: { services: 1, products: 1 },
    truncation: { services: false, products: true },
  };
}

afterEach(() => {
  cleanup();
});

describe('RecommendationOpsShopDetail', () => {
  it('loads detail from correct URL and renders tabs', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          generatedAt: '2026-09-06T12:00:00.000Z',
          data: detail(),
          nextCursor: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    render(
      <RecommendationOpsShopDetail shopId="shop_1" fetchImpl={fetchImpl as typeof fetch} />,
    );
    await waitFor(() => expect(screen.getByText('Ace Cuts')).toBeTruthy());
    const firstCall = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(firstCall[0])).toBe('/api/ops/recommendations/shop_1');
    expect(firstCall[1]).toMatchObject({
      credentials: 'same-origin',
      cache: 'no-store',
    });
    expect(screen.getByTestId('ops-detail-overview')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Services & recommendations' }));
    expect(screen.getByTestId('ops-detail-services')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Cut/ }));
    expect(screen.getByText(/Customer-visible/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Products & profiles' }));
    expect(screen.getByTestId('ops-detail-products')).toBeTruthy();
    expect(screen.getByText(/Product list is truncated/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Build history' }));
    expect(screen.getByTestId('ops-detail-builds')).toBeTruthy();
    expect(screen.getByText(/Services: 1/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/JSON\.stringify|postgres:\/\//);
  });

  it('handles malformed success payload without crash', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true, data: { overview: {} } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    render(
      <RecommendationOpsShopDetail shopId="shop_1" fetchImpl={fetchImpl as typeof fetch} />,
    );
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getAllByText(/Unable to load/i).length).toBeGreaterThanOrEqual(1);
  });

  it('clears detail on 401 after success; preserves on 500 refresh', async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n += 1;
      if (n === 1) {
        return new Response(
          JSON.stringify({
            ok: true,
            generatedAt: '2026-09-06T12:00:00.000Z',
            data: detail(),
            nextCursor: null,
          }),
          { status: 200 },
        );
      }
      if (n === 2) {
        return new Response(JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR' } }), {
          status: 500,
        });
      }
      return new Response(JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED' } }), {
        status: 401,
      });
    });
    render(
      <RecommendationOpsShopDetail shopId="shop_1" fetchImpl={fetchImpl as typeof fetch} />,
    );
    await waitFor(() => expect(screen.getByText('Ace Cuts')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Refresh shop detail'));
    await waitFor(() =>
      expect(screen.getAllByText(/Something went wrong/i).length).toBeGreaterThanOrEqual(1),
    );
    expect(screen.getByText('Ace Cuts')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Refresh shop detail'));
    await waitFor(() => expect(screen.getByText('Session expired')).toBeTruthy());
    expect(screen.queryByTestId('ops-detail-overview')).toBeNull();
  });

  it('shows 404 state', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: false, error: { code: 'NOT_FOUND' } }), {
        status: 404,
      });
    });
    render(
      <RecommendationOpsShopDetail shopId="missing" fetchImpl={fetchImpl as typeof fetch} />,
    );
    await waitFor(() => expect(screen.getByText('Shop not found')).toBeTruthy());
  });
});

describe('ops detail page source gates', () => {
  it('gates with operator auth and disables analytics/router', () => {
    const src = readFileSync(
      join(here, '../../../../pages/ops/recommendations/[shopId].astro'),
      'utf8',
    );
    expect(src).toContain('export const prerender = false');
    expect(src).toContain('resolveOperatorAccess');
    expect(src).toContain('parseOpsShopId');
    expect(src).toContain('enableAnalytics={false}');
    expect(src).toContain('enableClientRouter={false}');
    expect(src).toContain('showCookieConsent={false}');
    expect(src).toContain("Cache-Control', 'private, no-store'");
    expect(src).not.toContain('access.email');
    expect(src).not.toContain('KERSIVO_OPS_EMAILS');
    expect(src).not.toContain('resolveAdminAccess');
    expect(src).not.toMatch(/<GoogleAnalytics/);
    expect(src).not.toMatch(/<ClientRouter/);
  });
});
