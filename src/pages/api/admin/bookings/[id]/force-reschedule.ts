export const prerender = false;

import type { APIRoute } from 'astro';
import { BookingStatus, Prisma } from '@prisma/client';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { bookingCreateSchema } from '@/lib/booking/schemas';
import { BookingActionError } from '@/lib/booking/service';
import { prisma } from '@/lib/db/client';
import { findShopBarber, findShopService } from '@/lib/admin/shopScoped';
import { addMinutes, toUtcFromLondon } from '@/lib/booking/time';
import { smsReminderClearData } from '@/lib/sms/reminders';
import { emailReminderClearData } from '@/lib/email/reminders';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Shop-forced reschedule: moves time without consuming clientRescheduleCount.
 */
export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requireAnyPermission(access, ['bookings.manage']);
  if (denied) return denied;

  const bookingId = ctx.params.id;
  if (!bookingId) return json({ error: 'Missing booking id.' }, 400);

  const body = await ctx.request.json().catch(() => null);
  const parsed = bookingCreateSchema
    .pick({ serviceId: true, barberId: true, date: true, time: true })
    .safeParse(body);
  if (!parsed.success) return json({ error: 'Invalid request', issues: parsed.error.flatten() }, 400);

  const existing = await prisma.booking.findFirst({
    where: { id: bookingId, barber: { shopId: access.shopId } },
    include: { barber: true, service: true },
  });
  if (!existing) return json({ error: 'Booking not found.' }, 404);
  if (existing.status === BookingStatus.PENDING_PAYMENT) {
    return json({ error: 'Cannot force-reschedule an unpaid deposit hold.' }, 409);
  }

  const settings = await prisma.shopSettings.findUniqueOrThrow({ where: { id: access.shopId } });
  const service = await findShopService(parsed.data.serviceId, access.shopId);
  const barber = await findShopBarber(parsed.data.barberId, access.shopId);
  if (!service || !barber) return json({ error: 'Service or barber not found.' }, 404);

  const [h, m] = parsed.data.time.split(':').map(Number);
  const startAt = toUtcFromLondon(parsed.data.date, h * 60 + m);
  const endAt = addMinutes(
    startAt,
    service.durationMinutes + (service.bufferMinutes || settings.defaultBufferMinutes),
  );

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        const overlapping = await tx.booking.findFirst({
          where: {
            barberId: barber.id,
            id: { not: existing.id },
            status: { in: [BookingStatus.BOOKED, BookingStatus.PENDING_PAYMENT] },
            NOT: [{ endAt: { lte: startAt } }, { startAt: { gte: endAt } }],
          },
        });
        if (overlapping) throw new BookingActionError('This slot is no longer available.', 409);

        return tx.booking.update({
          where: { id: existing.id },
          data: {
            service: { connect: { id: service.id } },
            barber: { connect: { id: barber.id } },
            startAt,
            endAt,
            serviceNameAtBooking: service.name,
            servicePricePenceAtBooking: service.pricePence,
            serviceDurationMinutesAtBooking: service.durationMinutes,
            totalPricePence: service.pricePence,
            rescheduledAt: new Date(),
            originalStartAt: existing.originalStartAt ?? existing.startAt,
            originalEndAt: existing.originalEndAt ?? existing.endAt,
            status: BookingStatus.BOOKED,
            ...smsReminderClearData,
            ...emailReminderClearData,
          },
          include: { service: true, barber: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return json({ booking: { id: updated.id, startAt: updated.startAt, status: updated.status } });
  } catch (error) {
    if (error instanceof BookingActionError) return json({ error: error.message }, error.statusCode);
    return json({ error: error instanceof Error ? error.message : 'Reschedule failed.' }, 400);
  }
};
