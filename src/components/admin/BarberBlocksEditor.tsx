import React from 'react';
import { fromZonedTime } from 'date-fns-tz';
import type { TimeBlock } from './barbersTypes';
type CreatePayload = {
  type: 'BREAK' | 'HOLIDAY';
  startAtInput: string;
  endAtInput: string;
  allDay?: boolean;
};


type BarberBlocksEditorProps = {
  barberName: string;
  blocks: TimeBlock[];
  successMessage: string;
  errorMessage: string;
  onCreate: (payload: CreatePayload) => void;
  onDelete: (blockId: string) => void;
};
const ADMIN_TIMEZONE = 'Europe/London';

function roundUpToQuarter(now: Date) {
  const next = new Date(now);
  next.setSeconds(0, 0);
  const mins = next.getMinutes();
  const rounded = Math.ceil(mins / 15) * 15;
  next.setMinutes(rounded);
  return next;
}

function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDateInputValue(date: Date) {
  return toLocalInputValue(date).slice(0, 10);
}

function formatUpcomingRange(block: TimeBlock) {
  const start = new Date(block.startAt);
  const end = new Date(block.endAt);
  const isVacation = block.title === 'HOLIDAY' || block.title.toLowerCase().includes('holiday') || block.title.toLowerCase().includes('vacation');
  const isAllDay = start.getUTCHours() === 0
    && start.getUTCMinutes() === 0
    && (end.getUTCHours() === 23 || end.getUTCHours() === 22)
    && end.getUTCMinutes() >= 59;

  if (!isVacation) {
    const day = new Intl.DateTimeFormat('en-GB', {
      timeZone: ADMIN_TIMEZONE,
      day: '2-digit',
      month: 'short'
    }).format(start);
    const startTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: ADMIN_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(start);
    const endTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: ADMIN_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(end);
    return `${day} • ${startTime}–${endTime}`;
  }

  if (isAllDay) {
    const startDay = new Intl.DateTimeFormat('en-GB', {
      timeZone: ADMIN_TIMEZONE,
      day: '2-digit',
      month: 'short'
    }).format(start);
    const endDay = new Intl.DateTimeFormat('en-GB', {
      timeZone: ADMIN_TIMEZONE,
      day: '2-digit',
      month: 'short'
    }).format(end);
    return `${startDay} – ${endDay}`;
  }

  const startValue = new Intl.DateTimeFormat('en-GB', {
    timeZone: ADMIN_TIMEZONE,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(start);
  const endValue = new Intl.DateTimeFormat('en-GB', {
    timeZone: ADMIN_TIMEZONE,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(end);
  return `${startValue} – ${endValue}`;
}

function getTypeLabel(block: TimeBlock) {
  return block.title === 'HOLIDAY' || block.title.toLowerCase().includes('holiday') || block.title.toLowerCase().includes('vacation')
    ? 'Vacation'
    : 'Break 15m';
}


export default function BarberBlocksEditor({
  blocks,
  successMessage,
  errorMessage,
  onCreate,
  onDelete
}: BarberBlocksEditorProps) {
  const [activeCreateMode, setActiveCreateMode] = React.useState<'break' | 'vacation'>('break');
  const [breakStartInput, setBreakStartInput] = React.useState(() => toLocalInputValue(roundUpToQuarter(new Date())));

  const [vacationStartDate, setVacationStartDate] = React.useState(() => toDateInputValue(new Date()));
  const [vacationEndDate, setVacationEndDate] = React.useState(() => toDateInputValue(new Date()));
  const [vacationAllDay, setVacationAllDay] = React.useState(true);
  const [vacationStartTime, setVacationStartTime] = React.useState('09:00');
  const [vacationEndTime, setVacationEndTime] = React.useState('17:00');
  const [localStatus, setLocalStatus] = React.useState('');
  const breakEndInput = React.useMemo(() => {
    const start = fromZonedTime(new Date(breakStartInput), ADMIN_TIMEZONE);
    return toLocalInputValue(new Date(start.getTime() + 15 * 60_000));
  }, [breakStartInput]);
  const breakHasRangeError = React.useMemo(() => {
    const startMs = new Date(breakStartInput).getTime();
    const endMs = new Date(breakEndInput).getTime();
    return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs <= startMs;
  }, [breakEndInput, breakStartInput]);

  const vacationHasRangeError = React.useMemo(() => {
    const startValue = vacationAllDay ? vacationStartDate : `${vacationStartDate}T${vacationStartTime}`;
    const endValue = vacationAllDay ? vacationEndDate : `${vacationEndDate}T${vacationEndTime}`;
    const startMs = new Date(startValue).getTime();
    const endMs = new Date(endValue).getTime();
    return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs < startMs;
  }, [vacationAllDay, vacationEndDate, vacationEndTime, vacationStartDate, vacationStartTime]);


  const sortedUpcoming = React.useMemo(() => {
    const now = Date.now();
    return [...blocks]
      .map((block) => ({ ...block, startMs: new Date(block.startAt).getTime() }))
      .filter((block) => Number.isFinite(block.startMs) && block.startMs >= now)
      .sort((a, b) => a.startMs - b.startMs);
  }, [blocks]);
  React.useEffect(() => {
    if (!successMessage) return;
    setLocalStatus(successMessage || 'Added');
    const timer = window.setTimeout(() => setLocalStatus(''), 2500);
    return () => window.clearTimeout(timer);
  }, [successMessage]);


  function handleCreateBreak() {
        if (breakHasRangeError) return;
    onCreate({
      type: 'BREAK',
      startAtInput: breakStartInput,
      endAtInput: breakEndInput,
      allDay: false
    });
  }

  function handleCreateVacation() {
        if (vacationHasRangeError) return;
    onCreate({
      type: 'HOLIDAY',
      startAtInput: vacationAllDay ? vacationStartDate : `${vacationStartDate}T${vacationStartTime}`,
      endAtInput: vacationAllDay ? vacationEndDate : `${vacationEndDate}T${vacationEndTime}`,
      allDay: vacationAllDay
    });
  }


  return (
    <section className="admin-settings-panel">
      <h3>TIME OFF</h3>
      <p className="muted">Manage unavailable time for this barber.</p>

      <div className="admin-timeoff-card">
        <header className="admin-timeoff-header-row">
          <h4>Create time off</h4>
          <p className="admin-timeoff-helper">Breaks are always 15 minutes. Vacation can be all-day or timed.</p>
        </header>

        <div className="admin-timeoff-create-area">
          <div className="admin-timeoff-mode-grid" role="radiogroup" aria-label="Time off type">

            <button
              type="button"
                            role="radio"
              aria-checked={activeCreateMode === 'break'}
              aria-pressed={activeCreateMode === 'break'}

              className={`admin-timeoff-mode-tile ${activeCreateMode === 'break' ? 'is-active' : ''}`}
              onClick={() => setActiveCreateMode('break')}
            >
              <span className="admin-timeoff-mode-title">Break</span>
              <span className="admin-timeoff-mode-meta">15 minutes</span>

            </button>
            <button
              type="button"
                            role="radio"
              aria-checked={activeCreateMode === 'vacation'}
              aria-pressed={activeCreateMode === 'vacation'}

              className={`admin-timeoff-mode-tile ${activeCreateMode === 'vacation' ? 'is-active' : ''}`}
              onClick={() => setActiveCreateMode('vacation')}
            >
              <span className="admin-timeoff-mode-title">Vacation</span>
              <span className="admin-timeoff-mode-meta">Single or multi-day</span>

            </button>

          </div>

          {activeCreateMode === 'break' ? (
            <div className="admin-timeoff-form-wrap">
              <div className="admin-timeoff-fields-grid">
                <label>
                  <span className="admin-timeoff-label">Start</span>
                  <input
                    type="datetime-local"
                    value={breakStartInput}
                    onChange={(event) => setBreakStartInput(event.target.value)}
                    className={breakHasRangeError ? 'has-error' : ''}
                  />
                </label>
                <label>
                  <span className="admin-timeoff-label">End</span>
                  <input type="datetime-local" value={breakEndInput} readOnly tabIndex={-1} aria-readonly="true" />
                </label>
              </div>
              {breakHasRangeError ? <p className="admin-inline-error">End time must be after start time.</p> : null}
              <div className="admin-timeoff-cta-row">
                <button type="button" className="btn btn--secondary" onClick={handleCreateBreak} disabled={breakHasRangeError}>
                  Add Break
                </button>
              </div>

            </div>
          ) : (
            <div className="admin-timeoff-form-wrap">
              <div className="admin-timeoff-fields-grid">
                <label>
                  <span className="admin-timeoff-label">Start date</span>
                  <input
                    type="date"
                    value={vacationStartDate}
                    onChange={(event) => setVacationStartDate(event.target.value)}
                    className={vacationHasRangeError ? 'has-error' : ''}
                  />
                </label>
                <label>
                  <span className="admin-timeoff-label">End date</span>
                  <input
                    type="date"
                    value={vacationEndDate}
                    onChange={(event) => setVacationEndDate(event.target.value)}
                    className={vacationHasRangeError ? 'has-error' : ''}
                  />
                </label>
              </div>

              <div className="admin-timeoff-all-day-row">
                <span className="admin-timeoff-label">All day</span>
                <button
                  type="button"
                  className={`admin-timeoff-switch ${vacationAllDay ? 'is-on' : ''}`}
                  onClick={() => setVacationAllDay((current) => !current)}
                  role="switch"
                  aria-checked={vacationAllDay}
                  aria-label="Toggle all day"
                >
                  <span className="admin-timeoff-switch-thumb" aria-hidden="true" />
                </button>
              </div>


              {!vacationAllDay ? (
                <div className="admin-timeoff-fields-grid">
                  <label>
                    <span className="admin-timeoff-label">Start time</span>
                    <input
                      type="time"
                      value={vacationStartTime}
                      onChange={(event) => setVacationStartTime(event.target.value)}
                                            className={vacationHasRangeError ? 'has-error' : ''}
                    />
                  </label>
                  <label>
                    <span className="admin-timeoff-label">End time</span>
                    <input
                      type="time"
                      value={vacationEndTime}
                      onChange={(event) => setVacationEndTime(event.target.value)}
                                            className={vacationHasRangeError ? 'has-error' : ''}
                    />
                  </label>
                              </div>
              ) : null}

              {vacationHasRangeError ? <p className="admin-inline-error">End must be after start.</p> : null}
              <div className="admin-timeoff-cta-row">
                <button type="button" className="btn btn--secondary" onClick={handleCreateVacation} disabled={vacationHasRangeError}>
                  Add Vacation
                </button>
              </div>

            </div>
          )}
          {localStatus ? <p className="admin-inline-success" role="status">{localStatus}</p> : null}
          {errorMessage ? <p className="admin-inline-error">{errorMessage}</p> : null}
        </div>
        <hr className="admin-timeoff-divider" />
        <div className="admin-timeoff-upcoming">
          <h4>Upcoming</h4>
          {sortedUpcoming.length === 0 ? <p className="muted">No time off yet.</p> : (
            <ul className="admin-timeoff-upcoming-list">
              {sortedUpcoming.map((block) => (
                <li key={block.id} className="admin-timeoff-upcoming-card">
                  <p className="admin-timeoff-upcoming-type">{getTypeLabel(block)}</p>
                  <p className="admin-timeoff-upcoming-range">{formatUpcomingRange(block)}</p>

                  <button
                    type="button"
                    className="btn btn--ghost admin-timeoff-delete"
                    onClick={() => {
                      const confirmed = window.confirm(`Delete this ${getTypeLabel(block)} time off entry?`);
                      if (!confirmed) return;
                      onDelete(block.id);
                    }}

                    aria-label={`Delete ${getTypeLabel(block)} time off`}
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

    </section>
  );
}
