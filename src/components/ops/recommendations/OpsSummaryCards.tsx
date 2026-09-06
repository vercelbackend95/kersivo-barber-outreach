import type { OpsPageSummary } from '@/lib/recommendations/ops/overviewClient';

type Props = {
  summary: OpsPageSummary;
};

export function OpsSummaryCards({ summary }: Props) {
  const railsText =
    summary.activeServicesOnPage > 0
      ? `${summary.railsVisibleServices} of ${summary.activeServicesOnPage} services`
      : `${summary.railsVisibleServices} services`;

  return (
    <section className="ops-summary" aria-label="Page-level summary">
      <article className="ops-summary__card">
        <p className="ops-summary__label">Shops on this page</p>
        <p className="ops-summary__value">{summary.shopsOnPage}</p>
        <p className="ops-summary__hint">Current page only</p>
      </article>
      <article className="ops-summary__card">
        <p className="ops-summary__label">Healthy</p>
        <p className="ops-summary__value">{summary.healthy}</p>
        <p className="ops-summary__hint">Severity OK on this page</p>
      </article>
      <article className="ops-summary__card">
        <p className="ops-summary__label">Needs attention</p>
        <p className="ops-summary__value">{summary.needsAttention}</p>
        <p className="ops-summary__hint">Warning or critical</p>
      </article>
      <article className="ops-summary__card">
        <p className="ops-summary__label">Rails visible</p>
        <p className="ops-summary__value">{summary.railsVisibleServices}</p>
        <p className="ops-summary__hint">{railsText}</p>
      </article>
    </section>
  );
}
