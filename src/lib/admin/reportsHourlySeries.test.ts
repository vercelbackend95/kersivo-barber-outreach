import { describe, expect, it } from 'vitest';

import {
  buildWorkdayHourLabels,
  formatHourLabel,
  isHourLabel,
  toCumulativeSeries,
} from './reportsHourlySeries';

describe('reportsHourlySeries', () => {
  it('detects hour labels', () => {
    expect(isHourLabel('09:00')).toBe(true);
    expect(isHourLabel('2026-07-13')).toBe(false);
  });

  it('builds workday labels from open through current hour', () => {
    // 12:00 UTC in July = 13:00 Europe/London
    const labels = buildWorkdayHourLabels(new Date('2026-07-13T12:00:00.000Z'));
    expect(labels[0]).toBe('09:00');
    expect(labels.at(-1)).toBe('13:00');
    expect(labels).toEqual(['09:00', '10:00', '11:00', '12:00', '13:00']);
  });

  it('clamps to close hour late in the day', () => {
    const labels = buildWorkdayHourLabels(new Date('2026-07-13T21:00:00.000Z'));
    expect(labels[0]).toBe('09:00');
    expect(labels.at(-1)).toBe('19:00');
  });

  it('formats hours and builds cumulative series', () => {
    expect(formatHourLabel(9)).toBe('09:00');
    const labels = ['09:00', '10:00', '11:00'];
    const perHour = new Map([
      ['09:00', 40],
      ['10:00', 60],
      ['11:00', 20],
    ]);
    expect(toCumulativeSeries(labels, perHour)).toEqual([
      { label: '09:00', value: 40 },
      { label: '10:00', value: 100 },
      { label: '11:00', value: 120 },
    ]);
  });
});
