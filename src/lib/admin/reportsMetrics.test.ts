import { describe, expect, it } from 'vitest';
import { fromZonedTime } from 'date-fns-tz';

import {
  ADMIN_REPORTS_TIMEZONE,
  aggregateReportMetrics,
  classifyBookingStatus,
  computeAvailableMinutes,
  getRangeDayKeys,
  mergeIntervals,
  toLegacyBreakdown,
  type AggregatableBooking,
} from './reportsMetrics';

function booking(partial: Partial<AggregatableBooking> & Pick<AggregatableBooking, 'id' | 'startAt' | 'endAt'>): AggregatableBooking {
  return {
    status: 'BOOKED',
    barberId: 'b1',
    barberName: 'Marco',
    serviceId: 's1',
    serviceName: 'Haircut',
    clientName: 'Client',
    clientEmail: 'c@example.com',
    paymentStatus: null,
    valuePence: 2500,
    durationMinutes: 30,
    ...partial,
  };
}

describe('classifyBookingStatus', () => {
  const start = new Date('2026-07-16T09:00:00.000Z');
  const end = new Date('2026-07-16T09:30:00.000Z');

  it('maps terminal statuses directly', () => {
    expect(classifyBookingStatus('NO_SHOW', start, end)).toBe('noShow');
    expect(classifyBookingStatus('EXPIRED', start, end)).toBe('expired');
    expect(classifyBookingStatus('CANCELLED_BY_CLIENT', start, end)).toBe('cancelledByClient');
    expect(classifyBookingStatus('CANCELLED_BY_ADMIN', start, end)).toBe('cancelledByShop');
  });

  it('treats past BOOKED as completed', () => {
    expect(classifyBookingStatus('BOOKED', start, end, end.getTime() + 1)).toBe('completed');
  });

  it('treats future BOOKED as active', () => {
    expect(classifyBookingStatus('BOOKED', start, end, start.getTime() - 1)).toBe('active');
  });
});

describe('toLegacyBreakdown', () => {
  it('folds active into completed and no-show+expired together', () => {
    expect(toLegacyBreakdown({
      completed: 2,
      active: 3,
      cancelledByClient: 1,
      cancelledByShop: 1,
      expired: 1,
      noShow: 2,
    })).toEqual({
      completed: 5,
      cancelledByClient: 1,
      cancelledByShop: 1,
      noShowExpired: 3,
    });
  });
});

describe('aggregateReportMetrics', () => {
  const range = {
    from: fromZonedTime('2026-07-14T00:00:00.000', ADMIN_REPORTS_TIMEZONE),
    to: fromZonedTime('2026-07-16T23:59:59.999', ADMIN_REPORTS_TIMEZONE),
  };
  const nowMs = fromZonedTime('2026-07-17T12:00:00.000', ADMIN_REPORTS_TIMEZONE).getTime();

  it('counts only booking revenue and avg from paid-qualified rows', () => {
    const metrics = aggregateReportMetrics({
      bookings: [
        booking({
          id: '1',
          startAt: fromZonedTime('2026-07-15T10:00:00.000', ADMIN_REPORTS_TIMEZONE),
          endAt: fromZonedTime('2026-07-15T10:30:00.000', ADMIN_REPORTS_TIMEZONE),
          valuePence: 2500,
          paymentStatus: 'PAID',
        }),
        booking({
          id: '2',
          startAt: fromZonedTime('2026-07-16T10:00:00.000', ADMIN_REPORTS_TIMEZONE),
          endAt: fromZonedTime('2026-07-16T10:30:00.000', ADMIN_REPORTS_TIMEZONE),
          valuePence: 3000,
          status: 'CANCELLED_BY_CLIENT',
        }),
        booking({
          id: '3',
          startAt: fromZonedTime('2026-07-16T11:00:00.000', ADMIN_REPORTS_TIMEZONE),
          endAt: fromZonedTime('2026-07-16T11:30:00.000', ADMIN_REPORTS_TIMEZONE),
          valuePence: 2000,
          // past booked => completed => revenue
        }),
      ],
      range,
      rangeKey: '7d',
      nowMs,
      activeBarberIds: ['b1'],
      availability: [],
      timeBlocks: [],
      timeOff: [],
    });

    expect(metrics.bookingsCount).toBe(3);
    expect(metrics.revenue).toBe(45);
    expect(metrics.revenueCount).toBe(2);
    expect(metrics.avgBookingValue).toBe(22.5);
    expect(metrics.cancelledRate).toBeCloseTo((1 / 3) * 100, 5);
    expect(metrics.breakdown.completed + metrics.breakdown.cancelledByClient
      + metrics.breakdown.cancelledByShop + metrics.breakdown.noShowExpired).toBe(3);
  });

  it('includes NO_SHOW in no-show metrics and excludes it from cancel rate', () => {
    const metrics = aggregateReportMetrics({
      bookings: [
        booking({
          id: '1',
          status: 'NO_SHOW',
          startAt: fromZonedTime('2026-07-15T10:00:00.000', ADMIN_REPORTS_TIMEZONE),
          endAt: fromZonedTime('2026-07-15T10:30:00.000', ADMIN_REPORTS_TIMEZONE),
        }),
        booking({
          id: '2',
          status: 'EXPIRED',
          startAt: fromZonedTime('2026-07-15T11:00:00.000', ADMIN_REPORTS_TIMEZONE),
          endAt: fromZonedTime('2026-07-15T11:30:00.000', ADMIN_REPORTS_TIMEZONE),
        }),
        booking({
          id: '3',
          status: 'CANCELLED_BY_SHOP',
          startAt: fromZonedTime('2026-07-15T12:00:00.000', ADMIN_REPORTS_TIMEZONE),
          endAt: fromZonedTime('2026-07-15T12:30:00.000', ADMIN_REPORTS_TIMEZONE),
        }),
      ],
      range,
      rangeKey: '7d',
      nowMs,
      activeBarberIds: ['b1'],
      availability: [],
      timeBlocks: [],
      timeOff: [],
    });

    expect(metrics.breakdown.noShowExpired).toBe(2);
    expect(metrics.breakdownDetailed.noShow).toBe(1);
    expect(metrics.breakdownDetailed.expired).toBe(1);
    expect(metrics.cancelledRate).toBeCloseTo((1 / 3) * 100, 5);
    expect(metrics.revenue).toBe(0);
  });

  it('ranks busiest barber from kept bookings only', () => {
    const metrics = aggregateReportMetrics({
      bookings: [
        booking({
          id: '1',
          barberId: 'b1',
          barberName: 'Marco',
          startAt: fromZonedTime('2026-07-15T10:00:00.000', ADMIN_REPORTS_TIMEZONE),
          endAt: fromZonedTime('2026-07-15T10:30:00.000', ADMIN_REPORTS_TIMEZONE),
          paymentStatus: 'PAID',
        }),
        booking({
          id: '2',
          barberId: 'b2',
          barberName: 'Igor',
          status: 'CANCELLED_BY_CLIENT',
          startAt: fromZonedTime('2026-07-15T11:00:00.000', ADMIN_REPORTS_TIMEZONE),
          endAt: fromZonedTime('2026-07-15T11:30:00.000', ADMIN_REPORTS_TIMEZONE),
        }),
        booking({
          id: '3',
          barberId: 'b2',
          barberName: 'Igor',
          status: 'CANCELLED_BY_CLIENT',
          startAt: fromZonedTime('2026-07-15T12:00:00.000', ADMIN_REPORTS_TIMEZONE),
          endAt: fromZonedTime('2026-07-15T12:30:00.000', ADMIN_REPORTS_TIMEZONE),
        }),
      ],
      range,
      rangeKey: '7d',
      nowMs,
      activeBarberIds: ['b1', 'b2'],
      availability: [],
      timeBlocks: [],
      timeOff: [],
    });

    expect(metrics.busiestBarber).toEqual({ name: 'Marco', count: 1 });
  });
});

