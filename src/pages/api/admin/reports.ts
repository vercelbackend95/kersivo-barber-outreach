export const prerender = false;

import type { APIRoute } from 'astro';
import { BookingStatus } from '@prisma/client';
import { addMilliseconds, differenceInMilliseconds, subDays, subYears } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { requireAdmin } from '../../../lib/admin/auth';
import { prisma } from '../../../lib/db/client';
import { getDemoServicePriceGbp, normalizeServiceLookupKey, parsePriceTextToGbp } from '../../../lib/admin/reportPricing';
const ADMIN_TIMEZONE = 'Europe/London';

type ReportsRange = 'week' | '7d' | '30d' | '90d' | '1y';

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

type BarberRankingRow = {
  barberId: string;
  barberName: string;
  bookings: number;
  revenue: number;
  cancelledRate: number;
  utilizationPct: number | null;
};



const BOOKED_STATUSES = new Set<BookingStatus>([BookingStatus.CONFIRMED, BookingStatus.RESCHEDULED]);
const REVENUE_STATUSES = new Set<BookingStatus>([BookingStatus.CONFIRMED]);

function getStartOfWeekInLondon(now: Date) {


  const londonNow = toZonedTime(now, ADMIN_TIMEZONE);
  const day = londonNow.getDay();
  const diffToMonday = (day + 6) % 7;

  const mondayDate = new Date(londonNow);
  mondayDate.setDate(londonNow.getDate() - diffToMonday);

  const mondayKey = formatInTimeZone(mondayDate, ADMIN_TIMEZONE, 'yyyy-MM-dd');
  return fromZonedTime(`${mondayKey}T00:00:00.000`, ADMIN_TIMEZONE);
}

