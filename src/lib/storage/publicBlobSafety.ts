import { prisma } from '@/lib/db/client';

const PUBLIC_HOST_RE = /^[a-z0-9][a-z0-9_-]*\.public\.blob\.vercel-storage\.com$/;

export type NormalizedPublicBlobUrl = {
  canonicalUrl: string;
  pathname: string;
  host: string;
};

export type ShopPurgePublicBlobDecision =
  | { ok: true; canonicalUrl: string; pathname: string }
  | { ok: false; reason: string };

/**
 * Non-secret exact public Blob store hostname.
 * Fail closed when missing or not a `*.public.blob.vercel-storage.com` host.
 * Never derived from tokens.
 */
export function getConfiguredPublicBlobStoreHost(): string | null {
  const raw = String(
    process.env.PUBLIC_BLOB_STORE_HOST ??
      (typeof import.meta !== 'undefined' ? import.meta.env?.PUBLIC_BLOB_STORE_HOST : undefined) ??
      '',
  )
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (!PUBLIC_HOST_RE.test(raw)) return null;
  return raw;
}

/** Parse + canonicalize a full HTTPS public Blob URL for this store. Rejects pathname-only. */
export function normalizePublicBlobHttpsUrl(urlOrPathname: string): NormalizedPublicBlobUrl | null {
  const value = urlOrPathname.trim();
  if (!value) return null;
  if (!/^https:\/\//i.test(value)) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.port && parsed.port !== '443') return null;

  const host = parsed.hostname.toLowerCase();
  const expected = getConfiguredPublicBlobStoreHost();
  if (!expected || host !== expected) return null;

  let pathname: string;
  try {
    pathname = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
  } catch {
    return null;
  }
  if (!pathname || pathname.includes('..') || pathname.includes('\\')) return null;

  return {
    host,
    pathname,
    canonicalUrl: `https://${host}/${pathname}`,
  };
}

export function isAllowedKersivoPublicUploadPathname(pathname: string): boolean {
  const path = pathname.replace(/^\/+/, '');
  return (
    path.startsWith('shops/') ||
    path.startsWith('products/') ||
    path.startsWith('barbers/') ||
    path.startsWith('clients/')
  );
}

export function shopIdFromShopsPrefixedPathname(pathname: string): string | null {
  const path = pathname.replace(/^\/+/, '');
  if (!path.startsWith('shops/')) return null;
  const rest = path.slice('shops/'.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  const id = rest.slice(0, slash).trim();
  return id || null;
}

/**
 * Contextual shop-purge candidate gate (not a generic "any Blob is safe" helper).
 * Requires full HTTPS URL on the configured public store + known upload namespace.
 */
export function evaluateShopPurgePublicBlobCandidate(
  url: string,
  purgedShopId: string,
): ShopPurgePublicBlobDecision {
  const normalized = normalizePublicBlobHttpsUrl(url);
  if (!normalized) {
    return { ok: false, reason: 'invalid_or_foreign_public_blob_url' };
  }
  if (!isAllowedKersivoPublicUploadPathname(normalized.pathname)) {
    return { ok: false, reason: 'disallowed_pathname_namespace' };
  }
  const pathShopId = shopIdFromShopsPrefixedPathname(normalized.pathname);
  if (pathShopId !== null && pathShopId !== purgedShopId) {
    return { ok: false, reason: 'shops_prefix_tenant_mismatch' };
  }
  return {
    ok: true,
    canonicalUrl: normalized.canonicalUrl,
    pathname: normalized.pathname,
  };
}

function pushNormalized(set: Set<string>, raw: string | null | undefined) {
  const value = raw?.trim();
  if (!value) return;
  const normalized = normalizePublicBlobHttpsUrl(value);
  if (normalized) set.add(normalized.canonicalUrl);
}

/**
 * Build a set of canonical public Blob URLs referenced by live shops
 * other than `excludeShopId` (omit exclude to include every live shop).
 */
export async function buildForeignPublicBlobCanonicalSet(
  excludeShopId: string | null,
  db: Pick<
    typeof prisma,
    'shopSettings' | 'product' | 'service' | 'barber' | 'client'
  > = prisma,
): Promise<Set<string>> {
  const shopWhere =
    excludeShopId && excludeShopId.trim()
      ? { id: { not: excludeShopId.trim() } }
      : {};

  const [shops, products, services, barbers, clients] = await Promise.all([
    db.shopSettings.findMany({
      where: { ...shopWhere, logoUrl: { not: null } },
      select: { logoUrl: true },
    }),
    db.product.findMany({
      where: { ...(excludeShopId ? { shopId: { not: excludeShopId } } : {}), imageUrl: { not: null } },
      select: { imageUrl: true },
    }),
    db.service.findMany({
      where: { ...(excludeShopId ? { shopId: { not: excludeShopId } } : {}), imageUrl: { not: null } },
      select: { imageUrl: true },
    }),
    db.barber.findMany({
      where: { ...(excludeShopId ? { shopId: { not: excludeShopId } } : {}), avatarUrl: { not: null } },
      select: { avatarUrl: true },
    }),
    db.client.findMany({
      where: { ...(excludeShopId ? { shopId: { not: excludeShopId } } : {}), avatarUrl: { not: null } },
      select: { avatarUrl: true },
    }),
  ]);

  const set = new Set<string>();
  for (const row of shops) pushNormalized(set, row.logoUrl);
  for (const row of products) pushNormalized(set, row.imageUrl);
  for (const row of services) pushNormalized(set, row.imageUrl);
  for (const row of barbers) pushNormalized(set, row.avatarUrl);
  for (const row of clients) pushNormalized(set, row.avatarUrl);
  return set;
}

/** Live cross-shop check: true if another live shop holds this canonical URL. */
export async function isCanonicalPublicBlobReferencedByOtherLiveShop(
  canonicalUrl: string,
  excludeShopId: string | null,
): Promise<boolean> {
  const set = await buildForeignPublicBlobCanonicalSet(excludeShopId);
  return set.has(canonicalUrl);
}

export const USER_SUPPLIED_PUBLIC_MEDIA_URL_REJECTED_CODE =
  'USER_SUPPLIED_PUBLIC_MEDIA_URL_REJECTED' as const;

export class UserSuppliedPublicMediaUrlRejectedError extends Error {
  readonly code = USER_SUPPLIED_PUBLIC_MEDIA_URL_REJECTED_CODE;

  constructor(message = 'This image URL cannot be attached to this shop.') {
    super(message);
    this.name = 'UserSuppliedPublicMediaUrlRejectedError';
  }
}

export function isUserSuppliedPublicMediaUrlRejectedError(
  error: unknown,
): error is UserSuppliedPublicMediaUrlRejectedError {
  return (
    error instanceof UserSuppliedPublicMediaUrlRejectedError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === USER_SUPPLIED_PUBLIC_MEDIA_URL_REJECTED_CODE)
  );
}

export type UserSuppliedPublicMediaUrlDecision =
  | { ok: true; reason: 'empty' | 'external' | 'own_shop_prefix' | 'unchanged_existing' }
  | { ok: false; reason: string };

/**
 * Write-time policy for user-controlled public media URL assignments.
 * Trusted same-request Blob uploads must NOT use this — they associate under the purge lock directly.
 *
 * - External (non-configured-public-store) URLs: allowed
 * - Foreign `*.public.blob.vercel-storage.com` host ≠ configured store: allowed as external
 * - Configured public store `shops/{id}/...`: only when id === shopId
 * - Configured store legacy products|barbers|clients: reject NEW associations; allow exact unchanged existing
 * - Malformed URL on our public host: fail closed
 */
export function evaluateUserSuppliedPublicMediaUrlAssignment(params: {
  shopId: string;
  proposedUrl: string | null | undefined;
  /** Existing value on the SAME entity being updated (not another row). */
  existingUrl?: string | null;
}): UserSuppliedPublicMediaUrlDecision {
  const proposed = params.proposedUrl?.trim() ?? '';
  if (!proposed) return { ok: true, reason: 'empty' };

  let parsed: URL;
  try {
    parsed = new URL(proposed);
  } catch {
    return { ok: false, reason: 'malformed_url' };
  }

  const host = parsed.hostname.toLowerCase();
  const looksLikeVercelPublicBlob = PUBLIC_HOST_RE.test(host);
  if (!looksLikeVercelPublicBlob) {
    return { ok: true, reason: 'external' };
  }

  const expected = getConfiguredPublicBlobStoreHost();
  if (!expected) {
    return { ok: false, reason: 'public_blob_store_host_unconfigured' };
  }

  if (host !== expected) {
    // Other Vercel public stores are external — not KERSIVO-owned.
    return { ok: true, reason: 'external' };
  }

  const normalized = normalizePublicBlobHttpsUrl(proposed);
  if (!normalized) {
    return { ok: false, reason: 'malformed_kersivo_public_blob_url' };
  }

  const existingCanonical = params.existingUrl
    ? normalizePublicBlobHttpsUrl(params.existingUrl)?.canonicalUrl ?? null
    : null;
  if (existingCanonical && existingCanonical === normalized.canonicalUrl) {
    return { ok: true, reason: 'unchanged_existing' };
  }

  const pathShopId = shopIdFromShopsPrefixedPathname(normalized.pathname);
  if (pathShopId !== null) {
    if (pathShopId === params.shopId) {
      return { ok: true, reason: 'own_shop_prefix' };
    }
    return { ok: false, reason: 'foreign_shop_blob_url' };
  }

  if (
    normalized.pathname.startsWith('products/') ||
    normalized.pathname.startsWith('barbers/') ||
    normalized.pathname.startsWith('clients/')
  ) {
    return { ok: false, reason: 'legacy_kersivo_blob_url_new_association' };
  }

  return { ok: false, reason: 'disallowed_kersivo_blob_pathname' };
}

export function assertUserSuppliedPublicMediaUrlAllowed(params: {
  shopId: string;
  proposedUrl: string | null | undefined;
  existingUrl?: string | null;
}): void {
  const decision = evaluateUserSuppliedPublicMediaUrlAssignment(params);
  if (!decision.ok) {
    throw new UserSuppliedPublicMediaUrlRejectedError();
  }
}

/**
 * Best-effort delete of a Blob freshly created by the same request when DB association lost.
 * Validates configured public host + allowed namespace. Optional expectedPathPrefix (e.g. shops/id/products/).
 */
export async function compensateFreshPublicBlobUpload(
  url: string,
  options: { expectedPathPrefix?: string; shopId?: string } = {},
): Promise<void> {
  const { deletePublicBlobObject } = await import('@/lib/storage/vercelBlob');
  const normalized = normalizePublicBlobHttpsUrl(url);
  if (!normalized) {
    console.error('[public-blob] compensation skipped: invalid or foreign URL', {
      shopId: options.shopId ?? null,
      phase: 'fresh_upload_compensation',
    });
    return;
  }
  if (!isAllowedKersivoPublicUploadPathname(normalized.pathname)) {
    console.error('[public-blob] compensation skipped: disallowed namespace', {
      shopId: options.shopId ?? null,
      phase: 'fresh_upload_compensation',
    });
    return;
  }
  const expected = options.expectedPathPrefix?.replace(/^\/+/, '');
  if (expected && !normalized.pathname.startsWith(expected)) {
    console.error('[public-blob] compensation skipped: path prefix mismatch', {
      shopId: options.shopId ?? null,
      phase: 'fresh_upload_compensation',
    });
    return;
  }
  try {
    await deletePublicBlobObject(normalized.canonicalUrl);
  } catch (error) {
    console.error('[public-blob] fresh upload compensation delete failed', {
      shopId: options.shopId ?? null,
      phase: 'fresh_upload_compensation',
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}
