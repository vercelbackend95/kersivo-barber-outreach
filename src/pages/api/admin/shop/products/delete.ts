export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { runSerializableTransaction } from '../../../../../lib/db/serializableTransaction';
import { resolveShopId } from '../../../../../lib/db/shopScope';
import { normalizeProductOrderAfterDeletion } from '../../../../../lib/products/sortOrder';
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
    const deleted = await runSerializableTransaction(async (tx) => {
      const existing = await tx.product.findFirst({
        where: { id: parsed.data.id, shopId },
        select: { id: true }
      });

      if (!existing) {
        throw new Error('Product not found.');
      }

      const removedProduct = await tx.product.delete({
        where: { id: parsed.data.id }
      });

      await normalizeProductOrderAfterDeletion(tx, shopId);
      return removedProduct;


    });

    return new Response(JSON.stringify({ ok: true, product: deleted }), { status: 200 });
  } catch (error) {
    console.error('Failed to delete product', error);
    
    if (error instanceof Error && error.message === 'Product not found.') {
      return new Response(JSON.stringify({ error: error.message }), { status: 404 });
    }


    if (typeof error === 'object' && error && 'code' in error && (error as { code?: string }).code === 'P2003') {
      return new Response(JSON.stringify({ error: 'Product cannot be deleted because it is linked to past orders.' }), { status: 409 });
    }
    return new Response(JSON.stringify({ error: 'Unable to delete product.' }), { status: 500 });

  }
};
