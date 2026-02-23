// src/lib/booking/time.test.ts
import { describe, expect, it } from 'vitest';
import { londonDayOfWeekFromIsoDate, normalizeToIsoDate } from './time';

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
  it('maps weekdays as Monday=1..Saturday=6', () => {
    expect(londonDayOfWeekFromIsoDate('2026-02-24')).toBe(2);
    expect(londonDayOfWeekFromIsoDate('2026-02-28')).toBe(6);
  });

  it('maps Sunday as 0', () => {
    expect(londonDayOfWeekFromIsoDate('2026-03-01')).toBe(0);
  });
});
