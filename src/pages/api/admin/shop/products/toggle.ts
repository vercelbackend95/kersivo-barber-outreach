export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminContext } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';

const toggleSchema = z.object({
  id: z.string().min(1),
  field: z.enum(['active', 'featured']),
  value: z.boolean()
});

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;

  const parsed = toggleSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  try {
    const shopId = access.shopId;
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
