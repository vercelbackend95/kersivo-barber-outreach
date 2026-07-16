export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminContext } from '../../../../../lib/admin/auth';
import { findShopBarber } from '../../../../../lib/admin/shopScoped';
import { prisma } from '../../../../../lib/db/client';

const schema = z.object({ serviceIds: z.array(z.string()) });

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;

  const barberId = ctx.params.id;
  if (!barberId) {
    return new Response(JSON.stringify({ error: 'Missing barber id.' }), { status: 400 });
  }

  const barber = await findShopBarber(barberId, access.shopId);
  if (!barber) {
    return new Response(JSON.stringify({ error: 'Barber not found.' }), { status: 404 });
  }

  const links = await prisma.barberService.findMany({
    where: { barberId: barber.id },
    select: { serviceId: true },
  });
  return new Response(JSON.stringify({ serviceIds: links.map((link) => link.serviceId) }));
};

export const PUT: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;

  const barberId = ctx.params.id;
  if (!barberId) {
    return new Response(JSON.stringify({ error: 'Missing barber id.' }), { status: 400 });
  }

  const barber = await findShopBarber(barberId, access.shopId);
  if (!barber) {
    return new Response(JSON.stringify({ error: 'Barber not found.' }), { status: 404 });
  }

  const parsed = schema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  const uniqueServiceIds = Array.from(new Set(parsed.data.serviceIds));

  if (uniqueServiceIds.length > 0) {
    const shopServices = await prisma.service.findMany({
      where: { shopId: access.shopId, id: { in: uniqueServiceIds } },
      select: { id: true },
    });
    if (shopServices.length !== uniqueServiceIds.length) {
      return new Response(JSON.stringify({ error: 'One or more services are invalid for this shop.' }), {
        status: 400,
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.barberService.deleteMany({ where: { barberId: barber.id } });
    if (uniqueServiceIds.length > 0) {
      await tx.barberService.createMany({
        data: uniqueServiceIds.map((serviceId) => ({ barberId: barber.id, serviceId })),
        skipDuplicates: true,
      });
    }
  });

  return new Response(JSON.stringify({ serviceIds: uniqueServiceIds }));
};
