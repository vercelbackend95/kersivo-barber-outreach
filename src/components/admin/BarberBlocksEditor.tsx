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
    return `${day}, ${startTime}–${endTime}`;
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
    : 'Break';
}


export default function BarberBlocksEditor({
  barberName,
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

  const breakEndInput = React.useMemo(() => {
    const start = fromZonedTime(new Date(breakStartInput), ADMIN_TIMEZONE);
    return toLocalInputValue(new Date(start.getTime() + 15 * 60_000));
  }, [breakStartInput]);

  const sortedUpcoming = React.useMemo(() => {
    const now = Date.now();
    return [...blocks]
      .map((block) => ({ ...block, startMs: new Date(block.startAt).getTime() }))
      .filter((block) => Number.isFinite(block.startMs) && block.startMs >= now)
      .sort((a, b) => a.startMs - b.startMs);
  }, [blocks]);

  function handleCreateBreak() {
    onCreate({
      type: 'BREAK',
      startAtInput: breakStartInput,
      endAtInput: breakEndInput,
      allDay: false
    });
  }

  function handleCreateVacation() {
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

      <div className="admin-timeoff-create">
        <h4>Create time off</h4>
        <p className="muted">Choose type and add unavailable time for {barberName}.</p>

        <div className="admin-timeoff-mode-grid" role="tablist" aria-label="Time off type">
          <button
            type="button"
            className={`admin-timeoff-mode-tile ${activeCreateMode === 'break' ? 'is-active' : ''}`}
            onClick={() => setActiveCreateMode('break')}
          >
            Break (15 min)
          </button>
          <button
            type="button"
            className={`admin-timeoff-mode-tile ${activeCreateMode === 'vacation' ? 'is-active' : ''}`}
            onClick={() => setActiveCreateMode('vacation')}
          >
            Vacation
          </button>
        </div>

        {activeCreateMode === 'break' ? (
          <div className="admin-timeoff-form-grid">
            <label>
              Start
              <input
                type="datetime-local"
                value={breakStartInput}
                onChange={(event) => setBreakStartInput(event.target.value)}
              />
            </label>
            <p className="admin-timeoff-readonly" aria-live="polite">End: {breakEndInput.replace('T', ' ')}</p>
            <button type="button" className="btn btn--secondary" onClick={handleCreateBreak}>Add break</button>
          </div>
        ) : (
          <div className="admin-timeoff-form-grid">
            <label>
              Start date
              <input
                type="date"
                value={vacationStartDate}
                onChange={(event) => setVacationStartDate(event.target.value)}
              />
            </label>
            <label>
              End date
              <input
                type="date"
                value={vacationEndDate}
                onChange={(event) => setVacationEndDate(event.target.value)}
              />
            </label>
            <label className="admin-timeoff-toggle">
              <input
                type="checkbox"
                checked={vacationAllDay}
                onChange={(event) => setVacationAllDay(event.target.checked)}
              />
              All-day
            </label>
            {!vacationAllDay ? (
              <>
                <label>
                  Start time
                  <input
                    type="time"
                    value={vacationStartTime}
                    onChange={(event) => setVacationStartTime(event.target.value)}
                  />
                </label>
                <label>
                  End time
                  <input
                    type="time"
                    value={vacationEndTime}
                    onChange={(event) => setVacationEndTime(event.target.value)}
                  />
                </label>
              </>
            ) : null}
            <button type="button" className="btn btn--secondary" onClick={handleCreateVacation}>Add vacation</button>
          </div>
        )}

      </div>
      {successMessage ? <p className="admin-inline-success">{successMessage}</p> : null}
      {errorMessage ? <p className="admin-inline-error">{errorMessage}</p> : null}

      <div className="admin-timeoff-upcoming">
        <h4>Upcoming</h4>
        {sortedUpcoming.length === 0 ? <p className="muted">No time off yet.</p> : (
          <ul className="admin-timeoff-upcoming-list">
            {sortedUpcoming.map((block) => (
              <li key={block.id} className="admin-timeoff-card">
                <p className="admin-timeoff-card__type">{getTypeLabel(block)}</p>
                <p className="admin-timeoff-card__range">{formatUpcomingRange(block)}</p>
                <button
                  type="button"
                  className="btn btn--ghost admin-timeoff-delete"
                  onClick={() => onDelete(block.id)}
                  aria-label={`Delete ${getTypeLabel(block)} time off`}
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

    </section>
  );
}
