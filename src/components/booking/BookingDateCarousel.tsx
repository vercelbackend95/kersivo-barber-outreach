import React, { useEffect, useMemo, useRef, useState } from 'react';
import { compareIsoDates, formatMonthYear, shiftIsoDate } from '@/lib/booking/bookingDateUi';

type Props = {
  date: string;
  minDate: string;
  timezone: string;
  onDateChange: (date: string) => void;
};

const DAYS_VISIBLE = 180;
function labelForDay(iso: string, timezone: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short' }).format(new Date(`${iso}T12:00:00Z`));
}
function dayNumber(iso: string) {
  return Number(iso.slice(8, 10));
}

export default function BookingDateCarousel({ date, minDate, timezone, onDateChange }: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLInputElement>(null);
  const [monthAnchor, setMonthAnchor] = useState(date || minDate);
  const [visibleStart, setVisibleStart] = useState(minDate);
  const dates = useMemo(
    () => Array.from({ length: DAYS_VISIBLE }, (_, index) => shiftIsoDate(visibleStart, index)),
    [visibleStart],
  );

  useEffect(() => {
    if (compareIsoDates(date, visibleStart) < 0 || compareIsoDates(date, shiftIsoDate(visibleStart, DAYS_VISIBLE - 1)) > 0) {
      setVisibleStart(compareIsoDates(date, minDate) < 0 ? minDate : date);
    }
  }, [date, visibleStart, minDate]);

  useEffect(() => {
    const rail = railRef.current;
    const button = rail?.querySelector<HTMLButtonElement>('[data-selected="true"]');
    if (rail && button) rail.scrollTo({ left: Math.max(0, button.offsetLeft - rail.offsetLeft - 8), behavior: 'instant' });
  }, [date, visibleStart]);

  const move = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * rail.clientWidth * 0.8, behavior: 'smooth' });
  };
  const openCalendar = () => {
    const input = calendarRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      try { input.showPicker(); return; } catch { /* fallback to focus */ }
    }
    input.focus();
    input.click();
  };

  return (
    <div className="booking-date-carousel">
      <div className="booking-date-carousel__header">
        <strong>{formatMonthYear(monthAnchor, timezone)}</strong>
        <div className="booking-date-carousel__actions">
          <button type="button" aria-label="Previous dates" onClick={() => move(-1)} className="booking-date-carousel__arrow">‹</button>
          <button type="button" aria-label="Next dates" onClick={() => move(1)} className="booking-date-carousel__arrow">›</button>
          <button type="button" aria-label="Choose date from calendar" className="booking-date-carousel__calendar" onClick={openCalendar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>
          </button>
          <input ref={calendarRef} type="date" className="booking-date-carousel__native" aria-label="Select booking date" min={minDate} value={date} onChange={(event) => { if (event.target.value && compareIsoDates(event.target.value, minDate) >= 0) onDateChange(event.target.value); }} />
        </div>
      </div>
      <div ref={railRef} className="booking-date-carousel__rail" role="group" aria-label="Choose booking date" onScroll={(event) => {
        const rail = event.currentTarget;
        const centre = rail.scrollLeft + rail.clientWidth / 2;
        const item = Array.from(rail.children).find((node) => {
          const element = node as HTMLElement;
          return element.offsetLeft - rail.offsetLeft <= centre && element.offsetLeft - rail.offsetLeft + element.offsetWidth > centre;
        }) as HTMLElement | undefined;
        if (item?.dataset.date) setMonthAnchor(item.dataset.date);
      }}>
        {dates.map((day) => (
          <button
            key={day}
            type="button"
            data-date={day}
            data-selected={day === date}
            className={`booking-date-carousel__day${day === date ? ' is-selected' : ''}`}
            aria-pressed={day === date}
            aria-label={new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${day}T12:00:00Z`))}
            onClick={() => { setMonthAnchor(day); onDateChange(day); }}
          >
            <span>{labelForDay(day, timezone)}</span>
            <strong>{dayNumber(day)}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
