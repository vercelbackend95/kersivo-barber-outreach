export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx); if (unauthorized) return unauthorized;
  const clientId = ctx.params.clientId;
  if (!clientId) return new Response(JSON.stringify({ error: 'Missing client id.' }), { status: 400 });

  const payload = (await ctx.request.json().catch(() => null)) as { notes?: unknown } | null;
  if (!payload || typeof payload.notes !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid notes payload.' }), { status: 400 });
  }

  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });

  const updated = await prisma.client.updateMany({
    where: { id: clientId, shopId: shop.id },
    data: { notes: payload.notes }
  });

  if (updated.count === 0) {
    return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404 });
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, notes: true, updatedAt: true }
  });

  return new Response(JSON.stringify({ client }));
};
