export const prerender = false;

import type { APIRoute } from 'astro';
import { BookingStatus, OrderStatus, Prisma } from '@prisma/client';
import { addMilliseconds, differenceInCalendarDays, differenceInMilliseconds, subDays, subMonths } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { requireAdminContext } from '../../../lib/admin/auth';
import { excludeSandboxBookingsWhere } from '../../../lib/booking/sandboxBookings';
import {
  ADMIN_REPORTS_DATABASE_UNAVAILABLE_MESSAGE,
  isPrismaDatabaseUnavailableError
} from '../../../lib/db/resilience';
import { prisma } from '../../../lib/db/client';
import { isBookingPaidQualified } from '../../../lib/booking/paymentReporting';
import {
  getStartOfMonthInLondon,
  parseYmdRange,
  type ReportsRangeKey,
} from '../../../lib/admin/reportsRange';
import {
  buildWorkdayHourLabels,
  getHourBucketLabel,
  toCumulativeSeries,
} from '../../../lib/admin/reportsHourlySeries';
const ADMIN_TIMEZONE = 'Europe/London';

type RangeBoundaries = { from: Date; to: Date };

type Breakdown = {
  completed: number;
  cancelledByClient: number;
  cancelledByShop: number;
  noShowExpired: number;
};
type TimeInterval = { start: Date; end: Date };
type RevenueSeriesPoint = {
  label: string;
  value: number;
};
type ReportBookingRow = {
  id: string;
  startAt: string;
  barberId: string;
  barberName: string;
  serviceName: string;
  status: BookingStatus;
  clientName: string | null;
  clientEmail: string | null;
  computedValueGbp: number | null;
};



const BOOKED_STATUSES = new Set<BookingStatus>([BookingStatus.BOOKED, BookingStatus.RESCHEDULED]);
// Revenue business rules: only paid-qualified bookings and paid/collected shop orders count as revenue.
const ORDER_REVENUE_STATUSES = new Set<OrderStatus>([
  OrderStatus.PAID,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.COLLECTED,
]);

const LEGACY_BOOKING_SELECT = {
  id: true,
  status: true,
  startAt: true,
  endAt: true,
  barberId: true,
  serviceId: true,
  fullName: true,
  email: true,
  barber: { select: { name: true, avatarUrl: true } },
  service: { select: { id: true, name: true, durationMinutes: true, pricePence: true } }
  ,
  paymentStatus: true
} satisfies Prisma.BookingSelect;

function isMissingHistoricalColumnError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === 'P2022'
    && String(error.meta?.column ?? '').includes('Booking.serviceNameAtBooking');
}



function getStartOfWeekInLondon(now: Date) {


  const londonNow = toZonedTime(now, ADMIN_TIMEZONE);
  const day = londonNow.getDay();
  const diffToMonday = (day + 6) % 7;

  const mondayDate = new Date(londonNow);
  mondayDate.setDate(londonNow.getDate() - diffToMonday);

  const mondayKey = formatInTimeZone(mondayDate, ADMIN_TIMEZONE, 'yyyy-MM-dd');
  return fromZonedTime(`${mondayKey}T00:00:00.000`, ADMIN_TIMEZONE);
}

function getReportsRange(range: ReportsRangeKey): RangeBoundaries {
  const now = new Date();
  if (range === 'week') {
    return { from: getStartOfWeekInLondon(now), to: now };
  }

  if (range === 'month') {
    return { from: getStartOfMonthInLondon(now, ADMIN_TIMEZONE), to: now };
  }

  if (range === '1d') {
    const todayKey = formatInTimeZone(now, ADMIN_TIMEZONE, 'yyyy-MM-dd');
    return {
      from: fromZonedTime(`${todayKey}T00:00:00.000`, ADMIN_TIMEZONE),
      to: now,
    };
  }

  if (range === '1y') {
    return { from: subDays(now, 365), to: now };
  }

  const daysBack = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  return { from: subDays(now, daysBack), to: now };
}

