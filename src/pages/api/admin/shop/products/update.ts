export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';
import { resolveShopId } from '../../../../../lib/db/shopScope';
import { makeBlobPath, uploadPublicImageToBlob } from '../../../../../lib/storage/vercelBlob';
const PRODUCT_DESCRIPTION_MAX_LENGTH = 2000;
const PRODUCT_CATEGORY_VALUES = ['POMADES_AND_CLAYS', 'BEARD_CARE', 'HAIR_WASH', 'STYLING', 'TOOLS', 'GIFT_SETS'] as const;
const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required.'),
  description: z.string().trim().max(PRODUCT_DESCRIPTION_MAX_LENGTH, `Description must be at most ${PRODUCT_DESCRIPTION_MAX_LENGTH} characters.`).optional().or(z.literal('')),
  pricePence: z.number().int().positive('Price must be greater than zero.'),
  imageUrl: z.string().trim().url('Image URL must be a valid URL.').optional().or(z.literal('')),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
    category: z.enum(PRODUCT_CATEGORY_VALUES).default('STYLING'),
  sortOrder: z.number().int().default(0)
});

async function handleUpdate(ctx: Parameters<APIRoute>[0]) {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const contentType = ctx.request.headers.get('content-type') ?? '';
  try {
    const shopId = await resolveShopId();
    
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

      const existing = await prisma.product.findFirst({ where: { id: parsed.data.id, shopId }, select: { id: true } });
      if (!existing) {
        return new Response(JSON.stringify({ error: 'Product not found.' }), { status: 404 });
      }

      const file = formData.get('image');
      let imageUrl = parsed.data.imageUrl || null;
      if (file instanceof File && file.size > 0) {
        imageUrl = await uploadPublicImageToBlob(file, makeBlobPath('products', file, parsed.data.id));
      }

      const product = await prisma.product.update({
        where: { id: parsed.data.id },
        data: {
          name: parsed.data.name,
          description: parsed.data.description || null,
          pricePence: parsed.data.pricePence,
          imageUrl,
          active: parsed.data.active,
          featured: parsed.data.featured,
                    category: parsed.data.category,
          sortOrder: parsed.data.sortOrder
        }
      });

      return new Response(JSON.stringify({ product }), { status: 200 });
    }

    const parsed = updateSchema.safeParse(await ctx.request.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
    }


    const existing = await prisma.product.findFirst({ where: { id: parsed.data.id, shopId }, select: { id: true } });
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Product not found.' }), { status: 404 });
    }

    const product = await prisma.product.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        pricePence: parsed.data.pricePence,
        imageUrl: parsed.data.imageUrl || null,
        active: parsed.data.active,
        featured: parsed.data.featured,
                category: parsed.data.category,
        sortOrder: parsed.data.sortOrder
      }
    });

    return new Response(JSON.stringify({ product }), { status: 200 });
  } catch (error) {
    console.error('Failed to update product', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to update product.' }), { status: 500 });
  }
}

export const POST: APIRoute = handleUpdate;
export const PUT: APIRoute = handleUpdate;
