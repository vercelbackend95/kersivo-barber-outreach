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

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx); if (unauthorized) return unauthorized;
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
