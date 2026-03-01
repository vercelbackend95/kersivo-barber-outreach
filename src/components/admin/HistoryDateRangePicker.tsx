import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

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
};

type CalendarMonthProps = {
  monthStart: Date;
  timezone: string;
  dateRange: HistoryDateRange | null;
  onSelectDate: (date: Date) => void;
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const VIEWPORT_PADDING_PX = 12;

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getDaysInMonth(monthStart: Date) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  return new Date(year, month + 1, 0).getDate();
}

function getMondayBasedIndex(day: number) {
  return day === 0 ? 6 : day - 1;
}

function toLondonDateKey(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

function makeZonedDate(day: number, monthStart: Date, timezone: string) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const dayString = `${String(day).padStart(2, '0')}`;
  const monthString = `${String(month + 1).padStart(2, '0')}`;
  return fromZonedTime(`${year}-${monthString}-${dayString}T00:00:00.000`, timezone);
}

function isDateInRange(date: Date, dateRange: HistoryDateRange | null, timezone: string) {
  if (!dateRange?.from || !dateRange?.to) return false;
  const key = toLondonDateKey(date, timezone);
  const fromKey = toLondonDateKey(dateRange.from, timezone);
  const toKey = toLondonDateKey(dateRange.to, timezone);
  return key > fromKey && key < toKey;
}

function CalendarMonth({ monthStart, timezone, dateRange, onSelectDate }: CalendarMonthProps) {
  const daysInMonth = getDaysInMonth(monthStart);
  const firstWeekdayIndex = getMondayBasedIndex(monthStart.getDay());

  return (
    <div className="admin-history-calendar-month">
      <div className="admin-history-calendar-header-row">
        <strong>{formatInTimeZone(monthStart, timezone, 'MMMM yyyy')}</strong>
      </div>
      <div className="admin-history-calendar-grid" role="grid" aria-label={formatInTimeZone(monthStart, timezone, 'MMMM yyyy')}>
        {WEEKDAY_LABELS.map((label) => (
          <div key={`${monthStart.toISOString()}-${label}`} className="admin-history-calendar-weekday" role="columnheader">
            {label}
          </div>
        ))}
        {Array.from({ length: firstWeekdayIndex }).map((_, index) => (
          <div key={`blank-${monthStart.toISOString()}-${index}`} className="admin-history-calendar-empty" aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const dayDate = makeZonedDate(day, monthStart, timezone);
          const dayKey = toLondonDateKey(dayDate, timezone);
          const fromKey = dateRange?.from ? toLondonDateKey(dateRange.from, timezone) : '';
          const toKey = dateRange?.to ? toLondonDateKey(dateRange.to, timezone) : '';
          const isStart = dayKey === fromKey;
          const isEnd = dayKey === toKey;
          const isSelected = isStart || isEnd;
          const inRange = isDateInRange(dayDate, dateRange, timezone);

          return (
            <button
              key={dayKey}
              type="button"
              className={`admin-history-calendar-day ${isSelected ? 'is-selected' : ''} ${inRange ? 'is-in-range' : ''}`}
              onClick={() => onSelectDate(dayDate)}
              aria-pressed={isSelected || inRange}
            >
              <span>{day}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function HistoryDateRangePicker({ dateRange, isMobileViewport, timezone, onChangeRange, onClear }: HistoryDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(dateRange?.from ?? new Date()));
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [desktopPosition, setDesktopPosition] = useState<{ left: number; top: number }>({ left: VIEWPORT_PADDING_PX, top: 64 });

  const historyDateRangeLabel = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return '';
    return `${formatInTimeZone(dateRange.from, timezone, 'dd MMM')} - ${formatInTimeZone(dateRange.to, timezone, 'dd MMM')}`;
  }, [dateRange, timezone]);

  useEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      const content = contentRef.current;
      if (!trigger || !content || isMobileViewport) return;

      const triggerRect = trigger.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const idealLeft = triggerRect.right - contentRect.width;
      const maxLeft = window.innerWidth - contentRect.width - VIEWPORT_PADDING_PX;
      const left = Math.min(Math.max(idealLeft, VIEWPORT_PADDING_PX), Math.max(VIEWPORT_PADDING_PX, maxLeft));
      const top = Math.max(VIEWPORT_PADDING_PX, triggerRect.bottom + 8);
      setDesktopPosition({ left, top });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, isMobileViewport]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || contentRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (dateRange?.from) {
      setVisibleMonth(getMonthStart(dateRange.from));
    }
  }, [dateRange?.from]);

  const handleSelectDate = (selectedDate: Date) => {
    const selectedKey = toLondonDateKey(selectedDate, timezone);
    const fromKey = dateRange?.from ? toLondonDateKey(dateRange.from, timezone) : null;
    const toKey = dateRange?.to ? toLondonDateKey(dateRange.to, timezone) : null;

    if (!fromKey || (fromKey && toKey)) {
      onChangeRange({ from: selectedDate, to: undefined });
      return;
    }

    if (selectedKey < fromKey) {
      onChangeRange({ from: selectedDate, to: dateRange?.from });
      setIsOpen(false);
      return;
    }

    onChangeRange({ from: dateRange?.from, to: selectedDate });
    setIsOpen(false);
  };

  const handleClear = () => {
    onClear();
    setIsOpen(false);
  };

  const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);

  return (
    <div className="admin-history-date-filter-wrap">
      <button
        ref={triggerRef}
        type="button"
        className={`admin-history-date-trigger ${dateRange ? 'admin-history-date-trigger--active' : ''}`}
        aria-label="Select date range"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm13 8H4v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8ZM5 6a1 1 0 0 0-1 1v1h16V7a1 1 0 0 0-1-1H5Z" />
        </svg>
      </button>

      {dateRange ? (
        <button
          type="button"
          className="admin-history-date-clear"
          onClick={handleClear}
          aria-label="Clear date range"
        >
          ×
        </button>
      ) : null}

      {isOpen ? (
        <>
          {isMobileViewport ? <button type="button" className="admin-history-dialog-backdrop" aria-label="Close date range picker" onClick={() => setIsOpen(false)} /> : null}
          <div
            ref={contentRef}
            className={`admin-history-date-picker admin-history-date-picker--${isMobileViewport ? 'mobile' : 'desktop'}`}
            role="dialog"
            aria-label="Choose history date range"
            style={isMobileViewport ? undefined : { left: `${desktopPosition.left}px`, top: `${desktopPosition.top}px` }}
          >
            <div className="admin-history-picker-summary">
              <p>{historyDateRangeLabel || 'Select a start and end date'}</p>
            </div>

            <div className={`admin-history-picker-months admin-history-picker-months--${isMobileViewport ? 'single' : 'double'}`}>
              <CalendarMonth monthStart={visibleMonth} timezone={timezone} dateRange={dateRange} onSelectDate={handleSelectDate} />
              {!isMobileViewport ? <CalendarMonth monthStart={nextMonth} timezone={timezone} dateRange={dateRange} onSelectDate={handleSelectDate} /> : null}
            </div>

            <div className="admin-history-picker-nav">
              <button type="button" className="btn btn--ghost" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>Previous month</button>
              <button type="button" className="btn btn--ghost" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>Next month</button>
            </div>

            <div className="admin-history-picker-actions">
              <button type="button" className="btn btn--ghost" onClick={handleClear}>Clear dates</button>
              <button type="button" className="btn btn--secondary" onClick={() => setIsOpen(false)}>Close</button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
