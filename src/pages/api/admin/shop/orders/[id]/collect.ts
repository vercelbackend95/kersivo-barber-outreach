export const prerender = false;

import type { APIRoute } from 'astro';
import { prisma } from '../../../../../../lib/db/client';
import { requireAdminPermissionAndCapability } from '@/lib/admin/productCapability';
import { isCollectableOrderStatus, isUnpaidReservation } from '@/lib/shop/retailPaymentMode';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

/**
 * Hand an order over at the counter.
 * - Paid orders (PAID / READY_FOR_PICKUP) → COLLECTED.
 * - Pay-at-collection reservations (RESERVED_UNPAID) need `{ paymentTakenInShop: true }`:
 *   they become COLLECTED with paidAt = now, which is when Sales starts counting them.
 */
export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminPermissionAndCapability(ctx, 'retail.manage', 'RETAIL');
  if (access instanceof Response) return access;
  const shopId = access.shopId;
  const orderId = ctx.params.id;
  if (!orderId) return json({ error: 'Order ID required' }, 400);

  const body = (await ctx.request.json().catch(() => null)) as { paymentTakenInShop?: unknown } | null;
  const paymentTakenInShop = body?.paymentTakenInShop === true;

  const order = await prisma.order.findFirst({
    where: { id: orderId, shopId },
    select: { id: true, status: true, isTestOrder: true },
  });
  if (!order) return json({ error: 'Order not found' }, 404);

  if (!isCollectableOrderStatus(order.status)) {
    return json({ error: 'Only paid or reserved orders can be collected' }, 400);
  }

  const unpaid = isUnpaidReservation(order.status);
  if (unpaid && !paymentTakenInShop) {
    return json(
      {
        error: 'This order has not been paid. Take payment in the shop, then mark it paid and collected.',
        code: 'payment_not_taken',
      },
      409,
    );
  }

  const now = new Date();
  // CAS on the status we read, so a double tap or a concurrent change cannot apply twice.
  const changed = await prisma.order.updateMany({
    where: { id: order.id, shopId, status: order.status },
    data: unpaid
      ? { status: 'COLLECTED', collectedAt: now, paidAt: now }
      : { status: 'COLLECTED', collectedAt: now },
  });
  if (changed.count === 0) {
    return json({ error: 'This order changed in the meantime. Refresh and try again.' }, 409);
  }

  const updated = await prisma.order.findFirst({
    where: { id: order.id, shopId },
    select: {
      id: true,
      status: true,
      isTestOrder: true,
      paidAt: true,
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

  return json({ ok: true, order: updated, paymentTakenInShop: unpaid });
};
