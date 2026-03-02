import React from 'react';
import type { WorkingHourRow } from './barbersTypes';

type BarberWorkingHoursEditorProps = {
  weekDays: string[];
  workingHours: WorkingHourRow[];
  loading: boolean;
  saving: boolean;
  onChangeHour: (dayOfWeek: number, field: 'active' | 'startTime' | 'endTime', value: string | boolean) => void;
  onSave: () => void;
};

export default function BarberWorkingHoursEditor({
  weekDays,
  workingHours,
  loading,
  saving,
  onChangeHour,
  onSave
}: BarberWorkingHoursEditorProps) {
  return (
    <section className="admin-settings-panel">
      <h3>Working hours</h3>
      <div className="admin-hours-grid">
        {workingHours.map((hour) => (
          <div key={hour.dayOfWeek} className="admin-hours-row">
            <strong>{weekDays[hour.dayOfWeek] ?? `Day ${hour.dayOfWeek}`}</strong>
            <label>
              <input
                type="checkbox"
                checked={hour.active}
                onChange={(event) => onChangeHour(hour.dayOfWeek, 'active', event.target.checked)}
                disabled={loading || saving}
              />
              Active
            </label>
            <input
              type="time"
              value={hour.startTime}
              onChange={(event) => onChangeHour(hour.dayOfWeek, 'startTime', event.target.value)}
              disabled={!hour.active || loading || saving}
            />
            <input
              type="time"
              value={hour.endTime}
              onChange={(event) => onChangeHour(hour.dayOfWeek, 'endTime', event.target.value)}
              disabled={!hour.active || loading || saving}
            />
          </div>
        ))}
      </div>
      <button type="button" className="btn btn--primary" onClick={onSave} disabled={saving}>Save working hours</button>
    </section>
  );
}
