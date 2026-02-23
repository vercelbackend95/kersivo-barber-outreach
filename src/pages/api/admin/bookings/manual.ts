import type { APIRoute } from 'astro';
import { bookingCreateSchema } from '../../../../lib/booking/schemas';
import { requireAdmin } from '../../../../lib/admin/auth';
import { prisma } from '../../../../lib/db/client';
import { addMinutes, toUtcFromLondon } from '../../../../lib/booking/time';
import { BookingStatus } from '@prisma/client';

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx); if (unauthorized) return unauthorized;
  const parsed = bookingCreateSchema.safeParse(await ctx.request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });

  const settings = await prisma.shopSettings.findFirstOrThrow();
  const service = await prisma.service.findUniqueOrThrow({ where: { id: parsed.data.serviceId } });
  const [h, m] = parsed.data.time.split(':').map(Number);
  const startAt = toUtcFromLondon(parsed.data.date, h * 60 + m);
  const endAt = addMinutes(startAt, service.durationMinutes + (service.bufferMinutes || settings.defaultBufferMinutes));

  const booking = await prisma.booking.create({
    data: {
      serviceId: parsed.data.serviceId,
      barberId: parsed.data.barberId,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      startAt,
      endAt,
      status: BookingStatus.CONFIRMED,
      manageTokenHash: `manual-${Date.now()}`
    }
  });

  return new Response(JSON.stringify({ booking }));
};
