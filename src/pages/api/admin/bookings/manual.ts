export const prerender = false;

import type { APIRoute } from 'astro';
import { bookingCreateSchema } from '../../../../lib/booking/schemas';
import { requireAdminContext } from '../../../../lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { requireLinkedBarber } from '@/lib/admin/rbac/scope';
import { findShopBarber, findShopService } from '../../../../lib/admin/shopScoped';
import { prisma } from '../../../../lib/db/client';
import { addMinutes, toUtcFromLondon } from '../../../../lib/booking/time';
import { BookingStatus, Prisma } from '@prisma/client';

async function upsertClient(
  tx: Prisma.TransactionClient,
  shopId: string,
  input: { email: string; fullName: string; phone?: string },
) {
  return tx.client.upsert({
    where: { shopId_email: { shopId, email: input.email } },
    update: {
      fullName: input.fullName,
      phone: input.phone ?? null,
    },
    create: {
      shopId,
      email: input.email,
      fullName: input.fullName,
      phone: input.phone ?? null,
    },
  });
}

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requireAnyPermission(access, ['bookings.manage', 'bookings.self']);
  if (denied) return denied;

  const linked = requireLinkedBarber(access);
  if (linked) return linked;

  const parsed = bookingCreateSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  if (access.role === 'BARBER' && access.barberId && parsed.data.barberId !== access.barberId) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const settings = await prisma.shopSettings.findUniqueOrThrow({
    where: { id: access.shopId },
  });

  const [service, barber] = await Promise.all([
    findShopService(parsed.data.serviceId, access.shopId),
    findShopBarber(parsed.data.barberId, access.shopId),
  ]);

  if (!service) {
    return new Response(JSON.stringify({ error: 'Service not found.' }), { status: 404 });
  }
  if (!barber) {
    return new Response(JSON.stringify({ error: 'Barber not found.' }), { status: 404 });
  }
  if (!service.isActive) {
    return new Response(JSON.stringify({ error: 'Selected service is inactive.' }), { status: 400 });
  }

  const [h, m] = parsed.data.time.split(':').map(Number);
  const startAt = toUtcFromLondon(parsed.data.date, h * 60 + m);
  const endAt = addMinutes(
    startAt,
    service.durationMinutes + (service.bufferMinutes || settings.defaultBufferMinutes),
  );

  const booking = await prisma.$transaction(async (tx) => {
    const client = await upsertClient(tx, access.shopId, {
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
    });
    return tx.booking.create({
      data: {
        service: { connect: { id: service.id } },
        barber: { connect: { id: barber.id } },
        client: { connect: { id: client.id } },
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        startAt,
        endAt,
        serviceNameAtBooking: service.name,
        servicePricePenceAtBooking: service.pricePence,
        serviceDurationMinutesAtBooking: service.durationMinutes,
        totalPricePence: service.pricePence,
        status: BookingStatus.BOOKED,
        manageTokenHash: `manual-${Date.now()}`,
      },
      include: { service: true, barber: true },
    });
  });

  return new Response(JSON.stringify({ booking }));
};
