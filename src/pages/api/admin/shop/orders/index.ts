export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';
import { resolveShopId } from '../../../../../lib/db/shopScope';

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const shopId = await resolveShopId();
  const orders = await prisma.order.findMany({
    where: { shopId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      customerEmail: true,
      status: true,
      totalPence: true,
      currency: true,
      createdAt: true,
      _count: { select: { items: true } }
    }
  });

  return new Response(JSON.stringify({ orders }), { status: 200 });
};
