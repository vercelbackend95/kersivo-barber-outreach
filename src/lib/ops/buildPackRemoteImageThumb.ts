/**
 * Small WebP thumbnails of build-pack dashboard images (Barber.avatarUrl, Product.imageUrl,
 * Service.imageUrl, ShopSettings.logoUrl) for the ops Overview. The originals are often 1.5 MB+ PNGs,
 * so rendering them at 48–96 px made the Overview download megabytes per shop.
 *
 * The URL is never taken from the request: the caller passes a pack ref ("<source>:<ownerId>") and the
 * URL is looked up on the preview request's own draft shop, with the same row filters loadBuildPack uses.
 * Fetching goes through fetchRemoteImage, so the same allowlist, timeout and size cap apply.
 * Downloads and the zip keep serving originals.
 */
import sharp from 'sharp';
import { prisma } from '@/lib/db/client';
import { fetchRemoteImage, type BuildPackRemoteImageSource } from '@/lib/ops/buildPackRemoteImages';

export const REMOTE_IMAGE_THUMB_WIDTHS = [96, 240] as const;
export type RemoteImageThumbWidth = (typeof REMOTE_IMAGE_THUMB_WIDTHS)[number];

const SOURCES: readonly BuildPackRemoteImageSource[] = ['barber', 'product', 'service', 'shopLogo'];

export type RemoteImageRef = { source: BuildPackRemoteImageSource; ownerId: string };

/** "barber:clx123" → { source, ownerId }, or null for anything else. */
export function parseRemoteImageRef(raw: string | null | undefined): RemoteImageRef | null {
  const value = (raw ?? '').trim();
  const index = value.indexOf(':');
  if (index <= 0) return null;
  const source = value.slice(0, index) as BuildPackRemoteImageSource;
  const ownerId = value.slice(index + 1);
  if (!SOURCES.includes(source)) return null;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(ownerId)) return null;
  return { source, ownerId };
}

export function parseThumbWidth(raw: string | null | undefined): RemoteImageThumbWidth | null {
  const value = Number(raw);
  return (REMOTE_IMAGE_THUMB_WIDTHS as readonly number[]).includes(value) ? (value as RemoteImageThumbWidth) : null;
}

/** Overview helper: the thumbnail URL for one pack image. */
export function remoteImageThumbUrl(requestId: string, ref: RemoteImageRef, width: RemoteImageThumbWidth): string {
  const params = new URLSearchParams({ ref: `${ref.source}:${ref.ownerId}`, w: String(width) });
  return `/api/ops/preview-requests/${encodeURIComponent(requestId)}/remote-image?${params.toString()}`;
}

export type RemoteImageLookup =
  | { ok: true; url: string }
  | { ok: false; reason: 'request_not_found' | 'gone' | 'image_not_found' };

/**
 * The stored URL for a ref, only when the row belongs to this request's draft shop and would appear in the
 * pack (same filters as loadBuildPack: active / shown on website).
 */
export async function lookupPackRemoteImageUrl(requestId: string, ref: RemoteImageRef): Promise<RemoteImageLookup> {
  const request = await prisma.previewRequest.findUnique({
    where: { id: requestId },
    select: { draftShopId: true, anonymisedAt: true },
  });
  if (!request) return { ok: false, reason: 'request_not_found' };
  if (request.anonymisedAt) return { ok: false, reason: 'gone' };
  const shopId = request.draftShopId;
  if (!shopId) return { ok: false, reason: 'image_not_found' };

  let url: string | null | undefined = null;
  switch (ref.source) {
    case 'barber':
      url = (
        await prisma.barber.findFirst({
          where: { id: ref.ownerId, shopId, active: true, showOnWebsite: true },
          select: { avatarUrl: true },
        })
      )?.avatarUrl;
      break;
    case 'product':
      url = (
        await prisma.product.findFirst({ where: { id: ref.ownerId, shopId, active: true }, select: { imageUrl: true } })
      )?.imageUrl;
      break;
    case 'service':
      url = (
        await prisma.service.findFirst({ where: { id: ref.ownerId, shopId, isActive: true }, select: { imageUrl: true } })
      )?.imageUrl;
      break;
    case 'shopLogo':
      url =
        ref.ownerId === shopId
          ? (await prisma.shopSettings.findUnique({ where: { id: shopId }, select: { logoUrl: true } }))?.logoUrl
          : null;
      break;
  }
  const trimmed = url?.trim();
  return trimmed ? { ok: true, url: trimmed } : { ok: false, reason: 'image_not_found' };
}

export type RemoteImageThumbResult =
  | { ok: true; bytes: Buffer; contentType: 'image/webp' }
  | { ok: false; status: 404 | 410 | 422 | 502; reason: string };

/** Fetches (allowlisted) and resizes to WebP, never enlarging. */
export async function buildRemoteImageThumb(
  requestId: string,
  ref: RemoteImageRef,
  width: RemoteImageThumbWidth,
  deps: { fetchImpl?: typeof fetch; storeHost?: string | null } = {},
): Promise<RemoteImageThumbResult> {
  const lookup = await lookupPackRemoteImageUrl(requestId, ref);
  if (!lookup.ok) return { ok: false, status: lookup.reason === 'gone' ? 410 : 404, reason: lookup.reason };
  const fetched = await fetchRemoteImage(lookup.url, { fetchImpl: deps.fetchImpl, storeHost: deps.storeHost });
  if (!fetched.ok) return { ok: false, status: 502, reason: fetched.reason };
  try {
    const bytes = await sharp(Buffer.from(fetched.bytes), { failOn: 'none', limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();
    return { ok: true, bytes, contentType: 'image/webp' };
  } catch {
    return { ok: false, status: 422, reason: 'not a readable image' };
  }
}
