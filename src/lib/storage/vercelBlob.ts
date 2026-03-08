import { randomUUID } from 'node:crypto';

const BLOB_API_BASE_URL = 'https://blob.vercel-storage.com';

type BlobPutFn = (pathname: string, body: Blob | File, options?: {
  access?: 'public';
  token?: string;
  contentType?: string;
  addRandomSuffix?: boolean;
}) => Promise<{ url: string }>;

export function getBlobReadWriteToken() {
  return process.env.BLOB_READ_WRITE_TOKEN
    ?? process.env.VERCEL_BLOB_READ_WRITE_TOKEN
    ?? import.meta.env.BLOB_READ_WRITE_TOKEN
    ?? import.meta.env.VERCEL_BLOB_READ_WRITE_TOKEN
    ?? null;
}

function sanitizeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extensionForMimeType(contentType: string): string {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  return 'bin';
}

export function makeBlobPath(prefix: string, file: File, idHint?: string) {
  const extension = extensionForMimeType(file.type);
  const cleanName = sanitizeFileName(file.name || `${Date.now()}.${extension}`);
  const baseName = cleanName.includes('.') ? cleanName.slice(0, cleanName.lastIndexOf('.')) : cleanName;
  const safeBaseName = baseName || 'upload';
  const identifier = idHint?.trim() || `${Date.now()}-${randomUUID()}`;
  return `${prefix}/${identifier}-${safeBaseName}.${extension}`;
}

async function tryLoadVercelBlobPut(): Promise<BlobPutFn | null> {
  try {
    const loadModule = new Function('return import("@vercel/blob")') as () => Promise<{ put?: BlobPutFn }>;
    const blobModule = await loadModule();
    if (typeof blobModule.put === 'function') {
      return blobModule.put as BlobPutFn;
    }
    return null;
  } catch {
    return null;
  }
}

async function uploadViaBlobApi(file: File, pathname: string, token: string) {
  const response = await fetch(`${BLOB_API_BASE_URL}/${pathname}?access=public`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': file.type || 'application/octet-stream',
      'x-add-random-suffix': '0'
    },
    body: file
  });

  const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: { message?: string } | string };
  if (!response.ok || !payload.url) {
    const errorMessage = typeof payload.error === 'string'
      ? payload.error
      : payload.error?.message;
    throw new Error(errorMessage || 'Could not upload image to Vercel Blob.');
  }

  return payload.url;
}

export async function uploadPublicImageToBlob(file: File, pathname: string) {
  const token = getBlobReadWriteToken();
  if (!token) {
    throw new Error('Blob storage is not configured. Set BLOB_READ_WRITE_TOKEN (or VERCEL_BLOB_READ_WRITE_TOKEN).');
  }

  const put = await tryLoadVercelBlobPut();
  if (put) {
    const uploaded = await put(pathname, file, {
      access: 'public',
      token,
      contentType: file.type || 'application/octet-stream',
      addRandomSuffix: false
    });
    return uploaded.url;
  }

  return uploadViaBlobApi(file, pathname, token);
}
