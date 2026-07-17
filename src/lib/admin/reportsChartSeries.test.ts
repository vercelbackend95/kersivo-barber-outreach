import { describe, expect, it } from 'vitest';
import {
  buildBarberSeries,
  buildOverallSeries,
  getBarberTotals,
  getWinnerBarberId,
  toChartValue,
  type ReportsChartInput,
} from './reportsChartSeries';

const sampleReports: ReportsChartInput = {
  revenueSeries: [
    { label: '2026-07-03', value: 100 },
    { label: '2026-07-04', value: 50 },
    { label: '2026-07-05', value: 30 },
  ],
  reportBookings: [
    {
      startAt: '2026-07-03T10:00:00.000Z',
      barberId: 'b1',
      barberName: 'Alex',
      status: 'COMPLETED',
      computedValueGbp: 40,
    },
    {
      startAt: '2026-07-03T12:00:00.000Z',
      barberId: 'b2',
      barberName: 'Sam',
      status: 'COMPLETED',
      computedValueGbp: 60,
    },
    {
      startAt: '2026-07-04T10:00:00.000Z',
      barberId: 'b1',
      barberName: 'Alex',
      status: 'CANCELLED_BY_CLIENT',
      computedValueGbp: null,
    },
    {
      startAt: '2026-07-04T11:00:00.000Z',
      barberId: 'b2',
      barberName: 'Sam',
      status: 'COMPLETED',
      computedValueGbp: 50,
    },
    {
      startAt: '2026-07-05T09:00:00.000Z',
      barberId: 'b1',
      barberName: 'Alex',
      status: 'COMPLETED',
      computedValueGbp: 20,
    },
  ],
};

describe('getBarberTotals', () => {
  it('ranks barbers by revenue', () => {
    const totals = getBarberTotals(sampleReports, 'revenue');
    expect(totals.find((row) => row.barberId === 'b2')?.total).toBe(110);
    expect(totals.find((row) => row.barberId === 'b1')?.total).toBe(60);
  });

  it('ranks barbers by bookings count', () => {
    const totals = getBarberTotals(sampleReports, 'bookings');
    expect(totals.find((row) => row.barberId === 'b1')?.total).toBe(3);
    expect(totals.find((row) => row.barberId === 'b2')?.total).toBe(2);
  });

  it('computes cancel rate per barber', () => {
    const totals = getBarberTotals(sampleReports, 'cancelRate');
    expect(totals.find((row) => row.barberId === 'b1')?.total).toBeCloseTo(33.33, 1);
    expect(totals.find((row) => row.barberId === 'b2')?.total).toBe(0);
  });
});

describe('getWinnerBarberId', () => {
  it('picks highest revenue barber', () => {
    expect(getWinnerBarberId(sampleReports, 'revenue')).toBe('b2');
  });

  it('picks highest bookings barber', () => {
    expect(getWinnerBarberId(sampleReports, 'bookings')).toBe('b1');
  });

  it('picks lowest cancel rate barber', () => {
    expect(getWinnerBarberId(sampleReports, 'cancelRate')).toBe('b2');
  });
});

describe('buildBarberSeries', () => {
  it('buckets revenue per day in pence', () => {
    const series = buildBarberSeries(sampleReports, 'b1', 'revenue');
    expect(series).toEqual([
      { label: '2026-07-03', value: 4000 },
      { label: '2026-07-04', value: 0 },
      { label: '2026-07-05', value: 2000 },
    ]);
  });

  it('buckets bookings per day', () => {
    const series = buildBarberSeries(sampleReports, 'b2', 'bookings');
    expect(series).toEqual([
      { label: '2026-07-03', value: 1 },
      { label: '2026-07-04', value: 1 },
      { label: '2026-07-05', value: 0 },
    ]);
  });
});

