import { describe, expect, it } from 'vitest';
import { bookingPreviewDates } from './bookingPreviewDates';

describe('booking preview dates', () => {
  it('starts on the coming Monday and shows the next three weekdays', () => {
    const preview = bookingPreviewDates(new Date('2026-10-30T12:00:00Z'));
    expect(preview.monthLabel).toBe('November 2026');
    expect(preview.days.map((day) => day.weekday)).toEqual(['Mon', 'Tue', 'Wed']);
    expect(preview.days.map((day) => day.dayOfMonth)).toEqual([2, 3, 4]);
    expect(preview.days.map((day) => day.selected)).toEqual([false, true, false]);
  });

  it('keeps today when today is Monday', () => {
    const preview = bookingPreviewDates(new Date('2026-11-02T12:00:00Z'));
    expect(preview.days[0]).toMatchObject({ weekday: 'Mon', dayOfMonth: 2, selected: false });
    expect(preview.monthLabel).toBe('November 2026');
  });

  it('names both months when the three dates cross a month boundary', () => {
    const preview = bookingPreviewDates(new Date('2026-11-30T12:00:00Z'));
    expect(preview.monthLabel).toBe('November–December 2026');
    expect(preview.days.map((day) => day.dayOfMonth)).toEqual([30, 1, 2]);
  });

  it('names both years when the three dates cross into January', () => {
    const preview = bookingPreviewDates(new Date('2024-12-30T12:00:00Z'));
    expect(preview.monthLabel).toBe('December 2024–January 2025');
    expect(preview.days.map((day) => [day.weekday, day.dayOfMonth])).toEqual([
      ['Mon', 30],
      ['Tue', 31],
      ['Wed', 1],
    ]);
  });

  it('stays in the current month when the next Monday is still this month', () => {
    expect(bookingPreviewDates(new Date('2026-01-01T12:00:00Z')).monthLabel).toBe('January 2026');
  });
});
