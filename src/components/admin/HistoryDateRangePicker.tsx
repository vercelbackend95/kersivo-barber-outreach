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
const VIEWPORT_PADDING_PX = 16;
const DESKTOP_BREAKPOINT_QUERY = '(min-width: 48rem)';
const DESKTOP_SIDE_OFFSET_PX = 8;
const DESKTOP_MAX_WIDTH_VW_OFFSET_PX = 64;
const DESKTOP_SINGLE_MONTH_MIN_WIDTH_PX = 680;

type DesktopPopoverLayout = {
  left: number;
  top: number;
  maxWidth: number;
  monthCount: 1 | 2;
};


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
  const [desktopLayout, setDesktopLayout] = useState<DesktopPopoverLayout>({
    left: VIEWPORT_PADDING_PX,
    top: 64,
    maxWidth: 720,
    monthCount: 2,
  });

  const isDesktopViewport = useMemo(() => {
    if (typeof window === 'undefined') return !isMobileViewport;
    return window.matchMedia(DESKTOP_BREAKPOINT_QUERY).matches && !isMobileViewport;
  }, [isMobileViewport]);


  const historyDateRangeLabel = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return '';
    return `${formatInTimeZone(dateRange.from, timezone, 'dd MMM')} - ${formatInTimeZone(dateRange.to, timezone, 'dd MMM')}`;
  }, [dateRange, timezone]);

  useEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      const content = contentRef.current;
      if (!trigger || !content || !isDesktopViewport) return;

      const triggerRect = trigger.getBoundingClientRect();
            const boundaryRect = trigger.closest('.admin-history-filters')?.getBoundingClientRect();
      const boundaryLeft = Math.max(VIEWPORT_PADDING_PX, boundaryRect?.left ?? VIEWPORT_PADDING_PX);
      const boundaryRight = Math.min(window.innerWidth - VIEWPORT_PADDING_PX, boundaryRect?.right ?? window.innerWidth - VIEWPORT_PADDING_PX);
      const boundaryTop = Math.max(VIEWPORT_PADDING_PX, boundaryRect?.top ?? VIEWPORT_PADDING_PX);
      const boundaryBottom = Math.min(window.innerHeight - VIEWPORT_PADDING_PX, boundaryRect?.bottom ?? window.innerHeight - VIEWPORT_PADDING_PX);
      const availableWidth = Math.max(0, boundaryRight - boundaryLeft);
      const maxWidth = Math.min(720, window.innerWidth - DESKTOP_MAX_WIDTH_VW_OFFSET_PX, availableWidth);
      const monthCount: 1 | 2 = maxWidth >= DESKTOP_SINGLE_MONTH_MIN_WIDTH_PX ? 2 : 1;

      content.style.maxWidth = `${Math.max(320, maxWidth)}px`;

      const contentRect = content.getBoundingClientRect();

      const leftPlacementLeft = triggerRect.left - contentRect.width - DESKTOP_SIDE_OFFSET_PX;
      const bottomPlacementLeft = triggerRect.right - contentRect.width;
      const bottomPlacementTop = triggerRect.bottom + DESKTOP_SIDE_OFFSET_PX;

      const canPlaceLeft = leftPlacementLeft >= boundaryLeft;

      const desiredLeft = canPlaceLeft ? leftPlacementLeft : bottomPlacementLeft;
      const desiredTop = canPlaceLeft ? triggerRect.top : bottomPlacementTop;

      const maxLeft = Math.max(boundaryLeft, boundaryRight - contentRect.width);
      const maxTop = Math.max(boundaryTop, boundaryBottom - contentRect.height);

      const left = Math.min(Math.max(desiredLeft, boundaryLeft), maxLeft);
      const top = Math.min(Math.max(desiredTop, boundaryTop), maxTop);

      setDesktopLayout({ left, top, maxWidth: Math.max(320, maxWidth), monthCount });

    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isDesktopViewport, isOpen]);

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
            className={`admin-history-date-picker admin-history-date-picker--${isDesktopViewport ? 'desktop' : 'mobile'}`}
            role="dialog"
            aria-label="Choose history date range"
            style={isDesktopViewport ? { left: `${desktopLayout.left}px`, top: `${desktopLayout.top}px`, maxWidth: `${desktopLayout.maxWidth}px` } : undefined}
          >
            <div className="admin-history-picker-summary">
              <p>{historyDateRangeLabel || 'Select a start and end date'}</p>
            </div>
            <div className={`admin-history-picker-months admin-history-picker-months--${isDesktopViewport && desktopLayout.monthCount === 2 ? 'double' : 'single'}`}>
              <CalendarMonth monthStart={visibleMonth} timezone={timezone} dateRange={dateRange} onSelectDate={handleSelectDate} />
              {isDesktopViewport && desktopLayout.monthCount === 2 ? <CalendarMonth monthStart={nextMonth} timezone={timezone} dateRange={dateRange} onSelectDate={handleSelectDate} /> : null}
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
