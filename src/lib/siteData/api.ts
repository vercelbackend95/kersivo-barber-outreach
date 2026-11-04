/**
 * HTTP layer for the site data contract. Shop websites (built outside this repo, one Vercel
 * project per shop) fetch their data here and bind a design to it.
 *
 * Caching: the public response is cached on the CDN for SITE_DATA_CDN_MAX_AGE seconds. The cache
 * key is the full URL, which always contains the shop identifier, so one shop's data can never be
 * served for another. Saved changes are live within that window, with no redeploy.
 */
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';
import { isPreviewExpired, resolvePreviewRequestByToken } from '@/lib/freePreview/previewAccess';
import { getSiteData, isSitePublished, loadSiteDataForShop } from './getSiteData';
import type { SiteData } from './types';

export const SITE_DATA_CDN_MAX_AGE = 30;
export const SITE_DATA_PREVIEW_TOKEN_HEADER = 'x-kersivo-preview-token';

const BLOCKED_PREVIEW_STATUSES = new Set(['REJECTED', 'DECLINED', 'EXPIRED']);

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

export const PUBLIC_SITE_DATA_HEADERS = {
  'Cache-Control': `public, max-age=0, s-maxage=${SITE_DATA_CDN_MAX_AGE}, stale-while-revalidate=${SITE_DATA_CDN_MAX_AGE * 2}`,
  'Access-Control-Allow-Origin': '*',
  'X-Robots-Tag': 'noindex',
} as const;

const NOT_FOUND_HEADERS = {
  'Cache-Control': `public, max-age=0, s-maxage=${SITE_DATA_CDN_MAX_AGE}`,
  'Access-Control-Allow-Origin': '*',
  'X-Robots-Tag': 'noindex',
} as const;

export const PRIVATE_SITE_DATA_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
} as const;

/** GET /api/public/site/{shopSlugOrDomain}[?location=id] */
export async function handlePublicSiteData(
  identifier: string | undefined,
  url: URL,
  deps: { getSiteData?: typeof getSiteData; now?: Date } = {},
): Promise<Response> {
  const load = deps.getSiteData ?? getSiteData;
  const id = (identifier ?? '').trim();
  if (!id || id.length > 253) return json({ error: 'Not found.' }, 404, NOT_FOUND_HEADERS);
  const location = url.searchParams.get('location') ?? undefined;
  let site: SiteData | null;
  try {
    site = await load(id, location, { now: deps.now });
  } catch (error) {
    console.error('[site-data] load failed', error instanceof Error ? error.message : error);
    return json({ error: 'Temporarily unavailable.' }, 503, { 'Cache-Control': 'no-store' });
  }
  // Plans control publishing, never storage: data stays, the site just is not served.
  if (!site || !isSitePublished(site)) return json({ error: 'Not found.' }, 404, NOT_FOUND_HEADERS);
  return json(site, 200, PUBLIC_SITE_DATA_HEADERS);
}

/** GET /api/public/site-preview with header X-Kersivo-Preview-Token: the private preview token. */
export async function handlePreviewSiteData(
  request: Request,
  deps: {
    resolveToken?: typeof resolvePreviewRequestByToken;
    loadShop?: typeof loadSiteDataForShop;
    rateLimit?: (request: Request) => Promise<Response | null>;
    now?: Date;
  } = {},
): Promise<Response> {
  const rateLimit = deps.rateLimit ?? ((r: Request) => enforceIpRateLimit(r, 'site_data_preview', 120, 60_000));
  const limited = await rateLimit(request);
  if (limited) return limited;

  const notFound = () => json({ error: 'Not found.' }, 404, PRIVATE_SITE_DATA_HEADERS);
  const token = request.headers.get(SITE_DATA_PREVIEW_TOKEN_HEADER)?.trim();
  if (!token) return notFound();

  const now = deps.now ?? new Date();
  const preview = await (deps.resolveToken ?? resolvePreviewRequestByToken)(token);
  if (!preview?.draftShopId) return notFound();
  if (BLOCKED_PREVIEW_STATUSES.has(preview.status) || isPreviewExpired(preview, now)) return notFound();

  const site = await (deps.loadShop ?? loadSiteDataForShop)(preview.draftShopId, { mode: 'preview', now });
  if (!site) return notFound();
  return json(site, 200, PRIVATE_SITE_DATA_HEADERS);
}
