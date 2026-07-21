export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminPermission } from '../../../../../../lib/admin/auth';
import { prisma } from '../../../../../../lib/db/client';

async function resolveCustomerName(shopId: string, customerEmail: string): Promise<string | null> {
  const email = customerEmail.trim().toLowerCase();
  if (!email) return null;

  const [client, user] = await Promise.all([
    prisma.client.findFirst({
      where: { shopId, email },
      select: { fullName: true },
    }),
    prisma.user.findFirst({
      where: { email },
      select: { name: true },
    }),
  ]);

  const clientName = client?.fullName?.trim();
  if (clientName) return clientName;

  const userName = user?.name?.trim();
  return userName || null;
}

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'retail.manage');
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
          lineTotalPence: true,
        },
      },
    },
  });

  if (!order) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 });

  const customerName = await resolveCustomerName(shopId, order.customerEmail);

  return new Response(JSON.stringify({ order: { ...order, customerName } }), { status: 200 });
};
