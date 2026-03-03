import React from 'react';
import type { WorkingHourRow } from './barbersTypes';

type WorkingHoursOverviewProps = {
  weekDays: string[];
  workingHours: WorkingHourRow[];
  expandedDayIndex: number | null;
  draftDay: WorkingHourRow | null;
  loading: boolean;
  saving: boolean;  errorMessage: string;
  savedToastVisible: boolean;
  onToggleDayEditor: (dayOfWeek: number) => void;
  onCancelDayEdit: () => void;
  onChangeDraftDay: (field: 'active' | 'startTime' | 'endTime', value: string | boolean) => void;

};

function getTimeText(hour: WorkingHourRow) {
  if (!hour.active) return 'Off';

  return `${hour.startTime}–${hour.endTime}`;
}
function isValidRange(day: WorkingHourRow | null) {
  if (!day || !day.active) return true;
  return day.startTime < day.endTime;
}


export default function WorkingHoursOverview({
  weekDays,
  workingHours,
  expandedDayIndex,
  draftDay,
  loading,
  saving,
    errorMessage,
  savedToastVisible,
  onToggleDayEditor,
  onCancelDayEdit,
  onChangeDraftDay

}: WorkingHoursOverviewProps) {
      const hasValidRange = isValidRange(draftDay);
  return (
    <div className="working-hours-overview" role="list" aria-label="Weekly working hours">
      {workingHours.map((hour) => {
        const dayLabel = weekDays[hour.dayOfWeek] ?? `Day ${hour.dayOfWeek}`;
        const isExpanded = expandedDayIndex === hour.dayOfWeek;
        const editorDay = isExpanded ? draftDay : null;


        return (
          <React.Fragment key={hour.dayOfWeek}>
            <button
              type="button"
              className="working-hours-day-row"
              role="listitem"
              onClick={() => onToggleDayEditor(hour.dayOfWeek)}
              disabled={loading || saving}
              aria-label={`${isExpanded ? 'Collapse' : 'Edit'} ${dayLabel}`}
              aria-expanded={isExpanded}
            >
              <span className="working-hours-day-row__label">{dayLabel}</span>
              <span className={`working-hours-time-chip ${hour.active ? '' : 'is-off'}`}>{getTimeText(hour)}</span>
              <span className={`working-hours-day-row__chevron ${isExpanded ? 'is-expanded' : ''}`} aria-hidden="true">⌄</span>
            </button>


            {isExpanded && editorDay ? (
              <section className="working-hours-inline-editor" aria-label={`Edit ${dayLabel} shift`}>
                <label className="working-hours-inline-toggle">
                  <span>Status</span>
                  <input
                    type="checkbox"
                    checked={editorDay.active}
                    onChange={(event) => onChangeDraftDay('active', event.target.checked)}
                    disabled={loading || saving}
                  />
                  <strong>{editorDay.active ? 'On shift' : 'Off shift'}</strong>
                </label>

                <fieldset className="working-hours-range-control" disabled={!editorDay.active || loading || saving}>
                  <legend>Working range</legend>
                  <div className="working-hours-range-control__inputs">
                    <input
                      type="time"
                      value={editorDay.startTime}
                      onChange={(event) => onChangeDraftDay('startTime', event.target.value)}
                      aria-label="Start time"
                    />
                    <span aria-hidden="true">—</span>
                    <input
                      type="time"
                      value={editorDay.endTime}
                      onChange={(event) => onChangeDraftDay('endTime', event.target.value)}
                      aria-label="End time"
                    />
                  </div>
                </fieldset>

                {!hasValidRange ? <p className="admin-inline-error">Start time must be earlier than end time.</p> : null}
                {errorMessage ? <p className="admin-inline-error">{errorMessage}</p> : null}
                {savedToastVisible ? (
                  <p className="working-hours-saved-toast" aria-live="polite">
                    Saved
                  </p>
                ) : null}

                <div className="working-hours-inline-editor__actions">
                  <button type="button" className="btn btn--ghost" onClick={onCancelDayEdit} disabled={saving}>
                    Cancel
                  </button>
                </div>
              </section>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}