describe('buildOverallSeries', () => {
  it('buckets overall revenue from bookings in pence', () => {
    const series = buildOverallSeries(sampleReports, 'revenue');
    expect(series).toEqual([
      { label: '2026-07-03', value: 10000 },
      { label: '2026-07-04', value: 5000 },
      { label: '2026-07-05', value: 2000 },
    ]);
  });

  it('ignores inflated API revenueSeries so Overall matches barber sum', () => {
    const inflated: ReportsChartInput = {
      ...sampleReports,
      revenueSeries: [
        { label: '2026-07-03', value: 7074 },
        { label: '2026-07-04', value: 100 },
        { label: '2026-07-05', value: 50 },
      ],
    };

    const overall = buildOverallSeries(inflated, 'revenue');
    const barber1 = buildBarberSeries(inflated, 'b1', 'revenue');
    const barber2 = buildBarberSeries(inflated, 'b2', 'revenue');

    expect(overall).toEqual([
      { label: '2026-07-03', value: 10000 },
      { label: '2026-07-04', value: 5000 },
      { label: '2026-07-05', value: 2000 },
    ]);

    for (let i = 0; i < overall.length; i += 1) {
      expect(overall[i].value).toBe(barber1[i].value + barber2[i].value);
    }
  });

  it('excludes EXPIRED from cancel rate so chart matches KPI cancelled rate', () => {
    const reports: ReportsChartInput = {
      revenueSeries: [
        { label: '2026-07-03', value: 0 },
        { label: '2026-07-04', value: 0 },
      ],
      reportBookings: [
        {
          startAt: '2026-07-03T10:00:00.000Z',
          barberId: 'b1',
          barberName: 'Alex',
          status: 'CANCELLED_BY_CLIENT',
          computedValueGbp: null,
        },
        {
          startAt: '2026-07-03T11:00:00.000Z',
          barberId: 'b1',
          barberName: 'Alex',
          status: 'EXPIRED',
          computedValueGbp: null,
        },
        {
          startAt: '2026-07-04T10:00:00.000Z',
          barberId: 'b1',
          barberName: 'Alex',
          status: 'COMPLETED',
          computedValueGbp: 20,
        },
      ],
    };

    // 1 cancel of 3 bookings on day1+day2 combined per-day rates:
    // day1: 1/2 = 50%, day2: 0/1 = 0%
    expect(buildOverallSeries(reports, 'cancelRate')).toEqual([
      { label: '2026-07-03', value: 50 },
      { label: '2026-07-04', value: 0 },
    ]);
  });

  it('builds cumulative bookings for hourly labels', () => {
    const hourlyReports: ReportsChartInput = {
      revenueSeries: [
        { label: '09:00', value: 40 },
        { label: '10:00', value: 90 },
        { label: '11:00', value: 90 },
      ],
      reportBookings: [
        {
          startAt: '2026-07-13T08:00:00.000Z', // 09:00 London BST
          barberId: 'b1',
          barberName: 'Alex',
          status: 'COMPLETED',
          computedValueGbp: 40,
        },
        {
          startAt: '2026-07-13T09:00:00.000Z', // 10:00 London BST
          barberId: 'b1',
          barberName: 'Alex',
          status: 'COMPLETED',
          computedValueGbp: 50,
        },
        {
          startAt: '2026-07-13T09:30:00.000Z',
          barberId: 'b2',
          barberName: 'Sam',
          status: 'CANCELLED_BY_CLIENT',
          computedValueGbp: null,
        },
      ],
    };

    expect(buildOverallSeries(hourlyReports, 'bookings')).toEqual([
      { label: '09:00', value: 1 },
      { label: '10:00', value: 3 },
      { label: '11:00', value: 3 },
    ]);

    expect(buildBarberSeries(hourlyReports, 'b1', 'revenue')).toEqual([
      { label: '09:00', value: 4000 },
      { label: '10:00', value: 9000 },
      { label: '11:00', value: 9000 },
    ]);

    expect(buildOverallSeries(hourlyReports, 'revenue')).toEqual([
      { label: '09:00', value: 4000 },
      { label: '10:00', value: 9000 },
      { label: '11:00', value: 9000 },
    ]);
  });
});

describe('toChartValue', () => {
  it('converts GBP to pence for revenue', () => {
    expect(toChartValue(24.08, 'revenue')).toBe(2408);
  });
});
