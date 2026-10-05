export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess } from '@/lib/admin/auth';
import { requirePermission } from '@/lib/admin/rbac/can';
import { requireAdminProductCapability } from '@/lib/admin/productCapability';
import { prisma } from '@/lib/db/client';
import { getSiteLaunchStatus } from '@/lib/setup/siteLaunch';
import { loadFullBookingDestinationForState } from '@/lib/shop/fullBookingDestination';
import { loadKersivoAccess } from '@/lib/shop/kersivoAccess';
import { resolvePublicBookingDestination } from '@/lib/shop/publicBookingDestination';

export const GET: APIRoute = async (context) => {
  const access = await resolveAdminAccess(context);
  if (!access || access.via !== 'session') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const denied = requirePermission(access, 'billing.manage');
  if (denied) return denied;
  const grant = await requireAdminProductCapability(access, 'BRANDED_SITE');
  if (grant instanceof Response) return grant;

  const shop = await prisma.shopSettings.findUnique({
    where: { id: access.shopId },
    select: {
      sitePreviewUrl: true,
      sitePreviewVersion: true,
      sitePreviewReadyAt: true,
      launchApprovedAt: true,
      launchApprovedByUserId: true,
      launchApprovedByEmail: true,
      launchApprovedVersion: true,
      goLiveAt: true,
    },
  });

  if (!shop) {
    return new Response(JSON.stringify({ error: 'Shop not found' }), { status: 404 });
  }

  const status = getSiteLaunchStatus(shop);
  // Preview approval / goLiveAt never imply a live domain: only the OPS-verified destination does.
  const productAccess = grant.productAccess ?? (await loadKersivoAccess(access.shopId));
  const fullDestination = await loadFullBookingDestinationForState(access.shopId, productAccess.state);
  const bookingDestination = resolvePublicBookingDestination({
    state: productAccess.state,
    shop: { id: access.shopId, bookingSlug: null },
    fullDestination,
  });

  return new Response(
    JSON.stringify({
      shopId: access.shopId,
      status,
      previewUrl: shop.sitePreviewUrl ?? null,
      siteVersion: shop.sitePreviewVersion ?? null,
      previewReadyAt: shop.sitePreviewReadyAt?.toISOString() ?? null,
      approvedAt: shop.launchApprovedAt?.toISOString() ?? null,
      approvedByEmail: shop.launchApprovedByEmail ?? null,
      approvedVersion: shop.launchApprovedVersion ?? null,
      goLiveAt: shop.goLiveAt?.toISOString() ?? null,
      liveBookingDestination:
        bookingDestination.kind === 'own_domain' ? bookingDestination.url : null,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
