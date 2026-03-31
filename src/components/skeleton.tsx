import React from 'react';

/* ─────────────────────────────────────────────────────────────
   Booking choice card skeletons (services / barbers)
   ───────────────────────────────────────────────────────────── */

export function SkeletonBookingChoices({ count = 4, variant = 'service' }: { count?: number; variant?: 'service' | 'barber' }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`skeleton--card skeleton-booking-choice-card${variant === 'service' ? ' skeleton-booking-choice-card--service' : ''}`}
          aria-hidden="true"
        >
          {variant === 'barber' ? (
            <>
              <span className="skeleton skeleton--avatar" style={{ margin: '0 auto' }} />
              <span className="skeleton skeleton--text" style={{ width: '70%', margin: '0 auto' }} />
            </>
          ) : (
            <>
              <span className="skeleton skeleton--title" style={{ width: '65%' }} />
              <span className="skeleton skeleton--text" style={{ marginTop: 'auto', width: '45%' }} />
              <span className="skeleton skeleton--text-sm" style={{ width: '35%' }} />
            </>
          )}
        </div>
      ))}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Time slot grid skeletons
   ───────────────────────────────────────────────────────────── */

export function SkeletonSlotGrid({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="skeleton--card skeleton-booking-choice-card skeleton-booking-choice-card--slot"
          aria-hidden="true"
        >
          <span className="skeleton skeleton--text" style={{ width: '60%' }} />
          <span className="skeleton skeleton--text-sm" style={{ width: '45%' }} />
        </div>
      ))}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Table row skeletons
   ───────────────────────────────────────────────────────────── */

const TABLE_COL_WIDTHS = ['70%', '55%', '60%', '50%', '30%', '40%', '80px'];

export function SkeletonTableRows({ count = 5, cols = 6 }: { count?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, rowIndex) => (
        <tr key={rowIndex} className="skeleton-table-row" aria-hidden="true">
          {Array.from({ length: cols }, (__, colIndex) => (
            <td key={colIndex}>
              <span
                className="skeleton skeleton-table-cell"
                style={{ width: TABLE_COL_WIDTHS[colIndex] ?? '60%' }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   KPI card skeletons (reports grid)
   ───────────────────────────────────────────────────────────── */

export function SkeletonKPICards({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="skeleton--card skeleton-kpi-card"
          aria-hidden="true"
        >
          <span className="skeleton skeleton--text-sm" style={{ width: '45%' }} />
          <span className="skeleton skeleton--title" style={{ width: '55%' }} />
          <span className="skeleton skeleton--text-sm" style={{ width: '35%' }} />
        </div>
      ))}
    </>
  );
}
