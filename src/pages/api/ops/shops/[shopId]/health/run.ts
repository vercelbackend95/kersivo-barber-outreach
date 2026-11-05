export const prerender = false;

/**
 * POST /api/ops/shops/[shopId]/health/run — run every check now, including probes (docs/ops/shop-health.md).
 * Operator only, same-origin JSON. Body: {} for "Run checks now" (1 per minute per shop) or
 * { "launch": true } for the "Mark live" guard (a LAUNCH run in LIVE mode; own bucket, 3 per minute).
 */
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { OPS_API_HEADERS } from '@/lib/ops/operatorAuth';
import { requireOperatorMutation } from '@/lib/ops/requireOperatorMutation';
import { checkDurableRateLimit } from '@/lib/rate-limit/durableRateLimit';
import { ShopNotFoundError } from '@/lib/ops/shopHealth/context';
import { runShopHealth, type ShopHealthRunResult } from '@/lib/ops/shopHealth/run';
import { opsLogError } from '@/lib/ops/opsLog';

export const RUN_RATE_LIMIT = { action: 'ops_shop_health_run', limit: 1, windowMs: 60_000 } as const;
export const LAUNCH_RATE_LIMIT = { action: 'ops_shop_health_launch', limit: 3, windowMs: 60_000 } as const;

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...OPS_API_HEADERS, ...extra } });
}

const schema = z.object({ launch: z.boolean().optional() }).strict();

export function serialiseRunResult(result: ShopHealthRunResult) {
  const brief = (r: ShopHealthRunResult['results'][number]) => ({
    id: r.id,
    area: r.area,
    title: r.title,
    status: r.status,
    message: r.message,
    fix: r.fix,
  });
  return {
    runId: result.runId,
    shopId: result.shopId,
    trigger: result.trigger,
    mode: result.mode,
    overall: result.overall,
    readiness: result.readiness,
    failing: result.failing.map(brief),
    warnings: result.warnings.map(brief),
    results: result.results,
    startedAt: result.startedAt.toISOString(),
    durationMs: result.durationMs,
  };
}

export const POST: APIRoute = async (context) => {
  const access = await requireOperatorMutation(context);
  if (access instanceof Response) return access;

  const shopId = (context.params.shopId ?? '').trim();
  if (!shopId || shopId.length > 64) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);

  const body = await context.request.json().catch(() => ({}));
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return json({ ok: false, error: { code: 'VALIDATION' } }, 400);
  const launch = parsed.data.launch === true;

  const bucket = launch ? LAUNCH_RATE_LIMIT : RUN_RATE_LIMIT;
  const limited = await checkDurableRateLimit({ key: `shop:${shopId}`, ...bucket });
  if (!limited.ok) {
    return json(
      { ok: false, error: { code: 'RATE_LIMITED', retryAfterSeconds: limited.retryAfterSeconds ?? 60 } },
      429,
      { 'Retry-After': String(limited.retryAfterSeconds ?? 60) },
    );
  }

  try {
    const result = await runShopHealth(shopId, {
      trigger: launch ? 'LAUNCH' : 'MANUAL',
      probes: true,
      ...(launch ? { mode: 'LIVE' as const } : {}),
    });
    return json({ ok: true, run: serialiseRunResult(result) });
  } catch (error) {
    if (error instanceof ShopNotFoundError) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
    opsLogError('ops.shop_health', 'manual_run_failed', error, { shopId, launch, actor: access.email });
    return json({ ok: false, error: { code: 'RUN_FAILED' } }, 500);
  }
};
