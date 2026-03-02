export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';

const schema = z.object({ serviceIds: z.array(z.string()) });

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const barberId = ctx.params.id;
  if (!barberId) return new Response(JSON.stringify({ error: 'Missing barber id.' }), { status: 400 });

  const links = await prisma.barberService.findMany({ where: { barberId }, select: { serviceId: true } });
  return new Response(JSON.stringify({ serviceIds: links.map((link) => link.serviceId) }));
};

export const PUT: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const barberId = ctx.params.id;
  if (!barberId) return new Response(JSON.stringify({ error: 'Missing barber id.' }), { status: 400 });

  const parsed = schema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  const uniqueServiceIds = Array.from(new Set(parsed.data.serviceIds));

  await prisma.$transaction(async (tx) => {
    await tx.barberService.deleteMany({ where: { barberId } });
    if (uniqueServiceIds.length > 0) {
      await tx.barberService.createMany({
        data: uniqueServiceIds.map((serviceId) => ({ barberId, serviceId })),
        skipDuplicates: true
      });
    }
  });

  return new Response(JSON.stringify({ serviceIds: uniqueServiceIds }));
};
