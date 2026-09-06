import { OpsCoverageBar } from '../OpsCoverageBar';
import { OpsHealthBadge } from '../OpsHealthBadge';
import {
  formatExactTime,
  formatRelativeTime,
  jobStatusLabel,
  reasonListLabels,
  type OpsShopDetail,
} from '@/lib/recommendations/ops/detailClient';

type Props = {
  detail: OpsShopDetail;
};

export function OpsHealthSummary({ detail }: Props) {
  const { overview, profileSummary } = detail;
  const reasons = reasonListLabels(overview.health.reasonCodes, String(overview.health.code));
  return (
    <div className="ops-detail-section" data-testid="ops-detail-overview">
      <div className="ops-summary">
        <article className="ops-summary__card">
          <p className="ops-summary__label">Health</p>
          <OpsHealthBadge shop={overview} />
        </article>
        <article className="ops-summary__card">
          <p className="ops-summary__label">Retail</p>
          <p className="ops-summary__value ops-summary__value--sm">
            {overview.retail.eligible ? 'Eligible' : 'Not eligible'}
          </p>
          <p className="ops-summary__hint">
            Paid {overview.retail.paid ? 'yes' : 'no'} · Retail{' '}
            {overview.retail.retailEnabled ? 'on' : 'off'} · Connect{' '}
            {overview.retail.connectAccountPresent ? 'present' : 'missing'} · Charges{' '}
            {overview.retail.connectChargesEnabled ? 'on' : 'off'}
          </p>
        </article>
        <article className="ops-summary__card">
          <p className="ops-summary__label">Catalogue</p>
          <p className="ops-summary__value ops-summary__value--sm">
            {overview.catalogue.activeServiceCount} svc · {overview.catalogue.activeProductCount}{' '}
            prod
          </p>
        </article>
        <article className="ops-summary__card">
          <p className="ops-summary__label">Rails</p>
          <OpsCoverageBar
            readable={overview.coverage.servicesWithReadableRail}
            active={overview.coverage.activeServices}
          />
          <p className="ops-summary__hint">
            Stored {overview.coverage.totalStoredItems} · Readable{' '}
            {overview.coverage.totalReadableActiveItems}
          </p>
        </article>
      </div>

      <section className="ops-detail-panel">
        <h2 className="ops-detail-panel__title">Why this status</h2>
        <ul className="ops-detail-reasons">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section className="ops-detail-panel">
        <h2 className="ops-detail-panel__title">Job state</h2>
        <dl className="ops-detail-dl">
          <div>
            <dt>Status</dt>
            <dd>{jobStatusLabel(overview.state.jobStatus)}</dd>
          </div>
          <div>
            <dt>Attempts</dt>
            <dd>{overview.state.attemptCount ?? '—'}</dd>
          </div>
          <div>
            <dt>Pending version</dt>
            <dd>{overview.state.pendingCatalogueVersion ?? '—'}</dd>
          </div>
          <div>
            <dt>Next attempt</dt>
            <dd title={formatExactTime(overview.state.nextAttemptAt) || undefined}>
              {formatRelativeTime(overview.state.nextAttemptAt)}
            </dd>
          </div>
          <div>
            <dt>Last error</dt>
            <dd>
              {overview.state.lastErrorCode || '—'}
              {overview.state.lastErrorAt
                ? ` · ${formatRelativeTime(overview.state.lastErrorAt)}`
                : ''}
            </dd>
          </div>
        </dl>
      </section>

      <section className="ops-detail-panel">
        <h2 className="ops-detail-panel__title">Versions</h2>
        <dl className="ops-detail-dl">
          <div>
            <dt>Catalogue</dt>
            <dd>{overview.state.catalogueVersion ?? '—'}</dd>
          </div>
          <div>
            <dt>Published catalogue</dt>
            <dd>{overview.state.publishedCatalogueVersion ?? '—'}</dd>
          </div>
          <div>
            <dt>Taxonomy</dt>
            <dd>{overview.publishedSet?.taxonomyVersion ?? overview.state.taxonomyVersion ?? '—'}</dd>
          </div>
          <div>
            <dt>Schema</dt>
            <dd>{overview.publishedSet?.schemaVersion ?? '—'}</dd>
          </div>
          <div>
            <dt>Prompt</dt>
            <dd>{overview.publishedSet?.promptVersion ?? '—'}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{overview.publishedSet?.modelId ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="ops-detail-panel">
        <h2 className="ops-detail-panel__title">Profiles</h2>
        <p>
          Services {profileSummary.activeServicesWithCurrentProfile} /{' '}
          {profileSummary.activeServicesTotal} current · Products{' '}
          {profileSummary.activeProductsWithCurrentProfile} /{' '}
          {profileSummary.activeProductsTotal} current
        </p>
      </section>
    </div>
  );
}
