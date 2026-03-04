import React from 'react';
import type { WorkingHourRow } from './barbersTypes';

type WorkingHoursOverviewProps = {
  weekDays: string[];
  workingHours: WorkingHourRow[];
  expandedDayIndex: number | null;
  draftDay: WorkingHourRow | null;
  loading: boolean;
  saving: boolean;
  errorMessage: string;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onToggleDayEditor: (dayOfWeek: number) => void;
  onChangeDraftDay: (field: 'active' | 'startTime' | 'endTime', value: string | boolean) => void;

};
function getHeaderChipText(hour: WorkingHourRow) {
  if (!hour.active) return 'Off shift';


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
  saveStatus,

  onToggleDayEditor,
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
              className={`working-hours-day-row ${isExpanded ? 'is-expanded' : ''}`}
              role="listitem"
              onClick={() => onToggleDayEditor(hour.dayOfWeek)}
              disabled={loading || saving}
              aria-label={`${isExpanded ? 'Collapse' : 'Edit'} ${dayLabel}`}
              aria-expanded={isExpanded}
            >
              <span className="working-hours-day-row__label">{dayLabel}</span>
              <span className={`working-hours-time-chip ${hour.active ? 'is-on' : 'is-off'}`}>{getHeaderChipText(hour)}</span>
              <span className={`working-hours-day-row__chevron ${isExpanded ? 'is-expanded' : ''}`} aria-hidden="true">
                ⌄
              </span>
            </button>


            {isExpanded && editorDay ? (
              <section className="working-hours-inline-editor" aria-label={`Edit ${dayLabel} shift`}>
                <div className="working-hours-inline-toggle">
                  <span className="working-hours-inline-toggle__label">On shift</span>
                  <button
                    type="button"
                    className={`working-hours-switch ${editorDay.active ? 'is-on' : 'is-off'}`}
                    role="switch"
                    aria-checked={editorDay.active}
                    aria-label={`Toggle ${dayLabel} on shift`}
                    onClick={() => onChangeDraftDay('active', !editorDay.active)}

                    disabled={loading || saving}
                  >
                    <span className="working-hours-switch__thumb" aria-hidden="true" />
                  </button>
                </div>

                {editorDay.active ? (
                  <fieldset className="working-hours-range-control" disabled={loading || saving}>
                    <div className="working-hours-range-control__inputs">
                      <label className="working-hours-time-field">
                        <span>Start</span>
                        <input
                          type="time"
                          value={editorDay.startTime}
                          onChange={(event) => onChangeDraftDay('startTime', event.target.value)}
                          aria-label="Start time"
                        />
                      </label>
                      <span aria-hidden="true">—</span>
                      <label className="working-hours-time-field">
                        <span>End</span>
                        <input
                          type="time"
                          value={editorDay.endTime}
                          onChange={(event) => onChangeDraftDay('endTime', event.target.value)}
                          aria-label="End time"
                        />
                      </label>
                    </div>
                  </fieldset>
                ) : (
                  <p className="working-hours-off-helper">Off shift — no bookings</p>
                )}


                {!hasValidRange ? <p className="admin-inline-error">Start time must be earlier than end time.</p> : null}
                {errorMessage ? <p className="admin-inline-error">{errorMessage}</p> : null}
                {saveStatus === 'saving' ? <p className="working-hours-save-status" aria-live="polite">Saving…</p> : null}
                {saveStatus === 'saved' ? <p className="working-hours-save-status is-saved" aria-live="polite">Saved</p> : null}
                {saveStatus === 'error' ? <p className="working-hours-save-status is-error" aria-live="polite">Failed to save</p> : null}


              </section>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}
