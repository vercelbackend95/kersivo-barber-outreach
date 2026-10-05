export const prerender = false;

import type { APIRoute } from 'astro';
import { prisma } from '../../../../lib/db/client';
import { requireAdminPermissionAndCapability } from '@/lib/admin/productCapability';

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminPermissionAndCapability(ctx, 'billing.manage', 'RETAIL');
  if (access instanceof Response) return access;
  const shopId = access.shopId;

  try {
    const [ordersResult, productsResult] = await prisma.$transaction([
      prisma.order.deleteMany({ where: { shopId } }),
      prisma.product.deleteMany({ where: { shopId } })
    ]);

    return new Response(
      JSON.stringify({
        ok: true,
        deleted: {
          orders: ordersResult.count,
          products: productsResult.count
        }
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to reset shop catalog data', error);
    return new Response(JSON.stringify({ error: 'Unable to clear shop products and sales data.' }), { status: 500 });
  }
};
