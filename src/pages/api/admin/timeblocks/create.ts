export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../../lib/admin/auth';
import { prisma } from '../../../../lib/db/client';

const schema = z.object({
  title: z.string().min(1).max(80),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  barberId: z.string().optional().nullable()
});

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const parsed = schema.safeParse(await ctx.request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });

  const { title, startAt, endAt, barberId } = parsed.data;
  const start = new Date(startAt);
  const end = new Date(endAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return new Response(JSON.stringify({ error: 'Invalid block range.' }), { status: 400 });
  }

  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });

  if (barberId) {
    const barber = await prisma.barber.findUnique({ where: { id: barberId }, select: { id: true } });
    if (!barber) return new Response(JSON.stringify({ error: 'Barber not found.' }), { status: 404 });
  }

  const timeBlock = await prisma.timeBlock.create({
    data: {
      shopId: shop.id,
      barberId: barberId ?? null,
      title,
      startAt: start,
      endAt: end
    },
    include: { barber: { select: { id: true, name: true } } }
  });

  return new Response(JSON.stringify({ timeBlock }));
};
