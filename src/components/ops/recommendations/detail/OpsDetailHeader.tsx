import { OpsHealthBadge } from '../OpsHealthBadge';
import {
  formatExactTime,
  formatRelativeTime,
  type OpsShopDetail,
} from '@/lib/recommendations/ops/detailClient';

type Props = {
  detail: OpsShopDetail | null;
  generatedAt: string | null;
  refreshing: boolean;
  onRefresh: () => void;
};

export function OpsDetailHeader({ detail, generatedAt, refreshing, onRefresh }: Props) {
  const overview = detail?.overview;
  return (
    <header className="ops-detail__header">
      <a className="ops-detail__back" href="/ops/recommendations">
        ← Smart Retail Control Room
      </a>
      <div className="ops-detail__header-row">
        <div className="ops-detail__brand">
          <p className="ops-cr__brand-kicker">KERSIVO Ops</p>
          <h1 className="ops-cr__title">{overview?.shop.name ?? 'Shop detail'}</h1>
          <p className="ops-cr__subtitle">
            {overview?.shop.townCity || '—'} · Read-only monitoring
          </p>
        </div>
        <div className="ops-cr__header-actions">
          {overview ? <OpsHealthBadge shop={overview} /> : null}
          <p className="ops-cr__refreshed" title={formatExactTime(generatedAt) || undefined}>
            {generatedAt
              ? `Last refresh ${formatRelativeTime(generatedAt)}`
              : 'Not refreshed yet'}
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh shop detail"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
    </header>
  );
}
