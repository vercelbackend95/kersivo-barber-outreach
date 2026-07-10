import { useEffect, useMemo, useRef, useState } from 'react';

const MAX_SELECTED_BARBERS = 5;
export const BARBER_SELECTION_LIMIT_MESSAGE = 'Max 5 barbers can be compared on the chart.';

type UseBarberSeriesSelectionArgs = {
  winnerBarberId: string | null;
  validBarberIds: Set<string>;
  selectionKey: string;
  enabled?: boolean;
  controlledSelectedBarberIds?: string[];
  onSelectedBarberIdsChange?: (ids: string[]) => void;
};

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

export function useBarberSeriesSelection({
  winnerBarberId,
  validBarberIds,
  selectionKey,
  enabled = true,
  controlledSelectedBarberIds,
  onSelectedBarberIdsChange,
}: UseBarberSeriesSelectionArgs) {
  const isControlled = controlledSelectedBarberIds !== undefined;
  const [enabledBarberIds, setEnabledBarberIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isManualSelectionRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const lastSelectionKeyRef = useRef(selectionKey);
  const validBarberIdsKey = useMemo(
    () => Array.from(validBarberIds).sort().join('|'),
    [validBarberIds],
  );
  const validBarberIdsRef = useRef(validBarberIds);
  validBarberIdsRef.current = validBarberIds;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!enabled || isControlled) return;

    const validIds = validBarberIdsRef.current;
    const selectionContextChanged = lastSelectionKeyRef.current !== selectionKey;
    lastSelectionKeyRef.current = selectionKey;

    if (selectionContextChanged) {
      isManualSelectionRef.current = false;
    }

    if (isManualSelectionRef.current && !selectionContextChanged) return;

    const defaultIds = winnerBarberId && validIds.has(winnerBarberId)
      ? new Set([winnerBarberId])
      : new Set<string>();

    setEnabledBarberIds((previous) => {
      const filtered = new Set(Array.from(previous).filter((id) => validIds.has(id)));
      const next = isManualSelectionRef.current && !selectionContextChanged
        ? filtered
        : defaultIds;
      return setsEqual(previous, next) ? previous : next;
    });
  }, [enabled, isControlled, winnerBarberId, validBarberIdsKey, selectionKey]);

  const setLimitError = () => {
    setErrorMessage(BARBER_SELECTION_LIMIT_MESSAGE);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setErrorMessage(null), 2000);
  };

  const clearLimitError = () => {
    setErrorMessage(null);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const applySelection = (next: Set<string>) => {
    if (isControlled) {
      onSelectedBarberIdsChange?.(Array.from(next));
      return;
    }
    setEnabledBarberIds(next);
  };

  const addBarber = (barberId: string) => {
    isManualSelectionRef.current = true;
    const previous = isControlled
      ? new Set(controlledSelectedBarberIds)
      : enabledBarberIds;
    if (previous.has(barberId)) return;
    if (previous.size >= MAX_SELECTED_BARBERS) {
      setLimitError();
      return;
    }
    clearLimitError();
    const next = new Set(previous);
    next.add(barberId);
    applySelection(next);
  };

  const removeBarber = (barberId: string) => {
    isManualSelectionRef.current = true;
    const previous = isControlled
      ? new Set(controlledSelectedBarberIds)
      : enabledBarberIds;
    if (!previous.has(barberId)) return;
    const next = new Set(previous);
    next.delete(barberId);
    clearLimitError();
    applySelection(next);
  };

  const selectedBarberIds = useMemo(
    () => (isControlled ? controlledSelectedBarberIds : Array.from(enabledBarberIds)),
    [controlledSelectedBarberIds, enabledBarberIds, isControlled],
  );
  const activeSeriesKeys = useMemo(
    () => (enabled ? ['overall', ...selectedBarberIds] : ['overall']),
    [enabled, selectedBarberIds],
  );

  return {
    selectedBarberIds,
    activeSeriesKeys,
    addBarber,
    removeBarber,
    errorMessage,
  };
}
