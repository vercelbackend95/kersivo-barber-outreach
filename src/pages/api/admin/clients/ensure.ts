export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminPermission } from '../../../../lib/admin/auth';
import { upsertShopClient } from '../../../../lib/admin/clientUpsert';

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'clients.write');
  if (access instanceof Response) return access;

  const payload = (await ctx.request.json().catch(() => null)) as {
    email?: unknown;
    fullName?: unknown;
    phone?: unknown;
  } | null;

  if (!payload || typeof payload.email !== 'string' || !payload.email.trim()) {
    return new Response(JSON.stringify({ error: 'Invalid email.' }), { status: 400 });
  }

  try {
    const client = await upsertShopClient({
      email: payload.email,
      fullName: typeof payload.fullName === 'string' ? payload.fullName : null,
      phone: typeof payload.phone === 'string' ? payload.phone : null,
      shopId: access.shopId,
    });

    return new Response(JSON.stringify({ clientId: client.id }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not ensure client.';
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }
};
