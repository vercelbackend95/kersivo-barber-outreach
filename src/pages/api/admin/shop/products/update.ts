export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminPermission } from '../../../../../lib/admin/auth';
import { runSerializableTransaction } from '../../../../../lib/db/serializableTransaction';
import { normalizeRequestedProductSortOrder, reorderProductWithinShop } from '../../../../../lib/products/sortOrder';
import { makeBlobPath, uploadPublicImageToBlob } from '../../../../../lib/storage/vercelBlob';
import { PRODUCT_CATEGORY_VALUES } from '../../../../../lib/shop/productPresentation';
import { productSemanticFieldsChanged } from '@/lib/recommendations/hash';
import { scheduleCatalogueRebuild } from '@/lib/recommendations/scheduleCatalogueRebuild';
const PRODUCT_DESCRIPTION_MAX_LENGTH = 2000;
const imageUrlSchema = z.string().trim().refine((value) => {
  if (!value) return true;
  return z.string().url().safeParse(value).success;
}, 'Image URL must be a valid URL.');


const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required.'),
  description: z.string().trim().max(PRODUCT_DESCRIPTION_MAX_LENGTH, `Description must be at most ${PRODUCT_DESCRIPTION_MAX_LENGTH} characters.`).optional().or(z.literal('')),
  pricePence: z.number().int().positive('Price must be greater than zero.'),
  imageUrl: imageUrlSchema.optional().or(z.literal('')),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
    category: z.enum(PRODUCT_CATEGORY_VALUES).default('STYLING'),
  sortOrder: z.number().int().default(0)
});
type UpdatePayload = z.infer<typeof updateSchema>;

async function updateProductWithReorder(shopId: string, payload: UpdatePayload, imageUrlOverride?: string | null) {
  return runSerializableTransaction(async (tx) => {
    const existing = await tx.product.findFirst({
      where: { id: payload.id, shopId },
      select: { id: true, name: true, description: true, category: true, active: true },
    });

    if (!existing) {
      throw new Error('Product not found.');
    }

    const beforeSemantic = {
      name: existing.name,
      description: existing.description,
      category: existing.category,
    };

    const requestedSortOrder = normalizeRequestedProductSortOrder(payload.sortOrder);

    const product = await tx.product.update({
      where: { id: payload.id },
      data: {
        name: payload.name,
        description: payload.description || null,
        pricePence: payload.pricePence,
        imageUrl: (imageUrlOverride ?? payload.imageUrl) || null,
        active: payload.active,
        featured: payload.featured,
        category: payload.category
      }
    });

    const sortOrder = await reorderProductWithinShop(tx, shopId, payload.id, requestedSortOrder);

    const afterSemantic = {
      name: product.name,
      description: product.description,
      category: product.category,
    };
    const availabilityChanged = existing.active !== product.active;
    if (productSemanticFieldsChanged(beforeSemantic, afterSemantic) || availabilityChanged) {
      await scheduleCatalogueRebuild(shopId, tx);
    }

    return { ...product, sortOrder };
  });
}


async function handleUpdate(ctx: Parameters<APIRoute>[0]) {
  const access = await requireAdminPermission(ctx, 'retail.manage');
  if (access instanceof Response) return access;

  const contentType = ctx.request.headers.get('content-type') ?? '';
  try {
    const shopId = access.shopId;
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await ctx.request.formData();
      const parsed = updateSchema.safeParse({
        id: String(formData.get('id') ?? ''),
        name: String(formData.get('name') ?? ''),
        description: String(formData.get('description') ?? ''),
        pricePence: Number(formData.get('pricePence') ?? 0),
        imageUrl: String(formData.get('imageUrl') ?? ''),
        active: String(formData.get('active') ?? 'true').toLowerCase() !== 'false',
        featured: String(formData.get('featured') ?? 'false').toLowerCase() === 'true',
                category: String(formData.get('category') ?? 'STYLING'),
        sortOrder: Number(formData.get('sortOrder') ?? 0)
      });

      if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
      }

      const file = formData.get('image');
      let uploadedImageUrl: string | null | undefined;
      if (file instanceof File && file.size > 0) {
        uploadedImageUrl = await uploadPublicImageToBlob(file, makeBlobPath('products', file, parsed.data.id));
      }

      const product = await updateProductWithReorder(shopId, parsed.data, uploadedImageUrl);
      return new Response(JSON.stringify({ product }), { status: 200 });
    }

    const parsed = updateSchema.safeParse(await ctx.request.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
    }
    const product = await updateProductWithReorder(shopId, parsed.data);
    return new Response(JSON.stringify({ product }), { status: 200 });
  } catch (error) {
    console.error('Failed to update product', error);


    if (error instanceof Error && error.message === 'Product not found.') {
      return new Response(JSON.stringify({ error: error.message }), { status: 404 });

    }
    if (typeof error === 'object' && error && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return new Response(JSON.stringify({ error: 'Unable to save product because list positions must stay unique per shop.' }), { status: 409 });
    }

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to update product.' }), { status: 500 });
  }
}

export const POST: APIRoute = handleUpdate;
export const PUT: APIRoute = handleUpdate;
