export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/admin/auth';
import { makeBlobPath } from '../../../../lib/storage/vercelBlob';
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);


function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export const POST: APIRoute = async (ctx) => {
      console.info('[admin/products/upload-image] request received', {
    path: new URL(ctx.request.url).pathname,
    method: ctx.request.method
  });


  const unauthorized = requireAdmin(ctx);
  if (unauthorized) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }


  const blobToken = process.env.BLOB_READ_WRITE_TOKEN ?? import.meta.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    console.error('[admin/products/upload-image] missing BLOB_READ_WRITE_TOKEN');
    return jsonResponse({ error: 'Image storage is not configured. Missing BLOB_READ_WRITE_TOKEN.' }, 500);

  }
  try {
    const contentType = ctx.request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return jsonResponse({ error: 'Expected multipart/form-data.' }, 400);
    }


    const form = await ctx.request.formData();
    const filePart = form.get('file') ?? form.get('image');

  }

    if (!(filePart instanceof File) || filePart.size === 0) {
      return jsonResponse({ error: 'Image file is required.' }, 400);
    }


    console.info('[admin/products/upload-image] file parsed', {
      name: filePart.name,
      size: filePart.size,
      type: filePart.type
    });

    if (!filePart.type.startsWith('image/') || !ALLOWED_IMAGE_TYPES.has(filePart.type)) {
      return jsonResponse({ error: 'Only JPG, PNG, WEBP, or GIF images are supported.' }, 400);
    }


    if (filePart.size > MAX_IMAGE_SIZE_BYTES) {
      return jsonResponse({ error: 'Image is too large. Maximum size is 5MB.' }, 400);
    }

    const pathname = makeBlobPath('products', filePart);
    const loadModule = new Function('return import("@vercel/blob")') as () => Promise<{ put?: (pathname: string, body: Blob | File, options?: { access?: 'public'; token?: string; contentType?: string; addRandomSuffix?: boolean; }) => Promise<{ url: string }> }>;
    const { put } = await loadModule();
    if (typeof put !== 'function') {
      throw new Error('Vercel Blob client is unavailable.');
    }

    const uploaded = await put(pathname, filePart, {
      access: 'public',
      contentType: filePart.type || 'application/octet-stream',
      token: blobToken,
      addRandomSuffix: false
    });

    console.info('[admin/products/upload-image] blob put ok', {
      pathname,
      url: uploaded.url
    });

    return jsonResponse({ url: uploaded.url }, 200);
  } catch (error) {
    console.error('[admin/products/upload-image] upload failed', {
      message: error instanceof Error ? error.message : 'Unknown upload error'
    });
    const message = error instanceof Error ? error.message : 'Could not upload image.';
    return jsonResponse({ error: message }, 500);


  }
};
