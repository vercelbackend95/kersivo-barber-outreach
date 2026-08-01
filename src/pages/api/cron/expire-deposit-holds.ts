export const prerender = false;

import type { APIRoute } from 'astro';
import { processExpiredDepositHolds } from '../../../lib/booking/depositHoldExpiry';
import { authorizeCronRequest } from '../../../lib/ops/cronAuth';

async function handle(request: Request): Promise<Response> {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;
  const result = await processExpiredDepositHolds(new Date());
  return new Response(JSON.stringify({ ok: true, ...result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request }) => handle(request);
export const POST: APIRoute = async ({ request }) => handle(request);
