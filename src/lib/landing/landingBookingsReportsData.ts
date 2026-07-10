/**
 * Landing "Inside the System" bookings-reports preview data.
 *
 * Believable demo bookings anchored to the current date (Europe/London),
 * with per-barber series, derived KPIs, and landing avatars — no admin API.
 */
import { addMilliseconds } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import type { BookingsReportsPayload } from '@/components/admin/BookingsReportsAnalyticsStudio';
import { demoBarbersResponse } from '@/lib/admin/demoFixtures/barbers';
import { DEMO_BARBER_IDS } from '@/lib/admin/demoFixtures/ids';
import { LANDING_DEMO_BARBER_AVATARS } from '@/lib/landing/landingDemoAssets';
import {
  customRangeDayCount,
  getStartOfMonthInLondon,
  type ReportsRangeKey,
} from '@/lib/admin/reportsRange';

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

const CLIENT_NAMES = [
  'Oliver Reed', 'Amelia Clarke', 'Noah Bennett', 'Harry Watson', 'Daniel Price',
  'Ethan Walsh', 'Leo Carter', 'Freya Hughes', 'Jack Turner', 'Maya Brooks',
  'Theo Hughes', 'Grace Turner', 'Charlie Evans', 'Sophie Lane', 'James Foster',
  'Ruby Shaw', 'Louis Grant', 'Nathan Cole', 'Dylan Reid', 'Aaron Webb',
  'Connor Walsh', 'Mason Field', 'Rory Ellis', 'Isla Morgan', 'Ella Price',
];

/** Bookings per day for a 7-day window (oldest → newest). Fri/Sat busier, Sun quieter. */
const WEEKLY_DAILY_COUNTS = [11, 12, 13, 14, 16, 15, 9];

/** Barber share weights (Jamie leads). */
const BARBER_WEIGHTS: Record<BarberKey, number> = {
  jamie: 0.38,
  alex: 0.26,
  sam: 0.20,
  marcus: 0.16,
};

const BARBER_KEYS: BarberKey[] = ['jamie', 'alex', 'sam', 'marcus'];

const CACHE = new Map<string, BookingsReportsPayload>();