function getReportsRange(range: ReportsRange): RangeBoundaries {
  const now = new Date();
  if (range === 'week') {
    return { from: getStartOfWeekInLondon(now), to: now };
  }

  const daysBack = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  return { from: subDays(now, daysBack), to: now };
}
function getPreviousRange(range: ReportsRange, current: RangeBoundaries): RangeBoundaries {
  if (range === 'week') {
    const currentWeekStart = getStartOfWeekInLondon(new Date());
    const previousWeekStart = subDays(currentWeekStart, 7);
    return { from: previousWeekStart, to: addMilliseconds(currentWeekStart, -1) };
  }

  if (range === '1y') {
    const previousFrom = subYears(current.from, 1);
    return { from: previousFrom, to: addMilliseconds(current.from, -1) };
  }

  const diffMs = Math.max(0, differenceInMilliseconds(current.to, current.from));

  return {
    from: addMilliseconds(current.from, -(diffMs + 1)),
    to: addMilliseconds(current.from, -1)

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


function getRevenueBucketMode(rangeKey: ReportsRange): 'day' | 'week' {
  return rangeKey === '1y' ? 'week' : 'day';
}

function getRevenueSeriesSeed(range: RangeBoundaries, rangeKey: ReportsRange): RevenueSeriesPoint[] {
  if (getRevenueBucketMode(rangeKey) === 'day') {
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

function getRevenueBucketLabel(date: Date, rangeKey: ReportsRange): string {
  return getRevenueBucketMode(rangeKey) === 'week'
    ? formatInTimeZone(date, ADMIN_TIMEZONE, "yyyy-'W'II")
    : formatInTimeZone(date, ADMIN_TIMEZONE, 'yyyy-MM-dd');
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
        barber: { select: { name: true } }
      },
      orderBy: { startAt: 'desc' },
      take: 250
    });

    const seen = new Set<string>();
    const recent = [] as { id: string; name: string }[];

    for (const booking of bookings) {
      if (seen.has(booking.barberId)) continue;
      seen.add(booking.barberId);
      recent.push({ id: booking.barberId, name: booking.barber?.name ?? 'Barber' });
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


async function computeMetrics(shopId: string, range: RangeBoundaries, selectedBarberId: string | null, rangeKey: ReportsRange) {
  const whereBase = {
    client: { shopId },
    startAt: { gte: range.from, lte: range.to },

    ...(selectedBarberId ? { barberId: selectedBarberId } : {})

  };

  const [bookings, services, busiestBarberRaw, mostPopularServiceRaw, activeBarbers, timeBlocks] = await Promise.all([
    prisma.booking.findMany({
      where: whereBase,
      select: {
                id: true,
        status: true,
        startAt: true,
        endAt: true,
        barberId: true,
        serviceId: true,
                fullName: true,
        email: true,
        barber: { select: { name: true } },

        service: { select: { id: true, name: true, durationMinutes: true, fromPriceText: true } }

      }
    }),
    prisma.service.findMany({ select: { id: true, name: true, fromPriceText: true } }),
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

  const servicePriceById = new Map<string, number>();
  for (const service of services) {
    const dbPrice = parsePriceTextToGbp(service.fromPriceText);
    if (dbPrice != null) servicePriceById.set(service.id, dbPrice);
  }

  let usedDemoPricing = false;
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
      const fallbackDuration = Math.max(0, booking.service?.durationMinutes ?? 0);
      bookedMinutes += durationFromTimes > 0 ? durationFromTimes : fallbackDuration;

      const weekdayKey = formatInTimeZone(booking.startAt, ADMIN_TIMEZONE, 'EEEE');
      weekdayCounts.set(weekdayKey, (weekdayCounts.get(weekdayKey) ?? 0) + 1);

      const hour = Number.parseInt(formatInTimeZone(booking.startAt, ADMIN_TIMEZONE, 'H'), 10);
      const bucketStart = Math.floor(hour / 2) * 2;
      hourWindowCounts.set(bucketStart, (hourWindowCounts.get(bucketStart) ?? 0) + 1);
    }


    const serviceId = booking.serviceId;
    const normalizedServiceId = normalizeServiceLookupKey(serviceId);
    let bookingValue = servicePriceById.get(serviceId) ?? servicePriceById.get(normalizedServiceId) ?? null;

    if (bookingValue == null) {
      bookingValue = getDemoServicePriceGbp(serviceId, booking.service?.name);
      if (bookingValue != null) usedDemoPricing = true;
    }

    if (bookingValue == null) bookingValue = 0;
    reportBookings.push({
      id: booking.id,
      startAt: booking.startAt.toISOString(),
      barberId: booking.barberId,
      barberName: booking.barber?.name ?? 'Barber',
      serviceName: booking.service?.name ?? 'Service',
      status: booking.status,
      clientName: booking.fullName,
      clientEmail: booking.email,
      computedValueGbp: REVENUE_STATUSES.has(booking.status) ? bookingValue : null
    });

    if (!REVENUE_STATUSES.has(booking.status)) continue;


        revenue += bookingValue;
    revenueCount += 1;
    const bucketLabel = getRevenueBucketLabel(booking.startAt, rangeKey);
    revenueSeriesMap.set(bucketLabel, (revenueSeriesMap.get(bucketLabel) ?? 0) + bookingValue);

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

  return {
    bookingsCount,
    revenue,
    revenueCount,
    avgBookingValue: revenueCount > 0 ? revenue / revenueCount : 0,
    usedDemoPricing,
    cancelledRate,
        noShowExpiredRate,
    breakdown,
    peakDay,
    peakHour,
    bookedMinutes,
    availableMinutes,
    utilizationPct,
    revenueSeries: [...revenueSeriesMap.entries()].map(([label, value]) => ({ label, value })),
    reportBookings,

    mostPopularService: mostPopularServiceTop && mostPopularServiceEntity
      ? { name: mostPopularServiceEntity.name, count: mostPopularServiceTop._count.serviceId }
      : null,
    busiestBarber: busiestBarberTop && busiestBarberEntity
      ? { name: busiestBarberEntity.name, count: busiestBarberTop._count.barberId }
      : null
  };
}

async function getBarberRanking(shopId: string, range: RangeBoundaries): Promise<BarberRankingRow[]> {
  const barbers = await prisma.barber.findMany({ where: { active: true }, select: { id: true, name: true } });

  const ranking = await Promise.all(barbers.map(async (barber) => {
    const metrics = await computeMetrics(shopId, range, barber.id, '30d');
    return {
      barberId: barber.id,
      barberName: barber.name,
      bookings: metrics.bookingsCount,
      revenue: metrics.revenue,
      cancelledRate: metrics.cancelledRate,
      utilizationPct: metrics.utilizationPct
    };
  }));

  return ranking.filter((row) => row.bookings > 0 || row.revenue > 0).sort((a, b) => b.bookings - a.bookings);
}



export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const rangeParam = ctx.url.searchParams.get('range');
  const range = rangeParam === 'week' || rangeParam === '7d' || rangeParam === '30d' || rangeParam === '90d' || rangeParam === '1y'
    ? rangeParam
    : null;

  if (!range) {
    return new Response(JSON.stringify({ error: 'Invalid range.' }), { status: 400 });
  }

  const selectedBarberId = ctx.url.searchParams.get('barberId') || null;
  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });
  const selectedRange = getReportsRange(range);
  const previousRange = getPreviousRange(range, selectedRange);

  const [selectedBarberEntity, recentBarbers, currentMetrics, previousMetrics, barberRanking] = await Promise.all([
    selectedBarberId
      ? prisma.barber.findUnique({ where: { id: selectedBarberId }, select: { id: true, name: true } })
      : Promise.resolve(null),
    getRecentBarbers(shop.id, selectedRange.from, selectedRange.to),
    computeMetrics(shop.id, selectedRange, selectedBarberId, range),
    computeMetrics(shop.id, previousRange, selectedBarberId, range),
    getBarberRanking(shop.id, selectedRange)


  ]);
  const selectedBarberRankIndex = selectedBarberId
    ? barberRanking.findIndex((row) => row.barberId === selectedBarberId)
    : -1;

  const rankingBookingsTotal = barberRanking.reduce((sum, row) => sum + row.bookings, 0);
  const rankingRevenueTotal = barberRanking.reduce((sum, row) => sum + row.revenue, 0);
  const selectedRankRow = selectedBarberRankIndex >= 0 ? barberRanking[selectedBarberRankIndex] : null;



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
    },
    barberRanking,
    selectedBarberRank: selectedRankRow ? {
      rank: selectedBarberRankIndex + 1,
      total: barberRanking.length,
      bookingSharePct: rankingBookingsTotal > 0 ? (selectedRankRow.bookings / rankingBookingsTotal) * 100 : 0,
      revenueSharePct: rankingRevenueTotal > 0 ? (selectedRankRow.revenue / rankingRevenueTotal) * 100 : 0
    } : null


  }));
};
