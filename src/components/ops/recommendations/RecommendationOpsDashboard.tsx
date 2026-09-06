import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildOverviewUrl,
  classifyOpsFetchError,
  computePageSummary,
  filterShops,
  formatExactTime,
  formatRelativeTime,
  userMessageForFetchError,
  type OpsClientFilter,
  type OpsFetchErrorKind,
  type OpsOverviewApiError,
  type OpsOverviewApiSuccess,
  type OpsShopOverview,
} from '@/lib/recommendations/ops/overviewClient';

import { OpsFilters } from './OpsFilters';
import { OpsShopCard } from './OpsShopCard';
import { OpsShopTable } from './OpsShopTable';
import { OpsSummaryCards } from './OpsSummaryCards';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_LIMIT = 100;
const SIGN_IN_HREF = '/ops/recommendations';

type LoadMode = 'initial' | 'refresh' | 'search' | 'page';

type Props = {
  fetchImpl?: typeof fetch;
};

export default function RecommendationOpsDashboard({ fetchImpl = fetch }: Props) {
  const [shops, setShops] = useState<OpsShopOverview[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<OpsClientFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<OpsFetchErrorKind | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const requestGen = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  // Reset pagination when debounced search changes (not on every keystroke).
  const searchEpoch = useRef(debouncedSearch);
  useEffect(() => {
    if (searchEpoch.current === debouncedSearch) return;
    searchEpoch.current = debouncedSearch;
    setCursorStack([null]);
    setPageIndex(0);
    setNextCursor(null);
  }, [debouncedSearch]);

  const currentCursor = cursorStack[pageIndex] ?? null;

  const load = useCallback(
    async (mode: LoadMode, opts?: { cursor?: string | null; q?: string }) => {
      const gen = ++requestGen.current;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      if (mode === 'initial' || (mode === 'search' && !hasLoadedOnce.current)) {
        setLoading(true);
      } else if (mode === 'refresh') {
        setRefreshing(true);
      } else if (mode === 'page' || mode === 'search') {
        setNavigating(true);
      }

      setErrorKind(null);
      if (mode === 'refresh') {
        setStatusMessage('Refreshing…');
      } else if (mode !== 'initial') {
        setStatusMessage('Loading…');
      }

      const q = opts?.q ?? debouncedSearch;
      const cursor = opts?.cursor !== undefined ? opts.cursor : currentCursor;
      const url = buildOverviewUrl({ q, cursor, limit: PAGE_LIMIT });

      try {
        const res = await fetchImpl(url, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          signal: ac.signal,
          headers: { Accept: 'application/json' },
        });

        if (gen !== requestGen.current) return;

        let body: OpsOverviewApiSuccess | OpsOverviewApiError | null = null;
        try {
          body = (await res.json()) as OpsOverviewApiSuccess | OpsOverviewApiError;
        } catch {
          body = null;
        }

        if (gen !== requestGen.current) return;

        if (!res.ok || !body || body.ok !== true) {
          const code =
            body && typeof body === 'object' && 'error' in body
              ? (body as OpsOverviewApiError).error?.code
              : undefined;
          const kind = classifyOpsFetchError(res.status, code);
          setErrorKind(kind);
          setStatusMessage(userMessageForFetchError(kind));
          if (
            kind === 'unauthorized' ||
            kind === 'forbidden' ||
            kind === 'unconfigured'
          ) {
            setShops([]);
            setNextCursor(null);
            setCursorStack([null]);
            setPageIndex(0);
            hasLoadedOnce.current = false;
          } else if (!hasLoadedOnce.current) {
            setShops([]);
          }
          return;
        }

        setShops(body.data.shops);
        setNextCursor(body.nextCursor);
        setGeneratedAt(body.generatedAt);
        setErrorKind(null);
        setStatusMessage(
          mode === 'refresh' ? 'Refresh complete.' : `Loaded ${body.data.shops.length} shops.`,
        );
        hasLoadedOnce.current = true;
      } catch (err) {
        if (ac.signal.aborted || gen !== requestGen.current) return;
        const kind = classifyOpsFetchError(null);
        setErrorKind(kind);
        setStatusMessage(userMessageForFetchError(kind));
        if (!hasLoadedOnce.current) setShops([]);
      } finally {
        if (gen === requestGen.current) {
          setLoading(false);
          setRefreshing(false);
          setNavigating(false);
        }
      }
    },
    [currentCursor, debouncedSearch, fetchImpl],
  );

  useEffect(() => {
    void load(hasLoadedOnce.current ? 'search' : 'initial', {
      cursor: currentCursor,
      q: debouncedSearch,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: reload on search/page cursor
  }, [debouncedSearch, pageIndex, currentCursor]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const onRefresh = () => {
    void load('refresh', { cursor: currentCursor, q: debouncedSearch });
  };

  const onClear = () => {
    setSearchInput('');
    setFilter('all');
  };

  const onNext = () => {
    if (!nextCursor || navigating || loading) return;
    setCursorStack((stack) => {
      const trimmed = stack.slice(0, pageIndex + 1);
      return [...trimmed, nextCursor];
    });
    setPageIndex((i) => i + 1);
  };

  const onPrev = () => {
    if (pageIndex <= 0 || navigating || loading) return;
    setPageIndex((i) => i - 1);
  };

  const filtered = useMemo(() => filterShops(shops, filter), [shops, filter]);
  const summary = useMemo(() => computePageSummary(shops), [shops]);
  const nowMs = Date.now();
  const busy = loading || refreshing || navigating;

  return (
    <div className="ops-cr">
      <header className="ops-cr__header">
        <div className="ops-cr__brand">
          <p className="ops-cr__brand-kicker">KERSIVO Ops</p>
          <h1 className="ops-cr__title">Smart Retail Control Room</h1>
          <p className="ops-cr__subtitle">Read-only monitoring</p>
        </div>
        <div className="ops-cr__header-actions">
          <p
            className="ops-cr__refreshed"
            title={formatExactTime(generatedAt) || undefined}
          >
            {generatedAt
              ? `Last refresh ${formatRelativeTime(generatedAt, nowMs)}`
              : 'Not refreshed yet'}
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onRefresh}
            disabled={refreshing || (loading && !hasLoadedOnce.current)}
            aria-label="Refresh shop overview"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      <p
        className={
          errorKind ? 'ops-cr__status ops-cr__status--error' : 'ops-cr__status'
        }
        role="status"
        aria-live="polite"
      >
        {statusMessage}
      </p>

      <OpsSummaryCards summary={summary} />

      <OpsFilters
        search={searchInput}
        onSearchChange={setSearchInput}
        filter={filter}
        onFilterChange={setFilter}
        onClear={onClear}
        disabled={loading && !hasLoadedOnce.current}
      />

      {errorKind === 'unauthorized' ? (
        <div className="ops-error-panel" role="alert">
          <h2 className="ops-error-panel__title">Session expired</h2>
          <p className="ops-error-panel__body">{userMessageForFetchError('unauthorized')}</p>
          <div className="ops-error-panel__actions">
            <a className="btn btn--primary" href={SIGN_IN_HREF}>
              Sign in again
            </a>
          </div>
        </div>
      ) : null}

      {errorKind === 'forbidden' ? (
        <div className="ops-error-panel" role="alert">
          <h2 className="ops-error-panel__title">Access denied</h2>
          <p className="ops-error-panel__body">{userMessageForFetchError('forbidden')}</p>
        </div>
      ) : null}

      {errorKind === 'unconfigured' ? (
        <div className="ops-error-panel" role="alert">
          <h2 className="ops-error-panel__title">Configuration unavailable</h2>
          <p className="ops-error-panel__body">{userMessageForFetchError('unconfigured')}</p>
        </div>
      ) : null}

      {errorKind &&
      errorKind !== 'unauthorized' &&
      errorKind !== 'forbidden' &&
      errorKind !== 'unconfigured' &&
      !hasLoadedOnce.current ? (
        <div className="ops-error-panel" role="alert">
          <h2 className="ops-error-panel__title">Unable to load</h2>
          <p className="ops-error-panel__body">{userMessageForFetchError(errorKind)}</p>
          <div className="ops-error-panel__actions">
            <button type="button" className="btn btn--primary" onClick={onRefresh}>
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {loading && !hasLoadedOnce.current ? (
        <div aria-busy="true" aria-label="Loading shops">
          <div className="ops-skeleton-row" />
          <div className="ops-skeleton-row" />
          <div className="ops-skeleton-row" />
        </div>
      ) : null}

      {hasLoadedOnce.current && shops.length === 0 && !errorKind ? (
        <div className="ops-empty">
          <h2 className="ops-empty__title">
            {debouncedSearch ? 'No search results' : 'No shops yet'}
          </h2>
          <p className="ops-empty__body">
            {debouncedSearch
              ? 'No shops match that name. Clear search or try another query.'
              : 'There are no shops to monitor on this page.'}
          </p>
        </div>
      ) : null}

      {hasLoadedOnce.current && shops.length > 0 && filtered.length === 0 ? (
        <div className="ops-empty">
          <h2 className="ops-empty__title">No shops match this filter</h2>
          <p className="ops-empty__body">
            Filters only apply to shops loaded on this page. Clear filters to see all loaded
            shops.
          </p>
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <>
          <OpsShopTable shops={filtered} nowMs={nowMs} />
          <OpsShopCard shops={filtered} nowMs={nowMs} />
        </>
      ) : null}

      <div className="ops-pager">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onPrev}
          disabled={pageIndex <= 0 || busy}
          aria-label="Previous page"
        >
          Previous
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onNext}
          disabled={!nextCursor || busy}
          aria-label="Next page"
        >
          Next
        </button>
        <span className="ops-cr__refreshed">Page {pageIndex + 1}</span>
      </div>
    </div>
  );
}
