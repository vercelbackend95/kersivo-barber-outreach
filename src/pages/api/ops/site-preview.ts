export const prerender = false;

import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db/client';
import { SITE_LAUNCH_ACTIONS, recordSiteLaunchEvent } from '@/lib/setup/siteLaunch';

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

  const previewUrlRaw = body.previewUrl?.trim() ?? '';
  let previewUrl: string;
  try {
    const parsed = new URL(previewUrlRaw);
    if (parsed.protocol !== 'https:' || !parsed.hostname) {
      return badRequest('previewUrl must be a valid https:// URL.');
    }
    // Avoid forcing a trailing slash on bare origins (URL.toString does).
    previewUrl =
      parsed.pathname === '/' && !parsed.search && !parsed.hash
        ? `https://${parsed.host}`
        : parsed.toString();
  } catch {
    return badRequest('previewUrl must be a valid https:// URL.');
  }

  const siteVersion = body.siteVersion?.trim();
  if (!siteVersion || siteVersion.length > 80) return badRequest('siteVersion is required.');

  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: { sitePreviewUrl: true },
  });

  if (!shop) return badRequest('Shop not found.');

  const isUpdate = !!shop.sitePreviewUrl;

  await prisma.shopSettings.update({
    where: { id: shopId },
    data: {
      sitePreviewUrl: previewUrl,
      sitePreviewVersion: siteVersion,
      sitePreviewReadyAt: isUpdate ? undefined : new Date(),
      // Clear approval on preview update so status resets to ready_for_review
      launchApprovedAt: null,
      launchApprovedByUserId: null,
      launchApprovedByEmail: null,
      launchApprovedVersion: null,
      goLiveAt: null,
    },
  });

  await recordSiteLaunchEvent({
    shopId,
    action: isUpdate ? SITE_LAUNCH_ACTIONS.PREVIEW_UPDATED : SITE_LAUNCH_ACTIONS.PREVIEW_READY,
    siteVersion,
    previewUrl,
    request,
  });

  return new Response(JSON.stringify({ ok: true, action: isUpdate ? 'updated' : 'ready' }), {
    status: 200,
  });
};
