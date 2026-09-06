import { useMemo, useState } from 'react';

import {
  filterServices,
  formatConfidence,
  formatScore,
  profileStatusLabel,
  recommendationVisibilityLabel,
  type OpsDetailService,
  type OpsServiceFilter,
  type OpsShopDetail,
} from '@/lib/recommendations/ops/detailClient';
import { reasonShortLabel } from '@/lib/recommendations/ops/overviewClient';

type Props = {
  detail: OpsShopDetail;
};

const FILTERS: Array<{ id: OpsServiceFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'rail_visible', label: 'Rail visible' },
  { id: 'no_rail', label: 'No rail' },
  { id: 'profile_issue', label: 'Profile outdated/missing' },
];

export function OpsServiceRecommendations({ detail }: Props) {
  const [filter, setFilter] = useState<OpsServiceFilter>('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const services = useMemo(
    () => filterServices(detail.services, filter, search),
    [detail.services, filter, search],
  );

  return (
    <div className="ops-detail-section" data-testid="ops-detail-services">
      {detail.truncation.services ? (
        <p className="ops-banner" role="status">
          Service list is truncated. Showing {detail.returned.services} of active services.
        </p>
      ) : null}
      <div className="ops-filters__search-row">
        <label className="sr-only" htmlFor="ops-svc-search">
          Search services
        </label>
        <input
          id="ops-svc-search"
          className="input ops-filters__search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search services"
        />
      </div>
      <div className="ops-filters__rail" role="toolbar" aria-label="Service filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={
              filter === f.id ? 'ops-filters__chip ops-filters__chip--active' : 'ops-filters__chip'
            }
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {services.length === 0 ? (
        <div className="ops-empty">
          <h2 className="ops-empty__title">No services</h2>
          <p className="ops-empty__body">No services match the current search or filter.</p>
        </div>
      ) : (
        <ul className="ops-detail-list">
          {services.map((svc) => (
            <ServiceRow
              key={svc.id}
              service={svc}
              open={openId === svc.id}
              onToggle={() => setOpenId((id) => (id === svc.id ? null : svc.id))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ServiceRow({
  service,
  open,
  onToggle,
}: {
  service: OpsDetailService;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="ops-detail-list__item">
      <button
        type="button"
        className="ops-detail-list__toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="ops-detail-list__name">{service.name}</span>
        <span className="ops-detail-list__meta">
          {service.category} · Profile {profileStatusLabel(service)} · Rail{' '}
          {service.railWillRender ? 'yes' : 'no'} · Stored {service.storedRecommendationCount} ·
          Visible {service.readableActiveRecommendationCount}
        </span>
      </button>
      {open ? (
        <div className="ops-detail-recs">
          {service.recommendations.length === 0 ? (
            <p className="ops-cr__subtitle">No stored recommendations for this service.</p>
          ) : (
            <ul>
              {service.recommendations.map((rec) => (
                <li key={`${service.id}-${rec.productId}-${rec.rank}`}>
                  <strong>
                    #{rec.rank} {rec.productName}
                  </strong>{' '}
                  ({rec.productCategory || '—'}) · {rec.productActive ? 'Active' : 'Inactive'} ·
                  Score {formatScore(rec.deterministicScore)} · Confidence{' '}
                  {formatConfidence(rec.confidenceGate)}
                  {rec.rerankPosition != null ? ` · Rerank ${rec.rerankPosition}` : ''} ·{' '}
                  {recommendationVisibilityLabel(rec)}
                  <div className="ops-table__muted">
                    {reasonShortLabel(rec.reasonCodes) !== '—'
                      ? reasonShortLabel(rec.reasonCodes)
                      : 'No reason codes'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  );
}
