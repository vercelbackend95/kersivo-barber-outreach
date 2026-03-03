import React from 'react';
import type { WorkingHourRow } from './barbersTypes';

type WorkingHoursDayDrawerProps = {
  isOpen: boolean;
  weekDays: string[];
  day: WorkingHourRow | null;
  loading: boolean;
  saving: boolean;
  errorMessage: string;
  onClose: () => void;
  onChange: (field: 'active' | 'startTime' | 'endTime', value: string | boolean) => void;
  onCopyToWeekdays: () => void;
  onCopyToOpenDays: () => void;
  onSave: () => void;
};

function useBodyScrollLock(isLocked: boolean) {
  React.useEffect(() => {
    if (!isLocked || typeof window === 'undefined') return undefined;

    const scrollY = window.scrollY;
    const { body } = document;
    const originalOverflow = body.style.overflow;
    const originalPosition = body.style.position;
    const originalTop = body.style.top;
    const originalWidth = body.style.width;

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';

    return () => {
      body.style.overflow = originalOverflow;
      body.style.position = originalPosition;
      body.style.top = originalTop;
      body.style.width = originalWidth;
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}

function isValidRange(day: WorkingHourRow | null) {
  if (!day || !day.active) return true;
  return day.startTime < day.endTime;
}

export default function WorkingHoursDayDrawer({
  isOpen,
  weekDays,
  day,
  loading,
  saving,
  errorMessage,
  onClose,
  onChange,
  onCopyToWeekdays,
  onCopyToOpenDays,
  onSave
}: WorkingHoursDayDrawerProps) {
  useBodyScrollLock(isOpen);

  React.useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !day) return null;

  const dayLabel = weekDays[day.dayOfWeek] ?? `Day ${day.dayOfWeek}`;
  const hasValidRange = isValidRange(day);
  const hasError = !hasValidRange || Boolean(errorMessage);

  return (
    <div
      className="working-hours-drawer-layer"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${dayLabel} working hours`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="working-hours-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <header className="working-hours-drawer__header">
          <h4>Edit {dayLabel}</h4>
          <button type="button" className="btn btn--ghost" onClick={onClose} aria-label="Close working hours editor">✕</button>
        </header>

        <div className="working-hours-drawer__body">
          <label className="working-hours-inline-toggle">
            <span>Status</span>
            <input
              type="checkbox"
              checked={day.active}
              onChange={(event) => onChange('active', event.target.checked)}
              disabled={loading || saving}
            />
            <strong>{day.active ? 'Open' : 'Closed'}</strong>
          </label>

          <div className="working-hours-time-grid">
            <label>
              Start
              <input
                type="time"
                value={day.startTime}
                onChange={(event) => onChange('startTime', event.target.value)}
                disabled={!day.active || loading || saving}
              />
            </label>
            <label>
              End
              <input
                type="time"
                value={day.endTime}
                onChange={(event) => onChange('endTime', event.target.value)}
                disabled={!day.active || loading || saving}
              />
            </label>
          </div>

          <div className="working-hours-copy-actions">
            <button type="button" className="btn btn--secondary" onClick={onCopyToWeekdays} disabled={saving || loading}>
              Copy this day to Weekdays
            </button>
            <button type="button" className="btn btn--ghost" onClick={onCopyToOpenDays} disabled={saving || loading || !day.active}>
              Copy to All open days
            </button>
          </div>

          {!hasValidRange ? <p className="admin-inline-error">Start time must be earlier than end time.</p> : null}
          {errorMessage ? <p className="admin-inline-error">{errorMessage}</p> : null}
        </div>

        <footer className="working-hours-drawer__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={onSave} disabled={saving || hasError}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </footer>
      </section>
    </div>
  );
}
