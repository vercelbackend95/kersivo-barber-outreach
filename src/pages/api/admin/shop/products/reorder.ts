export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminContext } from '../../../../../lib/admin/auth';
import { runSerializableTransaction } from '../../../../../lib/db/serializableTransaction';
import { persistProductOrder } from '../../../../../lib/products/sortOrder';
const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1)
});

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;

  const parsed = reorderSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  try {
    const shopId = access.shopId;
    const products = await runSerializableTransaction(async (tx) => {
      await persistProductOrder(tx, shopId, parsed.data.orderedIds);

      return tx.product.findMany({
        where: { shopId },
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }]
      });

    });

    return new Response(JSON.stringify({ ok: true, products }), { status: 200 });
  } catch (error) {
    console.error('Failed to reorder products', error);
    
    if (error instanceof Error && error.message.includes('payload')) {
      return new Response(JSON.stringify({ error: 'Invalid product ids.' }), { status: 400 });
    }


    return new Response(JSON.stringify({ error: 'Unable to reorder products.' }), { status: 500 });
  }
};
