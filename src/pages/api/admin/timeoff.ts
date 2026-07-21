export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminPermission } from '../../../lib/admin/auth';
import { findShopBarber } from '../../../lib/admin/shopScoped';
import { prisma } from '../../../lib/db/client';

const schema = z.object({
  id: z.string().optional(),
  barberId: z.string(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().optional(),
});

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'catalog.manage');
  if (access instanceof Response) return access;

  const rows = await prisma.barberTimeOff.findMany({
    where: { barber: { shopId: access.shopId } },
    orderBy: { startsAt: 'asc' },
  });
  return new Response(JSON.stringify({ timeOff: rows }));
};

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'catalog.manage');
  if (access instanceof Response) return access;

  const parsed = schema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  const barber = await findShopBarber(parsed.data.barberId, access.shopId);
  if (!barber) {
    return new Response(JSON.stringify({ error: 'Barber not found.' }), { status: 404 });
  }

  const { id, startsAt, endsAt, ...data } = parsed.data;
  const payload = { ...data, barberId: barber.id, startsAt: new Date(startsAt), endsAt: new Date(endsAt) };

  if (id) {
    const existing = await prisma.barberTimeOff.findFirst({
      where: { id, barber: { shopId: access.shopId } },
      select: { id: true },
    });
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Time off not found.' }), { status: 404 });
    }
    const row = await prisma.barberTimeOff.update({ where: { id: existing.id }, data: payload });
    return new Response(JSON.stringify({ timeOff: row }));
  }

  const row = await prisma.barberTimeOff.create({ data: payload });
  return new Response(JSON.stringify({ timeOff: row }));
};
