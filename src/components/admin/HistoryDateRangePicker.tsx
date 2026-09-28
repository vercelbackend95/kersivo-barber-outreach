import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fromZonedTime } from 'date-fns-tz';
import { X } from '../lucide-react';
import { dateToYmdInLondon } from '@/lib/admin/reportsRange';

type HistoryDateRange = {
  from?: Date;
  to?: Date;
};

type HistoryDateRangePickerProps = {
  dateRange: HistoryDateRange | null;
  isMobileViewport: boolean;
  timezone: string;
  onChangeRange: (range: HistoryDateRange | null) => void;
  onClear: () => void;
  variant?: 'standalone' | 'segment' | 'date-label';
  label?: string;
};

const CALENDAR_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm13 8H4v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8ZM5 6a1 1 0 0 0-1 1v1h16V7a1 1 0 0 0-1-1H5Z" fill="currentColor" />
  </svg>
);

function ymdToZonedDate(ymd: string, timezone: string): Date {
  return fromZonedTime(`${ymd}T00:00:00.000`, timezone);
}

function dateToYmd(date: Date, timezone: string): string {
  return dateToYmdInLondon(date, timezone);
}

export default function HistoryDateRangePicker({
  dateRange,
  isMobileViewport,
  timezone,
  onChangeRange,
  onClear,
  variant = 'standalone',
  label,
}: HistoryDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [fromYmd, setFromYmd] = useState('');
  const [toYmd, setToYmd] = useState('');
  const [selectionMode, setSelectionMode] = useState<'single' | 'range'>('range');
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number }>({
    top: 64,
    left: 16,
    width: 240,
  });

  const isSegmentVariant = variant === 'segment';
  const isDateLabelVariant = variant === 'date-label';
  const isCustomActive = Boolean(dateRange?.from && dateRange?.to);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const nextFrom = dateRange?.from ? dateToYmd(dateRange.from, timezone) : '';
    const nextTo = dateRange?.to ? dateToYmd(dateRange.to, timezone) : '';
    setFromYmd(nextFrom);
    setToYmd(nextTo);
    if (isDateLabelVariant) {
      setSelectionMode(nextFrom && nextTo && nextFrom === nextTo ? 'single' : 'range');
    }
  }, [dateRange, isDateLabelVariant, timezone]);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const panelWidth = Math.min(isDateLabelVariant ? 360 : 280, window.innerWidth - 24);
    const left = Math.min(
      Math.max(12, rect.right - panelWidth),
      window.innerWidth - panelWidth - 12,
    );
    const top = rect.bottom + 8;
    setPanelStyle({ top, left, width: panelWidth });
  }, [isDateLabelVariant]);

  useEffect(() => {
    if (!isOpen) return;
    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [isOpen, updatePanelPosition]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  const applyRange = useCallback((nextFrom: string, nextTo: string) => {
    if (!nextFrom || !nextTo) return;

    const fromDate = ymdToZonedDate(nextFrom, timezone);
    const toDate = ymdToZonedDate(nextTo, timezone);
    if (nextFrom > nextTo) return;

    onChangeRange({ from: fromDate, to: toDate });
    setIsOpen(false);
  }, [onChangeRange, timezone]);

  const handleFromChange = (value: string) => {
    setFromYmd(value);
    if (isDateLabelVariant) {
      if (selectionMode === 'range' && toYmd && value && value > toYmd) {
        setToYmd('');
      }
      return;
    }
    applyRange(value, toYmd);
  };

  const handleToChange = (value: string) => {
    setToYmd(value);
    if (isDateLabelVariant) return;
    applyRange(fromYmd, value);
  };

  const handleSelectionModeChange = (nextMode: 'single' | 'range') => {
    setSelectionMode(nextMode);
    if (nextMode === 'single' && !fromYmd && toYmd) {
      setFromYmd(toYmd);
    }
  };

  const canApplyDateLabel =
    selectionMode === 'single'
      ? Boolean(fromYmd)
      : Boolean(fromYmd && toYmd && fromYmd <= toYmd);

  const handleDateLabelApply = () => {
    if (!canApplyDateLabel || !fromYmd) return;

    const fromDate = ymdToZonedDate(fromYmd, timezone);
    const toDate =
      selectionMode === 'single' || !toYmd
        ? fromDate
        : ymdToZonedDate(toYmd, timezone);

    onChangeRange({ from: fromDate, to: toDate });
    setIsOpen(false);
  };

  const handleTriggerClick = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    if (isDateLabelVariant) {
      const nextFrom = dateRange?.from ? dateToYmd(dateRange.from, timezone) : '';
      const nextTo = dateRange?.to ? dateToYmd(dateRange.to, timezone) : '';
      setFromYmd(nextFrom);
      setToYmd(nextTo);
      setSelectionMode(nextFrom && nextTo && nextFrom === nextTo ? 'single' : 'range');
    }

    setIsOpen(true);
  };

  const handleClear = () => {
    setFromYmd('');
    setToYmd('');
    onClear();
    setIsOpen(false);
  };

  const legacyPanel = (
    <>
      <div className="admin-native-date-range-panel__fields">
        <label className="field admin-native-date-range-panel__field">
          <span className="field__label">From</span>
          <input
            type="date"
            className="input"
            value={fromYmd}
            max={toYmd || undefined}
            onChange={(event) => handleFromChange(event.target.value)}
          />
        </label>
        <label className="field admin-native-date-range-panel__field">
          <span className="field__label">To</span>
          <input
            type="date"
            className="input"
            value={toYmd}
            min={fromYmd || undefined}
            onChange={(event) => handleToChange(event.target.value)}
          />
        </label>
      </div>
      <div className="admin-native-date-range-panel__actions">
        <button type="button" className="btn btn--ghost" onClick={handleClear}>
          Clear
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => setIsOpen(false)}>
          Close
        </button>
      </div>
    </>
  );

  const dateLabelPanel = (
    <>
      <div className="admin-native-date-range-panel__header">
        <div>
          <strong className="admin-native-date-range-panel__title">Filter by date</strong>
          <p className="admin-native-date-range-panel__subtitle">Choose one day or a date range.</p>
        </div>
        <button
          type="button"
          className="admin-native-date-range-panel__close"
          onClick={() => setIsOpen(false)}
          aria-label="Close date picker"
        >
          <X width={16} height={16} aria-hidden="true" />
        </button>
      </div>

      <div className="admin-native-date-range-panel__mode" role="tablist" aria-label="Date selection mode">
        <button
          type="button"
          role="tab"
          aria-selected={selectionMode === 'single'}
          className={selectionMode === 'single' ? 'is-active' : ''}
          onClick={() => handleSelectionModeChange('single')}
        >
          Single day
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={selectionMode === 'range'}
          className={selectionMode === 'range' ? 'is-active' : ''}
          onClick={() => handleSelectionModeChange('range')}
        >
          Date range
        </button>
      </div>

      <div className={`admin-native-date-range-panel__fields admin-native-date-range-panel__fields--${selectionMode}`}>
        {selectionMode === 'single' ? (
          <label className="field admin-native-date-range-panel__field">
            <span className="field__label">Date</span>
            <input
              type="date"
              className="input"
              value={fromYmd}
              onChange={(event) => handleFromChange(event.target.value)}
            />
          </label>
        ) : (
          <>
            <label className="field admin-native-date-range-panel__field">
              <span className="field__label">From</span>
              <input
                type="date"
                className="input"
                value={fromYmd}
                max={toYmd || undefined}
                onChange={(event) => handleFromChange(event.target.value)}
              />
            </label>
            <label className="field admin-native-date-range-panel__field">
              <span className="field__label">To</span>
              <input
                type="date"
                className="input"
                value={toYmd}
                min={fromYmd || undefined}
                onChange={(event) => handleToChange(event.target.value)}
              />
            </label>
          </>
        )}
      </div>

      <div className="admin-native-date-range-panel__actions">
        <button
          type="button"
          className="btn btn--ghost admin-native-date-range-panel__clear"
          onClick={handleClear}
        >
          Clear
        </button>
        <button
          type="button"
          className="btn admin-native-date-range-panel__apply"
          onClick={handleDateLabelApply}
          disabled={!canApplyDateLabel}
        >
          Apply
        </button>
      </div>
    </>
  );

  const panel = isOpen ? (
    <div
      ref={panelRef}
      className={`admin-native-date-range-panel${isDateLabelVariant ? ' admin-native-date-range-panel--history-range' : ''}${isMobileViewport ? ' admin-native-date-range-panel--mobile' : ''}`}
      role="dialog"
      aria-label={isDateLabelVariant ? 'Filter booking history by date' : 'Choose custom date range'}
      style={{
        top: `${panelStyle.top}px`,
        left: `${panelStyle.left}px`,
        width: `${panelStyle.width}px`,
      }}
    >
      {isDateLabelVariant ? dateLabelPanel : legacyPanel}
    </div>
  ) : null;

  return (
    <div className={`admin-history-date-filter-wrap${isSegmentVariant ? ' admin-history-date-filter-wrap--segment' : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className={
          isSegmentVariant
            ? `admin-segmented-control__option admin-segmented-control__option--icon${isCustomActive ? ' is-active' : ''}`
            : isDateLabelVariant
              ? `admin-date-picker-label admin-date-picker-label--range${isCustomActive ? ' admin-date-picker-label--active' : ''}`
              : `admin-history-date-trigger${dateRange ? ' admin-history-date-trigger--active' : ''}`
        }
        aria-label={
          isDateLabelVariant
            ? `Choose date range, currently ${label ?? 'no range selected'}`
            : 'Choose custom date range'
        }
        aria-expanded={isOpen}
        onClick={handleTriggerClick}
      >
        {isDateLabelVariant ? <span className="admin-date-picker-text">{label ?? 'Choose dates'}</span> : null}
        {CALENDAR_ICON}
      </button>

      {!isSegmentVariant && !isDateLabelVariant && dateRange ? (
        <button
          type="button"
          className="admin-history-date-clear"
          onClick={handleClear}
          aria-label="Clear date range"
        >
          <X width={12} height={12} aria-hidden="true" />
        </button>
      ) : null}

      {isMounted && typeof document !== 'undefined' ? createPortal(panel, document.body) : panel}
    </div>
  );
}
