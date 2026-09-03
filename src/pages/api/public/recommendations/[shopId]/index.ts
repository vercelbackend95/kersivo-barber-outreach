export const prerender = false;

import type { APIRoute } from 'astro';

import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';
import { readPublishedRecommendations } from '@/lib/recommendations/reader';

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export const GET: APIRoute = async (ctx) => {
  const limited = await enforceIpRateLimit(ctx.request, 'recommendations_read', 60, 15 * 60 * 1000);
  if (limited) return limited;

  const shopId = ctx.params.shopId?.trim() ?? '';
  const url = new URL(ctx.request.url);
  const serviceIds = url.searchParams.getAll('serviceId').map((id) => id.trim()).filter(Boolean);

  const result = await readPublishedRecommendations({ shopId, serviceIds });
  if (!result.ok) {
    return json({ ok: false, error: result.error }, result.status);
  }

  return json(result.response, 200, {
    'Cache-Control': 'private, max-age=60',
  });
};
