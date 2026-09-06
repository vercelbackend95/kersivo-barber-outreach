/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RecommendationOpsDashboard from './RecommendationOpsDashboard';
import { OpsShopCard } from './OpsShopCard';
import { OpsShopTable } from './OpsShopTable';
import type { OpsShopOverview } from '@/lib/recommendations/ops/overviewClient';

const here = dirname(fileURLToPath(import.meta.url));

function makeShop(id: string, name: string, code = 'HEALTHY', severity = 'OK'): OpsShopOverview {
  return {
    shop: { id, name, townCity: 'Manchester', createdAt: '2026-01-01T00:00:00.000Z' },
    retail: {
      paid: true,
      retailEnabled: true,
      connectAccountPresent: true,
      connectChargesEnabled: true,
      eligible: true,
      reason: 'ok',
    },
    catalogue: { activeServiceCount: 5, activeProductCount: 4 },
    state: {
      exists: true,
      catalogueVersion: 3,
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
    publishedSet: null,
    stats: null,
    coverage: {
      activeServices: 5,
      servicesWithStoredItems: 3,
      servicesWithReadableRail: 3,
      totalStoredItems: 6,
      totalReadableActiveItems: 6,
    },
    health: {
      code,
      severity,
      reasonCodes: [code],
      facts: {},
      generatedAt: '2026-09-06T12:00:00.000Z',
    },
  };
}

function okBody(shops: OpsShopOverview[], nextCursor: string | null = null) {
  return {
    ok: true as const,
    generatedAt: '2026-09-06T12:00:00.000Z',
    data: { shops },
    nextCursor,
  };
}

function expectShopName(name: string) {
  expect(screen.getAllByText(name).length).toBeGreaterThanOrEqual(1);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RecommendationOpsDashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('loads shops, builds search URL, and resets pagination on search', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('q=Alpha')) {
        return new Response(JSON.stringify(okBody([makeShop('a', 'Alpha')])), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify(okBody([makeShop('1', 'One'), makeShop('2', 'Two')], 'cursor-2')),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    render(<RecommendationOpsDashboard fetchImpl={fetchImpl as typeof fetch} />);

    await waitFor(() => expectShopName('One'));
    const firstCall = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(firstCall[0]).toContain('/api/ops/recommendations?limit=100');
    expect(firstCall[1]).toMatchObject({
      credentials: 'same-origin',
      cache: 'no-store',
    });

    fireEvent.click(screen.getByLabelText('Next page'));
    await waitFor(() => {
      const last = fetchImpl.mock.calls.at(-1) as unknown as [string, RequestInit];
      expect(String(last[0])).toContain('cursor=cursor-2');
    });

    fireEvent.change(screen.getByLabelText('Search shops by name'), {
      target: { value: 'Alpha' },
    });
    await vi.advanceTimersByTimeAsync(350);
    await waitFor(() => expectShopName('Alpha'));
    const lastUrl = String((fetchImpl.mock.calls.at(-1) as unknown as [string])[0]);
    expect(lastUrl).toContain('q=Alpha');
    expect(lastUrl).not.toContain('cursor=');
  });

  it('ignores stale responses when a newer request completes first', async () => {
    let resolveSlow: (v: Response) => void = () => undefined;
    const slow = new Promise<Response>((resolve) => {
      resolveSlow = resolve;
    });
    let calls = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      calls += 1;
      const url = String(input);
      if (calls === 1) return slow;
      if (url.includes('q=New')) {
        return new Response(JSON.stringify(okBody([makeShop('n', 'New Shop')])), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(okBody([])), { status: 200 });
    });

    render(<RecommendationOpsDashboard fetchImpl={fetchImpl as typeof fetch} />);
    fireEvent.change(screen.getByLabelText('Search shops by name'), {
      target: { value: 'New' },
    });
    await vi.advanceTimersByTimeAsync(350);
    await waitFor(() => expectShopName('New Shop'));

    resolveSlow(
      new Response(JSON.stringify(okBody([makeShop('old', 'Stale Shop')])), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await Promise.resolve();
    expect(screen.queryByText('Stale Shop')).toBeNull();
    expectShopName('New Shop');
  });

  it('refresh preserves search and filter state', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify(okBody([makeShop('1', 'Ace Cuts', 'STALE', 'WARNING')])), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    render(<RecommendationOpsDashboard fetchImpl={fetchImpl as typeof fetch} />);
    await waitFor(() => expectShopName('Ace Cuts'));
    fireEvent.change(screen.getByLabelText('Search shops by name'), {
      target: { value: 'Ace' },
    });
    await vi.advanceTimersByTimeAsync(350);
    await waitFor(() => {
      const last = fetchImpl.mock.calls.at(-1) as unknown as [string];
      expect(String(last[0])).toContain('q=Ace');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Needs attention' }));
    const callsBefore = fetchImpl.mock.calls.length;
    fireEvent.click(screen.getByLabelText('Refresh shop overview'));
    await waitFor(() => expect(fetchImpl.mock.calls.length).toBeGreaterThan(callsBefore));
    const refreshLast = fetchImpl.mock.calls.at(-1) as unknown as [string];
    expect(String(refreshLast[0])).toContain('q=Ace');
    expect((screen.getByLabelText('Search shops by name') as HTMLInputElement).value).toBe('Ace');
    expect(screen.getByRole('button', { name: 'Needs attention' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('shows sanitized 500 and network errors without raw leakage', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const { unmount } = render(
      <RecommendationOpsDashboard fetchImpl={fetchImpl as typeof fetch} />,
    );
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getAllByText(/Something went wrong/i).length).toBeGreaterThanOrEqual(1);
    expect(document.body.textContent).not.toContain('INTERNAL_ERROR');
    expect(document.body.textContent).not.toContain('stack');
    unmount();

    const net = vi.fn(async () => {
      throw new TypeError('Failed to fetch secret REDACTED_CONN_STRING');
    });
    render(<RecommendationOpsDashboard fetchImpl={net as typeof fetch} />);
    await waitFor(() =>
      expect(screen.getAllByText(/Network error/i).length).toBeGreaterThanOrEqual(1),
    );
    expect(document.body.textContent).not.toContain('REDACTED_CONN_STRING');
    expect(document.body.textContent).not.toContain('TypeError');
  });

  it('shows session expiry with safe sign-in path on 401', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    render(<RecommendationOpsDashboard fetchImpl={fetchImpl as typeof fetch} />);
    await waitFor(() => expect(screen.getByText('Session expired')).toBeTruthy());
    const link = screen.getByRole('link', { name: /sign in again/i });
    expect(link.getAttribute('href')).toBe('/ops/recommendations');
  });

  it('shows loading then empty states', async () => {
    let resolve!: (v: Response) => void;
    const pending = new Promise<Response>((r) => {
      resolve = r;
    });
    const fetchImpl = vi.fn(async () => pending);
    render(<RecommendationOpsDashboard fetchImpl={fetchImpl as typeof fetch} />);
    expect(screen.getByLabelText('Loading shops')).toBeTruthy();
    resolve(
      new Response(JSON.stringify(okBody([])), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await waitFor(() => expect(screen.getByText('No shops yet')).toBeTruthy());
  });

  it('supports previous/next cursor navigation without parsing cursors', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('cursor=c2')) {
        return new Response(JSON.stringify(okBody([makeShop('2', 'Page Two')])), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(okBody([makeShop('1', 'Page One')], 'c2')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    render(<RecommendationOpsDashboard fetchImpl={fetchImpl as typeof fetch} />);
    await waitFor(() => expectShopName('Page One'));
    fireEvent.click(screen.getByLabelText('Next page'));
    await waitFor(() => expectShopName('Page Two'));
    fireEvent.click(screen.getByLabelText('Previous page'));
    await waitFor(() => expectShopName('Page One'));
    const urls = fetchImpl.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('cursor=c2'))).toBe(true);
  });

  it('clears shops after successful load then 401', async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n += 1;
      if (n === 1) {
        return new Response(JSON.stringify(okBody([makeShop('1', 'Keep Me')])), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    render(<RecommendationOpsDashboard fetchImpl={fetchImpl as typeof fetch} />);
    await waitFor(() => expectShopName('Keep Me'));
    fireEvent.click(screen.getByLabelText('Refresh shop overview'));
    await waitFor(() => expect(screen.getByText('Session expired')).toBeTruthy());
    expect(screen.queryByText('Keep Me')).toBeNull();
  });

  it('clears shops after successful load then 403', async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n += 1;
      if (n === 1) {
        return new Response(JSON.stringify(okBody([makeShop('1', 'Gone Soon')])), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ ok: false, error: { code: 'FORBIDDEN' } }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    render(<RecommendationOpsDashboard fetchImpl={fetchImpl as typeof fetch} />);
    await waitFor(() => expectShopName('Gone Soon'));
    fireEvent.click(screen.getByLabelText('Refresh shop overview'));
    await waitFor(() => expect(screen.getByText('Access denied')).toBeTruthy());
    expect(screen.queryByText('Gone Soon')).toBeNull();
  });

  it('clears shops after successful load then 503', async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n += 1;
      if (n === 1) {
        return new Response(JSON.stringify(okBody([makeShop('1', 'Config Shop')])), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ ok: false, error: { code: 'OPS_ACCESS_NOT_CONFIGURED' } }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    });
    render(<RecommendationOpsDashboard fetchImpl={fetchImpl as typeof fetch} />);
    await waitFor(() => expectShopName('Config Shop'));
    fireEvent.click(screen.getByLabelText('Refresh shop overview'));
    await waitFor(() => expect(screen.getByText('Configuration unavailable')).toBeTruthy());
    expect(screen.queryByText('Config Shop')).toBeNull();
  });

  it('preserves shops after successful load then 500/network refresh failure', async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n += 1;
      if (n === 1) {
        return new Response(JSON.stringify(okBody([makeShop('1', 'Stay Visible')])), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (n === 2) {
        return new Response(JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR' } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new TypeError('Failed to fetch');
    });
    render(<RecommendationOpsDashboard fetchImpl={fetchImpl as typeof fetch} />);
    await waitFor(() => expectShopName('Stay Visible'));
    fireEvent.click(screen.getByLabelText('Refresh shop overview'));
    await waitFor(() =>
      expect(screen.getAllByText(/Something went wrong/i).length).toBeGreaterThanOrEqual(1),
    );
    expectShopName('Stay Visible');
    fireEvent.click(screen.getByLabelText('Refresh shop overview'));
    await waitFor(() =>
      expect(screen.getAllByText(/Network error/i).length).toBeGreaterThanOrEqual(1),
    );
    expectShopName('Stay Visible');
  });

  it('aborts active request on unmount', async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
    let resolve!: (v: Response) => void;
    const pending = new Promise<Response>((r) => {
      resolve = r;
    });
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeTruthy();
      return pending;
    });
    const { unmount } = render(
      <RecommendationOpsDashboard fetchImpl={fetchImpl as typeof fetch} />,
    );
    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    unmount();
    expect(abortSpy).toHaveBeenCalled();
    resolve(
      new Response(JSON.stringify(okBody([])), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    abortSpy.mockRestore();
  });
});

describe('desktop/mobile content parity', () => {
  it('renders table and card content for the same shops', () => {
    const shops = [makeShop('shop/odd', 'Parity Shop', 'READY_PARTIAL', 'INFO')];
    shops[0]!.shop.id = 'shop_odd-1';
    const table = render(<OpsShopTable shops={shops} nowMs={Date.parse('2026-09-06T12:00:00Z')} />);
    const tableEl = table.getByTestId('ops-shop-table');
    expect(within(tableEl).getByText('Parity Shop')).toBeTruthy();
    expect(tableEl.textContent).toContain('Partial service coverage');
    expect(tableEl.textContent).toContain('3 of 5 services');
    const tableLink = within(tableEl).getByRole('link', { name: 'Inspect Parity Shop' });
    expect(tableLink.getAttribute('href')).toBe('/ops/recommendations/shop_odd-1');
    table.unmount();
    const cards = render(<OpsShopCard shops={shops} nowMs={Date.parse('2026-09-06T12:00:00Z')} />);
    const cardsEl = cards.getByTestId('ops-shop-cards');
    expect(within(cardsEl).getByText('Parity Shop')).toBeTruthy();
    expect(cardsEl.textContent).toContain('Partial service coverage');
    expect(cardsEl.textContent).toContain('3 of 5 services');
    const cardLink = within(cardsEl).getByRole('link', { name: 'Inspect Parity Shop' });
    expect(cardLink.getAttribute('href')).toBe('/ops/recommendations/shop_odd-1');
  });
});

describe('ops recommendations page source gates', () => {
  it('authorizes via resolveOperatorAccess and never serializes email/allowlist', () => {
    const src = readFileSync(
      join(here, '../../../pages/ops/recommendations/index.astro'),
      'utf8',
    );
    expect(src).toContain('export const prerender = false');
    expect(src).toContain('resolveOperatorAccess');
    expect(src).toContain('resolveOpsPageView');
    expect(src).toContain("Cache-Control', 'private, no-store'");
    expect(src).toContain("Vary', 'Cookie'");
    expect(src).toContain('noindex={true}');
    expect(src).toContain('enableAnalytics={false}');
    expect(src).toContain('enableClientRouter={false}');
    expect(src).toContain('RecommendationOpsDashboard');
    expect(src).toContain("view === 'dashboard'");
    expect(src).toContain('PrivateDemoAuthPanel');
    expect(src).toContain('callbackURL="/ops/recommendations"');
    expect(src).toContain('showGoogle={false}');
    expect(src).toContain('allowSignup={false}');
    expect(src).toContain('passwordResetRedirectTo="/ops/reset-password"');
    expect(src).not.toContain('resolveAdminAccess');
    expect(src).not.toContain('ADMIN_SECRET');
    expect(src).not.toContain('CRON_SECRET');
    expect(src).not.toContain('access.email');
    expect(src).not.toContain('KERSIVO_OPS_EMAILS');
    expect(src).not.toMatch(/email=\{/);
  });

  it('disallows /ops in robots.txt', () => {
    const src = readFileSync(join(here, '../../../pages/robots.txt.ts'), 'utf8');
    expect(src).toContain('Disallow: /ops');
  });
});
