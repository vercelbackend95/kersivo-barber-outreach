export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';

const CANCELLED_STATUSES = ['CANCELLED_BY_CLIENT', 'CANCELLED_BY_SHOP'] as const;

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx); if (unauthorized) return unauthorized;
  const clientId = ctx.params.clientId;
  if (!clientId) return new Response(JSON.stringify({ error: 'Missing client id.' }), { status: 400 });

  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });

  const client = await prisma.client.findFirst({
    where: { id: clientId, shopId: shop.id },
    include: {
      bookings: {
        orderBy: { startAt: 'desc' },
        take: 10,
        include: { barber: true, service: true }
      }
    }
  });

  if (!client) return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404 });

  const [totalBookings, lastBooking, cancelledCount] = await Promise.all([
    prisma.booking.count({ where: { clientId } }),
    prisma.booking.findFirst({ where: { clientId }, orderBy: { startAt: 'desc' }, select: { startAt: true } }),
    prisma.booking.count({ where: { clientId, status: { in: [...CANCELLED_STATUSES] } } })
  ]);

  return new Response(JSON.stringify({
    client,
    stats: {
      totalBookings,
      lastBookingAt: lastBooking?.startAt ?? null,
      cancelledCount
    },
    recentBookings: client.bookings
  }));
};
