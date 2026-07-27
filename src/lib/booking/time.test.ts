// src/lib/booking/time.test.ts
import { describe, expect, it } from 'vitest';
import { getEarliestBookableSlotMinute, londonDayOfWeekFromIsoDate, normalizeToIsoDate } from './time';

describe('normalizeToIsoDate', () => {
  it('keeps ISO dates unchanged', () => {
    expect(normalizeToIsoDate('2026-02-24')).toBe('2026-02-24');
  });

  it('converts DMY dates into ISO dates', () => {
    expect(normalizeToIsoDate('24/02/2026')).toBe('2026-02-24');
  });

  it('returns null for invalid dates', () => {
    expect(normalizeToIsoDate('31/02/2026')).toBeNull();
  });
});

describe('londonDayOfWeekFromIsoDate', () => {
  it('maps weekdays as Monday=1 … Saturday=6', () => {
    expect(londonDayOfWeekFromIsoDate('2026-03-02')).toBe(1); // Monday
    expect(londonDayOfWeekFromIsoDate('2026-02-24')).toBe(2); // Tuesday
    expect(londonDayOfWeekFromIsoDate('2026-02-28')).toBe(6); // Saturday
  });

  it('maps Sunday as 7', () => {
    expect(londonDayOfWeekFromIsoDate('2026-03-01')).toBe(7);
  });
});


describe('getEarliestBookableSlotMinute', () => {
  it('applies the 30-minute lead time and rounds up to the next slot boundary for today', () => {
    expect(getEarliestBookableSlotMinute({
      date: '2026-03-23',
      slotIntervalMinutes: 15,
      now: new Date('2026-03-23T12:22:00Z')
    })).toBe(13 * 60);
  });

  it('returns the full-day cutoff when the lead time spills into the next day', () => {
    expect(getEarliestBookableSlotMinute({
      date: '2026-03-23',
      slotIntervalMinutes: 15,
      now: new Date('2026-03-23T23:46:00Z')
    })).toBe(24 * 60);
  });

  it('leaves future dates unaffected', () => {
    expect(getEarliestBookableSlotMinute({
      date: '2026-03-24',
      slotIntervalMinutes: 15,
      now: new Date('2026-03-23T12:46:00Z')
    })).toBe(0);
  });
});
