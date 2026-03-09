export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/admin/auth';
import { prisma } from '../../../../lib/db/client';
import { resolveShopId } from '../../../../lib/db/shopScope';

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  try {
    const shopId = await resolveShopId();

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
