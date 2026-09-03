export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminPermission } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';
import { scheduleCatalogueRebuild } from '@/lib/recommendations/scheduleCatalogueRebuild';

const toggleSchema = z.object({
  id: z.string().min(1),
  field: z.enum(['active', 'featured']),
  value: z.boolean()
});

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'retail.manage');
  if (access instanceof Response) return access;

  const parsed = toggleSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  try {
    const shopId = access.shopId;
    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findFirst({
        where: { id: parsed.data.id, shopId },
        select: { id: true, active: true },
      });
      if (!existing) {
        throw new Error('Product not found.');
      }

      const updated = await tx.product.update({
        where: { id: parsed.data.id },
        data: { [parsed.data.field]: parsed.data.value }
      });

      if (parsed.data.field === 'active' && existing.active !== parsed.data.value) {
        await scheduleCatalogueRebuild(shopId, tx);
      }

      return updated;
    });

    return new Response(JSON.stringify({ product }), { status: 200 });
  } catch (error) {
    console.error('Failed to toggle product field', error);
    if (error instanceof Error && error.message === 'Product not found.') {
      return new Response(JSON.stringify({ error: error.message }), { status: 404 });
    }
    return new Response(JSON.stringify({ error: 'Unable to update product.' }), { status: 500 });
  }
};
