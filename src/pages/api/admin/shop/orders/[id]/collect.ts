export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../../lib/admin/auth';
import { prisma } from '../../../../../../lib/db/client';
import { resolveShopId } from '../../../../../../lib/db/shopScope';

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const shopId = await resolveShopId();
  const orderId = ctx.params.id;
  if (!orderId) return new Response(JSON.stringify({ error: 'Order ID required' }), { status: 400 });

  const order = await prisma.order.findFirst({ where: { id: orderId, shopId }, select: { id: true, status: true } });
  if (!order) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 });
  if (order.status !== 'PAID') return new Response(JSON.stringify({ error: 'Only PAID orders can be collected' }), { status: 400 });

  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'COLLECTED', collectedAt: new Date() }
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
