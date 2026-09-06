import {
  formatDurationMs,
  formatExactTime,
  formatRelativeTime,
  setStatusLabel,
  statsDisplayRows,
  type OpsShopDetail,
} from '@/lib/recommendations/ops/detailClient';

type Props = {
  detail: OpsShopDetail;
};

export function OpsBuildHistory({ detail }: Props) {
  const sets = [...detail.recentSets].sort(
    (a, b) => Date.parse(b.buildStartedAt) - Date.parse(a.buildStartedAt),
  );

  if (sets.length === 0) {
    return (
      <div className="ops-detail-section" data-testid="ops-detail-builds">
        <div className="ops-empty">
          <h2 className="ops-empty__title">No recommendation sets</h2>
          <p className="ops-empty__body">This shop has no recent recommendation builds.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ops-detail-section" data-testid="ops-detail-builds">
      <ul className="ops-detail-list">
        {sets.map((set) => {
          const stats = statsDisplayRows(set.stats);
          return (
            <li key={set.id} className="ops-detail-list__item ops-detail-list__item--static">
              <span className="ops-detail-list__name">
                {setStatusLabel(set.status)} · catalogue v{set.catalogueVersion}
              </span>
              <span className="ops-detail-list__meta">
                Taxonomy {set.taxonomyVersion} · Schema {set.schemaVersion} · Prompt{' '}
                {set.promptVersion} · Model {set.modelId || '—'}
                {set.rerankModelId ? ` · Rerank ${set.rerankModelId}` : ''}
              </span>
              <span className="ops-detail-list__meta">
                Started{' '}
                <span title={formatExactTime(set.buildStartedAt)}>
                  {formatRelativeTime(set.buildStartedAt)}
                </span>{' '}
                · Finished{' '}
                <span title={formatExactTime(set.buildFinishedAt) || undefined}>
                  {set.buildFinishedAt ? formatRelativeTime(set.buildFinishedAt) : '—'}
                </span>{' '}
                · Duration {formatDurationMs(set.buildStartedAt, set.buildFinishedAt)}
                {set.errorCode ? ` · Error ${set.errorCode}` : ''}
              </span>
              {stats.length > 0 ? (
                <ul className="ops-stats">
                  {stats.map((row) => (
                    <li key={row.label}>
                      {row.label}: {row.value}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
