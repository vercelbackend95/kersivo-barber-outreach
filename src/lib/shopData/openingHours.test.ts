import { describe, expect, it } from 'vitest';
import {
  copyMondayToWeekdays,
  defaultOpeningWeek,
  isOpeningWeekValid,
  OPENING_HOURS_CLOSE_AFTER_OPEN,
  openingDayError,
  openingRowsFromWeek,
  openingWeekErrors,
  openingWeekFromRows,
  QUARTER_HOUR_TIMES,
  sameOpeningWeek,
  timeOptionsFor,
} from './openingHours';
import { parsePoundsToPence, penceToPoundsInput } from './schema';

describe('opening hours model', () => {
  it('defaults to Monday–Saturday 09:00–18:00 with Sunday closed, Monday first', () => {
    const week = defaultOpeningWeek();
    expect(week.map((d) => d.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(week.filter((d) => d.isOpen).map((d) => d.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(week.every((d) => d.opens === '09:00' && d.closes === '18:00')).toBe(true);
    expect(isOpeningWeekValid(week)).toBe(true);
  });

  it('offers 24-hour times in 15-minute steps, keeping an off-grid saved value', () => {
    expect(QUARTER_HOUR_TIMES).toHaveLength(96);
    expect(QUARTER_HOUR_TIMES[0]).toBe('00:00');
    expect(QUARTER_HOUR_TIMES[53]).toBe('13:15');
    expect(QUARTER_HOUR_TIMES.at(-1)).toBe('23:45');
    expect(timeOptionsFor('09:10')).toContain('09:10');
    expect(timeOptionsFor('09:10')).toHaveLength(97);
    expect(timeOptionsFor('09:15')).toHaveLength(96);
  });

  it('needs closing after opening on open days only', () => {
    expect(openingDayError({ dayOfWeek: 1, isOpen: true, opens: '18:00', closes: '09:00' })).toBe(
      OPENING_HOURS_CLOSE_AFTER_OPEN,
    );
    expect(openingDayError({ dayOfWeek: 1, isOpen: true, opens: '09:00', closes: '09:00' })).toBe(
      OPENING_HOURS_CLOSE_AFTER_OPEN,
    );
    expect(openingDayError({ dayOfWeek: 1, isOpen: false, opens: '18:00', closes: '09:00' })).toBeNull();
    const week = defaultOpeningWeek().map((d) => (d.dayOfWeek === 3 ? { ...d, closes: '08:00' } : d));
    expect(openingWeekErrors(week)).toEqual({ 3: OPENING_HOURS_CLOSE_AFTER_OPEN });
    expect(isOpeningWeekValid(week)).toBe(false);
  });

  it('copies Monday to Tuesday–Friday and leaves the weekend alone', () => {
    const week = defaultOpeningWeek().map((d) => (d.dayOfWeek === 1 ? { ...d, opens: '08:30', closes: '19:00' } : d));
    const copied = copyMondayToWeekdays(week);
    expect(copied.slice(0, 5).every((d) => d.opens === '08:30' && d.closes === '19:00' && d.isOpen)).toBe(true);
    expect(copied[5]).toEqual(week[5]);
    expect(copied[6]).toEqual(week[6]);
    const closedMonday = copyMondayToWeekdays(defaultOpeningWeek().map((d) => (d.dayOfWeek === 1 ? { ...d, isOpen: false } : d)));
    expect(closedMonday.slice(0, 5).every((d) => !d.isOpen)).toBe(true);
  });

  it('round-trips the API rows and treats a missing day as closed', () => {
    const week = openingWeekFromRows([
      { dayOfWeek: 2, active: true, startTime: '10:00', endTime: '17:00' },
      { dayOfWeek: 6, active: false, startTime: '09:00', endTime: '13:00' },
    ]);
    expect(week[0]).toEqual({ dayOfWeek: 1, isOpen: false, opens: '09:00', closes: '18:00' });
    expect(week[1]).toEqual({ dayOfWeek: 2, isOpen: true, opens: '10:00', closes: '17:00' });
    const rows = openingRowsFromWeek(week);
    expect(rows).toHaveLength(7);
    expect(rows[1]).toEqual({ dayOfWeek: 2, active: true, startTime: '10:00', endTime: '17:00' });
    expect(sameOpeningWeek(openingWeekFromRows(rows), week)).toBe(true);
    expect(sameOpeningWeek(week, defaultOpeningWeek())).toBe(false);
  });
});

describe('pounds and pence', () => {
  it('parses pounds typed by the owner into whole pence without floating-point drift', () => {
    expect(parsePoundsToPence('12')).toBe(1200);
    expect(parsePoundsToPence('12.5')).toBe(1250);
    expect(parsePoundsToPence('£12.50')).toBe(1250);
    expect(parsePoundsToPence(' £ 1,200.99 ')).toBe(120099);
    expect(parsePoundsToPence('0.29')).toBe(29);
    expect(parsePoundsToPence('')).toBeNull();
    expect(parsePoundsToPence('12.505')).toBeNull();
    expect(parsePoundsToPence('-5')).toBeNull();
    expect(parsePoundsToPence('abc')).toBeNull();
    expect(parsePoundsToPence(null)).toBeNull();
  });

  it('formats pence for a price input', () => {
    expect(penceToPoundsInput(1250)).toBe('12.50');
    expect(penceToPoundsInput(1200)).toBe('12');
    expect(penceToPoundsInput(5)).toBe('0.05');
    expect(penceToPoundsInput(-1)).toBe('');
    expect(parsePoundsToPence(penceToPoundsInput(2999))).toBe(2999);
  });
});
