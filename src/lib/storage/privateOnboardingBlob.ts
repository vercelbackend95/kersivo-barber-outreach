import { randomUUID } from 'node:crypto';
import { del, get, put } from '@vercel/blob';
import { ClientOnboardingAssetKind } from '@prisma/client';
import { getBlobReadWriteToken } from '@/lib/storage/vercelBlob';

export const MIGRATION_CSV_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_ASSET_MAX_BYTES = 5 * 1024 * 1024;
export const GUIDELINES_MAX_BYTES = 10 * 1024 * 1024;
export const OTHER_ASSET_MAX_BYTES = 5 * 1024 * 1024;

const CSV_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
]);

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const PDF_MIME = 'application/pdf';
const PDF_EXT = 'pdf';
const TEXT_MIME = 'text/plain';
const TEXT_EXT = 'txt';

export type PrivateBlobUploadResult = {
  pathname: string;
  contentType: string;
  sizeBytes: number;
};

export type AssetValidationError =
  | 'empty'
  | 'filename'
  | 'extension'
  | 'mime'
  | 'oversized'
  | 'kind';

function sanitizeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function fileExt(name: string): string {
  const lower = name.toLowerCase();
  const i = lower.lastIndexOf('.');
  if (i < 0) return '';
  return lower.slice(i + 1);
}

function requireBlobToken(): string {
  const token = getBlobReadWriteToken();
  if (!token) {
    throw new Error(
      'Blob storage is not configured. Set BLOB_READ_WRITE_TOKEN (or VERCEL_BLOB_READ_WRITE_TOKEN).',
    );
  }
  return token;
}

/** Path under private store — never treat as a public URL. */
export function makePrivateOnboardingPath(
  shopId: string,
  kind: string,
  originalFileName: string,
): string {
  const cleanName = sanitizeFileName(originalFileName || 'upload.bin');
  const baseName = cleanName.includes('.')
    ? cleanName.slice(0, cleanName.lastIndexOf('.'))
    : cleanName;
  const ext = cleanName.includes('.')
    ? cleanName.slice(cleanName.lastIndexOf('.') + 1)
    : 'bin';
  const safeBase = baseName || 'upload';
  const safeExt = ext || 'bin';
  return `client-onboarding/${shopId.trim()}/${kind.toLowerCase()}/${Date.now()}-${randomUUID()}-${safeBase}.${safeExt}`;
}

export type MigrationCsvValidationError = AssetValidationError;

export function validateMigrationCsvFile(file: {
  name: string;
  type: string;
  size: number;
}): MigrationCsvValidationError | null {
  const name = (file.name || '').trim();
  if (!name) return 'filename';
  if (file.size <= 0) return 'empty';
  if (file.size > MIGRATION_CSV_MAX_BYTES) return 'oversized';

  if (fileExt(name) !== 'csv') return 'extension';

  const mime = (file.type || '').trim().toLowerCase();
  if (mime && !CSV_MIME_TYPES.has(mime)) return 'mime';

  return null;
}

function validateImageLike(file: {
  name: string;
  type: string;
  size: number;
}, maxBytes: number): AssetValidationError | null {
  const name = (file.name || '').trim();
  if (!name) return 'filename';
  if (file.size <= 0) return 'empty';
  if (file.size > maxBytes) return 'oversized';
  const ext = fileExt(name);
  if (!IMAGE_EXTS.has(ext)) return 'extension';
  const mime = (file.type || '').trim().toLowerCase();
  if (mime && !IMAGE_MIME_TYPES.has(mime)) return 'mime';
  if (!mime) {
    // Infer from extension when browser omits type
    return null;
  }
  return null;
}

function validatePdfOrImage(
  file: { name: string; type: string; size: number },
  maxBytes: number,
): AssetValidationError | null {
  const name = (file.name || '').trim();
  if (!name) return 'filename';
  if (file.size <= 0) return 'empty';
  if (file.size > maxBytes) return 'oversized';
  const ext = fileExt(name);
  const mime = (file.type || '').trim().toLowerCase();

  if (ext === PDF_EXT) {
    if (mime && mime !== PDF_MIME) return 'mime';
    return null;
  }
  if (IMAGE_EXTS.has(ext)) {
    if (mime && !IMAGE_MIME_TYPES.has(mime)) return 'mime';
    return null;
  }
  return 'extension';
}

