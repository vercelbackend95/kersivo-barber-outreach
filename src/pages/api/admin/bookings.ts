import type { APIRoute } from 'astro';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { requireAdmin } from '../../../lib/admin/auth';
import { prisma } from '../../../lib/db/client';

const ADMIN_TIMEZONE = 'Europe/London';

function getTodayRangeInLondon() {
  const todayInLondon = formatInTimeZone(new Date(), ADMIN_TIMEZONE, 'yyyy-MM-dd');
  return {
    gte: fromZonedTime(`${todayInLondon}T00:00:00.000`, ADMIN_TIMEZONE),
    lt: fromZonedTime(`${todayInLondon}T23:59:59.999`, ADMIN_TIMEZONE)
  };
}
function getLondonDayRange(date: string) {
  return {
    gte: fromZonedTime(`${date}T00:00:00.000`, ADMIN_TIMEZONE),
    lte: fromZonedTime(`${date}T23:59:59.999`, ADMIN_TIMEZONE)
  };
}

function getHistoryPresetRange(preset: string | null) {
  const todayInLondon = formatInTimeZone(new Date(), ADMIN_TIMEZONE, 'yyyy-MM-dd');
  const todayStart = fromZonedTime(`${todayInLondon}T00:00:00.000`, ADMIN_TIMEZONE);

  if (preset === 'last30') {
    return {
      from: formatInTimeZone(new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000), ADMIN_TIMEZONE, 'yyyy-MM-dd'),
      to: todayInLondon
    };
  }
  if (preset === 'overall') return { from: null, to: null };
  return {
    from: formatInTimeZone(new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000), ADMIN_TIMEZONE, 'yyyy-MM-dd'),
    to: todayInLondon
  };
}


export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx); if (unauthorized) return unauthorized;
  const view = ctx.url.searchParams.get('view');

  if (view === 'history') {
    const barberId = ctx.url.searchParams.get('barberId');
    const preset = ctx.url.searchParams.get('preset');
    const from = ctx.url.searchParams.get('from');
    const to = ctx.url.searchParams.get('to');
    const limit = Math.min(Math.max(Number(ctx.url.searchParams.get('limit') || '50'), 1), 100);
    const cursor = ctx.url.searchParams.get('cursor');
    const [cursorStartAt, cursorId] = cursor ? cursor.split('|') : [null, null];

    const fallbackRange = getHistoryPresetRange(preset);
    const effectiveFrom = from ?? fallbackRange.from;
    const effectiveTo = to ?? fallbackRange.to;
    const startAtFilter = effectiveFrom && effectiveTo
      ? { ...getLondonDayRange(effectiveFrom), ...{ lte: getLondonDayRange(effectiveTo).lte } }
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


  const q = ctx.url.searchParams.get('q');
  const status = ctx.url.searchParams.get('status');
  const date = ctx.url.searchParams.get('date');
  const range = ctx.url.searchParams.get('range');

  const startAtRange = range === 'today'
    ? getTodayRangeInLondon()
    : date
      ? { gte: new Date(`${date}T00:00:00.000Z`), lt: new Date(`${date}T23:59:59.999Z`) }
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
