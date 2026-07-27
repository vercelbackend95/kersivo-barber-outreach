import { describe, expect, it } from 'vitest';
import {
  getLondonMinutesFromMidnight,
  getTodayInLondon,
  getTodayScheduleForBarber,
  getTodayShiftWindowForBarber,
  isHolidayBlockTitle,
  isWithinShiftNow,
  withHolidayTodayLabel,
} from './todayWorkingHours';

describe('getTodayInLondon', () => {
  it('maps Monday to 1', () => {
    expect(getTodayInLondon(new Date('2026-03-02T12:00:00.000Z'))).toBe(1);
  });

  it('maps Tuesday to 2 (no off-by-one)', () => {
    expect(getTodayInLondon(new Date('2026-03-03T12:00:00.000Z'))).toBe(2);
  });

  it('maps Sunday to 7', () => {
    expect(getTodayInLondon(new Date('2026-03-08T12:00:00.000Z'))).toBe(7);
  });
});

describe('getTodayScheduleForBarber', () => {
  it('returns scheduled hours when active', () => {
    expect(getTodayScheduleForBarber([{ active: true, startMinutes: 600, endMinutes: 1080 }])).toEqual({
      todayLabel: '10:00–18:00',
      todayIsOnShift: true
    });
  });

  it('returns off when day exists but is inactive', () => {
    expect(getTodayScheduleForBarber([{ active: false, startMinutes: 600, endMinutes: 1080 }])).toEqual({
      todayLabel: 'Off',
      todayIsOnShift: false
    });
  });

  it('returns off when schedule is missing for the day', () => {
    expect(getTodayScheduleForBarber(undefined)).toEqual({
      todayLabel: 'Off',
      todayIsOnShift: false
    });
    expect(getTodayScheduleForBarber([])).toEqual({
      todayLabel: 'Off',
      todayIsOnShift: false
    });
  });
});

describe('isHolidayBlockTitle', () => {
  it('detects HOLIDAY and vacation titles', () => {
    expect(isHolidayBlockTitle('HOLIDAY')).toBe(true);
    expect(isHolidayBlockTitle('Summer vacation')).toBe(true);
    expect(isHolidayBlockTitle('BREAK')).toBe(false);
  });
});

describe('withHolidayTodayLabel', () => {
  it('overrides schedule with Holiday', () => {
    expect(
      withHolidayTodayLabel({ todayLabel: '10:00–18:00', todayIsOnShift: true }, true),
    ).toEqual({ todayLabel: 'Holiday', todayIsOnShift: false });
    expect(
      withHolidayTodayLabel({ todayLabel: '10:00–18:00', todayIsOnShift: true }, false),
    ).toEqual({ todayLabel: '10:00–18:00', todayIsOnShift: true });
  });
});

describe('getTodayShiftWindowForBarber', () => {
  it('returns null when no rules', () => {
    expect(getTodayShiftWindowForBarber(undefined)).toBeNull();
    expect(getTodayShiftWindowForBarber([])).toBeNull();
  });

  it('returns null when no active rule', () => {
    expect(getTodayShiftWindowForBarber([{ active: false, startMinutes: 600, endMinutes: 1080 }])).toBeNull();
  });

  it('returns window with break fields', () => {
    expect(
      getTodayShiftWindowForBarber([
        { active: true, startMinutes: 600, endMinutes: 1080, breakStartMin: 780, breakEndMin: 840 }
      ])
    ).toEqual({
      startMinutes: 600,
      endMinutes: 1080,
      breakStartMin: 780,
      breakEndMin: 840
    });
  });
});

describe('getLondonMinutesFromMidnight', () => {
  it('reads London wall time in winter (GMT)', () => {
    const jan = new Date('2026-01-15T14:30:00.000Z');
    expect(getLondonMinutesFromMidnight(jan)).toBe(14 * 60 + 30);
  });
});

describe('isWithinShiftNow', () => {
  const window = { startMinutes: 600, endMinutes: 1080, breakStartMin: null, breakEndMin: null };

  it('returns false for null window', () => {
    expect(isWithinShiftNow(new Date(), null)).toBe(false);
    expect(isWithinShiftNow(new Date(), undefined)).toBe(false);
  });

  it('is true inside [start, end) without break', () => {
    const t = new Date('2026-01-15T15:00:00.000Z');
    expect(isWithinShiftNow(t, window)).toBe(true);
  });

  it('is false before shift', () => {
    const t = new Date('2026-01-15T08:00:00.000Z');
    expect(isWithinShiftNow(t, window)).toBe(false);
  });

  it('is false at or after endMinutes', () => {
    const atEnd = new Date('2026-01-15T18:00:00.000Z');
    expect(isWithinShiftNow(atEnd, window)).toBe(false);
  });

  it('is false inside lunch break', () => {
    const withBreak = {
      startMinutes: 600,
      endMinutes: 1080,
      breakStartMin: 780,
      breakEndMin: 840
    };
    const duringBreak = new Date('2026-01-15T13:30:00.000Z');
    expect(isWithinShiftNow(duringBreak, withBreak)).toBe(false);
  });

  it('is true after break same day', () => {
    const withBreak = {
      startMinutes: 600,
      endMinutes: 1080,
      breakStartMin: 780,
      breakEndMin: 840
    };
    const afterBreak = new Date('2026-01-15T14:30:00.000Z');
    expect(isWithinShiftNow(afterBreak, withBreak)).toBe(true);
  });
});
