import React from 'react';
import type { WorkingHourRow } from './barbersTypes';
import WorkingHoursOverview from './WorkingHoursOverview';

type BarberWorkingHoursEditorProps = {
  weekDays: string[];
  workingHours: WorkingHourRow[];
  loading: boolean;
  saving: boolean;
    saveError: string;
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
  const onShiftDays = workingHours.filter((day) => day.active).length;
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

  return `${onShiftDays} on-shift day${onShiftDays === 1 ? '' : 's'} • ${displayHours}`;
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
  const [expandedDayIndex, setExpandedDayIndex] = React.useState<number | null>(null);
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
    setExpandedDayIndex(null);
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
  const openEditor = React.useCallback(
    (dayOfWeek: number) => {
      clearAutoSaveTimeout();
      setPendingAutoSave(false);
      setSavedToastVisible(false);
      clearSavedToastTimeout();


      const sourceDay = orderedHours.find((hour) => hour.dayOfWeek === dayOfWeek) ?? null;
      setExpandedDayIndex(dayOfWeek);
      setDraftDay(sourceDay);
      originalDayRuleRef.current = sourceDay ? { ...sourceDay } : null;
    },
    [clearAutoSaveTimeout, clearSavedToastTimeout, orderedHours]
  );
  const toggleEditor = React.useCallback(
    (dayOfWeek: number) => {
      if (expandedDayIndex === dayOfWeek) {
        closeEditor();
        return;
      }
      openEditor(dayOfWeek);
    },
    [closeEditor, expandedDayIndex, openEditor]
  );


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
  const applyDraft = React.useCallback(
    (field: 'active' | 'startTime' | 'endTime', value: string | boolean) => {
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
    },
    [clearAutoSaveTimeout, clearSavedToastTimeout, draftDay, onSetWorkingHours, orderedHours, scheduleAutoSave]
  );



  const cancelEditing = React.useCallback(() => {
    const original = originalDayRuleRef.current;
    if (original) {
      const restoredRules = orderedHours.map((hour) => (hour.dayOfWeek === original.dayOfWeek ? original : hour));
      onSetWorkingHours(restoredRules);
      setDraftDay(original);
    }

    closeEditor();
  }, [closeEditor, onSetWorkingHours, orderedHours]);


  return (
    <section className="admin-settings-panel">
      <div className="working-hours-header-row">
        <h3>Working hours</h3>
        <p className="working-hours-weekly-summary" aria-live="polite">
          {weeklySummary}
        </p>
      </div>
      <p className="muted">Weekly overview with quick edits per day.</p>

      <WorkingHoursOverview
        weekDays={weekDays}
        workingHours={orderedHours}
        expandedDayIndex={expandedDayIndex}
        draftDay={draftDay}
        loading={loading}
        saving={saving}
        errorMessage={saveError}
        savedToastVisible={savedToastVisible}
        onToggleDayEditor={toggleEditor}
        onCancelDayEdit={cancelEditing}
        onChangeDraftDay={applyDraft}
      />
    </section>
  );
}
