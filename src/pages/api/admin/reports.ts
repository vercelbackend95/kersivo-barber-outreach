export const prerender = false;

import type { APIRoute } from 'astro';
import { Prisma } from '@prisma/client';
import { requireAdminContext } from '../../../lib/admin/auth';
import { shouldIncludeTestActivityInAnalytics } from '../../../lib/admin/analyticsMode';
import { bookingAnalyticsWhere } from '../../../lib/booking/sandboxBookings';
import {
  ADMIN_REPORTS_DATABASE_UNAVAILABLE_MESSAGE,
  isPrismaDatabaseUnavailableError,
} from '../../../lib/db/resilience';
import { prisma } from '../../../lib/db/client';
import type { ReportsRangeKey } from '../../../lib/admin/reportsRange';
import {
  ADMIN_REPORTS_TIMEZONE,
  aggregateReportMetrics,
  getCustomReportsRange,
  getPreviousRange,
  getReportsRange,
  toTrendPercent,
  type AggregatableBooking,
  type RangeBoundaries,
} from '../../../lib/admin/reportsMetrics';

function getBookingShopScopeWhere(shopId: string): Prisma.BookingWhereInput {
  // Reports are chair/barber analytics — scope by the barber's shop only.
  return { barber: { shopId } };
}

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
  service: { select: { id: true, name: true, durationMinutes: true, pricePence: true } },
  paymentStatus: true,
} satisfies Prisma.BookingSelect;

function isMissingHistoricalColumnError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === 'P2022'
    && String(error.meta?.column ?? '').includes('Booking.serviceNameAtBooking');
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

async function getRecentBarbers(
  shopId: string,
  from: Date,
  to: Date,
  includeTestActivity: boolean,
) {
  const extractRecent = async (inRangeOnly: boolean) => {
    const bookings = await prisma.booking.findMany({
      where: {
        ...getBookingShopScopeWhere(shopId),
        ...bookingAnalyticsWhere(includeTestActivity),
        ...(inRangeOnly ? { startAt: { gte: from, lte: to } } : {}),
      },
      select: {
        barberId: true,
        startAt: true,
        barber: { select: { name: true, avatarUrl: true } },
      },
      orderBy: { startAt: 'desc' },
      take: 250,
    });

    const seen = new Set<string>();
    const recent = [] as { id: string; name: string; avatarUrl: string | null }[];

    for (const booking of bookings) {
      if (seen.has(booking.barberId)) continue;
      seen.add(booking.barberId);
      recent.push({
        id: booking.barberId,
        name: booking.barber?.name ?? 'Barber',
        avatarUrl: booking.barber?.avatarUrl ?? null,
      });
      if (recent.length >= 5) break;
    }

    return recent;
  };

  const inRange = await extractRecent(true);
  if (inRange.length > 0) return inRange;
  return extractRecent(false);
}

