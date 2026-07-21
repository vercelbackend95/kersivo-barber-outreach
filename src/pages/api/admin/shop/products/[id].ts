export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminPermission } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';
import { normalizeProductFlags } from '../../../../../lib/products/normalizeProductFlags';

const patchSchema = z.object({
  active: z.boolean().optional(),
  featured: z.boolean().optional()
}).refine((value) => value.active !== undefined || value.featured !== undefined, {
  message: 'At least one field is required.'
});

export const PATCH: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'retail.manage');
  if (access instanceof Response) return access;

  const id = ctx.params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Product id is required.' }), { status: 400 });
  }

  const parsed = patchSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  try {
    const shopId = access.shopId;
    const existing = await prisma.product.findFirst({ where: { id, shopId } });
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Product not found.' }), { status: 404 });
    }

    const flags = normalizeProductFlags(
      { active: existing.active, featured: existing.featured },
      parsed.data
    );

    const product = await prisma.product.update({
      where: { id },
      data: {
        active: flags.active,
        featured: flags.featured
      }
    });

    return new Response(JSON.stringify({ product }), { status: 200 });
  } catch (error) {
    console.error('Failed to patch product', error);
    return new Response(JSON.stringify({ error: 'Unable to update product.' }), { status: 500 });
  }
};
