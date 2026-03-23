export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { runSerializableTransaction } from '../../../../../lib/db/serializableTransaction';
import { resolveShopId } from '../../../../../lib/db/shopScope';
import { insertProductIntoShopOrder, normalizeRequestedProductSortOrder } from '../../../../../lib/products/sortOrder';
import { makeBlobPath, uploadPublicImageToBlob } from '../../../../../lib/storage/vercelBlob';
const PRODUCT_DESCRIPTION_MAX_LENGTH = 2000;
const PRODUCT_CATEGORY_VALUES = ['POMADES_AND_CLAYS', 'BEARD_CARE', 'HAIR_WASH', 'STYLING', 'TOOLS', 'GIFT_SETS'] as const;
const imageUrlSchema = z.string().trim().refine((value) => {
  if (!value) return true;
  if (value.startsWith('data:image/')) return true;
  return z.string().url().safeParse(value).success;
}, 'Image URL must be a valid URL or inline image data.');


const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  description: z.string().trim().max(PRODUCT_DESCRIPTION_MAX_LENGTH, `Description must be at most ${PRODUCT_DESCRIPTION_MAX_LENGTH} characters.`).optional().or(z.literal('')),
  pricePence: z.number().int().positive('Price must be greater than zero.'),
  imageUrl: imageUrlSchema.optional().or(z.literal('')),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
    category: z.enum(PRODUCT_CATEGORY_VALUES).default('STYLING'),
  sortOrder: z.number().int().default(0)
});

const multipartCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  description: z.string().trim().max(PRODUCT_DESCRIPTION_MAX_LENGTH, `Description must be at most ${PRODUCT_DESCRIPTION_MAX_LENGTH} characters.`).optional().or(z.literal('')),
  pricePence: z.number().int().positive('Price must be greater than zero.'),
  imageUrl: imageUrlSchema.optional().or(z.literal('')),

  active: z.boolean().default(true),
  featured: z.boolean().default(false),
    category: z.enum(PRODUCT_CATEGORY_VALUES).default('STYLING'),
  sortOrder: z.number().int().default(0)
});
type CreatePayload = z.infer<typeof createSchema>;

async function createProductWithReorder(shopId: string, payload: CreatePayload, imageUrlOverride?: string | null) {
  return runSerializableTransaction(async (tx) => {
    const requestedSortOrder = normalizeRequestedProductSortOrder(payload.sortOrder);
    const productCount = await tx.product.count({ where: { shopId } });

    const product = await tx.product.create({
      data: {
        shopId,
        name: payload.name,
        description: payload.description || null,
        pricePence: payload.pricePence,
        imageUrl: (imageUrlOverride ?? payload.imageUrl) || null,
        active: payload.active,
        featured: payload.featured,
        category: payload.category,
        sortOrder: -1 - productCount
      }
    });

    const sortOrder = await insertProductIntoShopOrder(tx, shopId, product.id, requestedSortOrder);

    return { ...product, sortOrder };
  });
}


export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const contentType = ctx.request.headers.get('content-type') ?? '';

  try {
    const shopId = await resolveShopId();
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await ctx.request.formData();
      const parsed = multipartCreateSchema.safeParse({
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
        uploadedImageUrl = await uploadPublicImageToBlob(file, makeBlobPath('products', file));
      }
      const product = await createProductWithReorder(shopId, parsed.data, uploadedImageUrl);

      return new Response(JSON.stringify({ product }), { status: 200 });
    }

    const parsed = createSchema.safeParse(await ctx.request.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
    }
    const product = await createProductWithReorder(shopId, parsed.data);

    return new Response(JSON.stringify({ product }), { status: 200 });
  } catch (error) {
    console.error('Failed to create product', error);
    
    if (typeof error === 'object' && error && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return new Response(JSON.stringify({ error: 'Unable to create product because list positions must stay unique per shop.' }), { status: 409 });
    }


    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to create product.' }), { status: 500 });
  }
};
