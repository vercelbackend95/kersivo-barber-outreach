export const prerender = false;

import type { APIRoute } from 'astro';
import { SITE_VERSION_MAX, applySitePreview, normalizeSitePreviewUrl } from '@/lib/setup/sitePreview';

function getCronSecret(): string {
  return (import.meta.env.CRON_SECRET ?? process.env.CRON_SECRET ?? '').toString().trim();
}

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), { status: 400 });
}

type SitePreviewInput = {
  shopId: string;
  previewUrl: string;
  siteVersion: string;
};

export const POST: APIRoute = async ({ request }) => {
  const secret = getCronSecret();
  if (!secret) {
    return new Response(JSON.stringify({ error: 'CRON_SECRET is not configured.' }), { status: 503 });
  }

  const auth = request.headers.get('authorization')?.trim() ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || token !== secret) {
    return unauthorized();
  }

  let body: SitePreviewInput;
  try {
    body = (await request.json()) as SitePreviewInput;
  } catch {
    return badRequest('Invalid request body.');
  }

  const shopId = body.shopId?.trim();
  if (!shopId) return badRequest('shopId is required.');

  const previewUrl = normalizeSitePreviewUrl(body.previewUrl);
  if (!previewUrl) return badRequest('previewUrl must be a valid https:// URL.');

  const siteVersion = body.siteVersion?.trim();
  if (!siteVersion || siteVersion.length > SITE_VERSION_MAX) return badRequest('siteVersion is required.');

  const result = await applySitePreview({ shopId, previewUrl, siteVersion, request });
  if (!result.ok) return badRequest('Shop not found.');

  return new Response(JSON.stringify({ ok: true, action: result.action }), {
    status: 200,
  });
};
