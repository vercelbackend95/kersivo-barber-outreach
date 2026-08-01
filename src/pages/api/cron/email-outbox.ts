export const prerender = false;

import type { APIRoute } from 'astro';
import { processDueEmailOutbox } from '@/lib/email/outbox';
import { authorizeCronRequest } from '@/lib/ops/cronAuth';
import { opsLogError } from '@/lib/ops/opsLog';

async function handle(request: Request): Promise<Response> {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  try {
    const summary = await processDueEmailOutbox(new Date());
    return new Response(JSON.stringify({ ok: true, ...summary }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    opsLogError('email.outbox', 'cron_failed', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'email-outbox failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

export const GET: APIRoute = async ({ request }) => handle(request);
export const POST: APIRoute = async ({ request }) => handle(request);
