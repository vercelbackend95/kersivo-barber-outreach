import { useMemo, useState } from 'react';

import {
  filterProducts,
  formatConfidence,
  profileStatusLabel,
  type OpsProductFilter,
  type OpsShopDetail,
} from '@/lib/recommendations/ops/detailClient';

type Props = {
  detail: OpsShopDetail;
};

const FILTERS: Array<{ id: OpsProductFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'current', label: 'Current profile' },
  { id: 'missing', label: 'Missing profile' },
  { id: 'outdated', label: 'Outdated profile' },
];

export function OpsProductProfiles({ detail }: Props) {
  const [filter, setFilter] = useState<OpsProductFilter>('all');
  const [search, setSearch] = useState('');
  const products = useMemo(
    () => filterProducts(detail.products, filter, search),
    [detail.products, filter, search],
  );

  return (
    <div className="ops-detail-section" data-testid="ops-detail-products">
      {detail.truncation.products ? (
        <p className="ops-banner" role="status">
          Product list is truncated. Showing {detail.returned.products} of active products.
        </p>
      ) : null}
      <div className="ops-filters__search-row">
        <label className="sr-only" htmlFor="ops-prod-search">
          Search products
        </label>
        <input
          id="ops-prod-search"
          className="input ops-filters__search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products"
        />
      </div>
      <div className="ops-filters__rail" role="toolbar" aria-label="Product filters">
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

      {products.length === 0 ? (
        <div className="ops-empty">
          <h2 className="ops-empty__title">No products</h2>
          <p className="ops-empty__body">No products match the current search or filter.</p>
        </div>
      ) : (
        <ul className="ops-detail-list">
          {products.map((p) => (
            <li key={p.id} className="ops-detail-list__item ops-detail-list__item--static">
              <span className="ops-detail-list__name">{p.name}</span>
              <span className="ops-detail-list__meta">
                {p.category} · Profile {profileStatusLabel(p)} · Confidence{' '}
                {formatConfidence(p.profileConfidence)}
              </span>
              <details className="ops-detail-tech">
                <summary>Profile metadata</summary>
                <p>
                  Taxonomy {p.taxonomyVersion || '—'} · Schema {p.schemaVersion || '—'} · Prompt{' '}
                  {p.promptVersion || '—'} · Model {p.modelId || '—'}
                </p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
