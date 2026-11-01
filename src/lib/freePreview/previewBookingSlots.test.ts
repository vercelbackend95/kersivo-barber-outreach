import { describe, expect, it } from 'vitest';
import {
  isoWeekdayFromIsoDate,
  previewHoursFromRows,
  previewSlotsForDate,
  PREVIEW_STATIC_SLOTS,
} from './previewBookingSlots';

describe('preview booking slots honour shop hours', () => {
  it('keeps example slots when hours are omitted (marketing sandbox)', () => {
    expect(previewSlotsForDate({ isoDate: '2026-11-01' })).toEqual([...PREVIEW_STATIC_SLOTS]);
  });

  it('returns no slots on a closed Sunday after hours apply', () => {
    const hours = [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, open: true }));
    expect(isoWeekdayFromIsoDate('2026-11-01')).toBe(7);
    expect(previewSlotsForDate({ isoDate: '2026-11-01', hours })).toEqual([]);
    expect(previewSlotsForDate({ isoDate: '2026-11-02', hours }).length).toBeGreaterThan(0);
  });

  it('treats an explicit Sunday closed row as empty', () => {
    const hours = [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({ dayOfWeek, open: dayOfWeek !== 7 }));
    expect(previewSlotsForDate({ isoDate: '2026-11-01', hours })).toEqual([]);
  });

  it('pads omitted weekdays as closed after apply writes only open days', () => {
    const hours = previewHoursFromRows(
      [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, active: true })),
    );
    expect(hours).toHaveLength(7);
    expect(hours.find((day) => day.dayOfWeek === 7)).toEqual({ dayOfWeek: 7, open: false });
    expect(previewSlotsForDate({ isoDate: '2026-11-01', hours })).toEqual([]);
  });
});
