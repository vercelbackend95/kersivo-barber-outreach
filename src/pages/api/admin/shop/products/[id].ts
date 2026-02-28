export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';
import { resolveShopId } from '../../../../../lib/db/shopScope';

const patchSchema = z.object({
  active: z.boolean().optional(),
  featured: z.boolean().optional()
}).refine((value) => value.active !== undefined || value.featured !== undefined, {
  message: 'At least one field is required.'
});

export const PATCH: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const id = ctx.params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Product id is required.' }), { status: 400 });
  }

  const parsed = patchSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  try {
    const shopId = await resolveShopId();
    const existing = await prisma.product.findFirst({ where: { id, shopId } });
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Product not found.' }), { status: 404 });
    }

    const nextActive = parsed.data.active ?? existing.active;
    const nextFeatured = parsed.data.featured ?? existing.featured;

    const product = await prisma.product.update({
      where: { id },
      data: {
        active: nextFeatured ? true : nextActive,
        featured: nextActive ? nextFeatured : false
      }
    });

    return new Response(JSON.stringify({ product }), { status: 200 });
  } catch (error) {
    console.error('Failed to patch product', error);
    return new Response(JSON.stringify({ error: 'Unable to update product.' }), { status: 500 });
  }
};
