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

export function SkeletonTimelineRows({ lanes = 4 }: { lanes?: number }) {
  const laneWidths = [
    ['14%', '11%', '16%'],
    ['12%', '18%', '13%'],
    ['16%', '10%', '15%'],
    ['13%', '14%', '12%']
  ];

  return (
    <section className="admin-timeline admin-timeline--skeleton" aria-busy="true" aria-hidden="true">
      <div className="admin-timeline-scroll">
        <div className="admin-timeline-matrix admin-timeline-matrix--terminal">
          <div className="admin-timeline-barber-header" style={{ gridColumn: 1, gridRow: 1 }}>
            <span className="skeleton skeleton--text-sm admin-timeline-skeleton-barber-header" />
          </div>
          <div className="admin-timeline-scale admin-timeline-scale--skeleton" role="presentation" style={{ gridColumn: 2, gridRow: 1 }}>
            {Array.from({ length: 8 }).map((_, index) => (
              <span
                key={`timeline-scale-skeleton-${index}`}
                className={`admin-timeline-tick admin-timeline-tick--major admin-timeline-tick--skeleton${index % 2 === 0 ? ' is-even' : ''}`}
                style={{ left: `${(index / 7) * 100}%` }}
              >
                <span className="skeleton skeleton--text-sm admin-timeline-skeleton-tick-label" />
              </span>
            ))}
          </div>
          <div className="admin-timeline-terminal-header" aria-hidden="true" style={{ gridColumn: 3, gridRow: 1 }} />

          {Array.from({ length: lanes }).map((_, laneIndex) => {
            const laneRow = laneIndex + 2;
            const stripe = laneIndex % 2 === 0;
            return (
              <React.Fragment key={`timeline-lane-skeleton-${laneIndex}`}>
                <div
                  className={`admin-timeline-lane-label admin-timeline-lane-label--skeleton${stripe ? ' admin-timeline-lane-label--alt' : ''}`}
                  style={{ gridColumn: 1, gridRow: laneRow }}
                >
                  <span className="skeleton skeleton--text admin-timeline-skeleton-lane-label" />
                </div>
                <div
                  className={`admin-timeline-lane-canvas admin-timeline-lane-canvas--skeleton${stripe ? ' admin-timeline-lane-canvas--alt' : ''}`}
                  style={{ gridColumn: 2, gridRow: laneRow, minHeight: '96px' }}
                >
                  <div className="admin-timeline-lane-grid" aria-hidden="true">
                    {Array.from({ length: 16 }).map((__, gridIndex) => (
                      <span
                        key={`timeline-grid-skeleton-${laneIndex}-${gridIndex}`}
                        className={`admin-timeline-grid-line ${gridIndex % 2 === 0 ? 'admin-timeline-grid-line--major' : 'admin-timeline-grid-line--minor'}`}
                        style={{ left: `${(gridIndex / 15) * 100}%` }}
                      />
                    ))}
                  </div>
                  {laneWidths[laneIndex % laneWidths.length].map((width, blockIndex) => (
                    <article
                      key={`timeline-block-skeleton-${laneIndex}-${blockIndex}`}
                      className="admin-timeline-card admin-timeline-card--booking admin-timeline-card--skeleton"
                      style={{
                        left: `${8 + blockIndex * 30}%`,
                        width,
                        top: `${10 + blockIndex * 22}px`,
                        height: '58px'
                      }}
                    >
                      <span className="skeleton skeleton--text-sm" style={{ width: '40%' }} />
                      <span className="skeleton skeleton--text-sm" style={{ width: '68%' }} />
                      <span className="skeleton skeleton--text-sm" style={{ width: '52%' }} />
                    </article>
                  ))}
                </div>
              </React.Fragment>
            );
          })}

          <div
            className="admin-timeline-terminal-rail"
            style={{ gridColumn: 3, gridRow: `2 / ${2 + lanes}` }}
            aria-hidden="true"
          >
            <span className="skeleton admin-timeline-skeleton-terminal-rail" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function SkeletonBarberRosterCards({
  count = 3,
  variant = 'ops'
}: {
  count?: number;
  variant?: 'ops' | 'manage';
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <li
          key={`barber-roster-skeleton-${variant}-${index}`}
          className="admin-barber-card admin-barber-card--roster admin-barber-card--skeleton"
          aria-hidden="true"
        >
          <article className="admin-barber-identity admin-barber-identity--roster">
            <div className="admin-barber-roster-hero">
              <span className="skeleton skeleton--text-sm admin-barber-skeleton-rank" />
              <div className="admin-barber-roster-avatar-shell">
                <span className="skeleton skeleton--avatar admin-barber-skeleton-avatar" />
                <span className="skeleton admin-barber-skeleton-dot" />
              </div>
              <span className="skeleton skeleton--text-sm admin-barber-skeleton-pill" />
            </div>

            <div className="admin-barber-roster-body">
              <div className="admin-barber-name-row admin-barber-roster-name-row admin-barber-skeleton-name-row">
                <span className="skeleton skeleton--title admin-barber-skeleton-name" />
                {variant === 'manage' ? (
                  <span className="skeleton skeleton--text-sm admin-barber-skeleton-hidden-badge" />
                ) : null}
                {variant === 'manage' ? (
                  <div className="admin-barber-skeleton-reorder">
                    <span className="skeleton admin-barber-skeleton-reorder-btn" />
                    <span className="skeleton admin-barber-skeleton-reorder-btn" />
                  </div>
                ) : null}
              </div>

              <div className="admin-barber-roster-meta">
                <span className="admin-barber-roster-shift">
                  <i className="skeleton admin-barber-skeleton-meta-icon" />
                  <span className="skeleton skeleton--text-sm admin-barber-skeleton-shift-copy" />
                </span>
                <div className="admin-barber-roster-next">
                  <i className="skeleton admin-barber-skeleton-meta-icon" />
                  <div className="admin-barber-roster-next-copy">
                    <span className="skeleton skeleton--text-sm admin-barber-skeleton-next-primary" />
                    <span className="skeleton skeleton--text-sm admin-barber-skeleton-next-secondary" />
                  </div>
                </div>
              </div>

              <span className="admin-barber-roster-cta admin-barber-roster-cta--skeleton">
                <span className="skeleton skeleton--text-sm admin-barber-skeleton-cta-copy" />
                <i className="skeleton admin-barber-skeleton-cta-icon" />
              </span>
            </div>
          </article>
          <div className="admin-barber-roster-toolbar">
            <div className="admin-barber-day-fill-row admin-barber-day-fill-row--roster">
              <span className="skeleton admin-barber-skeleton-progress" />
            </div>
          </div>
        </li>
      ))}
    </>
  );
}

/** Barber roster grid loading shell — matches Admin → Barbers (manage skeleton × 6). */
export function BarberRosterOverviewGridSkeleton({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div className="admin-barber-list-wrap admin-barbers-overview-list-wrap">
      <ul className="admin-barber-grid admin-barbers-overview-grid" aria-label={ariaLabel} aria-busy="true">
        <SkeletonBarberRosterCards count={6} variant="manage" />
      </ul>
    </div>
  );
}
