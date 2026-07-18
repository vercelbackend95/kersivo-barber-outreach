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

const SHARED_EDITOR_ID = 'working-hours-day-panel';
const PANEL_CLOSE_MS = 230;

function formatShortTime(time: string) {
  const [hourPart, minutePart] = time.split(':');
  const hour = Number(hourPart);
  if (Number.isNaN(hour)) return time;
  if (!minutePart || minutePart === '00') return String(hour);
  return `${hour}:${minutePart}`;
}

function getTileSummary(hour: WorkingHourRow) {
  if (!hour.active) return 'OFF';
  return `${formatShortTime(hour.startTime)}–${formatShortTime(hour.endTime)}`;
}

function getAriaStatus(hour: WorkingHourRow) {
  if (!hour.active) return 'off shift';
  return `on shift ${hour.startTime}–${hour.endTime}`;
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
  const isSelectedOpen = expandedDayIndex !== null && draftDay !== null;
  const lastAnchorRef = React.useRef(0);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [visibleDay, setVisibleDay] = React.useState<WorkingHourRow | null>(null);

  if (expandedDayIndex !== null) {
    lastAnchorRef.current = expandedDayIndex;
  }

  React.useEffect(() => {
    if (draftDay && expandedDayIndex !== null) {
      setVisibleDay(draftDay);
      setPanelOpen(true);
      return;
    }

    setPanelOpen(false);
    const timeoutId = window.setTimeout(() => {
      setVisibleDay(null);
    }, PANEL_CLOSE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [draftDay, expandedDayIndex]);

  const anchorIndex = expandedDayIndex ?? visibleDay?.dayOfWeek ?? lastAnchorRef.current;
  const selectedDayLabel = weekDays[anchorIndex] ?? `Day ${anchorIndex}`;
  const editorDay = isSelectedOpen ? draftDay : visibleDay;
  const hasValidRange = isValidRange(editorDay);
  const overviewStyle = {
    ['--wh-anchor' as string]: `${((anchorIndex + 0.5) / 7) * 100}%`
  };

  return (
    <div className="working-hours-overview" style={overviewStyle}>
      <div className="working-hours-week" role="group" aria-label="Weekly working hours">
        {workingHours.map((hour) => {
          const dayLabel = weekDays[hour.dayOfWeek] ?? `Day ${hour.dayOfWeek}`;
          const isSelected = expandedDayIndex === hour.dayOfWeek;
          const tileSummary = getTileSummary(hour);

          return (
            <button
              key={hour.dayOfWeek}
              type="button"
              className={[
                'working-hours-day-tile',
                hour.active ? 'is-on' : 'is-off',
                isSelected ? 'is-selected' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onToggleDayEditor(hour.dayOfWeek)}
              disabled={loading || saving}
              aria-pressed={isSelected}
              aria-expanded={isSelected}
              aria-controls={SHARED_EDITOR_ID}
              aria-label={`${dayLabel}, ${getAriaStatus(hour)}${isSelected ? ', selected' : ''}`}
            >
              <span className="working-hours-day-tile__label">{dayLabel}</span>
              <span className="working-hours-day-tile__summary">{tileSummary}</span>
            </button>
          );
        })}
      </div>

      <section
        id={SHARED_EDITOR_ID}
        className={`working-hours-day-panel ${panelOpen ? 'is-open' : ''}`}
        aria-label={`Edit ${selectedDayLabel} shift`}
        aria-hidden={!panelOpen}
      >
        <span className="working-hours-day-panel__caret" aria-hidden="true" />
        {editorDay ? (
          <div className="working-hours-day-panel__body">
            <div className="working-hours-inline-toggle">
              <span className="working-hours-inline-toggle__label">On shift</span>
              <button
                type="button"
                className={`working-hours-switch ${editorDay.active ? 'is-on' : 'is-off'}`}
                role="switch"
                aria-checked={editorDay.active}
                aria-label={`Toggle ${selectedDayLabel} on shift`}
                onClick={() => onChangeDraftDay('active', !editorDay.active)}
                disabled={!isSelectedOpen || loading || saving}
              >
                <span className="working-hours-switch__thumb" aria-hidden="true" />
              </button>
            </div>

            {editorDay.active ? (
              <fieldset className="working-hours-range-control" disabled={!isSelectedOpen || loading || saving}>
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
              <p className="working-hours-off-helper">This day is off shift and hidden from booking slots.</p>
            )}

            {!hasValidRange ? <p className="admin-inline-error">Start time must be earlier than end time.</p> : null}
            {errorMessage ? <p className="admin-inline-error">{errorMessage}</p> : null}
            {saveStatus === 'saving' ? (
              <p className="working-hours-save-status" aria-live="polite">
                Saving…
              </p>
            ) : null}
            {saveStatus === 'saved' ? (
              <p className="working-hours-save-status is-saved" aria-live="polite">
                Saved
              </p>
            ) : null}
            {saveStatus === 'error' ? (
              <p className="working-hours-save-status is-error" aria-live="polite">
                Failed to save
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
