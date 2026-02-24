export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../../lib/admin/auth';
import { prisma } from '../../../../../../lib/db/client';
import { resolveShopId } from '../../../../../../lib/db/shopScope';

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const shopId = await resolveShopId();
  const orderId = ctx.params.id;
  if (!orderId) return new Response(JSON.stringify({ error: 'Order ID required' }), { status: 400 });

  const order = await prisma.order.findFirst({
    where: { id: orderId, shopId },
    include: {
      items: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          nameSnapshot: true,
          unitPricePenceSnapshot: true,
          quantity: true,
          lineTotalPence: true
        }
      }
    }
  });

  if (!order) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 });

  return new Response(JSON.stringify({ order }), { status: 200 });
};
