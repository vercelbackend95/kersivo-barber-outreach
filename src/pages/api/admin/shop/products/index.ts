export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;
  try {
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
