export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/admin/auth';
import { makeBlobPath, uploadPublicImageToBlob } from '../../../../lib/storage/vercelBlob';
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);


function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const contentType = ctx.request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return jsonResponse({ error: 'Expected multipart/form-data.' }, 400);
  }

  const form = await ctx.request.formData();
  const file = form.get('file');

  if (!(file instanceof File) || file.size === 0) {
    return jsonResponse({ error: 'Image file is required.' }, 400);
  }

  if (!file.type.startsWith('image/') || !ALLOWED_IMAGE_TYPES.has(file.type)) {
    return jsonResponse({ error: 'Only JPG, PNG, WEBP, or GIF images are supported.' }, 400);
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return jsonResponse({ error: 'Image is too large. Maximum size is 5MB.' }, 400);
  }

  try {
    const pathname = makeBlobPath('products', file);
    const url = await uploadPublicImageToBlob(file, pathname);

    return jsonResponse({ url }, 200);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Could not upload image.' }, 400);
  }
};
