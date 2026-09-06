import { useCallback, useEffect, useRef, useState } from 'react';

import {
  buildDetailUrl,
  classifyOpsFetchError,
  isOpsDetailPayload,
  userMessageForFetchError,
  type OpsDetailApiError,
  type OpsDetailTab,
  type OpsFetchErrorKind,
  type OpsShopDetail,
} from '@/lib/recommendations/ops/detailClient';

import { OpsBuildHistory } from './OpsBuildHistory';
import { OpsDetailHeader } from './OpsDetailHeader';
import { OpsHealthSummary } from './OpsHealthSummary';
import { OpsProductProfiles } from './OpsProductProfiles';
import { OpsServiceRecommendations } from './OpsServiceRecommendations';
import { OpsTechnicalFacts } from './OpsTechnicalFacts';

const TABS: Array<{ id: OpsDetailTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'services', label: 'Services & recommendations' },
  { id: 'products', label: 'Products & profiles' },
  { id: 'builds', label: 'Build history' },
];

type Props = {
  shopId: string;
  fetchImpl?: typeof fetch;
};

export default function RecommendationOpsShopDetail({
  shopId,
  fetchImpl = fetch,
}: Props) {
  const [detail, setDetail] = useState<OpsShopDetail | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [tab, setTab] = useState<OpsDetailTab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorKind, setErrorKind] = useState<OpsFetchErrorKind | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [malformed, setMalformed] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const requestGen = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const hasLoadedOnce = useRef(false);

  const clearSensitive = () => {
    setDetail(null);
    setGeneratedAt(null);
    hasLoadedOnce.current = false;
  };

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      const gen = ++requestGen.current;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setErrorKind(null);
      setNotFound(false);
      setMalformed(false);
      setStatusMessage(mode === 'refresh' ? 'Refreshing…' : 'Loading…');

      try {
        const res = await fetchImpl(buildDetailUrl(shopId), {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          signal: ac.signal,
          headers: { Accept: 'application/json' },
        });
        if (gen !== requestGen.current) return;

        let body: unknown = null;
        try {
          body = await res.json();
        } catch {
          body = null;
        }
        if (gen !== requestGen.current) return;

        if (!res.ok) {
          const code =
            body && typeof body === 'object' && body !== null && 'error' in body
              ? (body as OpsDetailApiError).error?.code
              : undefined;
          if (res.status === 404 || code === 'NOT_FOUND' || code === 'INVALID_QUERY') {
            setNotFound(true);
            clearSensitive();
            setStatusMessage('Shop not found.');
            return;
          }
          const kind = classifyOpsFetchError(res.status, code);
          setErrorKind(kind);
          setStatusMessage(userMessageForFetchError(kind));
          if (kind === 'unauthorized' || kind === 'forbidden' || kind === 'unconfigured') {
            clearSensitive();
          }
          return;
        }

        if (!isOpsDetailPayload(body)) {
          setMalformed(true);
          setStatusMessage('Unable to load shop detail.');
          if (!hasLoadedOnce.current) clearSensitive();
          return;
        }

        setDetail(body.data);
        setGeneratedAt(body.generatedAt);
        setErrorKind(null);
        setStatusMessage(mode === 'refresh' ? 'Refresh complete.' : 'Detail loaded.');
        hasLoadedOnce.current = true;
      } catch {
        if (ac.signal.aborted || gen !== requestGen.current) return;
        const kind = classifyOpsFetchError(null);
        setErrorKind(kind);
        setStatusMessage(userMessageForFetchError(kind));
        if (!hasLoadedOnce.current) clearSensitive();
      } finally {
        if (gen === requestGen.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [fetchImpl, shopId],
  );

  useEffect(() => {
    void load('initial');
    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  const signInHref = `/ops/recommendations/${encodeURIComponent(shopId)}`;

  return (
    <div className="ops-cr ops-detail">
      <OpsDetailHeader
        detail={detail}
        generatedAt={generatedAt}
        refreshing={refreshing}
        onRefresh={() => void load('refresh')}
      />

      <p
        className={errorKind || malformed ? 'ops-cr__status ops-cr__status--error' : 'ops-cr__status'}
        role="status"
        aria-live="polite"
      >
        {statusMessage}
      </p>

      {errorKind === 'unauthorized' ? (
        <div className="ops-error-panel" role="alert">
          <h2 className="ops-error-panel__title">Session expired</h2>
          <p className="ops-error-panel__body">{userMessageForFetchError('unauthorized')}</p>
          <div className="ops-error-panel__actions">
            <a className="btn btn--primary" href={signInHref}>
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
      {(errorKind === 'server' || errorKind === 'network' || malformed) && !detail ? (
        <div className="ops-error-panel" role="alert">
          <h2 className="ops-error-panel__title">Unable to load</h2>
          <p className="ops-error-panel__body">
            {malformed
              ? 'The shop detail response was incomplete.'
              : userMessageForFetchError(errorKind ?? 'unknown')}
          </p>
          <div className="ops-error-panel__actions">
            <button type="button" className="btn btn--primary" onClick={() => void load('refresh')}>
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {notFound ? (
        <div className="ops-empty" role="status">
          <h2 className="ops-empty__title">Shop not found</h2>
          <p className="ops-empty__body">
            This shop is unavailable or the identifier is not valid for Ops.
          </p>
          <a className="btn btn--secondary" href="/ops/recommendations">
            Back to overview
          </a>
        </div>
      ) : null}

      {loading && !detail ? (
        <div aria-busy="true" aria-label="Loading shop detail">
          <div className="ops-skeleton-row" />
          <div className="ops-skeleton-row" />
          <div className="ops-skeleton-row" />
        </div>
      ) : null}

      {detail ? (
        <>
          <div className="ops-tabs" role="tablist" aria-label="Shop detail sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`ops-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`ops-panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                className={tab === t.id ? 'ops-tabs__tab ops-tabs__tab--active' : 'ops-tabs__tab'}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id={`ops-panel-${tab}`}
            aria-labelledby={`ops-tab-${tab}`}
            className="ops-tabpanel"
          >
            {tab === 'overview' ? <OpsHealthSummary detail={detail} /> : null}
            {tab === 'services' ? <OpsServiceRecommendations detail={detail} /> : null}
            {tab === 'products' ? <OpsProductProfiles detail={detail} /> : null}
            {tab === 'builds' ? <OpsBuildHistory detail={detail} /> : null}
          </div>

          <OpsTechnicalFacts shopId={shopId} />
        </>
      ) : null}
    </div>
  );
}
