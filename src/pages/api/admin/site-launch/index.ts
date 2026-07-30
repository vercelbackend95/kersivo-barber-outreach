export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess } from '@/lib/admin/auth';
import { requirePermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';
import { getSiteLaunchStatus } from '@/lib/setup/siteLaunch';

export const GET: APIRoute = async (context) => {
  const access = await resolveAdminAccess(context);
  if (!access || access.via !== 'session') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const denied = requirePermission(access, 'billing.manage');
  if (denied) return denied;

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
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
