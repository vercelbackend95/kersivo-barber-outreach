export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminPermission } from '../../../../lib/admin/auth';
import { runSerializableTransaction } from '../../../../lib/db/serializableTransaction';

const deleteSchema = z.object({ id: z.string().min(1) });

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'catalog.manage');
  if (access instanceof Response) return access;
  const shopId = access.shopId;

  const parsed = deleteSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  try {
    const deleted = await runSerializableTransaction(async (tx) => {
      const existing = await tx.barber.findFirst({
        where: { id: parsed.data.id, shopId },
        select: { id: true }
      });

      if (!existing) {
        throw new Error('Barber not found.');
      }

      const bookingCount = await tx.booking.count({
        where: { barberId: parsed.data.id }
      });

      if (bookingCount > 0) {
        throw new Error('BARBER_HAS_BOOKINGS');
      }

      const removedBarber = await tx.barber.delete({
        where: { id: parsed.data.id }
      });

      const remainingBarbers = await tx.barber.findMany({
        where: { shopId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true }
      });

      await Promise.all(
        remainingBarbers.map((barber, index) => tx.barber.update({
          where: { id: barber.id },
          data: { sortOrder: index }
        }))
      );

      return removedBarber;
    });

    return new Response(JSON.stringify({ ok: true, barber: deleted }), { status: 200 });
  } catch (error) {
    console.error('Failed to delete barber', error);

    if (error instanceof Error && error.message === 'Barber not found.') {
      return new Response(JSON.stringify({ error: error.message }), { status: 404 });
    }

    if (error instanceof Error && error.message === 'BARBER_HAS_BOOKINGS') {
      return new Response(JSON.stringify({ error: 'Barber cannot be deleted because it is linked to existing bookings.' }), { status: 409 });
    }

    if (typeof error === 'object' && error && 'code' in error && (error as { code?: string }).code === 'P2003') {
      return new Response(JSON.stringify({ error: 'Barber cannot be deleted because it is linked to existing bookings.' }), { status: 409 });
    }

    return new Response(JSON.stringify({ error: 'Unable to delete barber.' }), { status: 500 });
  }
};
