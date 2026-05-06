export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';

export const PATCH: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

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
    prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, startAt: true, status: true },
    }),
    prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        name: true,
        pricePence: true,
        durationMinutes: true,
      },
    }),
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
    where: { id: bookingId },
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
