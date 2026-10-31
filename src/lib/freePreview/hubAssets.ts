import { randomUUID } from 'node:crypto';
import type { PreviewHubActor, PreviewHubAssetKind } from '@prisma/client';
import sharp from 'sharp';
import { prisma } from '@/lib/db/client';
import {
  deletePrivateOnboardingFile,
  retrievePrivateOnboardingFile,
  uploadPrivateOnboardingFile,
} from '@/lib/storage/privateOnboardingBlob';
import { sniffAllowedForHubKind, type SniffedFileKind } from '@/lib/storage/fileSniff';
import {
  HUB_UPLOAD_ERROR_CAP_BYTES,
  HUB_UPLOAD_ERROR_CAP_FILES,
  HUB_UPLOAD_ERROR_CAP_LOGO,
  HUB_UPLOAD_ERROR_CAP_PHOTOS,
  HUB_UPLOAD_ERROR_CAP_PRICE,
  HUB_UPLOAD_ERROR_CAP_TEAM,
  HUB_UPLOAD_ERROR_EMPTY,
  HUB_UPLOAD_ERROR_REJECTED,
  HUB_UPLOAD_ERROR_TOO_LARGE,
  HUB_UPLOAD_ERROR_TYPE,
  HUB_UPLOAD_ERROR_TYPE_LOGO,
  HUB_UPLOAD_ERROR_TYPE_PHOTO,
} from './hubCopy';

export const HUB_MAX_BODY_BYTES = 4 * 1024 * 1024;
export const HUB_MAX_ACTIVE_FILES = 60;
export const HUB_MAX_TOTAL_BYTES = 250 * 1024 * 1024;
export const HUB_MAX_IMAGE_EDGE = 2560;
export const HUB_THUMB_EDGE = 480;
export const HUB_JPEG_QUALITY = 85;
export const HUB_MAX_SHOP_PHOTOS = 40;
export const HUB_MAX_TEAM_PHOTOS = 40;
export const HUB_MAX_PRICE_LISTS = 5;
export const HUB_MAX_LOGOS = 3;
export const HUB_CAPTION_MAX = 140;
export const HUB_FILES_NOTIFY_WINDOW_MS = 15 * 60 * 1000;

export const HUB_OWNER_UPLOAD_KINDS: readonly PreviewHubAssetKind[] = [
  'LOGO',
  'SHOP_PHOTO',
  'TEAM_PHOTO',
  'PRICE_LIST',
  'MESSAGE_ATTACHMENT',
  'CHANGE_ATTACHMENT',
  'OTHER',
];

export type HubBlobClient = {
  put: (file: File | Blob, pathname: string, contentType?: string) => Promise<{ pathname: string; sizeBytes: number }>;
  delete: (pathname: string) => Promise<void>;
  get: (pathname: string) => Promise<{
    stream: ReadableStream<Uint8Array> | null;
    contentType: string | null;
    statusCode: number;
  }>;
};

export const defaultHubBlobClient: HubBlobClient = {
  put: async (file, pathname, contentType) => {
    const result = await uploadPrivateOnboardingFile(file, pathname, contentType);
    return { pathname: result.pathname, sizeBytes: result.sizeBytes };
  },
  delete: deletePrivateOnboardingFile,
  get: retrievePrivateOnboardingFile,
};

export type ProcessedHubFile = {
  kind: PreviewHubAssetKind;
  sniffed: SniffedFileKind;
  originalFileName: string;
  contentType: string;
  ext: string;
  buffer: Buffer;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  thumb: { buffer: Buffer; contentType: string; ext: string } | null;
};

export type HubAssetPublic = {
  id: string;
  kind: PreviewHubAssetKind;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  sortOrder: number;
  barberId: string | null;
  uploadedBy: PreviewHubActor;
  createdAt: string;
  hasThumb: boolean;
};

