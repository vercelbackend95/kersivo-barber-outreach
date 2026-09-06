import {
  formatExactTime,
  formatRelativeTime,
  jobStatusLabel,
  reasonShortLabel,
  retailEligibilityLabel,
  type OpsShopOverview,
} from '@/lib/recommendations/ops/overviewClient';

import { OpsCoverageBar } from './OpsCoverageBar';
import { OpsHealthBadge } from './OpsHealthBadge';

type Props = {
  shops: OpsShopOverview[];
  nowMs?: number;
};

function inspectHref(shopId: string): string {
  return `/ops/recommendations/${encodeURIComponent(shopId)}`;
}

export function OpsShopCard({ shops, nowMs = Date.now() }: Props) {
  return (
    <div className="ops-cards" data-testid="ops-shop-cards">
      {shops.map((shop) => (
        <article className="ops-card" key={shop.shop.id} data-shop-id={shop.shop.id}>
          <div className="ops-card__top">
            <div>
              <h3 className="ops-card__name">{shop.shop.name}</h3>
              <p className="ops-card__meta">{shop.shop.townCity || '—'}</p>
            </div>
            <OpsHealthBadge shop={shop} />
          </div>
          <div className="ops-card__grid">
            <div>
              <span className="ops-card__field-label">Retail</span>
              <span className="ops-card__field-value">{retailEligibilityLabel(shop)}</span>
            </div>
            <div>
              <span className="ops-card__field-label">Catalogue</span>
              <span className="ops-card__field-value">
                {shop.catalogue.activeServiceCount} svc · {shop.catalogue.activeProductCount} prod
              </span>
            </div>
            <div>
              <span className="ops-card__field-label">Rails</span>
              <OpsCoverageBar
                readable={shop.coverage.servicesWithReadableRail}
                active={shop.coverage.activeServices}
              />
            </div>
            <div>
              <span className="ops-card__field-label">Job</span>
              <span className="ops-card__field-value">{jobStatusLabel(shop.state.jobStatus)}</span>
            </div>
            <div>
              <span className="ops-card__field-label">Versions</span>
              <span className="ops-card__field-value">
                Cat {shop.state.catalogueVersion ?? '—'} / Pub{' '}
                {shop.state.publishedCatalogueVersion ?? '—'}
              </span>
            </div>
            <div>
              <span className="ops-card__field-label">Updated</span>
              <span
                className="ops-card__field-value"
                title={formatExactTime(shop.state.updatedAt) || undefined}
              >
                {formatRelativeTime(shop.state.updatedAt, nowMs)}
              </span>
            </div>
          </div>
          <p className="ops-card__reason" title={shop.health.reasonCodes.join(', ') || undefined}>
            {reasonShortLabel(shop.health.reasonCodes, String(shop.health.code))}
          </p>
          <a
            className="btn btn--secondary ops-inspect"
            href={inspectHref(shop.shop.id)}
            aria-label={`Inspect ${shop.shop.name}`}
          >
            Inspect
          </a>
        </article>
      ))}
    </div>
  );
}