function getCustomReportsRange(fromYmd: string, toYmd: string): RangeBoundaries {
  const { from, to } = parseYmdRange(fromYmd, toYmd);
  return {
    from: fromZonedTime(`${from}T00:00:00.000`, ADMIN_TIMEZONE),
    to: fromZonedTime(`${to}T23:59:59.999`, ADMIN_TIMEZONE),
  };
}

function resolveReportsRequest(searchParams: URLSearchParams):
  | { rangeKey: ReportsRangeKey; boundaries: RangeBoundaries }
  | { error: string } {
  const rangeParam = searchParams.get('range')?.trim();
  const fromParam = searchParams.get('from')?.trim();
  const toParam = searchParams.get('to')?.trim();

  if (rangeParam === 'custom' || (fromParam && toParam)) {
    if (!fromParam || !toParam) {
      return { error: 'Custom range requires from and to (YYYY-MM-DD).' };
    }
    try {
      return {
        rangeKey: 'custom',
        boundaries: getCustomReportsRange(fromParam, toParam),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Invalid date range.',
      };
    }
  }

  if (
    rangeParam === '1d'
    || rangeParam === '1y'
    || rangeParam === 'week'
    || rangeParam === '7d'
    || rangeParam === '30d'
    || rangeParam === '90d'
    || rangeParam === 'month'
  ) {
    return { rangeKey: rangeParam, boundaries: getReportsRange(rangeParam) };
  }

  return { error: 'Invalid range.' };
}
function getPreviousRange(range: ReportsRangeKey, current: RangeBoundaries): RangeBoundaries {
  if (range === 'week') {
    const currentWeekStart = getStartOfWeekInLondon(new Date());
    const previousWeekStart = subDays(currentWeekStart, 7);
    return { from: previousWeekStart, to: addMilliseconds(currentWeekStart, -1) };
  }

  if (range === 'month') {
    const currentMonthStart = getStartOfMonthInLondon(new Date(), ADMIN_TIMEZONE);
    const previousMonthStart = subMonths(currentMonthStart, 1);
    return { from: previousMonthStart, to: addMilliseconds(currentMonthStart, -1) };
  }

  const diffMs = Math.max(0, differenceInMilliseconds(current.to, current.from));

  return {
    from: addMilliseconds(current.from, -(diffMs + 1)),
    to: addMilliseconds(current.from, -1),
  };
}
function minutesOfOverlap(rangeFrom: Date, rangeTo: Date, eventFrom: Date, eventTo: Date): number {
  const fromMs = Math.max(rangeFrom.getTime(), eventFrom.getTime());
  const toMs = Math.min(rangeTo.getTime(), eventTo.getTime());
  if (toMs <= fromMs) return 0;
  return Math.round((toMs - fromMs) / 60000);
}

function getRangeDayKeys(range: RangeBoundaries): string[] {
  const keys: string[] = [];
  let cursor = fromZonedTime(`${formatInTimeZone(range.from, ADMIN_TIMEZONE, 'yyyy-MM-dd')}T00:00:00.000`, ADMIN_TIMEZONE);
  const rangeEndDay = fromZonedTime(`${formatInTimeZone(range.to, ADMIN_TIMEZONE, 'yyyy-MM-dd')}T23:59:59.999`, ADMIN_TIMEZONE);

  while (cursor <= rangeEndDay) {
    keys.push(formatInTimeZone(cursor, ADMIN_TIMEZONE, 'yyyy-MM-dd'));
    cursor = addMilliseconds(cursor, 24 * 60 * 60 * 1000);
  }

  return keys;
}


function getRevenueBucketMode(rangeKey: ReportsRangeKey, range: RangeBoundaries): 'hour' | 'day' | 'week' {
  if (rangeKey === '1d') return 'hour';
  if (rangeKey === 'custom') {
    const spanDays = differenceInCalendarDays(range.to, range.from) + 1;
    if (spanDays > 90) return 'week';
  }
  return 'day';
}

