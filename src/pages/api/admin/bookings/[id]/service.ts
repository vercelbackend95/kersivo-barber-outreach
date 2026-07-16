export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '../../../../../lib/admin/auth';
import { bookingWhereForShop, findShopService } from '../../../../../lib/admin/shopScoped';
import { prisma } from '../../../../../lib/db/client';

export const PATCH: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;

  const bookingId = ctx.params.id;
  if (!bookingId) {
    return new Response(JSON.stringify({ error: 'Missing booking id.' }), { status: 400 });
  }

  const payload = (await ctx.request.json().catch(() => null)) as {
    serviceId?: unknown;
  } | null;
  if (!payload || typeof payload.serviceId !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid payload: serviceId string required.' }), {
      status: 400,
    });
  }

  const { serviceId } = payload;

  const [booking, service] = await Promise.all([
    prisma.booking.findFirst({
      where: bookingWhereForShop(bookingId, access.shopId),
      select: { id: true, startAt: true, status: true },
    }),
    findShopService(serviceId, access.shopId),
  ]);

  if (!booking) {
    return new Response(JSON.stringify({ error: 'Booking not found.' }), { status: 404 });
  }
  if (!service) {
    return new Response(JSON.stringify({ error: 'Service not found.' }), { status: 404 });
  }

  const newEndAt = new Date(
    new Date(booking.startAt).getTime() + service.durationMinutes * 60 * 1000,
  );

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      serviceId: service.id,
      serviceNameAtBooking: service.name,
      servicePricePenceAtBooking: service.pricePence,
      serviceDurationMinutesAtBooking: service.durationMinutes,
      totalPricePence: service.pricePence,
      endAt: newEndAt,
    },
    select: {
      id: true,
      serviceId: true,
      serviceNameAtBooking: true,
      servicePricePenceAtBooking: true,
      serviceDurationMinutesAtBooking: true,
      totalPricePence: true,
      endAt: true,
      updatedAt: true,
    },
  });

  return new Response(JSON.stringify({ booking: updated }));
};
