export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '../../../../../../lib/admin/auth';
import { prisma } from '../../../../../../lib/db/client';

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;
  const orderId = ctx.params.id;
  if (!orderId) return new Response(JSON.stringify({ error: 'Order ID required' }), { status: 400 });

  const order = await prisma.order.findFirst({
    where: { id: orderId, shopId },
    select: { id: true, status: true, isTestOrder: true },
  });
  if (!order) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 });

  const canCollect = order.status === 'PAID' || order.status === 'READY_FOR_PICKUP';

  if (!canCollect) {
    return new Response(JSON.stringify({ error: 'Only paid orders can be collected' }), {
      status: 400,
    });
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: 'COLLECTED', collectedAt: new Date() },
    select: {
      id: true,
      status: true,
      isTestOrder: true,
      collectedAt: true,
    },
  });

  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: { retailTestOrderId: true, retailPickupWalkthroughCompletedAt: true },
  });

  if (
    shop?.retailTestOrderId === order.id &&
    !shop.retailPickupWalkthroughCompletedAt
  ) {
    await prisma.shopSettings.update({
      where: { id: shopId },
      data: { retailPickupWalkthroughCompletedAt: new Date() },
    });
  }

  return new Response(JSON.stringify({ ok: true, order: updated }), { status: 200 });
};
