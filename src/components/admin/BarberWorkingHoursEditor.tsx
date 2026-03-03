import React from 'react';
import type { WorkingHourRow } from './barbersTypes';
import WorkingHoursOverview from './WorkingHoursOverview';
import WorkingHoursDayDrawer from './WorkingHoursDayDrawer';

type BarberWorkingHoursEditorProps = {
  weekDays: string[];
  workingHours: WorkingHourRow[];
  loading: boolean;
  saving: boolean;
  onSetWorkingHours: (rules: WorkingHourRow[]) => void;
  onSave: (rules?: WorkingHourRow[]) => void;

};

const AUTO_SAVE_DELAY_MS = 600;
const SAVED_TOAST_TIMEOUT_MS = 1600;


function sortByDay(workingHours: WorkingHourRow[]) {
  return [...workingHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

function isValidRange(day: WorkingHourRow | null) {
  if (!day || !day.active) return true;
  return day.startTime < day.endTime;
}

function getWeeklySummary(workingHours: WorkingHourRow[]) {
  const openDays = workingHours.filter((day) => day.active).length;
  const totalMinutes = workingHours.reduce((sum, day) => {
    if (!day.active) return sum;
    const [startHour, startMinute] = day.startTime.split(':').map(Number);
    const [endHour, endMinute] = day.endTime.split(':').map(Number);
    if ([startHour, startMinute, endHour, endMinute].some((part) => Number.isNaN(part))) {
      return sum;
    }
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    return end > start ? sum + (end - start) : sum;
  }, 0);

  const totalHours = totalMinutes / 60;
  const displayHours = Number.isInteger(totalHours) ? `${totalHours}h/week` : `${totalHours.toFixed(1)}h/week`;

  return `${openDays} open day${openDays === 1 ? '' : 's'} • ${displayHours}`;
}

export default function BarberWorkingHoursEditor({
  weekDays,
  workingHours,
  loading,
  saving,
  saveError,
  onSetWorkingHours,
  onSave
}: BarberWorkingHoursEditorProps) {
  const [editingDay, setEditingDay] = React.useState<number | null>(null);
  const [draftDay, setDraftDay] = React.useState<WorkingHourRow | null>(null);
  const [savedToastVisible, setSavedToastVisible] = React.useState(false);
  const [pendingAutoSave, setPendingAutoSave] = React.useState(false);
  const originalDayRuleRef = React.useRef<WorkingHourRow | null>(null);
  const autoSaveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveToastTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const orderedHours = React.useMemo(() => sortByDay(workingHours), [workingHours]);
  const weeklySummary = React.useMemo(() => getWeeklySummary(orderedHours), [orderedHours]);

  const clearAutoSaveTimeout = React.useCallback(() => {
    if (!autoSaveTimeoutRef.current) return;
    clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = null;
  }, []);

  const clearSavedToastTimeout = React.useCallback(() => {
    if (!saveToastTimeoutRef.current) return;
    clearTimeout(saveToastTimeoutRef.current);
    saveToastTimeoutRef.current = null;
  }, []);

  const closeEditor = React.useCallback(() => {
    clearAutoSaveTimeout();
    setPendingAutoSave(false);
    setEditingDay(null);
    setDraftDay(null);
    originalDayRuleRef.current = null;
    clearSavedToastTimeout();
    setSavedToastVisible(false);
  }, [clearAutoSaveTimeout, clearSavedToastTimeout]);

  React.useEffect(() => {
    if (!pendingAutoSave || saving) return;
    if (saveError) return;

    setPendingAutoSave(false);
    setSavedToastVisible(true);
    clearSavedToastTimeout();
    saveToastTimeoutRef.current = setTimeout(() => {
      setSavedToastVisible(false);
      saveToastTimeoutRef.current = null;
    }, SAVED_TOAST_TIMEOUT_MS);
  }, [clearSavedToastTimeout, pendingAutoSave, saveError, saving]);

  React.useEffect(() => {
    return () => {
      clearAutoSaveTimeout();
      clearSavedToastTimeout();
    };
  }, [clearAutoSaveTimeout, clearSavedToastTimeout]);


  const openEditor = (dayOfWeek: number) => {
        clearAutoSaveTimeout();
    setPendingAutoSave(false);
    setSavedToastVisible(false);
    clearSavedToastTimeout();

    const sourceDay = orderedHours.find((hour) => hour.dayOfWeek === dayOfWeek) ?? null;

    setEditingDay(dayOfWeek);
        setDraftDay(sourceDay);
    originalDayRuleRef.current = sourceDay ? { ...sourceDay } : null;

  };

  const scheduleAutoSave = React.useCallback(
    (nextRules: WorkingHourRow[]) => {
      clearAutoSaveTimeout();
      setPendingAutoSave(true);
      autoSaveTimeoutRef.current = setTimeout(() => {
        onSave(nextRules);
      }, AUTO_SAVE_DELAY_MS);
    },
    [clearAutoSaveTimeout, onSave]
  );


  const applyDraft = (field: 'active' | 'startTime' | 'endTime', value: string | boolean) => {
    if (!draftDay) return;
    const nextDay = { ...draftDay, [field]: value } as WorkingHourRow;
    setDraftDay(nextDay);


    const nextRules = orderedHours.map((hour) => (hour.dayOfWeek === nextDay.dayOfWeek ? nextDay : hour));
    onSetWorkingHours(nextRules);


    if (isValidRange(nextDay)) {
      scheduleAutoSave(nextRules);
    } else {
      clearAutoSaveTimeout();
      setPendingAutoSave(false);
      setSavedToastVisible(false);
      clearSavedToastTimeout();
    }
  };


  const cancelEditing = () => {
    const original = originalDayRuleRef.current;
    if (original) {
      const restoredRules = orderedHours.map((hour) => (hour.dayOfWeek === original.dayOfWeek ? original : hour));
      onSetWorkingHours(restoredRules);
      setDraftDay(original);
    }

    closeEditor();
  };


  return (
    <section className="admin-settings-panel">
      <div className="working-hours-header-row">
        <h3>Working hours</h3>
        <p className="working-hours-weekly-summary" aria-live="polite">{weeklySummary}</p>
      </div>
      <p className="muted">Weekly overview with quick edits per day.</p>

      <WorkingHoursOverview
        weekDays={weekDays}
        workingHours={orderedHours}
        loading={loading}
        saving={saving}
        onEditDay={openEditor}
      />

      <WorkingHoursDayDrawer
        isOpen={editingDay !== null}
        weekDays={weekDays}
        day={draftDay}
        loading={loading}
        saving={saving}
        errorMessage={saveError}
                savedToastVisible={savedToastVisible}
        onClose={closeEditor}
                onCancel={cancelEditing}
        onChange={applyDraft}
      />
    </section>
  );
}
