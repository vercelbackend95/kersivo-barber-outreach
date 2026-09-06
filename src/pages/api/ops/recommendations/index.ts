import type { APIContext } from 'astro';

import { OPS_API_HEADERS, requireOperatorAccess } from '@/lib/ops/operatorAuth';
import {
  decodeOverviewCursor,
  listRecommendationOpsOverview,
  OVERVIEW_MAX_LIMIT,
} from '@/lib/recommendations/ops/readModel';
import {
  OVERVIEW_MAX_CURSOR_LENGTH,
  OVERVIEW_MAX_SEARCH_LENGTH,
} from '@/lib/recommendations/ops/types';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...OPS_API_HEADERS },
  });
}

function parseLimit(raw: string | null): number | { error: true } {
  if (raw == null || raw === '') return 25;
  if (!/^\d+$/.test(raw)) return { error: true };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > OVERVIEW_MAX_LIMIT) return { error: true };
  return n;
}

export async function GET(context: APIContext): Promise<Response> {
  const access = await requireOperatorAccess(context);
  if (access instanceof Response) return access;

  try {
    const url = new URL(context.request.url);
    const limitParsed = parseLimit(url.searchParams.get('limit'));
    if (typeof limitParsed === 'object') {
      return json({ ok: false, error: { code: 'INVALID_QUERY' } }, 400);
    }
    const cursorRaw = url.searchParams.get('cursor');
    if (cursorRaw != null && cursorRaw.length > OVERVIEW_MAX_CURSOR_LENGTH) {
      return json({ ok: false, error: { code: 'INVALID_QUERY' } }, 400);
    }
    if (cursorRaw && !decodeOverviewCursor(cursorRaw)) {
      return json({ ok: false, error: { code: 'INVALID_QUERY' } }, 400);
    }
    const q = url.searchParams.get('q');
    if (q != null && q.length > OVERVIEW_MAX_SEARCH_LENGTH) {
      return json({ ok: false, error: { code: 'INVALID_QUERY' } }, 400);
    }

    const result = await listRecommendationOpsOverview({
      limit: limitParsed,
      cursor: cursorRaw,
      search: q,
    });

    return json({
      ok: true,
      generatedAt: result.generatedAt,
      data: { shops: result.shops },
      nextCursor: result.nextCursor,
    });
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'INVALID_QUERY'
        ? 'INVALID_QUERY'
        : 'INTERNAL_ERROR';
    return json({ ok: false, error: { code } }, code === 'INVALID_QUERY' ? 400 : 500);
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