function dayKeyDaysAgo(daysAgo: number): string {
  const anchor = fromZonedTime(
    `${formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd')}T12:00:00.000`,
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

function resolveDayCount(range: ReportsRangeKey, customFrom?: string, customTo?: string): number {
  if (range === 'custom' && customFrom && customTo) {
    return Math.max(1, Math.min(90, customRangeDayCount(customFrom, customTo)));
  }
  if (range === '1d') return 1;
  if (range === '1y') return 90;
  if (range === '90d') return 90;
  if (range === '30d') return 30;
  if (range === 'month') {
    const monthStart = getStartOfMonthInLondon(new Date(), TZ);
    const todayKey = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
    const monthStartKey = formatInTimeZone(monthStart, TZ, 'yyyy-MM-dd');
    return Math.max(1, customRangeDayCount(monthStartKey, todayKey));
  }
  return 7;
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
  return SERVICES[seed % SERVICES.length]!;
}

function pickClient(seed: number): string {
  return CLIENT_NAMES[seed % CLIENT_NAMES.length]!;
}

function pickStatus(seed: number): string {
  const roll = seed % 100;
  if (roll < 6) return 'CANCELLED_BY_CLIENT';
  if (roll < 8) return 'CANCELLED_BY_SHOP';
  if (roll < 10) return 'EXPIRED';
  return 'COMPLETED';
}

function dailyBookingCount(dayIndex: number, totalDays: number): number {
  if (totalDays <= 7) {
    const offset = 7 - totalDays;
    return WEEKLY_DAILY_COUNTS[offset + dayIndex] ?? 12;
  }
  const base = 12 + (dayIndex % 7);
  const weekendBoost = (dayIndex % 7) >= 4 ? 2 : 0;
  return base + weekendBoost;
}

type GeneratedBooking = BookingsReportsPayload['reportBookings'][number];

function generateBookingsForRange(
  dayCount: number,
  dayOffsetBase: number,
  volumeScale: number,
): GeneratedBooking[] {
  const bookings: GeneratedBooking[] = [];
  let seedCounter = dayOffsetBase * 1000;

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    const daysAgo = dayCount - 1 - dayIndex + dayOffsetBase;
    const dayKey = dayKeyDaysAgo(daysAgo);
    const count = Math.max(1, Math.round(dailyBookingCount(dayIndex, dayCount) * volumeScale));

    for (let slot = 0; slot < count; slot += 1) {
      seedCounter += 1;
      const barberKey = pickBarber(seedCounter + dayIndex * 17);
      const barber = BARBERS[barberKey];
      const service = pickService(seedCounter + slot * 3);
      const clientName = pickClient(seedCounter + slot);
      const status = pickStatus(seedCounter + slot * 7);
      const hour = 9 + (slot % 9);
      const minute = (slot * 15) % 60;
      const email = `${clientName.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`;

      bookings.push({
        id: `landing-rpt-${dayOffsetBase}-${seedCounter}`,
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

function isCancelledStatus(status: string): boolean {
  return status === 'CANCELLED_BY_CLIENT'
    || status === 'CANCELLED_BY_SHOP'
    || status === 'CANCELLED_BY_ADMIN'
    || status === 'EXPIRED';
}

function computeMetrics(bookings: GeneratedBooking[], dayCount: number) {
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

  const labels = Array.from({ length: dayCount }, (_, index) => dayKeyDaysAgo(dayCount - 1 - index + 0));
  const revenueByDay = new Map(labels.map((label) => [label, 0]));

  for (const row of completed) {
    const label = formatInTimeZone(new Date(row.startAt), TZ, 'yyyy-MM-dd');
    if (revenueByDay.has(label)) {
      revenueByDay.set(label, (revenueByDay.get(label) ?? 0) + (row.computedValueGbp ?? 0));
    }
  }

  const revenueSeries = labels.map((label) => ({
    label,
    value: revenueByDay.get(label) ?? 0,
  }));

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

  const peakDayEntry = revenueSeries.reduce(
    (best, point) => (point.value > best.value ? point : best),
    revenueSeries[0] ?? { label: '', value: 0 },
  );
  const peakDay = peakDayEntry?.label
    ? formatInTimeZone(fromZonedTime(`${peakDayEntry.label}T12:00:00.000`, TZ), TZ, 'EEE')
    : null;

  return {
    bookingsCount,
    cancelledRate,
    noShowExpiredRate,
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
    peakHour: '14:00',
    busiestBarber: barberLeader
      ? { name: barberLeader[1].name, count: barberLeader[1].count }
      : null,
    mostPopularService: topService
      ? { name: topService[0], count: topService[1] }
      : null,
  };
}

function computeTrends(
  current: ReturnType<typeof computeMetrics>,
  previous: ReturnType<typeof computeMetrics>,
) {
  const bookingsPct = previous.bookingsCount > 0
    ? ((current.bookingsCount - previous.bookingsCount) / previous.bookingsCount) * 100
    : null;
  const revenuePct = previous.revenue > 0
    ? ((current.revenue - previous.revenue) / previous.revenue) * 100
    : null;
  const cancelledRatePp = current.cancelledRate - previous.cancelledRate;
  const utilizationPp = current.utilizationPct != null && previous.utilizationPct != null
    ? current.utilizationPct - previous.utilizationPct
    : null;

  return {
    bookingsPct: bookingsPct != null ? Math.round(bookingsPct * 10) / 10 : null,
    cancelledRatePp: Math.round(cancelledRatePp * 10) / 10,
    revenuePct: revenuePct != null ? Math.round(revenuePct * 10) / 10 : null,
    revenueDelta: Math.round((current.revenue - previous.revenue) * 100) / 100,
    avgBookingValueDelta: Math.round((current.avgBookingValue - previous.avgBookingValue) * 10) / 10,
    noShowExpiredCountDelta: current.breakdown.noShowExpired - previous.breakdown.noShowExpired,
    noShowExpiredRatePp: current.noShowExpiredRate - previous.noShowExpiredRate,
    utilizationPp: utilizationPp != null ? Math.round(utilizationPp * 10) / 10 : null,
  };
}

function buildPayload(
  range: ReportsRangeKey,
  dayCount: number,
  customFrom?: string,
  customTo?: string,
): BookingsReportsPayload {
  const currentBookings = generateBookingsForRange(dayCount, 0, 1);
  const previousBookings = generateBookingsForRange(dayCount, dayCount, 0.92);

  const current = computeMetrics(currentBookings, dayCount);
  const previous = computeMetrics(previousBookings, dayCount);

  const labels = current.revenueSeries.map((point) => point.label);
  const fromDay = labels[0] ?? dayKeyDaysAgo(dayCount - 1);
  const toDay = labels[labels.length - 1] ?? dayKeyDaysAgo(0);

  const from = range === 'custom' && customFrom
    ? startAtOnDayKey(customFrom, 0)
    : startAtOnDayKey(fromDay, 0);
  const to = range === 'custom' && customTo
    ? startAtOnDayKey(customTo, 23)
    : new Date().toISOString();

  const previousFromDay = dayKeyDaysAgo(dayCount * 2 - 1);
  const previousToDay = dayKeyDaysAgo(dayCount);

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
    trends: computeTrends(current, previous),
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

export function getLandingBookingsReportsData(
  range: ReportsRangeKey,
  customFrom?: string,
  customTo?: string,
): BookingsReportsPayload {
  const cacheKey = range === 'custom'
    ? `custom:${customFrom ?? ''}:${customTo ?? ''}`
    : range;
  const cached = CACHE.get(cacheKey);
  if (cached) return cached;

  const dayCount = resolveDayCount(range, customFrom, customTo);
  const payload = buildPayload(range, dayCount, customFrom, customTo);
  CACHE.set(cacheKey, payload);
  return payload;
}

export const landingBookingsReportsBarbers = demoBarbersResponse.barbers;
