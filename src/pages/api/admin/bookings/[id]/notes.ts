export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '../../../../../lib/admin/auth';
import { bookingWhereForShop } from '../../../../../lib/admin/shopScoped';
import { prisma } from '../../../../../lib/db/client';

export const PATCH: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;

  const bookingId = ctx.params.id;
  if (!bookingId) {
    return new Response(JSON.stringify({ error: 'Missing booking id.' }), { status: 400 });
  }

  const payload = (await ctx.request.json().catch(() => null)) as { notes?: unknown } | null;
  if (!payload || typeof payload.notes !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid notes payload.' }), { status: 400 });
  }

  const booking = await prisma.booking.findFirst({
    where: bookingWhereForShop(bookingId, access.shopId),
    select: { id: true },
  });

  if (!booking) {
    return new Response(JSON.stringify({ error: 'Booking not found.' }), { status: 404 });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { notes: payload.notes },
    select: { id: true, notes: true, updatedAt: true },
  });

  return new Response(JSON.stringify({ booking: updated }));
};
