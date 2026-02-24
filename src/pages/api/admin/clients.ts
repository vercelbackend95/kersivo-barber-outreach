export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin/auth';
import { prisma } from '../../../lib/db/client';

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx); if (unauthorized) return unauthorized;
  const query = ctx.url.searchParams.get('query')?.trim();

  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });

  const clients = await prisma.client.findMany({
    where: {
      shopId: shop.id,
      ...(query ? {
      OR: [
        { email: { contains: query, mode: 'insensitive' } },
        { fullName: { contains: query, mode: 'insensitive' } }
      ]
    } : {})
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      updatedAt: true
    }
  });

  return new Response(JSON.stringify({ clients }));
};
