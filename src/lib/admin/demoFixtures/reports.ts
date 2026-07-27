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

const TZ = 'Europe/London';

const BARBERS = {
  jamie: { id: DEMO_BARBER_IDS.jamie, name: 'Jamie Reed', avatarUrl: LANDING_DEMO_BARBER_AVATARS.jamie },
  alex: { id: DEMO_BARBER_IDS.alex, name: 'Alex Morgan', avatarUrl: LANDING_DEMO_BARBER_AVATARS.alex },
  sam: { id: DEMO_BARBER_IDS.sam, name: 'Sam Brooks', avatarUrl: LANDING_DEMO_BARBER_AVATARS.sam },
  marcus: { id: DEMO_BARBER_IDS.marcus, name: 'Marcus Bell', avatarUrl: LANDING_DEMO_BARBER_AVATARS.marcus },
} as const;

type BarberKey = keyof typeof BARBERS;

type ServiceTemplate = {
  name: string;
  valueGbp: number;
};

const SERVICES: ServiceTemplate[] = [
  { name: 'Skin fade with haircut', valueGbp: 40 },
  { name: 'Quality haircut', valueGbp: 35 },
  { name: 'Premium haircut', valueGbp: 45 },
  { name: 'Quality beard trim', valueGbp: 15 },
  { name: 'Premium beard trim', valueGbp: 30 },
  { name: 'Luxury wet shave', valueGbp: 40 },
  { name: 'Longer haircut', valueGbp: 65 },
  { name: 'Express shave', valueGbp: 25 },
];

/** Service pick weights — haircuts dominate, premium / beard less often. */
const SERVICE_WEIGHTS = [22, 20, 14, 10, 8, 6, 5, 15];

const CLIENT_NAMES = [
  'Oliver Reed', 'Amelia Clarke', 'Noah Bennett', 'Harry Watson', 'Daniel Price',
  'Ethan Walsh', 'Leo Carter', 'Freya Hughes', 'Jack Turner', 'Maya Brooks',
  'Theo Hughes', 'Grace Turner', 'Charlie Evans', 'Sophie Lane', 'James Foster',
  'Ruby Shaw', 'Louis Grant', 'Nathan Cole', 'Dylan Reid', 'Aaron Webb',
  'Connor Walsh', 'Mason Field', 'Rory Ellis', 'Isla Morgan', 'Ella Price',
];

/** Mon–Sun base bookings for a busy 4-chair shop. */
const WEEKDAY_BASE_COUNTS = [0, 10, 11, 11, 12, 16, 17, 6];

/** Prefer late morning + late afternoon. */
const HOUR_POOL = [10, 11, 12, 11, 16, 17, 12, 18, 10, 13, 16, 17, 9, 15, 14, 19];

/** Barber share weights (Jamie leads). */
const BARBER_WEIGHTS: Record<BarberKey, number> = {
  jamie: 0.34,
  alex: 0.28,
  sam: 0.22,
  marcus: 0.16,
};

const BARBER_KEYS: BarberKey[] = ['jamie', 'alex', 'sam', 'marcus'];

const CACHE = new Map<string, BookingsReportsPayload>();

function dayKeyDaysAgo(daysAgo: number, now = new Date()): string {
  const anchor = fromZonedTime(
    `${formatInTimeZone(now, TZ, 'yyyy-MM-dd')}T12:00:00.000`,
    TZ,
  );
  return formatInTimeZone(addMilliseconds(anchor, -daysAgo * 24 * 60 * 60 * 1000), TZ, 'yyyy-MM-dd');
}

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

function londonWeekdayMon1(dayKey: string): number {
  const isoDow = Number(formatInTimeZone(fromZonedTime(`${dayKey}T12:00:00.000`, TZ), TZ, 'i'));
  return Number.isFinite(isoDow) ? isoDow : 1;
}

function pickBarber(seed: number): BarberKey {
  const roll = (seed % 100) / 100;
  let cumulative = 0;
  for (const key of BARBER_KEYS) {
    cumulative += BARBER_WEIGHTS[key];
    if (roll < cumulative) return key;
  }
  return 'marcus';
}

function pickService(seed: number): ServiceTemplate {
  const total = SERVICE_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
  let roll = seed % total;
  for (let index = 0; index < SERVICES.length; index += 1) {
    roll -= SERVICE_WEIGHTS[index] ?? 0;
    if (roll < 0) return SERVICES[index]!;
  }
  return SERVICES[0]!;
}

function pickClient(seed: number): string {
  return CLIENT_NAMES[seed % CLIENT_NAMES.length]!;
}

/** ~4–5% client cancel, ~1% shop, ~2% no-show → completes ~92–95%. */
function pickStatus(seed: number, cancelBoost = 0): string {
  const roll = seed % 100;
  if (roll < 4 + cancelBoost) return 'CANCELLED_BY_CLIENT';
  if (roll < 5 + cancelBoost) return 'CANCELLED_BY_SHOP';
  if (roll < 7 + cancelBoost) return 'EXPIRED';
  return 'COMPLETED';
}

function dailyBookingCountForDayKey(dayKey: string, seed: number): number {
  const weekday = londonWeekdayMon1(dayKey);
  const base = WEEKDAY_BASE_COUNTS[weekday] ?? 10;
  const noise = ((seed * 17 + weekday * 3) % 5) - 2;
  return Math.max(4, base + noise);
}

function pickHour(seed: number): number {
  return HOUR_POOL[seed % HOUR_POOL.length]!;
}

function pickMinute(seed: number): number {
  return [0, 15, 30, 45][seed % 4]!;
}

type GeneratedBooking = BookingsReportsPayload['reportBookings'][number];

function generateBookingsForRange(
  dayCount: number,
  dayOffsetBase: number,
  volumeScale: number,
  options: { cancelBoost?: number; idPrefix?: string; now?: Date; maxHourInclusive?: number } = {},
): GeneratedBooking[] {
  const { cancelBoost = 0, idPrefix = 'demo-rpt', now = new Date(), maxHourInclusive } = options;
  const bookings: GeneratedBooking[] = [];
  let seedCounter = dayOffsetBase * 1000;

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    const daysAgo = dayCount - 1 - dayIndex + dayOffsetBase;
    const dayKey = dayKeyDaysAgo(daysAgo, now);
    const count = Math.max(
      1,
      Math.round(dailyBookingCountForDayKey(dayKey, seedCounter + dayIndex) * volumeScale),
    );

    for (let slot = 0; slot < count; slot += 1) {
      seedCounter += 1;
      const barberKey = pickBarber(seedCounter + dayIndex * 17);
      const barber = BARBERS[barberKey];
      const service = pickService(seedCounter + slot * 3);
      const clientName = pickClient(seedCounter + slot);
      const status = pickStatus(seedCounter + slot * 7, cancelBoost);
      let hour = pickHour(seedCounter + slot * 5);
      if (maxHourInclusive != null && hour > maxHourInclusive) {
        hour = Math.max(9, maxHourInclusive - ((seedCounter + slot) % Math.max(1, maxHourInclusive - 8)));
      }
      const minute = pickMinute(seedCounter + slot);
      const email = `${clientName.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`;

      bookings.push({
        id: `${idPrefix}-${dayOffsetBase}-${seedCounter}`,
        startAt: startAtOnDayKey(dayKey, hour, minute),
        barberId: barber.id,
        barberName: barber.name,
        serviceName: service.name,
        status,
        clientName,
        clientEmail: email,
        computedValueGbp: status === 'COMPLETED' ? service.valueGbp : null,
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
