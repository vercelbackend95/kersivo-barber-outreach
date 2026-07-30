/**
 * Deterministic demo reports for /admin-demo and the landing REPORTS & REVENUE widget.
 * Anchored to Europe/London "today" — same shape every day for a given calendar day, no Neon.
 * Tuned for a believable 4-barber UK shop.
 */
import { addMilliseconds } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import type { BookingsReportsPayload } from '../../../components/admin/BookingsReportsAnalyticsStudio';
import { LANDING_DEMO_BARBER_AVATARS } from '../../landing/landingDemoAssets';
import {
  customRangeDayCount,
  getStartOfMonthInLondon,
  type ReportsRangeKey,
} from '../reportsRange';
import {
  buildWorkdayHourLabels,
  getHourBucketLabel,
  toCumulativeSeries,
} from '../reportsHourlySeries';
import { DEMO_BARBER_IDS } from './ids';
import { dayKeyDaysAgo, getDemoBookingsForDayKey } from './bookingCalendar';

const TZ = 'Europe/London';

const BARBERS = {
  jamie: { id: DEMO_BARBER_IDS.jamie, name: 'Jamie Reed', avatarUrl: LANDING_DEMO_BARBER_AVATARS.jamie },
  alex: { id: DEMO_BARBER_IDS.alex, name: 'Alex Morgan', avatarUrl: LANDING_DEMO_BARBER_AVATARS.alex },
  sam: { id: DEMO_BARBER_IDS.sam, name: 'Sam Brooks', avatarUrl: LANDING_DEMO_BARBER_AVATARS.sam },
  marcus: { id: DEMO_BARBER_IDS.marcus, name: 'Marcus Bell', avatarUrl: LANDING_DEMO_BARBER_AVATARS.marcus },
} as const;

type BarberKey = keyof typeof BARBERS;

const BARBER_KEYS: BarberKey[] = ['jamie', 'alex', 'sam', 'marcus'];

const CACHE = new Map<string, BookingsReportsPayload>();

function startAtOnDayKey(dayKey: string, hour: number, minute = 0): string {
  return fromZonedTime(
    `${dayKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000`,
    TZ,
  ).toISOString();
}

export function resolveDemoReportsDayCount(
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
    const monthStart = getStartOfMonthInLondon(now, TZ);
    const todayKey = formatInTimeZone(now, TZ, 'yyyy-MM-dd');
    const monthStartKey = formatInTimeZone(monthStart, TZ, 'yyyy-MM-dd');
    return Math.max(1, customRangeDayCount(monthStartKey, todayKey));
  }
  return 7;
}

type GeneratedBooking = BookingsReportsPayload['reportBookings'][number];

function generateBookingsForRange(
  dayCount: number,
  dayOffsetBase: number,
  volumeScale: number,
  options: { cancelBoost?: number; idPrefix?: string; now?: Date; maxHourInclusive?: number } = {},
): GeneratedBooking[] {
  const { now = new Date(), maxHourInclusive } = options;
  const bookings: GeneratedBooking[] = [];

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    const daysAgo = dayCount - 1 - dayIndex + dayOffsetBase;
    const dayKey = dayKeyDaysAgo(daysAgo, now);
    const forHistory = daysAgo > 0;
    let dayRows = getDemoBookingsForDayKey(dayKey, { forHistory });
    if (volumeScale < 1) {
      const keep = Math.max(1, Math.round(dayRows.length * volumeScale));
      dayRows = dayRows.slice(0, keep);
    }
    if (maxHourInclusive != null) {
      dayRows = dayRows.filter(
        (row) => Number(formatInTimeZone(new Date(row.startAt), TZ, 'H')) <= maxHourInclusive,
      );
    }

    for (const row of dayRows) {
      const status =
        row.status === 'CANCELLED_BY_CLIENT'
          ? 'CANCELLED_BY_CLIENT'
          : row.status === 'CANCELLED_BY_SHOP'
            ? 'CANCELLED_BY_SHOP'
            : 'COMPLETED';
      const valueGbp = row.totalPricePence / 100;
      bookings.push({
        id: row.id,
        startAt: row.startAt,
        barberId: row.barberId,
        barberName: row.barber.name,
        serviceName: row.serviceNameAtBooking,
        status,
        clientName: row.fullName,
        clientEmail: row.email,
        computedValueGbp: status === 'COMPLETED' ? valueGbp : null,
      });
    }
  }

  return bookings;
}

