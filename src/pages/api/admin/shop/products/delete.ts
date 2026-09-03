export const prerender = false;



import type { APIRoute } from 'astro';

import { z } from 'zod';

import { requireAdminPermission } from '../../../../../lib/admin/auth';

import { runSerializableTransaction } from '../../../../../lib/db/serializableTransaction';

import { normalizeProductOrderAfterDeletion } from '../../../../../lib/products/sortOrder';

import { scheduleCatalogueRebuild } from '@/lib/recommendations/scheduleCatalogueRebuild';

const deleteSchema = z.object({ id: z.string().min(1) });



function isOrderItemConstraintViolation(error: unknown): boolean {

  if (typeof error !== 'object' || !error || !('code' in error)) return false;

  if ((error as { code?: string }).code !== 'P2003') return false;

  const meta = (error as { meta?: { field_name?: string; modelName?: string } }).meta;

  const field = meta?.field_name?.toLowerCase() ?? '';

  const model = meta?.modelName?.toLowerCase() ?? '';

  return field.includes('orderitem') || model.includes('orderitem');

}



export const POST: APIRoute = async (ctx) => {

  const access = await requireAdminPermission(ctx, 'retail.manage');

  if (access instanceof Response) return access;



  const parsed = deleteSchema.safeParse(await ctx.request.json());

  if (!parsed.success) {

    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });

  }



  try {

    const shopId = access.shopId;

    const deleted = await runSerializableTransaction(async (tx) => {

      const existing = await tx.product.findFirst({

        where: { id: parsed.data.id, shopId },

        select: { id: true }

      });



      if (!existing) {

        throw new Error('Product not found.');

      }



      const orderLineCount = await tx.orderItem.count({

        where: { productId: parsed.data.id },

      });

      if (orderLineCount > 0) {

        const err = new Error('Product cannot be deleted because it is linked to past orders.');

        (err as Error & { code: string }).code = 'ORDER_HISTORY';

        throw err;

      }



      const removedProduct = await tx.product.delete({

        where: { id: parsed.data.id }

      });



      await normalizeProductOrderAfterDeletion(tx, shopId);

      await scheduleCatalogueRebuild(shopId, tx);

      return removedProduct;





    });



    return new Response(JSON.stringify({ ok: true, product: deleted }), { status: 200 });

  } catch (error) {

    console.error('Failed to delete product', error);

    

    if (error instanceof Error && error.message === 'Product not found.') {

      return new Response(JSON.stringify({ error: error.message }), { status: 404 });

    }



    if (error instanceof Error && (error as Error & { code?: string }).code === 'ORDER_HISTORY') {

      return new Response(JSON.stringify({ error: error.message }), { status: 409 });

    }



    if (isOrderItemConstraintViolation(error)) {

      return new Response(JSON.stringify({ error: 'Product cannot be deleted because it is linked to past orders.' }), { status: 409 });

    }

    return new Response(JSON.stringify({ error: 'Unable to delete product.' }), { status: 500 });



  }

};

