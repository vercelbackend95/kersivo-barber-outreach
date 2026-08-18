import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { BookingsReportsPayload, ReportBookingRow } from '@/components/admin/BookingsReportsAnalyticsStudio';
import {
  customRangeDayCount,
  getStartOfMonthInLondon,
  type ReportsRangeKey,
} from '@/lib/admin/reportsRange';
import { buildWorkdayHourLabels, getHourBucketLabel, toCumulativeSeries } from '@/lib/admin/reportsHourlySeries';
import { DEMO_BARBERS } from '@/lib/demo/barbers';
import type { BlacklineBooking } from './schedule';
import { getBlacklineBookingsForDayKey } from './schedule';
import { BLACKLINE_TZ, blacklineDayKey, coarseLondonNow, dayKeyDaysAgo } from './time';

export type BlacklineReportsPayload = BookingsReportsPayload & {
  bookedServiceValueGbp: number;
  completedServiceValueGbp: number;
  depositsCollectedGbp: number;
};

function startAtOnDayKey(dayKey: string, hour: number, minute = 0): string {
  return fromZonedTime(
    `${dayKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000`,
    BLACKLINE_TZ,
  ).toISOString();
}

export function resolveBlacklineReportsDayCount(
  range: ReportsRangeKey,
  customFrom?: string,
  customTo?: string,
  now = new Date(),
): number {
  if (range === 'custom' && customFrom && customTo) {
    return Math.max(1, Math.min(90, customRangeDayCount(customFrom, customTo)));
  }
  if (range === '1d') return 1;
  if (range === '1y') return 90;
  if (range === '90d') return 90;
  if (range === '30d') return 30;
  if (range === 'month') {
    const monthStart = getStartOfMonthInLondon(now, BLACKLINE_TZ);
    const todayKey = blacklineDayKey(now);
    const monthStartKey = formatInTimeZone(monthStart, BLACKLINE_TZ, 'yyyy-MM-dd');
    return Math.max(1, customRangeDayCount(monthStartKey, todayKey));
  }
  return 7;
}

function penceToGbp(pence: number): number {
  return Math.round(pence) / 100;
}

function isCancelled(status: string): boolean {
  return status === 'CANCELLED_BY_CLIENT' || status === 'CANCELLED_BY_SHOP';
}

function collectRangeBookings(dayCount: number, now: Date): BlacklineBooking[] {
  const todayKey = blacklineDayKey(now);
  const rows: BlacklineBooking[] = [];
  for (let ago = dayCount - 1; ago >= 0; ago -= 1) {
    const dayKey = dayKeyDaysAgo(ago, now);
    const forHistory = dayKey < todayKey;
    rows.push(...getBlacklineBookingsForDayKey(dayKey, { now, forHistory }));
  }
  return rows;
}

function toReportRow(row: BlacklineBooking): ReportBookingRow {
  return {
    id: row.id,
    startAt: row.startAt,
    barberId: row.barberId,
    barberName: row.barber.name,
    serviceName: row.serviceNameAtBooking,
    status: row.status,
    clientName: row.fullName,
    clientEmail: row.email,
    computedValueGbp: penceToGbp(row.totalPricePence),
  };
}