async function computeMetrics(
  shopId: string,
  range: RangeBoundaries,
  selectedBarberId: string | null,
  rangeKey: ReportsRangeKey,
  includeTestActivity: boolean,
  nowMs: number,
) {
  const whereBase: Prisma.BookingWhereInput = {
    ...getBookingShopScopeWhere(shopId),
    startAt: { gte: range.from, lte: range.to },
    ...bookingAnalyticsWhere(includeTestActivity),
    ...(selectedBarberId ? { barberId: selectedBarberId } : {}),
  };

  const [bookingsRaw, activeBarbers, timeBlocks, timeOff] = await Promise.all([
    prisma.booking.findMany({
      where: whereBase,
      select: {
        ...LEGACY_BOOKING_SELECT,
        serviceNameAtBooking: true,
        paymentStatus: true,
        servicePricePenceAtBooking: true,
        serviceDurationMinutesAtBooking: true,
        totalPricePence: true,
      },
    }).catch((error) => {
      if (!isMissingHistoricalColumnError(error)) throw error;
      return prisma.booking.findMany({
        where: whereBase,
        select: LEGACY_BOOKING_SELECT,
      });
    }),
    prisma.barber.findMany({
      where: selectedBarberId
        ? { id: selectedBarberId, shopId, active: true }
        : { shopId, active: true },
      select: { id: true, name: true },
    }),
    prisma.timeBlock.findMany({
      where: {
        shopId,
        startAt: { lte: range.to },
        endAt: { gte: range.from },
        ...(selectedBarberId ? { OR: [{ barberId: selectedBarberId }, { barberId: null }] } : {}),
      },
      select: { barberId: true, startAt: true, endAt: true },
    }),
    prisma.barberTimeOff.findMany({
      where: {
        startsAt: { lte: range.to },
        endsAt: { gte: range.from },
        barber: selectedBarberId
          ? { id: selectedBarberId, shopId }
          : { shopId },
      },
      select: { barberId: true, startsAt: true, endsAt: true },
    }),
  ]);

  const activeBarberIds = activeBarbers.map((barber) => barber.id);
  const availability = await prisma.availabilityRule.findMany({
    where: {
      active: true,
      barberId: { in: activeBarberIds.length ? activeBarberIds : ['__none__'] },
    },
    select: {
      barberId: true,
      dayOfWeek: true,
      startMinutes: true,
      endMinutes: true,
      breakStartMin: true,
      breakEndMin: true,
    },
  });

  const bookings: AggregatableBooking[] = bookingsRaw.map((booking) => {
    const row = booking as typeof booking & {
      totalPricePence?: number | null;
      servicePricePenceAtBooking?: number | null;
      serviceDurationMinutesAtBooking?: number | null;
      serviceNameAtBooking?: string | null;
    };
    const valuePence = row.totalPricePence
      ?? row.servicePricePenceAtBooking
      ?? row.service?.pricePence
      ?? 0;
    const durationMinutes = row.serviceDurationMinutesAtBooking
      ?? row.service?.durationMinutes
      ?? 0;

    return {
      id: row.id,
      status: row.status,
      startAt: row.startAt,
      endAt: row.endAt,
      barberId: row.barberId,
      barberName: row.barber?.name ?? 'Barber',
      serviceId: row.serviceId ?? row.service?.id ?? null,
      serviceName: row.serviceNameAtBooking ?? row.service?.name ?? 'Service',
      clientName: row.fullName,
      clientEmail: row.email,
      paymentStatus: row.paymentStatus ?? null,
      valuePence,
      durationMinutes,
    };
  });

  const metrics = aggregateReportMetrics({
    bookings,
    range,
    rangeKey,
    nowMs,
    activeBarberIds,
    availability,
    timeBlocks: timeBlocks.map((block) => ({
      barberId: block.barberId,
      startAt: block.startAt,
      endAt: block.endAt,
    })),
    timeOff: timeOff.map((row) => ({
      barberId: row.barberId,
      startAt: row.startsAt,
      endAt: row.endsAt,
    })),
  });

  return {
    bookingsCount: metrics.bookingsCount,
    revenue: metrics.revenue,
    revenueCount: metrics.revenueCount,
    avgBookingValue: metrics.avgBookingValue,
    usedDemoPricing: false,
    cancelledRate: metrics.cancelledRate,
    noShowExpiredRate: metrics.noShowExpiredRate,
    breakdown: metrics.breakdown,
    peakDay: metrics.peakDay,
    peakHour: metrics.peakHour,
    bookedMinutes: metrics.bookedMinutes,
    availableMinutes: metrics.availableMinutes,
    utilizationPct: metrics.utilizationPct,
    revenueSeries: metrics.revenueSeries,
    reportBookings: metrics.reportBookings,
    mostPopularService: metrics.mostPopularService,
    busiestBarber: metrics.busiestBarber,
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
  const nowMs = Date.now();

  try {
    const shopId = access.shopId;
    const previousRange = getPreviousRange(range, selectedRange);
    const includeTestActivity = await shouldIncludeTestActivityInAnalytics(shopId);

    const [selectedBarberEntity, recentBarbers, currentMetrics, previousMetrics] = await Promise.all([
      selectedBarberId
        ? prisma.barber.findFirst({
            where: { id: selectedBarberId, shopId },
            select: { id: true, name: true, avatarUrl: true },
          })
        : Promise.resolve(null),
      getRecentBarbers(shopId, selectedRange.from, selectedRange.to, includeTestActivity),
      computeMetrics(shopId, selectedRange, selectedBarberId, range, includeTestActivity, nowMs),
      computeMetrics(shopId, previousRange, selectedBarberId, range, includeTestActivity, nowMs),
    ]);

    return new Response(JSON.stringify({
      range,
      rangeBoundaries: {
        from: selectedRange.from.toISOString(),
        to: selectedRange.to.toISOString(),
        tz: ADMIN_REPORTS_TIMEZONE,
      },
      previousRangeBoundaries: {
        from: previousRange.from.toISOString(),
        to: previousRange.to.toISOString(),
        tz: ADMIN_REPORTS_TIMEZONE,
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
          : currentMetrics.utilizationPct - previousMetrics.utilizationPct,
      },
      previousMetrics: {
        bookingsCount: previousMetrics.bookingsCount,
        cancelledRate: previousMetrics.cancelledRate,
        revenue: previousMetrics.revenue,
        avgBookingValue: previousMetrics.avgBookingValue,
        utilizationPct: previousMetrics.utilizationPct,
        noShowExpiredCount: previousMetrics.breakdown.noShowExpired,
        noShowExpiredRate: previousMetrics.noShowExpiredRate,
      },
    }));
  } catch (error) {
    if (isPrismaDatabaseUnavailableError(error)) {
      console.error('[api/admin/reports] Database unreachable:', error instanceof Error ? error.message : error);
      return new Response(JSON.stringify({ error: ADMIN_REPORTS_DATABASE_UNAVAILABLE_MESSAGE }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw error;
  }
};
