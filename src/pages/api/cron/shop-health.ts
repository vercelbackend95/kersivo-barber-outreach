export const prerender = false;

/** Hourly shop health run (docs/ops/shop-health.md). Bearer CRON_SECRET. */
import type { APIRoute } from 'astro';
import { authorizeCronRequest } from '@/lib/ops/cronAuth';
import { opsLogError } from '@/lib/ops/opsLog';
import { runShopHealthCron } from '@/lib/ops/shopHealth/cron';

async function handle(request: Request): Promise<Response> {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;
  try {
    const summary = await runShopHealthCron();
    return new Response(JSON.stringify({ ok: true, ...summary }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    opsLogError('ops.shop_health', 'cron_failed', error);
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'shop-health failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
}

export const GET: APIRoute = async ({ request }) => handle(request);
export const POST: APIRoute = async ({ request }) => handle(request);