function buildPayload(range: ReportsRangeKey, dayCount: number, customFrom?: string, customTo?: string, now = new Date()): BlacklineReportsPayload {
  const clock = coarseLondonNow(now);
  const hourlyCumulative = range === '1d';
  const currentBookings = collectRangeBookings(dayCount, clock);
  const previousBookings = collectRangeBookings(dayCount, new Date(clock.getTime() - dayCount * 24 * 60 * 60 * 1000));

  const current = computeMetrics(currentBookings, dayCount, clock, hourlyCumulative);
  const previous = computeMetrics(previousBookings, dayCount, clock, false);

  const labels = current.revenueSeries.map((point) => point.label);
  const fromDay = hourlyCumulative ? blacklineDayKey(clock) : (labels[0] ?? dayKeyDaysAgo(dayCount - 1, clock));
  const from = range === 'custom' && customFrom ? startAtOnDayKey(customFrom, 0) : startAtOnDayKey(fromDay, 0);
  const to = range === 'custom' && customTo ? startAtOnDayKey(customTo, 23) : clock.toISOString();

  return {
    range,
    rangeBoundaries: { from, to, tz: BLACKLINE_TZ },
    previousRangeBoundaries: {
      from: startAtOnDayKey(dayKeyDaysAgo(dayCount * 2 - 1, clock), 0),
      to: startAtOnDayKey(dayKeyDaysAgo(dayCount, clock), 23),
      tz: BLACKLINE_TZ,
    },
    bookingsCount: current.bookingsCount,
    cancelledRate: current.cancelledRate,
    noShowExpiredRate: current.noShowExpiredRate,
    revenue: current.completedServiceValueGbp,
    avgBookingValue: current.avgBookingValue,
    revenueCount: current.completedCount,
    usedDemoPricing: true,
    breakdown: current.breakdown,
    peakDay: current.peakDay,
    peakHour: current.peakHour,
    bookedMinutes: current.bookedMinutes,
    availableMinutes: current.availableMinutes,
    utilizationPct: current.utilizationPct,
    revenueSeries: current.revenueSeries,
    trends: {
      bookingsPct: previous.bookingsCount > 0
        ? Math.round(((current.bookingsCount - previous.bookingsCount) / previous.bookingsCount) * 1000) / 10
        : null,
      cancelledRatePp: Math.round((current.cancelledRate - previous.cancelledRate) * 10) / 10,
      revenuePct: previous.completedServiceValueGbp > 0
        ? Math.round(((current.completedServiceValueGbp - previous.completedServiceValueGbp) / previous.completedServiceValueGbp) * 1000) / 10
        : null,
      revenueDelta: Math.round((current.completedServiceValueGbp - previous.completedServiceValueGbp) * 100) / 100,
      avgBookingValueDelta: Math.round((current.avgBookingValue - previous.avgBookingValue) * 10) / 10,
      noShowExpiredCountDelta: current.breakdown.noShowExpired - previous.breakdown.noShowExpired,
      noShowExpiredRatePp: Math.round((current.noShowExpiredRate - previous.noShowExpiredRate) * 10) / 10,
      utilizationPp: current.utilizationPct != null && previous.utilizationPct != null
        ? Math.round((current.utilizationPct - previous.utilizationPct) * 10) / 10
        : null,
    },
    recentBarbers: DEMO_BARBERS.map((barber) => ({
      id: barber.id,
      name: barber.name,
      avatarUrl: barber.image.src,
    })),
    selectedBarber: null,
    previousMetrics: {
      bookingsCount: previous.bookingsCount,
      cancelledRate: previous.cancelledRate,
      revenue: previous.completedServiceValueGbp,
      avgBookingValue: previous.avgBookingValue,
      utilizationPct: previous.utilizationPct,
      noShowExpiredCount: previous.breakdown.noShowExpired,
      noShowExpiredRate: previous.noShowExpiredRate,
    },
    mostPopularService: current.mostPopularService,
    busiestBarber: current.busiestBarber,
    reportBookings: currentBookings.map(toReportRow),
    bookedServiceValueGbp: current.bookedServiceValueGbp,
    completedServiceValueGbp: current.completedServiceValueGbp,
    depositsCollectedGbp: current.depositsCollectedGbp,
  };
}

