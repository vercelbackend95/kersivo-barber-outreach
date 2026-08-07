import { randomUUID } from 'node:crypto';
import { del, get, put } from '@vercel/blob';
import { getBlobReadWriteToken } from '@/lib/storage/vercelBlob';

export const MIGRATION_CSV_MAX_BYTES = 10 * 1024 * 1024;

const CSV_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
]);

export type PrivateBlobUploadResult = {
  pathname: string;
  contentType: string;
  sizeBytes: number;
};

function sanitizeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
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

export type MigrationCsvValidationError =
  | 'empty'
  | 'filename'
  | 'extension'
  | 'mime'
  | 'oversized';

export function validateMigrationCsvFile(file: {
  name: string;
  type: string;
  size: number;
}): MigrationCsvValidationError | null {
  const name = (file.name || '').trim();
  if (!name) return 'filename';
  if (file.size <= 0) return 'empty';
  if (file.size > MIGRATION_CSV_MAX_BYTES) return 'oversized';

  const lower = name.toLowerCase();
  if (!lower.endsWith('.csv')) return 'extension';

  const mime = (file.type || '').trim().toLowerCase();
  // Browsers sometimes omit MIME; allow empty type only when extension is .csv.
  if (mime && !CSV_MIME_TYPES.has(mime)) return 'mime';

  return null;
}

export function migrationCsvValidationMessage(code: MigrationCsvValidationError): string {
  switch (code) {
    case 'empty':
      return 'File is empty.';
    case 'filename':
      return 'Filename is required.';
    case 'extension':
      return 'Only .csv migration files are accepted.';
    case 'mime':
      return 'Unsupported content type for migration CSV.';
    case 'oversized':
      return `Migration CSV must be ${MIGRATION_CSV_MAX_BYTES / (1024 * 1024)} MB or smaller.`;
    default:
      return 'Invalid migration file.';
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