function getRevenueSeriesSeed(range: RangeBoundaries, rangeKey: ReportsRangeKey): RevenueSeriesPoint[] {
  const mode = getRevenueBucketMode(rangeKey, range);
  if (mode === 'hour') {
    return buildWorkdayHourLabels(range.to, ADMIN_TIMEZONE).map((label) => ({ label, value: 0 }));
  }

  if (mode === 'day') {
    return getRangeDayKeys(range).map((dayKey) => ({ label: dayKey, value: 0 }));
  }

  const keys: string[] = [];
  let cursor = fromZonedTime(`${formatInTimeZone(range.from, ADMIN_TIMEZONE, 'yyyy-MM-dd')}T00:00:00.000`, ADMIN_TIMEZONE);
  const rangeEndDay = fromZonedTime(`${formatInTimeZone(range.to, ADMIN_TIMEZONE, 'yyyy-MM-dd')}T23:59:59.999`, ADMIN_TIMEZONE);

  while (cursor <= rangeEndDay) {
    keys.push(formatInTimeZone(cursor, ADMIN_TIMEZONE, "yyyy-'W'II"));
    cursor = addMilliseconds(cursor, 24 * 60 * 60 * 1000);
  }

  return [...new Set(keys)].map((weekKey) => ({ label: weekKey, value: 0 }));
}

function getRevenueBucketLabel(date: Date, rangeKey: ReportsRangeKey, range: RangeBoundaries): string {
  const mode = getRevenueBucketMode(rangeKey, range);
  if (mode === 'hour') return getHourBucketLabel(date, ADMIN_TIMEZONE);
  if (mode === 'week') return formatInTimeZone(date, ADMIN_TIMEZONE, "yyyy-'W'II");
  return formatInTimeZone(date, ADMIN_TIMEZONE, 'yyyy-MM-dd');
}


async function getRecentBarbers(shopId: string, from: Date, to: Date) {
  const extractRecent = async (inRangeOnly: boolean) => {
    const bookings = await prisma.booking.findMany({
      where: {
        client: { shopId },
        ...(inRangeOnly ? { startAt: { gte: from, lte: to } } : {})
      },
      select: {
        barberId: true,
        startAt: true,
        barber: { select: { name: true, avatarUrl: true } }
      },
      orderBy: { startAt: 'desc' },
      take: 250
    });

    const seen = new Set<string>();
    const recent = [] as { id: string; name: string; avatarUrl: string | null }[];

    for (const booking of bookings) {
      if (seen.has(booking.barberId)) continue;
      seen.add(booking.barberId);
      recent.push({ id: booking.barberId, name: booking.barber?.name ?? 'Barber', avatarUrl: booking.barber?.avatarUrl ?? null });
      if (recent.length >= 5) break;
    }

    return recent;

  };
  
  const inRange = await extractRecent(true);
  if (inRange.length > 0) return inRange;
  return extractRecent(false);

}

function toTrendPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}