function computeMetrics(
  bookings: BlacklineBooking[],
  dayCount: number,
  now: Date,
  hourlyCumulative: boolean,
) {
  const bookingsCount = bookings.length;
  const cancelled = bookings.filter((row) => isCancelled(row.status));
  const noShow = bookings.filter((row) => row.status === 'NO_SHOW');
  const completed = bookings.filter((row) => row.status === 'COMPLETED');
  const active = bookings.filter((row) => row.status === 'BOOKED');
  const cancelledRate = bookingsCount > 0 ? (cancelled.length / bookingsCount) * 100 : 0;
  const noShowExpiredRate = bookingsCount > 0 ? (noShow.length / bookingsCount) * 100 : 0;

  const bookedRows = bookings.filter((row) => !isCancelled(row.status) && row.status !== 'NO_SHOW');
  const bookedServiceValueGbp = penceToGbp(bookedRows.reduce((sum, row) => sum + row.totalPricePence, 0));
  const completedServiceValueGbp = penceToGbp(completed.reduce((sum, row) => sum + row.totalPricePence, 0));
  const depositsCollectedGbp = penceToGbp(
    bookings.reduce((sum, row) => sum + (row.paymentStatus === 'PAID' ? row.depositAmountPence ?? 0 : 0), 0),
  );
  const avgBookingValue = completed.length > 0 ? completedServiceValueGbp / completed.length : 0;

  const bookedMinutes = bookedRows.reduce((sum, row) => {
    const duration = (new Date(row.endAt).getTime() - new Date(row.startAt).getTime()) / 60000;
    return sum + Math.max(0, duration);
  }, 0);
  const chairs = DEMO_BARBERS.length;
  const availableMinutes = dayCount * chairs * 10 * 60;
  const utilizationPct = availableMinutes > 0 ? Math.round((bookedMinutes / availableMinutes) * 1000) / 10 : null;

  const barberCounts = new Map<string, { name: string; count: number }>();
  const serviceCounts = new Map<string, number>();
  for (const row of bookedRows) {
    const barber = barberCounts.get(row.barberId) ?? { name: row.barber.name, count: 0 };
    barber.count += 1;
    barberCounts.set(row.barberId, barber);
    serviceCounts.set(row.serviceNameAtBooking, (serviceCounts.get(row.serviceNameAtBooking) ?? 0) + 1);
  }
  const barberLeader = [...barberCounts.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  const topService = [...serviceCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  let revenueSeries: Array<{ label: string; value: number }>;
  if (hourlyCumulative) {
    const labels = buildWorkdayHourLabels(now, BLACKLINE_TZ);
    const hourly = new Map<string, number>();
    for (const row of completed) {
      const label = getHourBucketLabel(new Date(row.startAt), BLACKLINE_TZ);
      hourly.set(label, (hourly.get(label) ?? 0) + penceToGbp(row.totalPricePence));
    }
    revenueSeries = toCumulativeSeries(labels, hourly);
  } else {
    const byDay = new Map<string, number>();
    for (const row of completed) {
      const label = formatInTimeZone(new Date(row.startAt), BLACKLINE_TZ, 'yyyy-MM-dd');
      byDay.set(label, (byDay.get(label) ?? 0) + penceToGbp(row.totalPricePence));
    }
    revenueSeries = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, value]) => ({ label, value }));
  }

  const hourCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();
  for (const row of bookedRows) {
    const hour = formatInTimeZone(new Date(row.startAt), BLACKLINE_TZ, 'HH:00');
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    const day = formatInTimeZone(new Date(row.startAt), BLACKLINE_TZ, 'EEE');
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }

  return {
    bookingsCount,
    cancelledRate: Math.round(cancelledRate * 10) / 10,
    noShowExpiredRate: Math.round(noShowExpiredRate * 10) / 10,
    bookedServiceValueGbp,
    completedServiceValueGbp,
    depositsCollectedGbp,
    avgBookingValue: Math.round(avgBookingValue * 100) / 100,
    completedCount: completed.length,
    breakdown: {
      completed: completed.length + active.length,
      cancelledByClient: cancelled.filter((row) => row.status === 'CANCELLED_BY_CLIENT').length,
      cancelledByShop: cancelled.filter((row) => row.status === 'CANCELLED_BY_SHOP').length,
      noShowExpired: noShow.length,
    },
    bookedMinutes,
    availableMinutes,
    utilizationPct,
    revenueSeries,
    peakDay: [...dayCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    peakHour: [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    mostPopularService: topService ? { name: topService[0], count: topService[1] } : null,
    busiestBarber: barberLeader ? { name: barberLeader[1].name, count: barberLeader[1].count } : null,
  };
}

export function getBlacklineReportsResponse(
  range: ReportsRangeKey,
  customFrom?: string,
  customTo?: string,
  now = new Date(),
): BlacklineReportsPayload {
  const clock = coarseLondonNow(now);
  const dayCount = resolveBlacklineReportsDayCount(range, customFrom, customTo, clock);
  return buildPayload(range, dayCount, customFrom, customTo, clock);
}

export function getBlacklineRangeBookings(dayCount: number, now = new Date()): BlacklineBooking[] {
  return collectRangeBookings(dayCount, coarseLondonNow(now));
}
