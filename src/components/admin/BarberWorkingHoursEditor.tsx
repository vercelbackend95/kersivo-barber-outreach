import React from 'react';
import type { WorkingHourRow } from './barbersTypes';
import WorkingHoursOverview from './WorkingHoursOverview';
import WorkingHoursDayDrawer from './WorkingHoursDayDrawer';

type BarberWorkingHoursEditorProps = {
  weekDays: string[];
  workingHours: WorkingHourRow[];
  loading: boolean;
  saving: boolean;
    saveError: string;
  onChangeHour: (dayOfWeek: number, field: 'active' | 'startTime' | 'endTime', value: string | boolean) => void;
  onSetWorkingHours: (rules: WorkingHourRow[]) => void;
  onSave: (rules?: WorkingHourRow[]) => void;

};
function sortByDay(workingHours: WorkingHourRow[]) {
  return [...workingHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}


export default function BarberWorkingHoursEditor({
  weekDays,
  workingHours,
  loading,
  saving,
  saveError,
  onChangeHour,
    onSetWorkingHours,
  onSave
}: BarberWorkingHoursEditorProps) {
    const [editingDay, setEditingDay] = React.useState<number | null>(null);
  const [draftDay, setDraftDay] = React.useState<WorkingHourRow | null>(null);

  const orderedHours = React.useMemo(() => sortByDay(workingHours), [workingHours]);

  React.useEffect(() => {
    if (editingDay === null) return;
    const sourceDay = orderedHours.find((hour) => hour.dayOfWeek === editingDay) ?? null;
    setDraftDay(sourceDay);
  }, [editingDay, orderedHours]);

  const openEditor = (dayOfWeek: number) => {
    setEditingDay(dayOfWeek);
  };

  const closeEditor = () => {
    setEditingDay(null);
    setDraftDay(null);
  };

  const applyDraft = (field: 'active' | 'startTime' | 'endTime', value: string | boolean) => {
    if (!draftDay) return;
    setDraftDay({ ...draftDay, [field]: value });
  };

  const handleCopyToWeekdays = () => {
    if (!draftDay) return;
    setWorkingWithCopy((hour) => hour.dayOfWeek <= 4, draftDay);
  };

  const handleCopyToOpenDays = () => {
    if (!draftDay || !draftDay.active) return;
    setWorkingWithCopy((hour) => hour.active, draftDay);
  };

  const setWorkingWithCopy = (predicate: (hour: WorkingHourRow) => boolean, source: WorkingHourRow) => {
    const nextRules = orderedHours.map((hour) => {
      if (!predicate(hour)) return hour;
      return {
        ...hour,
        active: source.active,
        startTime: source.startTime,
        endTime: source.endTime
      };
    });
    onSetWorkingHours(nextRules);
  };

  const saveDraft = () => {
    if (!draftDay) return;
    const isInvalidRange = draftDay.active && draftDay.startTime >= draftDay.endTime;
    if (isInvalidRange) return;

    const nextRules = orderedHours.map((hour) => (hour.dayOfWeek === draftDay.dayOfWeek ? draftDay : hour));
    onSetWorkingHours(nextRules);
    onSave(nextRules);
    closeEditor();
  };


  return (
    <section className="admin-settings-panel">
      <h3>Working hours</h3>
            <p className="muted">Weekly overview with quick edits per day.</p>

      <WorkingHoursOverview
        weekDays={weekDays}
        workingHours={orderedHours}
        loading={loading}
        saving={saving}
        onToggleDay={(dayOfWeek, active) => {
          onChangeHour(dayOfWeek, 'active', active);
        }}
        onEditDay={openEditor}
      />

      <WorkingHoursDayDrawer
        isOpen={editingDay !== null}
        weekDays={weekDays}
        day={draftDay}
        loading={loading}
        saving={saving}
        errorMessage={saveError}
        onClose={closeEditor}
        onChange={applyDraft}
        onCopyToWeekdays={handleCopyToWeekdays}
        onCopyToOpenDays={handleCopyToOpenDays}
        onSave={saveDraft}
      />
    </section>
  );
}
