export const prerender = false;

import type { APIRoute } from 'astro';
import { BookingStatus } from '@prisma/client';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { requireAdmin } from '../../../lib/admin/auth';
import { prisma } from '../../../lib/db/client';

const ADMIN_TIMEZONE = 'Europe/London';

type ReportsRange = 'week' | '7d' | '30d' | '90d' | '1y';

function getStartOfWeekInLondon(now: Date) {

  const londonNow = toZonedTime(now, ADMIN_TIMEZONE);
  const day = londonNow.getDay();
  const diffToMonday = (day + 6) % 7;

  const mondayDate = new Date(londonNow);
  mondayDate.setDate(londonNow.getDate() - diffToMonday);

  const mondayKey = formatInTimeZone(mondayDate, ADMIN_TIMEZONE, 'yyyy-MM-dd');
  return fromZonedTime(`${mondayKey}T00:00:00.000`, ADMIN_TIMEZONE);
}

function getReportsRange(range: ReportsRange) {
  const now = new Date();
  if (range === 'week') {
    return { from: getStartOfWeekInLondon(now), to: now };
  }

  const daysBack = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;

  return {
    from: new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000),
    to: now
  };
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

  const bookingRangeWhere = {
    startAt: { gte: selectedRange.from, lte: selectedRange.to },
    client: { shopId: shop.id },
    ...(selectedBarberId ? { barberId: selectedBarberId } : {})

  };

  const [totalScheduled, cancelledCount, mostPopularServiceRaw, busiestBarberRaw, selectedBarberEntity, recentBarbers] = await Promise.all([
    prisma.booking.count({
      where: {
        ...bookingRangeWhere,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_CONFIRMATION] }
      }
    }),
    prisma.booking.count({
      where: {
        ...bookingRangeWhere,
        status: { in: [BookingStatus.CANCELLED_BY_CLIENT, BookingStatus.CANCELLED_BY_SHOP] }
      }
    }),
    prisma.booking.groupBy({
      by: ['serviceId'],
      where: {
        ...bookingRangeWhere,
        status: BookingStatus.CONFIRMED
      },
      _count: { serviceId: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: 1
    }),
    selectedBarberId
      ? Promise.resolve([] as { barberId: string; _count: { barberId: number } }[])
      : prisma.booking.groupBy({
        by: ['barberId'],
        where: {
          ...bookingRangeWhere,
          status: BookingStatus.CONFIRMED
        },
        _count: { barberId: true },
        orderBy: { _count: { barberId: 'desc' } },
        take: 1
      }),
    selectedBarberId
      ? prisma.barber.findUnique({ where: { id: selectedBarberId }, select: { id: true, name: true } })
      : Promise.resolve(null),
    getRecentBarbers(shop.id, selectedRange.from, selectedRange.to)

  ]);

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

  const denominator = totalScheduled + cancelledCount;
  const cancelledRate = denominator > 0 ? (cancelledCount / denominator) * 100 : 0;

  return new Response(JSON.stringify({
    range,
    rangeBoundaries: {
      from: selectedRange.from.toISOString(),
      to: selectedRange.to.toISOString(),

      tz: ADMIN_TIMEZONE
    },
    bookingsCount: totalScheduled,
    cancelledRate,
        recentBarbers,
    selectedBarber: selectedBarberEntity,

    mostPopularService: mostPopularServiceTop && mostPopularServiceEntity
      ? { name: mostPopularServiceEntity.name, count: mostPopularServiceTop._count.serviceId }
      : null,
    busiestBarber: busiestBarberTop && busiestBarberEntity
      ? { name: busiestBarberEntity.name, count: busiestBarberTop._count.barberId }
      : null
  }));
};
