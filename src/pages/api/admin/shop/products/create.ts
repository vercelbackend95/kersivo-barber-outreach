export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';
import { resolveShopId } from '../../../../../lib/db/shopScope';
import { makeBlobPath, uploadPublicImageToBlob } from '../../../../../lib/storage/vercelBlob';
const PRODUCT_DESCRIPTION_MAX_LENGTH = 2000;
const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  description: z.string().trim().max(PRODUCT_DESCRIPTION_MAX_LENGTH, `Description must be at most ${PRODUCT_DESCRIPTION_MAX_LENGTH} characters.`).optional().or(z.literal('')),
  pricePence: z.number().int().positive('Price must be greater than zero.'),
  imageUrl: z.string().trim().url('Image URL must be a valid URL.').optional().or(z.literal('')),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().default(0)
});

const multipartCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  description: z.string().trim().max(PRODUCT_DESCRIPTION_MAX_LENGTH, `Description must be at most ${PRODUCT_DESCRIPTION_MAX_LENGTH} characters.`).optional().or(z.literal('')),
  pricePence: z.number().int().positive('Price must be greater than zero.'),
  imageUrl: z.string().trim().url('Image URL must be a valid URL.').optional().or(z.literal('')),

  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().default(0)
});

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
        sortOrder: Number(formData.get('sortOrder') ?? 0)
      });

      if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
      }

      const file = formData.get('image');
      let imageUrl = parsed.data.imageUrl || null;
      if (file instanceof File && file.size > 0) {
        imageUrl = await uploadPublicImageToBlob(file, makeBlobPath('products', file));
      }

      const product = await prisma.product.create({
        data: {
          shopId,
          name: parsed.data.name,
          description: parsed.data.description || null,
          pricePence: parsed.data.pricePence,
          imageUrl,
          active: parsed.data.active,
          featured: parsed.data.featured,
          sortOrder: parsed.data.sortOrder
        }
      });

      return new Response(JSON.stringify({ product }), { status: 200 });
    }

    const parsed = createSchema.safeParse(await ctx.request.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
    }


    const product = await prisma.product.create({
      data: {
        shopId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        pricePence: parsed.data.pricePence,
        imageUrl: parsed.data.imageUrl || null,
        active: parsed.data.active,
        featured: parsed.data.featured,
        sortOrder: parsed.data.sortOrder
      }
    });

    return new Response(JSON.stringify({ product }), { status: 200 });
  } catch (error) {
    console.error('Failed to create product', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to create product.' }), { status: 500 });
  }
};
