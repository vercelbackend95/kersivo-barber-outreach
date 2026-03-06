export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';
import { resolveShopId } from '../../../../../lib/db/shopScope';

const deleteSchema = z.object({ id: z.string().min(1) });

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const parsed = deleteSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  try {
    const shopId = await resolveShopId();
    const existing = await prisma.product.findFirst({ where: { id: parsed.data.id, shopId }, select: { id: true } });
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Product not found.' }), { status: 404 });
    }

    await prisma.product.delete({
      where: { id: parsed.data.id }

    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error('Failed to delete product', error);
    if (typeof error === 'object' && error && 'code' in error && (error as { code?: string }).code === 'P2003') {
      return new Response(JSON.stringify({ error: 'Product cannot be deleted because it is linked to past orders.' }), { status: 409 });
    }
    return new Response(JSON.stringify({ error: 'Unable to delete product.' }), { status: 500 });

  }
};
