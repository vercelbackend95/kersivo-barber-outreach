export const prerender = false;

import type { APIRoute } from 'astro';
import { runSaasLifecycleCron } from '@/lib/setup/saasSubscriptionLifecycle';

function cronSecret(): string {
  return (import.meta.env.CRON_SECRET ?? process.env.CRON_SECRET ?? '').toString().trim();
}

function authorize(request: Request): Response | null {
  const expected = cronSecret();
  if (!expected) {
    if (import.meta.env.PROD === true || process.env.NODE_ENV === 'production') {
      return new Response(JSON.stringify({ error: 'CRON_SECRET is not configured.' }), { status: 503 });
    }
    return null;
  }
  const header = request.headers.get('authorization') ?? '';
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (bearer && bearer === expected) return null;
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
}

async function handle(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  try {
    const result = await runSaasLifecycleCron(new Date());
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[cron/saas-lifecycle] failed', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'SaaS lifecycle cron failed',
      }),
      { status: 500 },
    );
  }
}

export const GET: APIRoute = async ({ request }) => handle(request);
export const POST: APIRoute = async ({ request }) => handle(request);