describe('getRangeDayKeys', () => {
  it('iterates London calendar days without duplicates', () => {
    const keys = getRangeDayKeys({
      from: fromZonedTime('2026-07-14T00:00:00.000', ADMIN_REPORTS_TIMEZONE),
      to: fromZonedTime('2026-07-16T23:59:59.999', ADMIN_REPORTS_TIMEZONE),
    });
    expect(keys).toEqual(['2026-07-14', '2026-07-15', '2026-07-16']);
  });
});

describe('computeAvailableMinutes', () => {
  it('uses Monday=1 weekday mapping and subtracts overlapping blocks once', () => {
    // 2026-07-15 is Wednesday => dayOfWeek 3
    const dayKey = '2026-07-15';
    const range = {
      from: fromZonedTime(`${dayKey}T00:00:00.000`, ADMIN_REPORTS_TIMEZONE),
      to: fromZonedTime(`${dayKey}T23:59:59.999`, ADMIN_REPORTS_TIMEZONE),
    };
    const minutes = computeAvailableMinutes({
      range,
      activeBarberIds: ['b1'],
      availability: [{
        barberId: 'b1',
        dayOfWeek: 3,
        startMinutes: 9 * 60,
        endMinutes: 11 * 60,
        breakStartMin: null,
        breakEndMin: null,
      }],
      timeBlocks: [{
        barberId: 'b1',
        startAt: fromZonedTime(`${dayKey}T09:30:00.000`, ADMIN_REPORTS_TIMEZONE),
        endAt: fromZonedTime(`${dayKey}T10:00:00.000`, ADMIN_REPORTS_TIMEZONE),
      }],
      timeOff: [{
        barberId: 'b1',
        startAt: fromZonedTime(`${dayKey}T09:45:00.000`, ADMIN_REPORTS_TIMEZONE),
        endAt: fromZonedTime(`${dayKey}T10:15:00.000`, ADMIN_REPORTS_TIMEZONE),
      }],
    });

    // 09:00-11:00 = 120m, blocked merged 09:30-10:15 = 45m => 75m
    expect(minutes).toBe(75);
  });
});

describe('mergeIntervals', () => {
  it('merges overlapping intervals', () => {
    const a = fromZonedTime('2026-07-15T09:00:00.000', ADMIN_REPORTS_TIMEZONE);
    const b = fromZonedTime('2026-07-15T10:00:00.000', ADMIN_REPORTS_TIMEZONE);
    const c = fromZonedTime('2026-07-15T09:30:00.000', ADMIN_REPORTS_TIMEZONE);
    const d = fromZonedTime('2026-07-15T10:30:00.000', ADMIN_REPORTS_TIMEZONE);
    expect(mergeIntervals([{ start: a, end: b }, { start: c, end: d }])).toEqual([
      { start: a, end: d },
    ]);
  });
});
