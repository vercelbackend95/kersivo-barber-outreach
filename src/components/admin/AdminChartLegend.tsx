import React from 'react';
import { BarChart2 } from '../lucide-react';
import LeaderCrownIcon from './LeaderCrownIcon';

export type ChartLegendItem = {
  key: string;
  label: string;
  color: string;
  isOverall?: boolean;
  avatarUrl?: string | null;
  iconSrc?: string;
  initials?: string;
  isWinner?: boolean;
};

type AdminChartLegendProps = {
  items: ChartLegendItem[];
  onRemove?: (key: string) => void;
  hint?: string | null;
  addControl?: React.ReactNode;
};

function LegendSwatch({ item }: { item: ChartLegendItem }) {
  if (item.isOverall) {
    return (
      <span className="admin-chart-legend__avatar admin-chart-legend__avatar--icon" aria-hidden="true">
        <BarChart2 width={12} height={12} />
      </span>
    );
  }

  if (item.avatarUrl) {
    return (
      <img
        src={item.avatarUrl}
        alt=""
        className="admin-chart-legend__avatar"
        aria-hidden="true"
      />
    );
  }

  if (item.initials) {
    return (
      <span className="admin-chart-legend__avatar admin-chart-legend__avatar--initials" aria-hidden="true">
        {item.initials}
      </span>
    );
  }

  return (
    <span
      className="admin-chart-legend__swatch"
      style={{ background: item.color }}
      aria-hidden="true"
    />
  );
}

export default function AdminChartLegend({
  items,
  onRemove,
  hint,
  addControl,
}: AdminChartLegendProps) {
  return (
    <div className="admin-chart-legend" aria-live="polite">
      <div className="admin-chart-legend__pills" role="list" aria-label="Chart series legend">
        {items.map((item) => (
          <span
            key={item.key}
            className={`admin-chart-legend__pill${item.isOverall ? ' admin-chart-legend__pill--overall' : ''}${item.isWinner ? ' admin-chart-legend__pill--winner' : ''}`}
            role="listitem"
            aria-label={item.isWinner ? `${item.label}, week leader` : item.label}
            style={{ ['--pill-series-color' as '--pill-series-color']: item.color }}
          >
            <LegendSwatch item={item} />
            <span className="admin-chart-legend__label">{item.label}</span>
            {item.isWinner ? (
              <LeaderCrownIcon className="admin-chart-legend__crown" width={14} height={14} />
            ) : null}
            {!item.isOverall && onRemove ? (
              <button
                type="button"
                className="admin-chart-legend__remove"
                onClick={() => onRemove(item.key)}
                aria-label={`Remove ${item.label}`}
              >
                ×
              </button>
            ) : null}
          </span>
        ))}
        {addControl}
      </div>
      {hint ? <p className="admin-chart-legend__hint">{hint}</p> : null}
    </div>
  );
}
