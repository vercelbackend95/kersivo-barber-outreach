import React from 'react';
import AdminTrendBadge from './AdminTrendBadge';

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

type MetricDelta = {
  text: string;
  direction: 'up' | 'down' | 'flat';
  className: string;
};

type AdminMetricCardProps = {
  label: string;
  value: React.ReactNode;
  icon?: IconComponent;
  delta?: MetricDelta;
  note?: React.ReactNode;
  sparkline?: React.ReactNode;
  breakdown?: React.ReactNode;
  onClick?: () => void;
  valueVariant?: 'numeric' | 'text';
  className?: string;
};

function MetricCardContent({
  label,
  value,
  icon: Icon,
  delta,
  note,
  sparkline,
  breakdown,
  valueVariant = 'numeric',
}: Omit<AdminMetricCardProps, 'onClick' | 'className'>) {
  return (
    <>
      <div className="admin-metric-card__header">
        <p className="admin-metric-card__label">
          {Icon ? <Icon className="admin-metric-card__icon" width={16} height={16} aria-hidden="true" /> : null}
          <span>{label}</span>
        </p>
        {delta ? (
          <AdminTrendBadge direction={delta.direction} className={delta.className}>
            {delta.text}
          </AdminTrendBadge>
        ) : null}
      </div>
      <p className={`admin-metric-card__value${valueVariant === 'text' ? ' admin-metric-card__value--text' : ''}`}>
        {value}
      </p>
      {note ? <p className="admin-metric-card__note">{note}</p> : null}
      {breakdown ? <div className="admin-metric-card__breakdown">{breakdown}</div> : null}
      {sparkline ? <div className="admin-metric-card__sparkline" aria-hidden="true">{sparkline}</div> : null}
    </>
  );
}

export default function AdminMetricCard({
  onClick,
  className = '',
  ...contentProps
}: AdminMetricCardProps) {
  const classes = `admin-metric-card${onClick ? ' admin-metric-card--clickable' : ''}${className ? ` ${className}` : ''}`.trim();

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        <MetricCardContent {...contentProps} />
      </button>
    );
  }

  return (
    <article className={classes}>
      <MetricCardContent {...contentProps} />
    </article>
  );
}
