export const prerender = false;

import type { APIRoute } from 'astro';
import { bookingCreateSchema } from '../../../../lib/booking/schemas';
import { requireAdmin } from '../../../../lib/admin/auth';
import { prisma } from '../../../../lib/db/client';
import { addMinutes, toUtcFromLondon } from '../../../../lib/booking/time';
import { BookingStatus, Prisma } from '@prisma/client';

async function upsertClient(tx: Prisma.TransactionClient, input: { email: string; fullName: string; phone?: string }) {
  const shop = await tx.shopSettings.findFirstOrThrow({ select: { id: true } });
  return tx.client.upsert({
    where: { shopId_email: { shopId: shop.id, email: input.email } },
    update: {
      fullName: input.fullName,
      phone: input.phone ?? null
    },
    create: {
      shopId: shop.id,
      email: input.email,
      fullName: input.fullName,
      phone: input.phone ?? null
    }
  });
}


export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx); if (unauthorized) return unauthorized;
  const parsed = bookingCreateSchema.safeParse(await ctx.request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });

  const settings = await prisma.shopSettings.findFirstOrThrow();
  const service = await prisma.service.findUniqueOrThrow({ where: { id: parsed.data.serviceId } });
  const [h, m] = parsed.data.time.split(':').map(Number);
  const startAt = toUtcFromLondon(parsed.data.date, h * 60 + m);
  const endAt = addMinutes(startAt, service.durationMinutes + (service.bufferMinutes || settings.defaultBufferMinutes));

  const booking = await prisma.$transaction(async (tx) => {
    const client = await upsertClient(tx, {
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone

  });
    return tx.booking.create({
      data: {
        service: { connect: { id: parsed.data.serviceId } },
        barber: { connect: { id: parsed.data.barberId } },
        client: { connect: { id: client.id } },
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        startAt,
        endAt,
        status: BookingStatus.CONFIRMED,
        manageTokenHash: `manual-${Date.now()}`
      },
      include: { service: true, barber: true }
    });

  return new Response(JSON.stringify({ booking }));
};