function validateOther(file: {
  name: string;
  type: string;
  size: number;
}): AssetValidationError | null {
  const name = (file.name || '').trim();
  if (!name) return 'filename';
  if (file.size <= 0) return 'empty';
  if (file.size > OTHER_ASSET_MAX_BYTES) return 'oversized';
  const ext = fileExt(name);
  const mime = (file.type || '').trim().toLowerCase();

  if (ext === PDF_EXT) {
    if (mime && mime !== PDF_MIME) return 'mime';
    return null;
  }
  if (ext === TEXT_EXT) {
    if (mime && mime !== TEXT_MIME && mime !== 'text/plain') return 'mime';
    return null;
  }
  if (IMAGE_EXTS.has(ext)) {
    if (mime && !IMAGE_MIME_TYPES.has(mime)) return 'mime';
    return null;
  }
  return 'extension';
}

/** Kind-specific allowlist (MIME + extension + size). Rejects HTML/SVG/JS/executables. */
export function validateOnboardingAssetFile(
  kind: ClientOnboardingAssetKind | string,
  file: { name: string; type: string; size: number },
): AssetValidationError | null {
  switch (kind) {
    case ClientOnboardingAssetKind.MIGRATION_CSV:
    case 'MIGRATION_CSV':
      return validateMigrationCsvFile(file);
    case ClientOnboardingAssetKind.BRAND_LOGO:
    case 'BRAND_LOGO':
    case ClientOnboardingAssetKind.GALLERY_IMAGE:
    case 'GALLERY_IMAGE':
      return validateImageLike(file, IMAGE_ASSET_MAX_BYTES);
    case ClientOnboardingAssetKind.BRAND_GUIDELINES:
    case 'BRAND_GUIDELINES':
      return validatePdfOrImage(file, GUIDELINES_MAX_BYTES);
    case ClientOnboardingAssetKind.OTHER:
    case 'OTHER':
      return validateOther(file);
    default:
      return 'kind';
  }
}

export function migrationCsvValidationMessage(code: MigrationCsvValidationError): string {
  return assetValidationMessage(code);
}

export function assetValidationMessage(code: AssetValidationError): string {
  switch (code) {
    case 'empty':
      return 'File is empty.';
    case 'filename':
      return 'Filename is required.';
    case 'extension':
      return 'File extension is not allowed for this asset kind.';
    case 'mime':
      return 'Unsupported content type for this asset kind.';
    case 'oversized':
      return 'File exceeds the maximum allowed size for this asset kind.';
    case 'kind':
      return 'Unknown asset kind.';
    default:
      return 'Invalid upload.';
  }
}

/**
 * Upload a private onboarding file. Returns pathname only — never expose a permanent public URL.
 */
export async function uploadPrivateOnboardingFile(
  file: File | Blob,
  pathname: string,
  contentType?: string,
): Promise<PrivateBlobUploadResult> {
  const token = requireBlobToken();
  const type =
    contentType ||
    (file instanceof File ? file.type : '') ||
    'application/octet-stream';

  const result = await put(pathname, file, {
    access: 'private',
    token,
    contentType: type,
    addRandomSuffix: false,
  });

  return {
    pathname: result.pathname || pathname,
    contentType: type,
    sizeBytes: file.size,
  };
}

export async function deletePrivateOnboardingFile(pathname: string): Promise<void> {
  const token = requireBlobToken();
  const path = pathname.trim();
  if (!path) return;
  await del(path, { token });
}

/**
 * Server-side retrieve of a private blob. Callers must auth before streaming to a client.
 * Does not return a public permanent URL.
 */
export async function retrievePrivateOnboardingFile(pathname: string): Promise<{
  stream: ReadableStream<Uint8Array> | null;
  contentType: string | null;
  statusCode: number;
}> {
  const token = requireBlobToken();
  const path = pathname.trim();
  if (!path) {
    return { stream: null, contentType: null, statusCode: 404 };
  }

  const result = await get(path, { access: 'private', token });
  if (!result || result.statusCode !== 200) {
    return {
      stream: null,
      contentType: null,
      statusCode: result?.statusCode ?? 404,
    };
  }

  return {
    stream: result.stream as ReadableStream<Uint8Array> | null,
    contentType: result.blob?.contentType ?? null,
    statusCode: 200,
  };
}

/** True if a string looks like a public Vercel Blob URL (must never appear in client-onboarding API payloads). */
export function looksLikePublicBlobUrl(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v.startsWith('http://') && !v.startsWith('https://')) return false;
  return (
    v.includes('.public.blob.vercel-storage.com') ||
    (v.includes('blob.vercel-storage.com') && !v.includes('.private.blob.'))
  );
}
