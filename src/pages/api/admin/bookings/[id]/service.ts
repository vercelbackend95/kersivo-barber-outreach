export const prerender = false;

import type { APIRoute } from 'astro';
import { BookingStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { assertBookingAccessible } from '@/lib/admin/rbac/scope';
import { bookingWhereForShop, findShopService } from '@/lib/admin/shopScoped';
import { prisma } from '@/lib/db/client';
import { BookingActionError } from '@/lib/booking/service';
import { ensureSlotAvailable, SlotUnavailableError } from '@/lib/booking/slotGuard';
import { getEffectiveBookingStatus } from '@/lib/booking/operationalStatus';
import { addMinutes } from '@/lib/booking/time';

const EDITABLE_STATUSES = new Set<BookingStatus>([
  BookingStatus.BOOKED,
  BookingStatus.ARRIVED,
  BookingStatus.IN_PROGRESS,
]);

const patchServiceSchema = z.object({
  serviceId: z.string().min(1),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const PATCH: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requireAnyPermission(access, ['bookings.manage', 'bookings.self']);
  if (denied) return denied;

  const bookingId = ctx.params.id;
  if (!bookingId) {
    return json({ error: 'Missing booking id.' }, 400);
  }

  const scoped = await assertBookingAccessible(access, bookingId);
  if (scoped instanceof Response) return scoped;

  const payload = await ctx.request.json().catch(() => null);
  const parsed = patchServiceSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ error: 'Invalid payload: serviceId string required.' }, 400);
  }

  const { serviceId } = parsed.data;

  const [booking, service, settings] = await Promise.all([
    prisma.booking.findFirst({
      where: bookingWhereForShop(bookingId, access.shopId),
      select: {
        id: true,
        barberId: true,
        startAt: true,
        endAt: true,
        status: true,
      },
    }),
    findShopService(serviceId, access.shopId),
    prisma.shopSettings.findUniqueOrThrow({
      where: { id: access.shopId },
      select: { defaultBufferMinutes: true },
    }),
  ]);

  if (!booking) {
    return json({ error: 'Booking not found.' }, 404);
  }
  if (!service) {
    return json({ error: 'Service not found.' }, 404);
  }
  if (!service.isActive) {
    return json({ error: 'Service is not active.' }, 409);
  }

  const barberService = await prisma.barberService.findUnique({
    where: {
      barberId_serviceId: { barberId: booking.barberId, serviceId: service.id },
    },
    select: { serviceId: true },
  });
  if (!barberService) {
    return json({ error: 'Assigned barber does not provide this service.' }, 409);
  }

  if (!EDITABLE_STATUSES.has(booking.status)) {
    return json(
      { error: `Action is not allowed for booking in status ${booking.status}.` },
      422,
    );
  }

  const effectiveStatus = getEffectiveBookingStatus({
    status: booking.status,
    startAt: booking.startAt,
    endAt: booking.endAt,
  });
  if (effectiveStatus === 'COMPLETED') {
    return json(
      { error: 'Action is not allowed for booking in status COMPLETED.' },
      422,
    );
  }

  const newEndAt = addMinutes(
    booking.startAt,
    service.durationMinutes + (service.bufferMinutes || settings.defaultBufferMinutes),
  );

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        const current = await tx.booking.findFirst({
          where: {
            id: booking.id,
            status: { in: [...EDITABLE_STATUSES] },
            startAt: booking.startAt,
          },
          select: { id: true, barberId: true, startAt: true, status: true },
        });
        if (!current) {
          throw new BookingActionError(
            'Booking changed while updating service. Please refresh and try again.',
            409,
          );
        }

        await ensureSlotAvailable(tx, {
          barberId: current.barberId,
          startAt: current.startAt,
          endAt: newEndAt,
          ignoreBookingId: current.id,
        });

        return tx.booking.update({
          where: { id: current.id },
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
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return json({ booking: updated });
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return json({ error: error.message }, 409);
    }
    if (error instanceof BookingActionError) {
      return json({ error: error.message }, error.statusCode);
    }
    return json(
      { error: error instanceof Error ? error.message : 'Could not update booking service.' },
      400,
    );
  }
};
