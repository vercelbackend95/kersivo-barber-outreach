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
  it('converts overall revenue to pence', () => {
    const series = buildOverallSeries(sampleReports, 'revenue');
    expect(series[0].value).toBe(10000);
    expect(series[1].value).toBe(5000);
  });
});

describe('toChartValue', () => {
  it('converts GBP to pence for revenue', () => {
    expect(toChartValue(24.08, 'revenue')).toBe(2408);
  });
});
