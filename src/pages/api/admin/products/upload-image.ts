export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminPermission } from '../../../../lib/admin/auth';
import {
  getBlobReadWriteToken,
  makeBlobPath,
  uploadPublicImageToBlob,
} from '../../../../lib/storage/vercelBlob';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const BLOCKED_IMAGE_TYPES = new Set(['image/svg+xml', 'image/svg']);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'retail.manage');
  if (access instanceof Response) return access;

  if (!getBlobReadWriteToken()) {
    return jsonResponse(
      {
        code: 'BLOB_STORAGE_NOT_CONFIGURED',
        error:
          'Blob storage is not configured. Set BLOB_READ_WRITE_TOKEN or VERCEL_BLOB_READ_WRITE_TOKEN.',
      },
      503,
    );
  }

  try {
    const contentType = ctx.request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return jsonResponse({ error: 'Expected multipart/form-data.' }, 400);
    }

    const form = await ctx.request.formData();
    const filePart = form.get('file') ?? form.get('image');
    if (!(filePart instanceof File) || filePart.size === 0) {
      return jsonResponse({ error: 'Image file is required.' }, 400);
    }
    if (!filePart.type.startsWith('image/')) {
      return jsonResponse({ error: 'Only image/* files are allowed.' }, 400);
    }
    if (BLOCKED_IMAGE_TYPES.has(filePart.type.toLowerCase()) || /\.svg$/i.test(filePart.name)) {
      return jsonResponse({ error: 'SVG images are not allowed.' }, 400);
    }
    if (filePart.size > MAX_IMAGE_SIZE_BYTES) {
      return jsonResponse({ error: 'Image is too large. Maximum size is 5MB.' }, 413);
    }

    const pathname = makeBlobPath(`shops/${access.shopId}/products`, filePart);
    const url = await uploadPublicImageToBlob(filePart, pathname);

    return jsonResponse({ url }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not upload image.';
    return jsonResponse({ error: message }, 500);
  }
};
