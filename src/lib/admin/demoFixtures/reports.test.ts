import { describe, expect, it } from 'vitest';

import {
  getDemoReportsResponse,
  getDemoReportsResponseForTest,
  resolveDemoReportsDayCount,
} from './reports';

const FIXED_NOW = new Date('2026-07-13T12:00:00.000Z');

describe('resolveDemoReportsDayCount', () => {
  it('maps presets to day counts', () => {
    expect(resolveDemoReportsDayCount('1d')).toBe(1);
    expect(resolveDemoReportsDayCount('7d')).toBe(7);
    expect(resolveDemoReportsDayCount('week')).toBe(7);
    expect(resolveDemoReportsDayCount('30d')).toBe(30);
    expect(resolveDemoReportsDayCount('90d')).toBe(90);
    expect(resolveDemoReportsDayCount('1y')).toBe(90);
  });

  it('caps custom ranges at 90 days', () => {
    expect(resolveDemoReportsDayCount('custom', '2026-01-01', '2026-04-15')).toBe(90);
  });
});

describe('getDemoReportsResponse', () => {
  it('scales revenue and series length with range', () => {
    const oneDay = getDemoReportsResponseForTest('1d', { now: FIXED_NOW });
    const week = getDemoReportsResponseForTest('7d', { now: FIXED_NOW });
    const month = getDemoReportsResponseForTest('30d', { now: FIXED_NOW });
    const year = getDemoReportsResponseForTest('1y', { now: FIXED_NOW });

    expect(oneDay.revenueSeries).toHaveLength(1);
    expect(week.revenueSeries).toHaveLength(7);
    expect(month.revenueSeries).toHaveLength(30);
    expect(year.revenueSeries).toHaveLength(90);

    expect(week.revenue).toBeGreaterThan(oneDay.revenue);
    expect(month.revenue).toBeGreaterThan(week.revenue);
    expect(year.revenue).toBeGreaterThan(month.revenue);

    expect(week.bookingsCount).toBeGreaterThan(oneDay.bookingsCount);
    expect(month.bookingsCount).toBeGreaterThan(week.bookingsCount);
  });

  it('emits only favorable marketing trends', () => {
    for (const range of ['1d', '7d', '30d', '90d', '1y'] as const) {
      const payload = getDemoReportsResponseForTest(range, { now: FIXED_NOW });
      const { trends } = payload;

      expect(trends.revenuePct).toBeGreaterThan(0);
      expect(trends.bookingsPct).toBeGreaterThan(0);
      expect(trends.revenueDelta).toBeGreaterThan(0);
      expect(trends.avgBookingValueDelta).toBeGreaterThan(0);
      expect(trends.utilizationPp).toBeGreaterThan(0);
      expect(trends.cancelledRatePp).toBeLessThan(0);
      expect(trends.noShowExpiredRatePp).toBeLessThan(0);
      expect(trends.noShowExpiredCountDelta).toBeLessThan(0);
    }
  });

  it('uses cancel rates as percentages not fractions', () => {
    const payload = getDemoReportsResponseForTest('7d', { now: FIXED_NOW });
    expect(payload.cancelledRate).toBeGreaterThan(1);
    expect(payload.cancelledRate).toBeLessThan(30);
    expect(payload.previousMetrics.cancelledRate).toBeGreaterThan(1);
  });

  it('includes enough reportBookings to drive chart series', () => {
    const payload = getDemoReportsResponseForTest('7d', { now: FIXED_NOW });
    expect(payload.reportBookings.length).toBeGreaterThan(20);
    const barberIds = new Set(payload.reportBookings.map((row) => row.barberId));
    expect(barberIds.size).toBeGreaterThanOrEqual(3);
  });

  it('is deterministic for the same calendar day', () => {
    const a = getDemoReportsResponseForTest('7d', { now: FIXED_NOW });
    const b = getDemoReportsResponseForTest('7d', { now: FIXED_NOW });
    expect(a.revenue).toBe(b.revenue);
    expect(a.bookingsCount).toBe(b.bookingsCount);
    expect(a.revenueSeries).toEqual(b.revenueSeries);
  });

  it('caches live responses by range and London day', () => {
    const a = getDemoReportsResponse('30d');
    const b = getDemoReportsResponse('30d');
    expect(a).toBe(b);
  });
});
