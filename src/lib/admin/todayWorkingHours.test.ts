import { describe, expect, it } from 'vitest';
import { getTodayInLondon, getTodayScheduleForBarber } from './todayWorkingHours';

describe('getTodayInLondon', () => {
  it('maps Monday to 0', () => {
    expect(getTodayInLondon(new Date('2026-03-02T12:00:00.000Z'))).toBe(0);
  });

  it('maps Tuesday to 1 (no off-by-one)', () => {
    expect(getTodayInLondon(new Date('2026-03-03T12:00:00.000Z'))).toBe(1);
  });

  it('maps Sunday to 6', () => {
    expect(getTodayInLondon(new Date('2026-03-08T12:00:00.000Z'))).toBe(6);
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

  it('returns em dash when schedule is missing', () => {
    expect(getTodayScheduleForBarber(undefined)).toEqual({
      todayLabel: '—',
      todayIsOnShift: null
    });
  });
});
