export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { accessCan, requireAnyPermission, requirePermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';
import { canSellRetail, evaluateRetailSelling } from '@/lib/shop/cardPaymentsGate';
import { isPaidShop } from '@/lib/shop/paidShop';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requireAnyPermission(access, ['shop.settings', 'billing.manage', 'retail.manage']);
  if (denied) return denied;

  const canManage = accessCan(access, 'billing.manage');
  const shop = await prisma.shopSettings.findUnique({
    where: { id: access.shopId },
    select: {
      id: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      retailEnabled: true,
      stripeConnectAccountId: true,
      stripeConnectChargesEnabled: true,
    },
  });
  if (!shop) return json({ error: 'Shop not found.' }, 404);

  const gate = evaluateRetailSelling(shop);
  const base = getPublicSiteUrl();

  return json({
    paid: isPaidShop(shop),
    retailEnabled: shop.retailEnabled,
    sellReady: canSellRetail(shop),
    gate,
    canManageRetailPayments: canManage,
    publicShopUrl: `${base}/shop/${shop.id}`,
    connect: {
      accountLinked: Boolean(shop.stripeConnectAccountId?.trim()),
      chargesEnabled: shop.stripeConnectChargesEnabled,
    },
  });
};

/** Toggle retailEnabled. Owner / billing.manage only — same financial class as deposits. */
export const PATCH: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requirePermission(access, 'billing.manage');
  if (denied) return denied;

  const body = (await ctx.request.json().catch(() => null)) as { retailEnabled?: unknown } | null;
  if (!body || typeof body.retailEnabled !== 'boolean') {
    return json({ error: 'retailEnabled boolean required.' }, 400);
  }

  const shop = await prisma.shopSettings.findUnique({
    where: { id: access.shopId },
    select: {
      id: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      stripeConnectAccountId: true,
      stripeConnectChargesEnabled: true,
      retailEnabled: true,
    },
  });
  if (!shop) return json({ error: 'Shop not found.' }, 404);
  if (!isPaidShop(shop)) {
    return json({ error: 'Retail checkout is available after your KERSIVO subscription is active.' }, 403);
  }
  if (body.retailEnabled && (!shop.stripeConnectAccountId || !shop.stripeConnectChargesEnabled)) {
    return json({ error: 'Connect Stripe and finish onboarding before enabling retail checkout.' }, 400);
  }

  const updated = await prisma.shopSettings.update({
    where: { id: shop.id },
    data: { retailEnabled: body.retailEnabled },
    select: {
      id: true,
      retailEnabled: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      stripeConnectAccountId: true,
      stripeConnectChargesEnabled: true,
    },
  });

  return json({
    retailEnabled: updated.retailEnabled,
    sellReady: canSellRetail(updated),
    gate: evaluateRetailSelling(updated),
    publicShopUrl: `${getPublicSiteUrl()}/shop/${updated.id}`,
  });
};
