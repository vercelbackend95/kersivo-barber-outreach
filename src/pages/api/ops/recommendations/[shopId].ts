import type { APIContext } from 'astro';

import { OPS_API_HEADERS, requireOperatorAccess } from '@/lib/ops/operatorAuth';
import { getRecommendationOpsShopDetail } from '@/lib/recommendations/ops/readModel';
import { DETAIL_MAX_SHOP_ID_LENGTH } from '@/lib/recommendations/ops/types';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...OPS_API_HEADERS },
  });
}

function parseShopIdParam(
  raw: string | undefined,
): { ok: true; shopId: string } | { ok: false; code: 'INVALID_QUERY' } {
  if (raw == null) return { ok: false, code: 'INVALID_QUERY' };
  const shopId = raw.trim();
  if (!shopId || shopId.length > DETAIL_MAX_SHOP_ID_LENGTH) {
    return { ok: false, code: 'INVALID_QUERY' };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(shopId)) {
    return { ok: false, code: 'INVALID_QUERY' };
  }
  return { ok: true, shopId };
}

export async function GET(context: APIContext): Promise<Response> {
  const access = await requireOperatorAccess(context);
  if (access instanceof Response) return access;

  try {
    const parsed = parseShopIdParam(context.params.shopId);
    if (!parsed.ok) {
      return json({ ok: false, error: { code: 'INVALID_QUERY' } }, 400);
    }

    const detail = await getRecommendationOpsShopDetail(parsed.shopId);
    if (!detail) {
      return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
    }

    return json({
      ok: true,
      generatedAt: detail.overview.health.generatedAt,
      data: detail,
      nextCursor: null,
    });
  } catch {
    return json({ ok: false, error: { code: 'INTERNAL_ERROR' } }, 500);
  }
}

export async function POST(): Promise<Response> {
  return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
}

export async function PUT(): Promise<Response> {
  return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
}

export async function PATCH(): Promise<Response> {
  return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
}

export async function DELETE(): Promise<Response> {
  return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
}
