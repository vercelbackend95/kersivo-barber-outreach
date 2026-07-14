export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';

const DEFAULT_ORDERS_LIMIT = 50;
const MAX_ORDERS_LIMIT = 100;

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;
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
