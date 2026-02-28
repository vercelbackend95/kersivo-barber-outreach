export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';
import { resolveShopId } from '../../../../../lib/db/shopScope';

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1)
});

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const parsed = reorderSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  try {
    const shopId = await resolveShopId();
    const existing = await prisma.product.findMany({ where: { shopId }, select: { id: true } });
    const existingIds = new Set(existing.map((product) => product.id));

    if (parsed.data.orderedIds.some((id) => !existingIds.has(id))) {
      return new Response(JSON.stringify({ error: 'Invalid product ids.' }), { status: 400 });
    }

    await prisma.$transaction(
      parsed.data.orderedIds.map((id, index) => prisma.product.update({ where: { id }, data: { sortOrder: index } }))
    );

    const products = await prisma.product.findMany({
      where: { shopId },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }]
    });

    return new Response(JSON.stringify({ ok: true, products }), { status: 200 });
  } catch (error) {
    console.error('Failed to reorder products', error);
    return new Response(JSON.stringify({ error: 'Unable to reorder products.' }), { status: 500 });
  }
};
