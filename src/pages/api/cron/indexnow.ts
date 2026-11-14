export const prerender = false;

import type { APIRoute } from 'astro';
import { authorizeCronRequest } from '@/lib/ops/cronAuth';
import { opsLog } from '@/lib/ops/opsLog';
import { submitRecentlyChangedUrls } from '@/lib/seo/indexNow';

/**
 * Daily IndexNow ping (vercel.json crons). Submits only the sitemap URLs whose lastmod is today or
 * yesterday, and only on the production deployment, so previews never ping and nothing is resubmitted
 * day after day. Always answers 200 once authorised: an IndexNow outage is logged, not retried.
 */
async function handle(request: Request): Promise<Response> {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const result = await submitRecentlyChangedUrls({
    now: new Date(),
    enabled: process.env.VERCEL_ENV === 'production',
  });
  opsLog('seo.indexnow', result.status, {
    urls: result.urls.length,
    httpStatus: 'httpStatus' in result ? result.httpStatus : undefined,
    reason: 'reason' in result ? result.reason : undefined,
    error: 'error' in result ? result.error : undefined,
  });
  return new Response(JSON.stringify({ ok: result.status !== 'failed', ...result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request }) => handle(request);
export const POST: APIRoute = async ({ request }) => handle(request);
