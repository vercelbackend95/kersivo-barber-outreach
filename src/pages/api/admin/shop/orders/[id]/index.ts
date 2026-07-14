export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '../../../../../../lib/admin/auth';
import { prisma } from '../../../../../../lib/db/client';

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;
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
