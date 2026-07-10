import React from 'react';

type TrendDirection = 'up' | 'down' | 'flat';

type AdminTrendBadgeProps = {
  direction?: TrendDirection;
  className?: string;
  children: React.ReactNode;
};

export default function AdminTrendBadge({
  direction,
  className = '',
  children,
}: AdminTrendBadgeProps) {
  const toneClass = className.includes('admin-kpi-trend--')
    ? className
    : direction === 'up'
      ? 'admin-kpi-trend--up'
      : direction === 'down'
        ? 'admin-kpi-trend--down'
        : 'admin-kpi-trend--flat';

  return (
    <span className={`admin-trend-badge ${toneClass}`.trim()}>
      {direction === 'up' ? (
        <svg aria-hidden="true" className="admin-trend-badge__icon" viewBox="0 0 8 8" fill="currentColor">
          <path d="M4 0L8 8H0Z" />
        </svg>
      ) : direction === 'down' ? (
        <svg aria-hidden="true" className="admin-trend-badge__icon" viewBox="0 0 8 8" fill="currentColor">
          <path d="M4 8L0 0H8Z" />
        </svg>
      ) : null}
      {children}
    </span>
  );
}
