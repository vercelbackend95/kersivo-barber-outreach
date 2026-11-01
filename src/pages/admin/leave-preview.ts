export const prerender = false;

import type { APIRoute } from 'astro';
import { clearHubCookie } from '@/lib/adminHub/hubSession';
import { isSameOriginFormPost } from '@/lib/adminHub/adminMode';
import { PRIVATE_PREVIEW_HEADERS } from '@/lib/freePreview/previewHeaders';
import { isAdminHubRouteEnabled } from '@/lib/freePreview/hubPage';

/**
 * "Leave preview" in the hub account row: a plain form POST (works without JS) that clears `ks_hub`.
 * Outside /api/ on purpose: /admin is served with Referrer-Policy: no-referrer, so the browser sends
 * `Origin: null` on the form POST and the /api origin gate would refuse it.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!isAdminHubRouteEnabled()) return new Response('Not found', { status: 404, headers: PRIVATE_PREVIEW_HEADERS });
  if (!isSameOriginFormPost(request)) {
    return new Response('Forbidden', { status: 403, headers: PRIVATE_PREVIEW_HEADERS });
  }
  const headers = new Headers(PRIVATE_PREVIEW_HEADERS);
  headers.set('Location', '/');
  headers.append('Set-Cookie', clearHubCookie());
  return new Response(null, { status: 303, headers });
};
