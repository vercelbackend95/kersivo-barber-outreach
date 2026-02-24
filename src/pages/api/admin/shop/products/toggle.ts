export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';
import { resolveShopId } from '../../../../../lib/db/shopScope';

const toggleSchema = z.object({
  id: z.string().min(1),
  field: z.enum(['active', 'featured']),
  value: z.boolean()
});

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const parsed = toggleSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  try {
    const shopId = await resolveShopId();
    const existing = await prisma.product.findFirst({ where: { id: parsed.data.id, shopId }, select: { id: true } });
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Product not found.' }), { status: 404 });
    }

    const product = await prisma.product.update({
      where: { id: parsed.data.id },
      data: { [parsed.data.field]: parsed.data.value }
    });

    return new Response(JSON.stringify({ product }), { status: 200 });
  } catch (error) {
    console.error('Failed to toggle product field', error);
    return new Response(JSON.stringify({ error: 'Unable to update product.' }), { status: 500 });
  }
};
