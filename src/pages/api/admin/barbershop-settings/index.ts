export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { serializeShopOpeningHours } from '@/lib/admin/shopOpeningHours';
import { isPauseActiveNow, storedPauseDateToIso } from '@/lib/admin/shopPublicActivity';
import { prisma } from '@/lib/db/client';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  const denied = requireAnyPermission(access, ['shop.settings']);
  if (denied) return denied;

  const shop = await prisma.shopSettings.findUnique({
    where: { id: access.shopId },
    select: {
      name: true,
      townCity: true,
      logoUrl: true,
      timezone: true,
      publicActivityPaused: true,
      publicActivityPausedAt: true,
      publicActivityPauseFrom: true,
      publicActivityPauseUntil: true,
      publicActivityPauseReason: true,
    },
  });

  if (!shop) {
    return json({ error: 'Shop not found.' }, 404);
  }

  const hours = await serializeShopOpeningHours(access.shopId);

  return json({
    identity: {
      name: shop.name,
      townCity: shop.townCity,
      logoUrl: shop.logoUrl,
    },
    hours,
    pause: {
      paused: shop.publicActivityPaused,
      pausedNow: isPauseActiveNow(shop),
      pausedAt: shop.publicActivityPausedAt?.toISOString() ?? null,
      from: shop.publicActivityPauseFrom ? storedPauseDateToIso(shop.publicActivityPauseFrom) : null,
      until: shop.publicActivityPauseUntil ? storedPauseDateToIso(shop.publicActivityPauseUntil) : null,
      reason: shop.publicActivityPauseReason,
    },
  });
};
