export const prerender = false;

import type { APIRoute } from 'astro';
import { runFreePreviewLifecycle } from '@/lib/freePreview/lifecycle';
import { authorizeCronRequest } from '@/lib/ops/cronAuth';

async function handle(request: Request): Promise<Response> {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;
  try {
    const result = await runFreePreviewLifecycle(new Date());
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[cron/free-preview-lifecycle] failed', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Free preview lifecycle cron failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

export const GET: APIRoute = async ({ request }) => handle(request);
export const POST: APIRoute = async ({ request }) => handle(request);
