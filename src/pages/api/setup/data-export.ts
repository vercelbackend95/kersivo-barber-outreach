export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess, requireVerifiedEmail } from '@/lib/admin/auth';
import { requirePermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';
import { saasSubscriptionAllowsDataExport } from '@/lib/setup/saasEntitlement';
import { buildShopClientBookingCsv } from '@/lib/setup/saasDataExport';

async function findShopSubscription(shopId: string) {
  let subscription = await prisma.saasSubscription.findFirst({
    where: { shopId, status: { not: 'PENDING' } },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription) {
    const shop = await prisma.shopSettings.findUnique({
      where: { id: shopId },
      select: { owner: { select: { email: true } } },
    });
    const ownerEmail = shop?.owner?.email?.trim().toLowerCase();
    if (ownerEmail) {
      // Anonymous checkout orphans only — never stamp/consume another shop's sub.
      subscription = await prisma.saasSubscription.findFirst({
        where: {
          shopId: null,
          customerEmail: { equals: ownerEmail, mode: 'insensitive' },
          status: { not: 'PENDING' },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
  }

  return subscription;
}

export const GET: APIRoute = async (context) => {
  const access = await resolveAdminAccess(context);
  if (!access || access.via !== 'session') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const denied = requirePermission(access, 'billing.manage');
  if (denied) return denied;
  const unverified = requireVerifiedEmail(access);
  if (unverified) return unverified;

  const subscription = await findShopSubscription(access.shopId);
  if (!subscription) {
    return new Response(JSON.stringify({ error: 'No subscription found for this shop.' }), { status: 404 });
  }

  if (subscription.shopId && subscription.shopId !== access.shopId) {
    return new Response(JSON.stringify({ error: 'No subscription found for this shop.' }), { status: 404 });
  }

  if (subscription.dataExportDownloadedAt) {
    return new Response(JSON.stringify({ error: 'Data export was already downloaded.' }), { status: 409 });
  }

  if (!saasSubscriptionAllowsDataExport(subscription)) {
    return new Response(
      JSON.stringify({ error: 'Data export is not available for this subscription state.' }),
      { status: 403 },
    );
  }

  const csv = await buildShopClientBookingCsv(access.shopId);
  const stamp = new Date().toISOString().slice(0, 10);

  // Stamp only after claiming the orphan for this shop — never burn another shop's export right.
  await prisma.saasSubscription.update({
    where: { id: subscription.id },
    data: {
      shopId: access.shopId,
      dataExportDownloadedAt: new Date(),
    },
  });

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="kersivo-clients-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
};
