import React from 'react';
import type { WorkingHourRow } from './barbersTypes';

type WorkingHoursOverviewProps = {
  weekDays: string[];
  workingHours: WorkingHourRow[];
  loading: boolean;
  saving: boolean;

  onEditDay: (dayOfWeek: number) => void;
};

function formatTimeRange(hour: WorkingHourRow) {
  if (!hour.active) return 'Closed';
  return `${hour.startTime}–${hour.endTime}`;
}

export default function WorkingHoursOverview({
  weekDays,
  workingHours,
  loading,
  saving,

  onEditDay
}: WorkingHoursOverviewProps) {
  return (
    <div className="working-hours-overview" role="list" aria-label="Weekly working hours">
      {workingHours.map((hour) => {
        const dayLabel = weekDays[hour.dayOfWeek] ?? `Day ${hour.dayOfWeek}`;
        const statusText = hour.active ? 'Open' : 'Closed';

        return (
          <article
            key={hour.dayOfWeek}
            className="working-hours-day-card"
            role="listitem"
            tabIndex={0}
            onClick={() => onEditDay(hour.dayOfWeek)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onEditDay(hour.dayOfWeek);
              }
            }}
            aria-label={`Edit ${dayLabel}`}
          >
            <div className="working-hours-day-card__meta">
              <p className="working-hours-day-card__label">{dayLabel}</p>
              <p className={`working-hours-day-card__status ${hour.active ? 'is-open' : 'is-closed'}`}>{statusText}</p>
            </div>

            <p className={`working-hours-time-chip ${hour.active ? '' : 'is-closed'}`}>
              {formatTimeRange(hour)}
            </p>

            <div className="working-hours-day-card__actions" onClick={(event) => event.stopPropagation()}>
              <label className="working-hours-switch" aria-label={`${statusText} ${dayLabel}`}>
                <input
                  type="checkbox"
                  checked={hour.active}
                  onChange={(event) => onToggleDay(hour.dayOfWeek, event.target.checked)}
                  disabled={loading || saving}
                />
                <span>{hour.active ? 'Open' : 'Closed'}</span>
              </label>

              <button
                type="button"
                className="btn btn--ghost working-hours-edit-btn"
                onClick={() => onEditDay(hour.dayOfWeek)}
                disabled={loading || saving}
                aria-label={`Edit ${dayLabel} working hours`}
              >
                ✎
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
