export const prerender = false;

import type { APIRoute } from 'astro';
import { authorizeCronRequest } from '@/lib/ops/cronAuth';
import { prisma } from '@/lib/db/client';

export const GET: APIRoute = async ({ request }) => {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const sinceRaw = url.searchParams.get('since');
  const since = sinceRaw ? new Date(sinceRaw) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (Number.isNaN(since.getTime())) {
    return new Response(JSON.stringify({ error: 'Invalid since (ISO date).' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50)));

  const [sms, webhooks] = await Promise.all([
    prisma.smsOutbound.findMany({
      where: { status: 'FAILED', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        shopId: true,
        bookingId: true,
        purpose: true,
        error: true,
        createdAt: true,
        provider: true,
      },
    }),
    prisma.stripeWebhookEvent.findMany({
      where: { status: 'FAILED', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        error: true,
        httpStatus: true,
        createdAt: true,
        processedAt: true,
      },
    }),
  ]);

  return new Response(
    JSON.stringify({
      since: since.toISOString(),
      emailFailures: [],
      smsFailures: sms,
      webhookFailures: webhooks,
      note: 'emailFailures empty until EmailOutbound ships on main',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
