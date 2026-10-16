import { describe, expect, it } from 'vitest';
import { locateTimelineMinute, type TimelineRowAnchor } from './timelineFocus';

const row = (label: string, center: number, expanded = false, bottom = center + 15): TimelineRowAnchor => {
  const [h, m] = label.split(':').map(Number);
  return { minute: h * 60 + m, center, bottom, expanded };
};

const rows = [row('11:30', 100), row('12:00', 130), row('12:30', 160), row('18:00', 400), row('18:30', 430)];

describe('locateTimelineMinute', () => {
  it('puts a time with its own row on that row', () => {
    expect(locateTimelineMinute(rows, 12 * 60)).toBe(130);
    expect(locateTimelineMinute(rows, 18 * 60)).toBe(400);
  });

  it('puts a quarter-past start halfway between its neighbouring rows, never on the 00 or 30 row', () => {
    expect(locateTimelineMinute(rows, 12 * 60 + 15)).toBe(145);
    expect(locateTimelineMinute(rows, 18 * 60 + 15)).toBe(415);
    expect(locateTimelineMinute(rows, 18 * 60 + 15)).not.toBe(locateTimelineMinute(rows, 18 * 60));
    expect(locateTimelineMinute(rows, 18 * 60 + 15)).not.toBe(locateTimelineMinute(rows, 18 * 60 + 30));
  });

  it('uses inserted off-half-hour rows as neighbours', () => {
    const withBooking = [...rows, row('12:10', 140)];
    expect(locateTimelineMinute(withBooking, 12 * 60 + 15)).toBeCloseTo(140 + (160 - 140) * (5 / 20));
  });

  it('starts below expanded booking cards', () => {
    const expanded = [row('12:00', 130, true, 330), row('12:30', 360)];
    expect(locateTimelineMinute(expanded, 12 * 60 + 15)).toBe(345);
  });

  it('returns null outside the rendered rows', () => {
    expect(locateTimelineMinute([], 720)).toBeNull();
    expect(locateTimelineMinute(rows, 8 * 60)).toBeNull();
  });
});
