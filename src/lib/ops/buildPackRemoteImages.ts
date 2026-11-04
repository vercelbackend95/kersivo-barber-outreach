/**
 * Ops build pack: images added through the admin dashboard screens (Barber.avatarUrl, Product.imageUrl,
 * Service.imageUrl, ShopSettings.logoUrl). They are public Vercel Blob URLs, unlike hub uploads, which are
 * private PreviewHubAsset rows.
 *
 * SSRF guard: these URLs are stored from admin input (e.g. services/[id].ts accepts any URL), so the server
 * only fetches one when it is https, on this project's public Blob store host exactly, with no redirects,
 * a per-file timeout, a size cap enforced while reading, and an image/* Content-Type. Anything else is
 * listed in README as "external URL not fetched" and rendered as text on the Overview.
 *
 * Store host: PUBLIC_BLOB_STORE_HOST (publicBlobSafety.ts) when set. It is only set for Production, and
 * preview deployments share the production database and store, so the fallback is the store id inside
 * BLOB_READ_WRITE_TOKEN (vercel_blob_rw_<storeId>_<secret>): the store this app's upload routes write to.
 * Only the non-secret store id is read; it is already part of every public URL the store hands out.
 */
import { getConfiguredPublicBlobStoreHost } from '@/lib/storage/publicBlobSafety';

export type BuildPackRemoteImageSource = 'barber' | 'product' | 'service' | 'shopLogo';

export type BuildPackRemoteImage = {
  /** Stable id inside the pack: "<source>:<ownerId>". Never clashes with PreviewHubAsset ids. */
  id: string;
  source: BuildPackRemoteImageSource;
  ownerId: string;
  ownerName: string;
  url: string;
};

const PUBLIC_STORE_SUFFIX = '.public.blob.vercel-storage.com';
const STORE_HOST_RE = /^[a-z0-9][a-z0-9_-]*\.public\.blob\.vercel-storage\.com$/;

export const REMOTE_IMAGE_TIMEOUT_MS = 15_000;
export const REMOTE_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const REMOTE_IMAGE_NOT_FETCHED = 'external URL not fetched';

type Env = Record<string, string | undefined>;

function readEnv(name: string, env?: Env): string | undefined {
  if (env) return env[name];
  return process.env[name] ?? (typeof import.meta !== 'undefined' ? (import.meta.env?.[name] as string | undefined) : undefined);
}

/** This project's public Blob store host, or null (fail closed: nothing is fetched or rendered). */
export function remoteImageStoreHost(env?: Env): string | null {
  const configured = env
    ? (() => {
        const raw = String(env.PUBLIC_BLOB_STORE_HOST ?? '').trim().toLowerCase();
        return STORE_HOST_RE.test(raw) ? raw : null;
      })()
    : getConfiguredPublicBlobStoreHost();
  if (configured) return configured;
  const token = String(readEnv('BLOB_READ_WRITE_TOKEN', env) ?? readEnv('VERCEL_BLOB_READ_WRITE_TOKEN', env) ?? '').trim();
  const match = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(token);
  if (!match) return null;
  const host = `${match[1].toLowerCase()}${PUBLIC_STORE_SUFFIX}`;
  return STORE_HOST_RE.test(host) ? host : null;
}

/** True only for https URLs on exactly this project's public store host (no credentials, default port). */
export function isAllowedRemoteImageUrl(url: string | null | undefined, storeHost: string | null = remoteImageStoreHost()): boolean {
  if (!url || !storeHost) return false;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.port && parsed.port !== '443') return false;
  const host = parsed.hostname.toLowerCase();
  return host.endsWith(PUBLIC_STORE_SUFFIX) && host === storeHost;
}

