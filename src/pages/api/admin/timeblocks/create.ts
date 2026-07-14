export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminContext } from '../../../../lib/admin/auth';
import { prisma } from '../../../../lib/db/client';
import { getTimeBlockDelegate } from '../../../../lib/db/timeBlocks';

const schema = z.object({
  title: z.string().min(1).max(80),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  barberId: z.string().optional().nullable()
});

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;

  const parsed = schema.safeParse(await ctx.request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });

  const { title, startAt, endAt, barberId } = parsed.data;
  const start = new Date(startAt);
  const end = new Date(endAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return new Response(JSON.stringify({ error: 'Invalid block range.' }), { status: 400 });
  }

  const shopId = access.shopId;

  if (barberId) {
    const barber = await prisma.barber.findFirst({ where: { id: barberId, shopId }, select: { id: true } });
    if (!barber) return new Response(JSON.stringify({ error: 'Barber not found.' }), { status: 404 });
  }

  const timeBlockDelegate = getTimeBlockDelegate();
  if (!timeBlockDelegate) {
    return new Response(JSON.stringify({ error: 'Prisma client is missing the timeBlock delegate. Run `npx prisma generate`.' }), { status: 500 });
  }

  const timeBlock = await timeBlockDelegate.create({

    data: {
      shopId,
      barberId: barberId ?? null,
      title,
      startAt: start,
      endAt: end
    },
    include: { barber: { select: { id: true, name: true } } }
  });

  return new Response(JSON.stringify({ timeBlock }));
};
