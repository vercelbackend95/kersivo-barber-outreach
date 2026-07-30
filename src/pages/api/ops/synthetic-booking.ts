export const prerender = false;

import type { APIRoute } from 'astro';
import { authorizeCronRequest } from '@/lib/ops/cronAuth';
import { runSyntheticBookingCheck } from '@/lib/ops/syntheticBooking';
import { opsLogError } from '@/lib/ops/opsLog';

async function handle(request: Request): Promise<Response> {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  try {
    const result = await runSyntheticBookingCheck(new Date());
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    opsLogError('ops.synthetic', 'cron_failed', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'synthetic-booking failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

export const GET: APIRoute = async ({ request }) => handle(request);
export const POST: APIRoute = async ({ request }) => handle(request);
