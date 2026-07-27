export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminPermission } from '../../../lib/admin/auth';
import { findShopBarber } from '../../../lib/admin/shopScoped';
import { prisma } from '../../../lib/db/client';

const schema = z.object({
  id: z.string().optional(),
  barberId: z.string(),
  dayOfWeek: z.number().int().min(1).max(7),
  startMinutes: z.number().int().min(0).max(1440),
  endMinutes: z.number().int().min(1).max(1440),
  breakStartMin: z.number().int().optional().nullable(),
  breakEndMin: z.number().int().optional().nullable(),
  active: z.boolean().default(true),
});

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'catalog.manage');
  if (access instanceof Response) return access;

  const rows = await prisma.availabilityRule.findMany({
    where: { barber: { shopId: access.shopId } },
    orderBy: [{ barberId: 'asc' }, { dayOfWeek: 'asc' }],
  });
  return new Response(JSON.stringify({ rules: rows }));
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

  const { id, ...data } = parsed.data;

  if (id) {
    const existing = await prisma.availabilityRule.findFirst({
      where: { id, barber: { shopId: access.shopId } },
      select: { id: true },
    });
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Availability rule not found.' }), { status: 404 });
    }
    const rule = await prisma.availabilityRule.update({
      where: { id: existing.id },
      data: { ...data, barberId: barber.id },
    });
    return new Response(JSON.stringify({ rule }));
  }

  const rule = await prisma.availabilityRule.create({
    data: { ...data, barberId: barber.id },
  });
  return new Response(JSON.stringify({ rule }));
};
