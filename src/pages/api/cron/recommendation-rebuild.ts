export const prerender = false;

import type { APIRoute } from 'astro';

import { processDueRecommendationRebuilds } from '@/lib/recommendations/processor';
import { authorizeCronRequest } from '@/lib/ops/cronAuth';
import { opsLogError } from '@/lib/ops/opsLog';

async function handle(request: Request): Promise<Response> {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  try {
    const summary = await processDueRecommendationRebuilds(new Date());
    return new Response(JSON.stringify({ ok: true, ...summary }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    opsLogError('recommendations.cron', 'failed', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'recommendation-rebuild failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

export const GET: APIRoute = async ({ request }) => handle(request);
export const POST: APIRoute = async ({ request }) => handle(request);
