import { describe, expect, it } from 'vitest';
import {
  buildReportsFetchParams,
  customRangeDayCount,
  getDefaultReportsPreset,
  parseYmdRange,
} from './reportsRange';

describe('parseYmdRange', () => {
  it('accepts valid ordered dates', () => {
    expect(parseYmdRange('2026-01-01', '2026-01-07')).toEqual({
      from: '2026-01-01',
      to: '2026-01-07',
    });
  });

  it('rejects invalid format', () => {
    expect(() => parseYmdRange('01-01-2026', '2026-01-07')).toThrow(/YYYY-MM-DD/);
  });

  it('rejects from after to', () => {
    expect(() => parseYmdRange('2026-02-01', '2026-01-01')).toThrow(/less than or equal/);
  });

  it('rejects spans over 365 days', () => {
    expect(() => parseYmdRange('2024-01-01', '2025-01-02')).toThrow(/365 days/);
  });
});

describe('buildReportsFetchParams', () => {
  it('builds preset params', () => {
    const params = buildReportsFetchParams('week');
    expect(params?.get('range')).toBe('week');
    expect(params?.get('from')).toBeNull();
  });

  it('builds 1d preset params', () => {
    const params = buildReportsFetchParams('1d');
    expect(params?.get('range')).toBe('1d');
  });

  it('builds 1y preset params', () => {
    const params = buildReportsFetchParams('1y');
    expect(params?.get('range')).toBe('1y');
  });

  it('builds custom params when range is complete', () => {
    const params = buildReportsFetchParams('custom', {
      from: new Date('2026-01-10T12:00:00.000Z'),
      to: new Date('2026-01-15T12:00:00.000Z'),
    });
    expect(params?.get('range')).toBe('custom');
    expect(params?.get('from')).toBeTruthy();
    expect(params?.get('to')).toBeTruthy();
  });

  it('returns null for incomplete custom range', () => {
    expect(buildReportsFetchParams('custom', { from: new Date() })).toBeNull();
  });
});

describe('getDefaultReportsPreset', () => {
  it('defaults to week on desktop and 7d on mobile', () => {
    expect(getDefaultReportsPreset(false)).toBe('week');
    expect(getDefaultReportsPreset(true)).toBe('7d');
  });
});

describe('customRangeDayCount', () => {
  it('counts inclusive days', () => {
    expect(customRangeDayCount('2026-01-01', '2026-01-07')).toBe(7);
  });
});
