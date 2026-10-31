export const prerender = false;

import type { APIRoute } from 'astro';
import { isPreviewHubRealQaEnabled } from '@/lib/previewHub/realQa';

export const GET: APIRoute = async () => {
  if (!isPreviewHubRealQaEnabled()) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
};
