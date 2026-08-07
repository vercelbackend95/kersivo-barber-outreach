import React from 'react';
import { DAY_LABELS, type WeeklyRule } from './types';

export function WeeklyHoursEditor({
  rules,
  onChange,
  disabled,
  idPrefix,
}: {
  rules: WeeklyRule[];
  onChange: (next: WeeklyRule[]) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  const update = (dayOfWeek: number, patch: Partial<WeeklyRule>) => {
    onChange(
      rules.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row)),
    );
  };

  return (
    <div className="client-onboarding__section" role="group" aria-label="Weekly hours">
      {rules.map((row) => {
        const labelId = `${idPrefix}-day-${row.dayOfWeek}`;
        return (
          <div key={row.dayOfWeek} className="client-onboarding__hours-row">
            <div>
              <span id={labelId} className="admin-onboarding__switch-text">
                {DAY_LABELS[row.dayOfWeek]}
              </span>
            </div>
            <div className="client-onboarding__hours-times">
              <button
                type="button"
                role="switch"
                aria-checked={row.active}
                aria-labelledby={labelId}
                className={`admin-onboarding__switch${row.active ? ' is-on' : ' is-off'}`}
                disabled={disabled}
                onClick={() => update(row.dayOfWeek, { active: !row.active })}
              >
                <span className="admin-onboarding__switch-thumb" aria-hidden="true" />
              </button>
              {row.active ? (
                <>
                  <label className="sr-only" htmlFor={`${idPrefix}-start-${row.dayOfWeek}`}>
                    {DAY_LABELS[row.dayOfWeek]} open
                  </label>
                  <input
                    id={`${idPrefix}-start-${row.dayOfWeek}`}
                    className="input"
                    type="time"
                    value={row.startTime}
                    disabled={disabled}
                    onChange={(e) => update(row.dayOfWeek, { startTime: e.target.value })}
                  />
                  <span aria-hidden="true">–</span>
                  <label className="sr-only" htmlFor={`${idPrefix}-end-${row.dayOfWeek}`}>
                    {DAY_LABELS[row.dayOfWeek]} close
                  </label>
                  <input
                    id={`${idPrefix}-end-${row.dayOfWeek}`}
                    className="input"
                    type="time"
                    value={row.endTime}
                    disabled={disabled}
                    onChange={(e) => update(row.dayOfWeek, { endTime: e.target.value })}
                  />
                </>
              ) : (
                <span className="client-onboarding__card-meta">Closed</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
