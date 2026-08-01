export const prerender = false;

import type { APIRoute } from 'astro';
import { prisma } from '../../../lib/db/client';

export const GET: APIRoute = async ({ request }) => {
  const sessionId = new URL(request.url).searchParams.get('session_id');
  if (!sessionId) return new Response(JSON.stringify({ error: 'session_id is required' }), { status: 400 });

  const order = await prisma.order.findUnique({
    where: { stripeSessionId: sessionId },
    select: {
      id: true,
      reference: true,
      totalPence: true,
      currency: true,
      status: true,
      items: {
        select: {
          id: true,
          nameSnapshot: true,
          quantity: true,
          lineTotalPence: true,
        },
      },
    },
  });

  if (!order) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 });

  // Never expose customerEmail — session_id alone must not leak PII.
  return new Response(JSON.stringify({ order }), { status: 200 });
};