export function makeHubAssetPath(requestId: string, kind: string, ext: string): string {
  const safeKind = kind.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const safeExt = (ext || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  return `preview-hub/${requestId}/${safeKind}/${Date.now()}-${randomUUID()}.${safeExt}`;
}

export function typeErrorForKind(kind: PreviewHubAssetKind): string {
  if (kind === 'LOGO') return HUB_UPLOAD_ERROR_TYPE_LOGO;
  if (kind === 'SHOP_PHOTO' || kind === 'TEAM_PHOTO') return HUB_UPLOAD_ERROR_TYPE_PHOTO;
  return HUB_UPLOAD_ERROR_TYPE;
}

function hasTransparency(channels: number | undefined, hasAlpha: boolean | undefined): boolean {
  return Boolean(hasAlpha) || channels === 4 || channels === 2;
}

async function encodeImage(buffer: Buffer): Promise<{
  buffer: Buffer;
  contentType: string;
  ext: string;
  width: number;
  height: number;
}> {
  const pipeline = sharp(buffer, { failOn: 'none', limitInputPixels: 40_000_000 }).rotate();
  const meta = await pipeline.metadata();
  const keepPng = hasTransparency(meta.channels, meta.hasAlpha);
  const resized = pipeline.resize({
    width: HUB_MAX_IMAGE_EDGE,
    height: HUB_MAX_IMAGE_EDGE,
    fit: 'inside',
    withoutEnlargement: true,
  });
  const out = keepPng
    ? await resized.png({ compressionLevel: 8 }).toBuffer({ resolveWithObject: true })
    : await resized.jpeg({ quality: HUB_JPEG_QUALITY, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  return {
    buffer: out.data,
    contentType: keepPng ? 'image/png' : 'image/jpeg',
    ext: keepPng ? 'png' : 'jpg',
    width: out.info.width,
    height: out.info.height,
  };
}

async function encodeThumb(buffer: Buffer): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  const out = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: HUB_THUMB_EDGE, height: HUB_THUMB_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  return { buffer: out, contentType: 'image/webp', ext: 'webp' };
}

async function rasteriseSvg(buffer: Buffer): Promise<{
  display: Buffer;
  width: number;
  height: number;
}> {
  const out = await sharp(buffer, { failOn: 'none', density: 144 })
    .resize({ width: HUB_THUMB_EDGE, height: HUB_THUMB_EDGE, fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { display: out.data, width: out.info.width, height: out.info.height };
}

export async function processHubUpload(input: {
  bytes: Buffer;
  originalFileName: string;
  kind: PreviewHubAssetKind;
}): Promise<{ ok: true; file: ProcessedHubFile } | { ok: false; error: string }> {
  if (input.bytes.length === 0) return { ok: false, error: HUB_UPLOAD_ERROR_EMPTY };
  if (input.bytes.length > HUB_MAX_BODY_BYTES) return { ok: false, error: HUB_UPLOAD_ERROR_TOO_LARGE };

  const sniffed = sniffAllowedForHubKind(input.kind, input.bytes);
  if (!sniffed.ok) {
    if (sniffed.reason === 'empty') return { ok: false, error: HUB_UPLOAD_ERROR_EMPTY };
    return { ok: false, error: typeErrorForKind(input.kind) };
  }

  const originalFileName = (input.originalFileName || `upload.${sniffed.ext}`).slice(0, 180);

  if (sniffed.kind === 'pdf') {
    return {
      ok: true,
      file: {
        kind: input.kind,
        sniffed: sniffed.kind,
        originalFileName,
        contentType: 'application/pdf',
        ext: 'pdf',
        buffer: input.bytes,
        sizeBytes: input.bytes.length,
        width: null,
        height: null,
        thumb: null,
      },
    };
  }

  if (sniffed.kind === 'svg') {
    try {
      const raster = await rasteriseSvg(input.bytes);
      return {
        ok: true,
        file: {
          kind: input.kind,
          sniffed: sniffed.kind,
          originalFileName,
          contentType: 'image/svg+xml',
          ext: 'svg',
          buffer: input.bytes,
          sizeBytes: input.bytes.length,
          width: raster.width,
          height: raster.height,
          thumb: { buffer: raster.display, contentType: 'image/png', ext: 'png' },
        },
      };
    } catch {
      return { ok: false, error: HUB_UPLOAD_ERROR_REJECTED };
    }
  }

  try {
    const encoded = await encodeImage(input.bytes);
    const thumb = await encodeThumb(encoded.buffer);
    return {
      ok: true,
      file: {
        kind: input.kind,
        sniffed: sniffed.kind,
        originalFileName,
        contentType: encoded.contentType,
        ext: encoded.ext,
        buffer: encoded.buffer,
        sizeBytes: encoded.buffer.length,
        width: encoded.width,
        height: encoded.height,
        thumb,
      },
    };
  } catch {
    return { ok: false, error: HUB_UPLOAD_ERROR_REJECTED };
  }
}

export async function loadActiveHubAssets(previewRequestId: string) {
  return prisma.previewHubAsset.findMany({
    where: { previewRequestId, deletedAt: null },
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

export function serializeHubAsset(row: {
  id: string;
  kind: PreviewHubAssetKind;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  sortOrder: number;
  barberId: string | null;
  uploadedBy: PreviewHubActor;
  createdAt: Date;
  thumbPath: string | null;
}): HubAssetPublic {
  return {
    id: row.id,
    kind: row.kind,
    originalFileName: row.originalFileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    caption: row.caption,
    sortOrder: row.sortOrder,
    barberId: row.barberId,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
    hasThumb: Boolean(row.thumbPath),
  };
}

export async function assertHubUploadCaps(input: {
  previewRequestId: string;
  kind: PreviewHubAssetKind;
  incomingBytes: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const active = await prisma.previewHubAsset.findMany({
    where: { previewRequestId: input.previewRequestId, deletedAt: null },
    select: { kind: true, sizeBytes: true },
  });
  if (active.length >= HUB_MAX_ACTIVE_FILES) return { ok: false, error: HUB_UPLOAD_ERROR_CAP_FILES };
  const usedBytes = active.reduce((sum, row) => sum + row.sizeBytes, 0);
  if (usedBytes + input.incomingBytes > HUB_MAX_TOTAL_BYTES) return { ok: false, error: HUB_UPLOAD_ERROR_CAP_BYTES };
  const ofKind = active.filter((row) => row.kind === input.kind).length;
  if (input.kind === 'SHOP_PHOTO' && ofKind >= HUB_MAX_SHOP_PHOTOS) {
    return { ok: false, error: HUB_UPLOAD_ERROR_CAP_PHOTOS };
  }
  if (input.kind === 'TEAM_PHOTO' && ofKind >= HUB_MAX_TEAM_PHOTOS) {
    return { ok: false, error: HUB_UPLOAD_ERROR_CAP_TEAM };
  }
  if (input.kind === 'PRICE_LIST' && ofKind >= HUB_MAX_PRICE_LISTS) {
    return { ok: false, error: HUB_UPLOAD_ERROR_CAP_PRICE };
  }
  if (input.kind === 'LOGO' && ofKind >= HUB_MAX_LOGOS) return { ok: false, error: HUB_UPLOAD_ERROR_CAP_LOGO };
  return { ok: true };
}

export async function storeProcessedHubFile(input: {
  requestId: string;
  file: ProcessedHubFile;
  uploadedBy: PreviewHubActor;
  blob?: HubBlobClient;
}) {
  const blob = input.blob ?? defaultHubBlobClient;
  const storagePath = makeHubAssetPath(input.requestId, input.file.kind, input.file.ext);
  const stored = await blob.put(
    new Blob([new Uint8Array(input.file.buffer)], { type: input.file.contentType }),
    storagePath,
    input.file.contentType,
  );
  let thumbPath: string | null = null;
  if (input.file.thumb) {
    thumbPath = makeHubAssetPath(input.requestId, input.file.kind, `thumb.${input.file.thumb.ext}`);
    await blob.put(
      new Blob([new Uint8Array(input.file.thumb.buffer)], { type: input.file.thumb.contentType }),
      thumbPath,
      input.file.thumb.contentType,
    );
  }
  const nextOrder = await prisma.previewHubAsset.count({
    where: { previewRequestId: input.requestId, kind: input.file.kind, deletedAt: null },
  });
  const row = await prisma.previewHubAsset.create({
    data: {
      previewRequestId: input.requestId,
      kind: input.file.kind,
      storagePath: stored.pathname || storagePath,
      thumbPath,
      originalFileName: input.file.originalFileName,
      contentType: input.file.contentType,
      sizeBytes: input.file.sizeBytes,
      width: input.file.width,
      height: input.file.height,
      sortOrder: nextOrder,
      uploadedBy: input.uploadedBy,
    },
  });
  return row;
}

export type HubAssetServeMode = 'inline' | 'attachment';

export function hubAssetServePlan(input: {
  size: 'thumb' | 'full';
  contentType: string;
  sniffedExt?: string;
}): { cache: string; contentType: string; disposition: HubAssetServeMode } {
  const isThumb = input.size === 'thumb';
  const lower = input.contentType.toLowerCase();
  const isSvg = lower.includes('svg') || input.sniffedExt === 'svg';
  const isPdf = lower.includes('pdf') || input.sniffedExt === 'pdf';
  if (!isThumb && (isSvg || isPdf)) {
    return {
      cache: 'private, max-age=300',
      contentType: 'application/octet-stream',
      disposition: 'attachment',
    };
  }
  return {
    cache: 'private, max-age=300',
    contentType: isThumb && lower.includes('svg') ? 'image/png' : input.contentType,
    disposition: 'inline',
  };
}

export async function collectHubAssetBlobPaths(
  db: { previewHubAsset: { findMany: typeof prisma.previewHubAsset.findMany } },
  previewRequestId: string,
): Promise<string[]> {
  const rows = await db.previewHubAsset.findMany({
    where: { previewRequestId },
    select: { storagePath: true, thumbPath: true },
  });
  const paths: string[] = [];
  for (const row of rows) {
    if (row.storagePath) paths.push(row.storagePath);
    if (row.thumbPath) paths.push(row.thumbPath);
  }
  return paths;
}

export async function deleteHubAssetRows(
  db: { previewHubAsset: { deleteMany: typeof prisma.previewHubAsset.deleteMany } },
  previewRequestId: string,
): Promise<number> {
  const result = await db.previewHubAsset.deleteMany({ where: { previewRequestId } });
  return result.count;
}

export async function deleteHubBlobPaths(
  paths: string[],
  blob: Pick<HubBlobClient, 'delete'> = defaultHubBlobClient,
): Promise<void> {
  for (const path of paths) {
    try {
      await blob.delete(path);
    } catch (error) {
      console.error('[preview-hub] blob delete failed', {
        path: path.slice(0, 80),
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}

/** Soft-delete the row and remove blobs immediately so a deleted file cannot be fetched. */
export async function softDeleteHubAsset(input: {
  assetId: string;
  previewRequestId: string;
  blob?: Pick<HubBlobClient, 'delete'>;
}): Promise<boolean> {
  const blob = input.blob ?? defaultHubBlobClient;
  const row = await prisma.previewHubAsset.findFirst({
    where: { id: input.assetId, previewRequestId: input.previewRequestId, deletedAt: null },
  });
  if (!row) return false;
  await prisma.previewHubAsset.update({
    where: { id: row.id },
    data: { deletedAt: new Date() },
  });
  await deleteHubBlobPaths([row.storagePath, row.thumbPath].filter((path): path is string => Boolean(path)), blob);
  return true;
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
