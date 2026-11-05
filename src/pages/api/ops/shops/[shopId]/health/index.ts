export const prerender = false;

/** GET /api/ops/shops/[shopId]/health — latest stored run and the last 20 runs (docs/ops/shop-health.md). Operator only. */
import type { APIRoute } from 'astro';
import { OPS_API_HEADERS, requireOperatorAccess } from '@/lib/ops/operatorAuth';
import { loadShopHealthReport, serialiseShopHealthReport } from '@/lib/ops/shopHealth/report';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...OPS_API_HEADERS } });
}

export const GET: APIRoute = async (context) => {
  const access = await requireOperatorAccess(context);
  if (access instanceof Response) return access;

  const shopId = (context.params.shopId ?? '').trim();
  if (!shopId || shopId.length > 64) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);

  const report = await loadShopHealthReport(shopId);
  if (!report) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  return json({ ok: true, report: serialiseShopHealthReport(report) });
};
