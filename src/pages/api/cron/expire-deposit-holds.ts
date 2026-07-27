export const prerender = false;

import type { APIRoute } from 'astro';
import { expireUnpaidDepositHolds } from '../../../lib/booking/depositMoney';

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
  const expired = await expireUnpaidDepositHolds(new Date());
  return new Response(JSON.stringify({ ok: true, expired }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request }) => handle(request);
export const POST: APIRoute = async ({ request }) => handle(request);
