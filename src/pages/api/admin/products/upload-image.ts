export const prerender = false;

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/admin/auth';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function extensionForMimeType(contentType: string): string | null {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  return null;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary is not configured.');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'products';
  const publicId = `product-${randomUUID()}`;
  const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = createHash('sha1').update(paramsToSign).digest('hex');

  const payload = new FormData();
  payload.set('file', file);
  payload.set('api_key', apiKey);
  payload.set('timestamp', String(timestamp));
  payload.set('folder', folder);
  payload.set('public_id', publicId);
  payload.set('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: payload
  });

  const result = (await response.json()) as { secure_url?: string; error?: { message?: string } };
  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message || 'Could not upload image to Cloudinary.');
  }

  return result.secure_url;
}

async function uploadToLocal(file: File): Promise<string> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Local upload fallback is disabled in production. Configure Cloudinary variables.');
  }

  const extension = extensionForMimeType(file.type);
  if (!extension) {
    throw new Error('Unsupported image format.');
  }

  const uploadsDirectory = path.join(process.cwd(), 'public', 'uploads', 'products');
  await mkdir(uploadsDirectory, { recursive: true });

  const fileName = `${randomUUID()}.${extension}`;
  const absolutePath = path.join(uploadsDirectory, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return `/uploads/products/${fileName}`;
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
    const hasCloudinary = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
    const url = hasCloudinary ? await uploadToCloudinary(file) : await uploadToLocal(file);
    return jsonResponse({ url }, 200);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Could not upload image.' }, 400);
  }
};