async function computeMetrics(shopId: string, range: RangeBoundaries, selectedBarberId: string | null, rangeKey: ReportsRangeKey) {
  const whereBase = {
    client: { shopId },
    startAt: { gte: range.from, lte: range.to },
    ...excludeSandboxBookingsWhere,
    ...(selectedBarberId ? { barberId: selectedBarberId } : {})
  };

  const [bookings, orders, busiestBarberRaw, mostPopularServiceRaw, activeBarbers, timeBlocks] = await Promise.all([
    prisma.booking.findMany({
      where: whereBase,
      select: {
        ...LEGACY_BOOKING_SELECT,
        serviceNameAtBooking: true,
        paymentStatus: true,

        servicePricePenceAtBooking: true,
        serviceDurationMinutesAtBooking: true,
        totalPricePence: true
      }
          }).catch((error) => {
      if (!isMissingHistoricalColumnError(error)) throw error;
      return prisma.booking.findMany({
        where: whereBase,
        select: LEGACY_BOOKING_SELECT
      });

    }),
    prisma.order.findMany({
      where: {
        shopId,
        isTestOrder: false,
        createdAt: { gte: range.from, lte: range.to },
        status: { in: [...ORDER_REVENUE_STATUSES] }
      },
      select: { createdAt: true, totalPence: true }
    }),

    selectedBarberId
      ? Promise.resolve([] as { barberId: string; _count: { barberId: number } }[])
      : prisma.booking.groupBy({
        by: ['barberId'],
        where: { ...whereBase, status: { in: [...BOOKED_STATUSES] } },
        _count: { barberId: true },
        orderBy: { _count: { barberId: 'desc' } },
        take: 1
      }),
          prisma.booking.groupBy({
      by: ['serviceId'],
      where: { ...whereBase, status: { in: [...BOOKED_STATUSES] } },
      _count: { serviceId: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: 1
    }),
    prisma.barber.findMany({
      where: selectedBarberId ? { id: selectedBarberId, active: true } : { active: true },
      select: { id: true, name: true }
    }),
    prisma.timeBlock.findMany({
      where: {
        shopId,
        startAt: { lte: range.to },
        endAt: { gte: range.from },
        ...(selectedBarberId ? { OR: [{ barberId: selectedBarberId }, { barberId: null }] } : {})
      },
      select: { barberId: true, startAt: true, endAt: true }
    })


  ]);
  const activeBarberIds = activeBarbers.map((barber) => barber.id);
  const availability = await prisma.availabilityRule.findMany({
    where: {
      active: true,
      barberId: { in: activeBarberIds.length ? activeBarberIds : ['__none__'] }
    },
    select: { barberId: true, dayOfWeek: true, startMinutes: true, endMinutes: true, breakStartMin: true, breakEndMin: true }
  });

  let revenue = 0;
  let revenueCount = 0;
  const revenueSeriesMap = new Map(getRevenueSeriesSeed(range, rangeKey).map((point) => [point.label, point.value]));
  let bookingsCount = 0;
  let bookedMinutes = 0;
    const reportBookings: ReportBookingRow[] = [];
  const breakdown: Breakdown = { completed: 0, cancelledByClient: 0, cancelledByShop: 0, noShowExpired: 0 };
  const weekdayCounts = new Map<string, number>();
  const hourWindowCounts = new Map<number, number>();

  for (const booking of bookings) {
    bookingsCount += 1;

    if (booking.status === BookingStatus.CANCELLED_BY_CLIENT) breakdown.cancelledByClient += 1;
    else if (booking.status === BookingStatus.CANCELLED_BY_SHOP || booking.status === BookingStatus.CANCELLED_BY_ADMIN) breakdown.cancelledByShop += 1;
    else if (booking.status === BookingStatus.EXPIRED) breakdown.noShowExpired += 1;
    else if (BOOKED_STATUSES.has(booking.status)) breakdown.completed += 1;

    if (BOOKED_STATUSES.has(booking.status)) {
      const durationFromTimes = minutesOfOverlap(range.from, range.to, booking.startAt, booking.endAt);
      const fallbackDuration = Math.max(0, booking.serviceDurationMinutesAtBooking ?? booking.service?.durationMinutes ?? 0);
      bookedMinutes += durationFromTimes > 0 ? durationFromTimes : fallbackDuration;

      const weekdayKey = formatInTimeZone(booking.startAt, ADMIN_TIMEZONE, 'EEEE');
      weekdayCounts.set(weekdayKey, (weekdayCounts.get(weekdayKey) ?? 0) + 1);

      const hour = Number.parseInt(formatInTimeZone(booking.startAt, ADMIN_TIMEZONE, 'H'), 10);
      const bucketStart = Math.floor(hour / 2) * 2;
      hourWindowCounts.set(bucketStart, (hourWindowCounts.get(bucketStart) ?? 0) + 1);
    }
    const bookingValuePence = booking.totalPricePence ?? booking.servicePricePenceAtBooking ?? booking.service?.pricePence ?? 0;
    const bookingValue = bookingValuePence / 100;
    const isPaidQualified = isBookingPaidQualified({
      status: booking.status,
      startAt: booking.startAt,
      endAt: booking.endAt,
      paymentStatus: booking.paymentStatus ?? null,
    });

    reportBookings.push({
      id: booking.id,
      startAt: booking.startAt.toISOString(),
      barberId: booking.barberId,
      barberName: booking.barber?.name ?? 'Barber',
      serviceName: booking.serviceNameAtBooking ?? booking.service?.name ?? 'Service',
      status: booking.status,
      clientName: booking.fullName,
      clientEmail: booking.email,
      computedValueGbp: isPaidQualified ? bookingValue : null
    });

    if (!isPaidQualified) continue;


        revenue += bookingValue;
    revenueCount += 1;
    const bucketLabel = getRevenueBucketLabel(booking.startAt, rangeKey, range);
    revenueSeriesMap.set(bucketLabel, (revenueSeriesMap.get(bucketLabel) ?? 0) + bookingValue);

  }
 for (const order of orders) {
    revenue += order.totalPence / 100;
    const bucketLabel = getRevenueBucketLabel(order.createdAt, rangeKey, range);
    revenueSeriesMap.set(bucketLabel, (revenueSeriesMap.get(bucketLabel) ?? 0) + (order.totalPence / 100));
  }


  const cancelledCount = breakdown.cancelledByClient + breakdown.cancelledByShop;
  const cancelledRate = bookingsCount > 0 ? (cancelledCount / bookingsCount) * 100 : 0;
  const noShowExpiredRate = bookingsCount > 0 ? (breakdown.noShowExpired / bookingsCount) * 100 : 0;
  let peakDay: string | null = null;
  let peakDayCount = 0;
  for (const [key, count] of weekdayCounts.entries()) {
    if (count > peakDayCount) {
      peakDay = key;
      peakDayCount = count;
    }
  }

  let peakHour: string | null = null;
  let peakHourCount = 0;
  for (const [startHour, count] of hourWindowCounts.entries()) {
    if (count > peakHourCount) {
      peakHourCount = count;
      peakHour = `${String(startHour).padStart(2, '0')}:00–${String((startHour + 2) % 24).padStart(2, '0')}:00`;
    }
  }

  const dayKeys = getRangeDayKeys(range);
  const rulesByBarber = new Map<string, typeof availability>();
  for (const rule of availability) {
    if (!rulesByBarber.has(rule.barberId)) rulesByBarber.set(rule.barberId, []);
    rulesByBarber.get(rule.barberId)?.push(rule);
  }
  const mergeIntervals = (intervals: TimeInterval[]): TimeInterval[] => {
    if (intervals.length <= 1) return intervals;
    const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
    const merged: TimeInterval[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i += 1) {
      const current = sorted[i];
      const tail = merged[merged.length - 1];
      if (current.start.getTime() <= tail.end.getTime()) {
        if (current.end.getTime() > tail.end.getTime()) {
          tail.end = current.end;
        }
      } else {
        merged.push({ ...current });
      }
    }

    return merged;
  };


  let availableMinutes = 0;
  for (const barberId of activeBarberIds) {
    const rules = rulesByBarber.get(barberId) ?? [];

    for (const dayKey of dayKeys) {
      const dayDate = fromZonedTime(`${dayKey}T00:00:00.000`, ADMIN_TIMEZONE);
      const jsDay = Number.parseInt(formatInTimeZone(dayDate, ADMIN_TIMEZONE, 'i'), 10);
      const schemaDay = jsDay % 7;

      const dayRules = rules.filter((rule) => rule.dayOfWeek === schemaDay);
            const workingIntervals: TimeInterval[] = [];
      for (const rule of dayRules) {
        const startAt = fromZonedTime(`${dayKey}T${String(Math.floor(rule.startMinutes / 60)).padStart(2, '0')}:${String(rule.startMinutes % 60).padStart(2, '0')}:00`, ADMIN_TIMEZONE);
        const endAt = fromZonedTime(`${dayKey}T${String(Math.floor(rule.endMinutes / 60)).padStart(2, '0')}:${String(rule.endMinutes % 60).padStart(2, '0')}:00`, ADMIN_TIMEZONE);

        let effectiveStart = startAt;
        let effectiveEnd = endAt;


        if (rule.breakStartMin != null && rule.breakEndMin != null && rule.breakEndMin > rule.breakStartMin) {
          const breakStart = fromZonedTime(`${dayKey}T${String(Math.floor(rule.breakStartMin / 60)).padStart(2, '0')}:${String(rule.breakStartMin % 60).padStart(2, '0')}:00`, ADMIN_TIMEZONE);
          const breakEnd = fromZonedTime(`${dayKey}T${String(Math.floor(rule.breakEndMin / 60)).padStart(2, '0')}:${String(rule.breakEndMin % 60).padStart(2, '0')}:00`, ADMIN_TIMEZONE);
          if (breakStart > effectiveStart) {
            workingIntervals.push({ start: effectiveStart, end: breakStart < effectiveEnd ? breakStart : effectiveEnd });
          }
          if (breakEnd < effectiveEnd) {
            effectiveStart = breakEnd > effectiveStart ? breakEnd : effectiveStart;
          } else {
            effectiveStart = effectiveEnd;
          }

        }
        if (effectiveEnd > effectiveStart) {
          workingIntervals.push({ start: effectiveStart, end: effectiveEnd });
        }
      }


      const mergedWorkingIntervals = mergeIntervals(
        workingIntervals
          .map((interval) => ({
            start: interval.start < range.from ? range.from : interval.start,
            end: interval.end > range.to ? range.to : interval.end
          }))
          .filter((interval) => interval.end > interval.start)
      );

      const relevantBlocks = timeBlocks
        .filter((block) => block.barberId === null || block.barberId === barberId)
        .map((block) => ({
          start: block.startAt < range.from ? range.from : block.startAt,
          end: block.endAt > range.to ? range.to : block.endAt
        }))
        .filter((block) => block.end > block.start);

      const mergedBlockedIntervals = mergeIntervals(relevantBlocks);

      for (const workingInterval of mergedWorkingIntervals) {
        const baseMinutes = minutesOfOverlap(range.from, range.to, workingInterval.start, workingInterval.end);
        if (baseMinutes <= 0) continue;

        let blockedMinutes = 0;
        for (const blockInterval of mergedBlockedIntervals) {
          blockedMinutes += minutesOfOverlap(workingInterval.start, workingInterval.end, blockInterval.start, blockInterval.end);
        }


        availableMinutes += Math.max(0, baseMinutes - blockedMinutes);
      }
    }
  }

  const utilizationPct = availableMinutes > 0 ? Math.min(100, Math.max(0, (bookedMinutes / availableMinutes) * 100)) : null;


  const mostPopularServiceTop = mostPopularServiceRaw[0];
  const busiestBarberTop = busiestBarberRaw[0];

  const [mostPopularServiceEntity, busiestBarberEntity] = await Promise.all([
    mostPopularServiceTop
      ? prisma.service.findUnique({ where: { id: mostPopularServiceTop.serviceId }, select: { name: true } })
      : Promise.resolve(null),
    busiestBarberTop
      ? prisma.barber.findUnique({ where: { id: busiestBarberTop.barberId }, select: { name: true } })
      : Promise.resolve(null)
  ]);

  const revenueSeriesSeed = getRevenueSeriesSeed(range, rangeKey);
  const revenueSeriesRaw = revenueSeriesSeed.map((point) => ({
    label: point.label,
    value: revenueSeriesMap.get(point.label) ?? 0,
  }));
  const revenueSeries = getRevenueBucketMode(rangeKey, range) === 'hour'
    ? toCumulativeSeries(
      revenueSeriesRaw.map((point) => point.label),
      new Map(revenueSeriesRaw.map((point) => [point.label, point.value])),
    )
    : revenueSeriesRaw;

  return {
    bookingsCount,
    revenue,
    revenueCount,
    avgBookingValue: revenueCount > 0 ? revenue / revenueCount : 0,
    usedDemoPricing: false,
    cancelledRate,
        noShowExpiredRate,
    breakdown,
    peakDay,
    peakHour,
    bookedMinutes,
    availableMinutes,
    utilizationPct,
    revenueSeries,
    reportBookings,

    mostPopularService: mostPopularServiceTop && mostPopularServiceEntity
      ? { name: mostPopularServiceEntity.name, count: mostPopularServiceTop._count.serviceId }
      : null,
    busiestBarber: busiestBarberTop && busiestBarberEntity
      ? { name: busiestBarberEntity.name, count: busiestBarberTop._count.barberId }
      : null
  };
}



export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;

  const resolved = resolveReportsRequest(ctx.url.searchParams);
  if ('error' in resolved) {
    return new Response(JSON.stringify({ error: resolved.error }), { status: 400 });
  }

  const { rangeKey: range, boundaries: selectedRange } = resolved;
  const selectedBarberId = ctx.url.searchParams.get('barberId') || null;

  try {
    const shopId = access.shopId;
    const previousRange = getPreviousRange(range, selectedRange);

    const [selectedBarberEntity, recentBarbers, currentMetrics, previousMetrics] = await Promise.all([
      selectedBarberId
        ? prisma.barber.findFirst({
            where: { id: selectedBarberId, shopId },
            select: { id: true, name: true, avatarUrl: true },
          })
        : Promise.resolve(null),
      getRecentBarbers(shopId, selectedRange.from, selectedRange.to),
      computeMetrics(shopId, selectedRange, selectedBarberId, range),
      computeMetrics(shopId, previousRange, selectedBarberId, range)
    ]);

    return new Response(JSON.stringify({
      range,
      rangeBoundaries: {
        from: selectedRange.from.toISOString(),
        to: selectedRange.to.toISOString(),

        tz: ADMIN_TIMEZONE
      },
      previousRangeBoundaries: {
        from: previousRange.from.toISOString(),
        to: previousRange.to.toISOString(),
        tz: ADMIN_TIMEZONE
      },
      recentBarbers,

      selectedBarber: selectedBarberEntity,

      ...currentMetrics,
      trends: {
        bookingsPct: toTrendPercent(currentMetrics.bookingsCount, previousMetrics.bookingsCount),
        cancelledRatePp: currentMetrics.cancelledRate - previousMetrics.cancelledRate,
        revenuePct: toTrendPercent(currentMetrics.revenue, previousMetrics.revenue),
        revenueDelta: currentMetrics.revenue - previousMetrics.revenue,
        avgBookingValueDelta: currentMetrics.avgBookingValue - previousMetrics.avgBookingValue,
        noShowExpiredCountDelta: currentMetrics.breakdown.noShowExpired - previousMetrics.breakdown.noShowExpired,
        noShowExpiredRatePp: currentMetrics.noShowExpiredRate - previousMetrics.noShowExpiredRate,

        utilizationPp: currentMetrics.utilizationPct == null || previousMetrics.utilizationPct == null
          ? null
          : currentMetrics.utilizationPct - previousMetrics.utilizationPct
      },
      previousMetrics: {
        bookingsCount: previousMetrics.bookingsCount,
        cancelledRate: previousMetrics.cancelledRate,
        revenue: previousMetrics.revenue,
        avgBookingValue: previousMetrics.avgBookingValue,
        utilizationPct: previousMetrics.utilizationPct,
        noShowExpiredCount: previousMetrics.breakdown.noShowExpired,
        noShowExpiredRate: previousMetrics.noShowExpiredRate
      }
    }));
  } catch (error) {
    if (isPrismaDatabaseUnavailableError(error)) {
      console.error('[api/admin/reports] Database unreachable:', error instanceof Error ? error.message : error);
      return new Response(JSON.stringify({ error: ADMIN_REPORTS_DATABASE_UNAVAILABLE_MESSAGE }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw error;
  }
};
