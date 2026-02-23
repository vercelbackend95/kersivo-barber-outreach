import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin/auth';
import { prisma } from '../../../lib/db/client';

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx); if (unauthorized) return unauthorized;
  const q = ctx.url.searchParams.get('q');
  const status = ctx.url.searchParams.get('status');
  const date = ctx.url.searchParams.get('date');

  const bookings = await prisma.booking.findMany({
    where: {
      status: status || undefined,
      OR: q ? [{ fullName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] : undefined,
      startAt: date ? { gte: new Date(`${date}T00:00:00.000Z`), lt: new Date(`${date}T23:59:59.999Z`) } : undefined
    },
    include: { barber: true, service: true },
    orderBy: { startAt: 'asc' }
  });

  return new Response(JSON.stringify({ bookings }));
};
