export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';
import { resolveShopId } from '../../../../../lib/db/shopScope';

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  try {
    const shopId = await resolveShopId();
    const products = await prisma.product.findMany({
      where: { shopId },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }]
    });

    return new Response(JSON.stringify({ products }), { status: 200 });
  } catch (error) {
    console.error('Failed to load products', error);
    return new Response(JSON.stringify({ error: 'Unable to load products.' }), { status: 500 });
  }
};