/** Every dashboard image in the pack, in display order: team, products, services, shop logo. */
export function collectRemoteImages(input: {
  team: Array<{ id: string; name: string; avatarUrl: string | null }>;
  products: Array<{ id: string; name: string; imageUrl: string | null }>;
  services: Array<{ id: string; name: string; imageUrl: string | null }>;
  shop: { id: string; name: string; logoUrl: string | null } | null;
}): BuildPackRemoteImage[] {
  const out: BuildPackRemoteImage[] = [];
  const add = (source: BuildPackRemoteImageSource, ownerId: string, ownerName: string, url: string | null) => {
    const value = url?.trim();
    if (value) out.push({ id: `${source}:${ownerId}`, source, ownerId, ownerName, url: value });
  };
  for (const member of input.team) add('barber', member.id, member.name, member.avatarUrl);
  for (const product of input.products) add('product', product.id, product.name, product.imageUrl);
  for (const service of input.services) add('service', service.id, service.name, service.imageUrl);
  if (input.shop) add('shopLogo', input.shop.id, input.shop.name, input.shop.logoUrl);
  return out;
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/heic': 'heic',
};

/** Lowercase extension from the URL path ("…/logo-AbC123.PNG" → "png"), or null. */
export function remoteImageExtension(url: string): string | null {
  try {
    const match = /\.([a-z0-9]{1,8})$/i.exec(new URL(url).pathname);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

export function extensionForContentType(contentType: string | null | undefined): string {
  const type = (contentType ?? '').split(';')[0].trim().toLowerCase();
  return EXT_BY_TYPE[type] ?? 'img';
}

export type RemoteImageFetchResult =
  | { ok: true; bytes: Uint8Array; contentType: string }
  | { ok: false; reason: string };

/**
 * Fetches one allowlisted image fully into memory (at most maxBytes; callers fetch one at a time), so a
 * file that breaks a rule is never half-written into the zip.
 */
export async function fetchRemoteImage(
  url: string,
  options: {
    storeHost?: string | null;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    maxBytes?: number;
  } = {},
): Promise<RemoteImageFetchResult> {
  const storeHost = options.storeHost === undefined ? remoteImageStoreHost() : options.storeHost;
  if (!isAllowedRemoteImageUrl(url, storeHost)) return { ok: false, reason: REMOTE_IMAGE_NOT_FETCHED };
  const maxBytes = options.maxBytes ?? REMOTE_IMAGE_MAX_BYTES;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? REMOTE_IMAGE_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { redirect: 'error', signal: controller.signal, headers: { Accept: 'image/*' } });
    if (!response.ok || !response.body) return { ok: false, reason: `download failed (HTTP ${response.status})` };
    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      await response.body.cancel().catch(() => {});
      return { ok: false, reason: `not an image (${contentType.split(';')[0] || 'no content type'})` };
    }
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body.cancel().catch(() => {});
      return { ok: false, reason: `larger than ${Math.round(maxBytes / 1024 / 1024)} MB` };
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, reason: `larger than ${Math.round(maxBytes / 1024 / 1024)} MB` };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, bytes, contentType: contentType.split(';')[0].trim() };
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, reason: 'timed out' };
    return { ok: false, reason: `download failed (${error instanceof Error ? error.message : 'error'})` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Image URL columns per model and the remoteImages source each one becomes. buildPack.coverage.test.ts
 * fails when a new image-like URL column appears on these models without an entry here (or in
 * BUILD_PACK_NON_IMAGE_URL_FIELDS).
 */
export const BUILD_PACK_REMOTE_IMAGE_FIELDS = {
  Barber: { avatarUrl: 'barber' },
  Product: { imageUrl: 'product' },
  Service: { imageUrl: 'service' },
  ShopSettings: { logoUrl: 'shopLogo' },
} as const satisfies Record<string, Record<string, BuildPackRemoteImageSource>>;

/** URL columns on the same models that are links, not images. */
export const BUILD_PACK_NON_IMAGE_URL_FIELDS: Record<keyof typeof BUILD_PACK_REMOTE_IMAGE_FIELDS, readonly string[]> = {
  Barber: [],
  Product: [],
  Service: [],
  ShopSettings: ['googleBookingConfirmedUrl', 'sitePreviewUrl'],
};