function derivePeakHour(completed: GeneratedBooking[]): string {
  const hourCounts = new Map<number, number>();
  for (const row of completed) {
    const hour = Number(formatInTimeZone(new Date(row.startAt), TZ, 'H'));
    if (!Number.isFinite(hour)) continue;
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }
  const peak = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  const hour = peak?.[0] ?? 11;
  return `${String(hour).padStart(2, '0')}:00`;
}

function computeMetrics(
  bookings: GeneratedBooking[],
  dayCount: number,
  now = new Date(),
  options: { hourlyCumulative?: boolean } = {},
) {
  const completed = bookings.filter((row) => row.status === 'COMPLETED');
  const cancelledByClient = bookings.filter((row) => row.status === 'CANCELLED_BY_CLIENT').length;
  const cancelledByShop = bookings.filter((row) => row.status === 'CANCELLED_BY_SHOP').length;
  const noShowExpired = bookings.filter((row) => row.status === 'EXPIRED').length;
  const revenue = completed.reduce((sum, row) => sum + (row.computedValueGbp ?? 0), 0);
  const bookingsCount = bookings.length;
  const cancelledCount = cancelledByClient + cancelledByShop;
  const cancelledRate = bookingsCount > 0 ? (cancelledCount / bookingsCount) * 100 : 0;
  const noShowExpiredRate = bookingsCount > 0 ? (noShowExpired / bookingsCount) * 100 : 0;
  const avgBookingValue = completed.length > 0 ? revenue / completed.length : 0;

  let revenueSeries: Array<{ label: string; value: number }>;

  if (options.hourlyCumulative) {
    const labels = buildWorkdayHourLabels(now, TZ);
    const perHour = new Map(labels.map((label) => [label, 0]));
    for (const row of completed) {
      const label = getHourBucketLabel(row.startAt, TZ);
      if (perHour.has(label)) {
        perHour.set(label, (perHour.get(label) ?? 0) + (row.computedValueGbp ?? 0));
      }
    }
    revenueSeries = toCumulativeSeries(labels, perHour);
  } else {
    const labels = Array.from({ length: dayCount }, (_, index) => dayKeyDaysAgo(dayCount - 1 - index, now));
    const revenueByDay = new Map(labels.map((label) => [label, 0]));

    for (const row of completed) {
      const label = formatInTimeZone(new Date(row.startAt), TZ, 'yyyy-MM-dd');
      if (revenueByDay.has(label)) {
        revenueByDay.set(label, (revenueByDay.get(label) ?? 0) + (row.computedValueGbp ?? 0));
      }
    }

    revenueSeries = labels.map((label) => ({
      label,
      value: revenueByDay.get(label) ?? 0,
    }));
  }

  const byBarber = new Map<string, { name: string; count: number; revenue: number }>();
  for (const row of completed) {
    const entry = byBarber.get(row.barberId) ?? { name: row.barberName, count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += row.computedValueGbp ?? 0;
    byBarber.set(row.barberId, entry);
  }

  const barberLeader = Array.from(byBarber.entries())
    .sort((a, b) => b[1].count - a[1].count)[0];

  const serviceCounts = new Map<string, number>();
  for (const row of completed) {
    serviceCounts.set(row.serviceName, (serviceCounts.get(row.serviceName) ?? 0) + 1);
  }
  const topService = Array.from(serviceCounts.entries()).sort((a, b) => b[1] - a[1])[0];

  const bookedMinutes = completed.length * 35;
  const availableMinutes = dayCount * 4 * 9 * 60;
  const utilizationPct = availableMinutes > 0
    ? Math.round((bookedMinutes / availableMinutes) * 1000) / 10
    : null;

  let peakDay: string | null;
  if (options.hourlyCumulative) {
    peakDay = formatInTimeZone(now, TZ, 'EEE');
  } else {
    const peakDayEntry = revenueSeries.reduce(
      (best, point) => (point.value > best.value ? point : best),
      revenueSeries[0] ?? { label: '', value: 0 },
    );
    peakDay = peakDayEntry?.label
      ? formatInTimeZone(fromZonedTime(`${peakDayEntry.label}T12:00:00.000`, TZ), TZ, 'EEE')
      : null;
  }

  return {
    bookingsCount,
    cancelledRate: Math.round(cancelledRate * 10) / 10,
    noShowExpiredRate: Math.round(noShowExpiredRate * 10) / 10,
    revenue,
    avgBookingValue,
    revenueCount: completed.length,
    breakdown: {
      completed: completed.length,
      cancelledByClient,
      cancelledByShop,
      noShowExpired,
    },
    revenueSeries,
    utilizationPct,
    bookedMinutes,
    availableMinutes,
    peakDay,
    peakHour: derivePeakHour(completed),
    busiestBarber: barberLeader
      ? { name: barberLeader[1].name, count: barberLeader[1].count }
      : null,
    mostPopularService: topService
      ? { name: topService[0], count: topService[1] }
      : null,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Deterministic marketing growth by range — avoids the same +16% on every preset. */
const DEMO_GROWTH_BY_RANGE: Record<ReportsRangeKey, { bookings: number; revenue: number }> = {
  '1d': { bookings: 8.4, revenue: 9.6 },
  '7d': { bookings: 11.2, revenue: 12.8 },
  week: { bookings: 11.2, revenue: 12.8 },
  '30d': { bookings: 14.1, revenue: 15.3 },
  month: { bookings: 13.6, revenue: 14.7 },
  '90d': { bookings: 7.8, revenue: 8.9 },
  '1y': { bookings: 6.4, revenue: 7.2 },
  custom: { bookings: 10.0, revenue: 11.0 },
};

function growthForRange(range: ReportsRangeKey, metric: 'bookings' | 'revenue'): number {
  return DEMO_GROWTH_BY_RANGE[range]?.[metric] ?? 10;
}

/** Force marketing-friendly growth: higher-better up, lower-better improved (negative pp/count). */
function clampFavorableTrends(
  current: ReturnType<typeof computeMetrics>,
  previous: ReturnType<typeof computeMetrics>,
  range: ReportsRangeKey,
): BookingsReportsPayload['trends'] {
  const rawUtilPp = current.utilizationPct != null && previous.utilizationPct != null
    ? current.utilizationPct - previous.utilizationPct
    : 2.4;

  return {
    bookingsPct: growthForRange(range, 'bookings'),
    cancelledRatePp: -round1(Math.max(0.5, Math.abs(current.cancelledRate - previous.cancelledRate) || 1.1)),
    revenuePct: growthForRange(range, 'revenue'),
    revenueDelta: Math.round(Math.max(1, Math.abs(current.revenue - previous.revenue)) * 100) / 100,
    avgBookingValueDelta: round1(Math.max(0.5, Math.abs(current.avgBookingValue - previous.avgBookingValue) || 1.2)),
    noShowExpiredCountDelta: -Math.max(1, Math.abs(current.breakdown.noShowExpired - previous.breakdown.noShowExpired) || 1),
    noShowExpiredRatePp: -round1(Math.max(0.3, Math.abs(current.noShowExpiredRate - previous.noShowExpiredRate) || 0.4)),
    utilizationPp: round1(Math.min(6, Math.max(1.2, Math.abs(rawUtilPp) || 2.1))),
  };
}

function buildPayload(
  range: ReportsRangeKey,
  dayCount: number,
  customFrom?: string,
  customTo?: string,
  now = new Date(),
): BookingsReportsPayload {
  const hourlyCumulative = range === '1d';
  const currentHour = Number(formatInTimeZone(now, TZ, 'H'));
  const maxHourInclusive = hourlyCumulative
    ? Math.min(19, Math.max(9, Number.isFinite(currentHour) ? currentHour : 9))
    : undefined;

  const currentBookings = generateBookingsForRange(dayCount, 0, 1, { now, maxHourInclusive });
  const previousBookings = generateBookingsForRange(dayCount, dayCount, 0.88, {
    cancelBoost: 3,
    now,
  });

  const current = computeMetrics(currentBookings, dayCount, now, { hourlyCumulative });
  const previous = computeMetrics(previousBookings, dayCount, now);

  const labels = current.revenueSeries.map((point) => point.label);
  const fromDay = hourlyCumulative
    ? dayKeyDaysAgo(0, now)
    : (labels[0] ?? dayKeyDaysAgo(dayCount - 1, now));

  const from = range === 'custom' && customFrom
    ? startAtOnDayKey(customFrom, 0)
    : startAtOnDayKey(fromDay, 0);
  const to = range === 'custom' && customTo
    ? startAtOnDayKey(customTo, 23)
    : now.toISOString();

  const previousFromDay = dayKeyDaysAgo(dayCount * 2 - 1, now);
  const previousToDay = dayKeyDaysAgo(dayCount, now);

  return {
    range,
    rangeBoundaries: { from, to, tz: TZ },
    previousRangeBoundaries: {
      from: startAtOnDayKey(previousFromDay, 0),
      to: startAtOnDayKey(previousToDay, 23),
      tz: TZ,
    },
    bookingsCount: current.bookingsCount,
    cancelledRate: current.cancelledRate,
    noShowExpiredRate: current.noShowExpiredRate,
    revenue: current.revenue,
    avgBookingValue: current.avgBookingValue,
    revenueCount: current.revenueCount,
    usedDemoPricing: true,
    breakdown: current.breakdown,
    peakDay: current.peakDay,
    peakHour: current.peakHour,
    bookedMinutes: current.bookedMinutes,
    availableMinutes: current.availableMinutes,
    utilizationPct: current.utilizationPct,
    revenueSeries: current.revenueSeries,
    trends: clampFavorableTrends(current, previous, range),
    recentBarbers: BARBER_KEYS.map((key) => ({
      id: BARBERS[key].id,
      name: BARBERS[key].name,
      avatarUrl: BARBERS[key].avatarUrl,
    })),
    selectedBarber: null,
    previousMetrics: {
      bookingsCount: previous.bookingsCount,
      cancelledRate: previous.cancelledRate,
      revenue: previous.revenue,
      avgBookingValue: previous.avgBookingValue,
      utilizationPct: previous.utilizationPct,
      noShowExpiredCount: previous.breakdown.noShowExpired,
      noShowExpiredRate: previous.noShowExpiredRate,
    },
    mostPopularService: current.mostPopularService,
    busiestBarber: current.busiestBarber,
    reportBookings: currentBookings,
  };
}

export function getDemoReportsResponse(
  range: ReportsRangeKey,
  customFrom?: string,
  customTo?: string,
): BookingsReportsPayload {
  const cacheKey = range === 'custom'
    ? `custom:${customFrom ?? ''}:${customTo ?? ''}:${formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd')}`
    : `${range}:${formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd')}`;
  const cached = CACHE.get(cacheKey);
  if (cached) return cached;

  const dayCount = resolveDemoReportsDayCount(range, customFrom, customTo);
  const payload = buildPayload(range, dayCount, customFrom, customTo);
  CACHE.set(cacheKey, payload);
  return payload;
}

/** Test helper: bypass module cache and pin "now". */
export function getDemoReportsResponseForTest(
  range: ReportsRangeKey,
  options: { customFrom?: string; customTo?: string; now: Date },
): BookingsReportsPayload {
  const dayCount = resolveDemoReportsDayCount(range, options.customFrom, options.customTo, options.now);
  return buildPayload(range, dayCount, options.customFrom, options.customTo, options.now);
}
