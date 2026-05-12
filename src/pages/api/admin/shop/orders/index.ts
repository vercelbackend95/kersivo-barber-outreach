export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';
import { resolveShopId } from '../../../../../lib/db/shopScope';

const DEFAULT_ORDERS_LIMIT = 50;
const MAX_ORDERS_LIMIT = 100;

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const shopId = await resolveShopId();
  const requestedLimit = Number(ctx.url.searchParams.get('limit') ?? DEFAULT_ORDERS_LIMIT);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_ORDERS_LIMIT)
    : DEFAULT_ORDERS_LIMIT;
  const orders = await prisma.order.findMany({
    where: { shopId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    select: {
      id: true,
      customerEmail: true,
      status: true,
      totalPence: true,
      currency: true,
      createdAt: true,
      paidAt: true,
      _count: { select: { items: true } }
    }
  });

  return new Response(JSON.stringify({
    orders: orders.slice(0, limit),
    hasMore: orders.length > limit
  }), { status: 200 });
};
