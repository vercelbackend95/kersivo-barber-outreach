import type { APIRoute } from 'astro';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { requireAdmin } from '../../../lib/admin/auth';
import { prisma } from '../../../lib/db/client';
import { BookingStatus } from '@prisma/client';

const ADMIN_TIMEZONE = 'Europe/London';


function getLondonDayRange(date: string) {
    const startAt = fromZonedTime(`${date}T00:00:00.000`, ADMIN_TIMEZONE);
  return {
    gte: startAt,
    lt: new Date(startAt.getTime() + 24 * 60 * 60 * 1000)

  };
}
function getTodayRangeInLondon() {
  const todayInLondon = formatInTimeZone(new Date(), ADMIN_TIMEZONE, 'yyyy-MM-dd');
  return getLondonDayRange(todayInLondon);
}


export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx); if (unauthorized) return unauthorized;
  const view = ctx.url.searchParams.get('view');

  if (view === 'history') {
    const barberId = ctx.url.searchParams.get('barberId');
    const from = ctx.url.searchParams.get('from');
    const to = ctx.url.searchParams.get('to');
    const limit = Math.min(Math.max(Number(ctx.url.searchParams.get('limit') || '50'), 1), 100);
    const cursor = ctx.url.searchParams.get('cursor');
    const [cursorStartAt, cursorId] = cursor ? cursor.split('|') : [null, null];
    const startAtFilter = from && to
      ? { gte: getLondonDayRange(from).gte, lt: getLondonDayRange(to).lt }

      : undefined;

    const bookings = await prisma.booking.findMany({
      where: {
        barberId: barberId && barberId !== 'all' ? barberId : undefined,
        startAt: startAtFilter,
        ...(cursorStartAt && cursorId ? {
          OR: [
            { startAt: { lt: new Date(cursorStartAt) } },
            { startAt: new Date(cursorStartAt), id: { lt: cursorId } }
          ]
        } : {})
      },
      include: { barber: true, service: true },
      orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
      take: limit + 1
    });

    const hasMore = bookings.length > limit;
    const page = hasMore ? bookings.slice(0, limit) : bookings;
    const nextCursor = hasMore
      ? `${page[page.length - 1]?.startAt.toISOString() ?? ''}|${page[page.length - 1]?.id ?? ''}`
      : null;

    return new Response(JSON.stringify({ bookings: page, hasMore, cursor: nextCursor }));
  }
  if (view === 'stats') {
    const barberId = ctx.url.searchParams.get('barberId');
    if (!barberId) {
      return new Response(JSON.stringify({ error: 'Missing barberId.' }), { status: 400 });
    }

    const totalBookingsServed = await prisma.booking.count({
      where: {
        barberId,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.EXPIRED, BookingStatus.RESCHEDULED] }
      }
    });

    return new Response(JSON.stringify({ totalBookingsServed }));
  }



  const q = ctx.url.searchParams.get('q');
  const status = ctx.url.searchParams.get('status');
  const date = ctx.url.searchParams.get('date');
  const range = ctx.url.searchParams.get('range');

  const startAtRange = range === 'today'
    ? getTodayRangeInLondon()
    : date
      ? getLondonDayRange(date)

      : undefined;

  const bookings = await prisma.booking.findMany({
    where: {
      status: status || undefined,
      OR: q ? [{ fullName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] : undefined,
      startAt: startAtRange
    },
    include: { barber: true, service: true },
    orderBy: { startAt: 'asc' }
  });

  return new Response(JSON.stringify({ bookings }));
};
