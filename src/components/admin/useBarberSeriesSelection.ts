import { useEffect, useMemo, useRef, useState } from 'react';

const MAX_SELECTED_BARBERS = 5;
export const BARBER_SELECTION_LIMIT_MESSAGE = 'Max 5 barbers can be compared on the chart.';

type UseBarberSeriesSelectionArgs = {
  winnerBarberId: string | null;
  validBarberIds: Set<string>;
  selectionKey: string;
  enabled?: boolean;
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
}: UseBarberSeriesSelectionArgs) {
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
    if (!enabled) return;

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
  }, [enabled, winnerBarberId, validBarberIdsKey, selectionKey]);

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

  const addBarber = (barberId: string) => {
    isManualSelectionRef.current = true;
    setEnabledBarberIds((previous) => {
      if (previous.has(barberId)) return previous;
      if (previous.size >= MAX_SELECTED_BARBERS) {
        setLimitError();
        return previous;
      }
      clearLimitError();
      const next = new Set(previous);
      next.add(barberId);
      return next;
    });
  };

  const removeBarber = (barberId: string) => {
    isManualSelectionRef.current = true;
    setEnabledBarberIds((previous) => {
      if (!previous.has(barberId)) return previous;
      const next = new Set(previous);
      next.delete(barberId);
      clearLimitError();
      return next;
    });
  };

  const selectedBarberIds = useMemo(() => Array.from(enabledBarberIds), [enabledBarberIds]);
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
