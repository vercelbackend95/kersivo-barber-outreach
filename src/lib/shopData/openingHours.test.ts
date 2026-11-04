import { describe, expect, it } from 'vitest';
import {
  copyDayTo,
  formatOpenHours,
  OPENING_WEEK_PRESETS,
  openingWeekMatchesPreset,
  pickClosingTime,
  pickOpeningTime,
  summariseOpeningWeek,
  weeklyOpenMinutes,
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

  it('copies one day to the chosen days only (copyDayTo)', () => {
    const week = defaultOpeningWeek().map((d) => (d.dayOfWeek === 1 ? { ...d, opens: '08:30', closes: '19:00' } : d));
    const copied = copyDayTo(week, 1, [2, 3, 7]);
    expect(copied.map((d) => (d.isOpen ? `${d.opens}-${d.closes}` : 'closed'))).toEqual([
      '08:30-19:00',
      '08:30-19:00',
      '08:30-19:00',
      '09:00-18:00',
      '09:00-18:00',
      '09:00-18:00',
      '08:30-19:00',
    ]);
    // A closed source closes the targets; the source itself and unknown sources are left alone.
    const closed = copyDayTo(defaultOpeningWeek(), 7, [1, 7]);
    expect(closed[0]!.isOpen).toBe(false);
    expect(closed[6]).toEqual(defaultOpeningWeek()[6]);
    expect(copyDayTo([], 1, [2])).toEqual([]);
  });

  it('summarises consecutive days with the same hours (summariseOpeningWeek)', () => {
    expect(summariseOpeningWeek(defaultOpeningWeek())).toEqual([
      { days: 'Mon – Sat', time: '09:00 – 18:00', closed: false },
      { days: 'Sun', time: 'Closed', closed: true },
    ]);
    const split = OPENING_WEEK_PRESETS.find((p) => p.id === 'tue-sat')!.week;
    expect(summariseOpeningWeek(split)).toEqual([
      { days: 'Mon', time: 'Closed', closed: true },
      { days: 'Tue – Sat', time: '09:00 – 18:00', closed: false },
      { days: 'Sun', time: 'Closed', closed: true },
    ]);
    // Closed days group whatever their stored times; a different day breaks the run.
    const week = defaultOpeningWeek().map((d) =>
      d.dayOfWeek === 3 ? { ...d, closes: '20:00' } : d.dayOfWeek === 6 ? { ...d, isOpen: false, opens: '07:00' } : d,
    );
    expect(summariseOpeningWeek(week).map((l) => `${l.days} ${l.time}`)).toEqual([
      'Mon – Tue 09:00 – 18:00',
      'Wed 09:00 – 20:00',
      'Thu – Fri 09:00 – 18:00',
      'Sat – Sun Closed',
    ]);
  });

  it('totals the open minutes of the week (weeklyOpenMinutes)', () => {
    expect(weeklyOpenMinutes(defaultOpeningWeek())).toBe(54 * 60);
    expect(formatOpenHours(weeklyOpenMinutes(defaultOpeningWeek()))).toBe('54');
    const half = defaultOpeningWeek().map((d) => (d.dayOfWeek === 6 ? { ...d, closes: '16:30' } : d));
    expect(formatOpenHours(weeklyOpenMinutes(half))).toBe('52.5');
    // Invalid periods count as nothing.
    const invalid = defaultOpeningWeek().map((d) => (d.dayOfWeek === 1 ? { ...d, closes: '08:00' } : d));
    expect(weeklyOpenMinutes(invalid)).toBe(45 * 60);
    expect(formatOpenHours(3165)).toBe('52.75');
  });

  it('offers four quick patterns and matches a week ignoring closed-day times (OPENING_WEEK_PRESETS)', () => {
    expect(OPENING_WEEK_PRESETS.map((p) => p.label)).toEqual([
      'Mon–Sat · 09:00–18:00',
      'Mon–Fri 09:00–18:00 · Sat 09:00–17:00',
      'Tue–Sat · 09:00–18:00',
      'Every day · 10:00–18:00',
    ]);
    for (const preset of OPENING_WEEK_PRESETS) {
      expect(preset.week.map((d) => d.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(isOpeningWeekValid(preset.week)).toBe(true);
    }
    expect(weeklyOpenMinutes(OPENING_WEEK_PRESETS[1]!.week)).toBe(53 * 60);
    expect(OPENING_WEEK_PRESETS[3]!.week.every((d) => d.isOpen && d.opens === '10:00')).toBe(true);
    const monSat = OPENING_WEEK_PRESETS[0]!;
    const sundayOther = defaultOpeningWeek().map((d) => (d.dayOfWeek === 7 ? { ...d, opens: '11:00' } : d));
    expect(openingWeekMatchesPreset(sundayOther, monSat)).toBe(true);
    expect(openingWeekMatchesPreset(sundayOther, OPENING_WEEK_PRESETS[2]!)).toBe(false);
  });

  it('enforces the picker rules (pickOpeningTime, pickClosingTime)', () => {
    const day = { dayOfWeek: 1 as const, isOpen: true, opens: '09:00', closes: '18:00' };
    expect(pickOpeningTime(day, 8 * 60 + 15)).toEqual({ day: { ...day, opens: '08:15' }, movedClosing: null });
    // Reaching closing moves it forward by the previous length (capped at 23:45).
    const short = { ...day, opens: '09:00', closes: '10:00' };
    expect(pickOpeningTime(short, 10 * 60)).toEqual({ day: { ...short, opens: '10:00', closes: '11:00' }, movedClosing: '11:00' });
    expect(pickOpeningTime(day, 18 * 60).movedClosing).toBe('23:45');
    // At least an hour; latest opening 23:30.
    expect(pickOpeningTime({ ...day, closes: '09:00' }, 9 * 60).day.closes).toBe('10:00');
    expect(pickOpeningTime(day, 23 * 60 + 45).day).toMatchObject({ opens: '23:30', closes: '23:45' });
    // Off-grid choices snap to the quarter.
    expect(pickOpeningTime(day, 7 * 60 + 10).day.opens).toBe('07:00');
    expect(pickClosingTime(day, 17 * 60 + 30).closes).toBe('17:30');
    // At or before opening: first valid quarter of that hour, or unchanged when the hour has none.
    expect(pickClosingTime(day, 9 * 60).closes).toBe('09:15');
    expect(pickClosingTime(day, 8 * 60)).toEqual(day);
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
