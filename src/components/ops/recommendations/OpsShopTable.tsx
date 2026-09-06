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

export function OpsShopTable({ shops, nowMs = Date.now() }: Props) {
  return (
    <div className="ops-table-wrap" data-testid="ops-shop-table">
      <table className="ops-table">
        <thead>
          <tr>
            <th scope="col">Shop</th>
            <th scope="col">Health</th>
            <th scope="col">Retail</th>
            <th scope="col">Catalogue</th>
            <th scope="col">Rails</th>
            <th scope="col">Job</th>
            <th scope="col">Versions</th>
            <th scope="col">Updated</th>
            <th scope="col">Reason</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {shops.map((shop) => (
            <tr key={shop.shop.id}>
              <td>
                <div className="ops-table__name">{shop.shop.name}</div>
                <div className="ops-table__muted">{shop.shop.townCity || '—'}</div>
              </td>
              <td>
                <OpsHealthBadge shop={shop} />
              </td>
              <td>{retailEligibilityLabel(shop)}</td>
              <td>
                {shop.catalogue.activeServiceCount} svc
                <div className="ops-table__muted">
                  {shop.catalogue.activeProductCount} products
                </div>
              </td>
              <td>
                <OpsCoverageBar
                  readable={shop.coverage.servicesWithReadableRail}
                  active={shop.coverage.activeServices}
                />
              </td>
              <td>{jobStatusLabel(shop.state.jobStatus)}</td>
              <td>
                {shop.state.catalogueVersion ?? '—'} / {shop.state.publishedCatalogueVersion ?? '—'}
              </td>
              <td title={formatExactTime(shop.state.updatedAt) || undefined}>
                {formatRelativeTime(shop.state.updatedAt, nowMs)}
              </td>
              <td title={shop.health.reasonCodes.join(', ') || undefined}>
                {reasonShortLabel(shop.health.reasonCodes, String(shop.health.code))}
              </td>
              <td>
                <a
                  className="btn btn--secondary ops-inspect"
                  href={inspectHref(shop.shop.id)}
                  aria-label={`Inspect ${shop.shop.name}`}
                >
                  Inspect
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
