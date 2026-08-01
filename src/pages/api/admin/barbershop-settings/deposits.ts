export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { accessCan, requireAnyPermission, requirePermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';
import { canCollectBookingDeposit, BOOKING_DEPOSIT_PENCE } from '@/lib/booking/depositGate';
import { isPaidShop } from '@/lib/shop/paidShop';
import {
  createConnectAccountLink,
  createConnectExpressAccount,
  retrieveConnectAccount,
} from '@/lib/shop/stripeConnect';
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
  const denied = requireAnyPermission(access, ['shop.settings', 'billing.manage']);
  if (denied) return denied;

  const canManagePayouts = accessCan(access, 'billing.manage');

  const shop = await prisma.shopSettings.findUnique({
    where: { id: access.shopId },
    select: {
      id: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      depositsEnabled: true,
      stripeConnectAccountId: true,
      stripeConnectChargesEnabled: true,
      stripeConnectDetailsSubmitted: true,
      cancellationWindowHours: true,
      rescheduleWindowHours: true,
      maxClientReschedules: true,
    },
  });
  if (!shop) return json({ error: 'Shop not found.' }, 404);

  let connect = {
    accountId: shop.stripeConnectAccountId,
    chargesEnabled: shop.stripeConnectChargesEnabled,
    detailsSubmitted: shop.stripeConnectDetailsSubmitted,
  };

  if (shop.stripeConnectAccountId) {
    try {
      const live = await retrieveConnectAccount(shop.stripeConnectAccountId);
      if (
        live.chargesEnabled !== shop.stripeConnectChargesEnabled ||
        live.detailsSubmitted !== shop.stripeConnectDetailsSubmitted
      ) {
        await prisma.shopSettings.update({
          where: { id: shop.id },
          data: {
            stripeConnectChargesEnabled: live.chargesEnabled,
            stripeConnectDetailsSubmitted: live.detailsSubmitted,
          },
        });
        connect = {
          accountId: shop.stripeConnectAccountId,
          chargesEnabled: live.chargesEnabled,
          detailsSubmitted: live.detailsSubmitted,
        };
      }
    } catch {
      // Keep stored flags if Stripe is temporarily unreachable.
    }
  }

  const paid = isPaidShop(shop);
  const collectReady = canCollectBookingDeposit({
    id: shop.id,
    shopPaidAt: shop.shopPaidAt,
    smsRemindersEnabled: shop.smsRemindersEnabled,
    depositsEnabled: shop.depositsEnabled,
    stripeConnectAccountId: connect.accountId,
    stripeConnectChargesEnabled: connect.chargesEnabled,
  });

  return json({
    paid,
    depositsEnabled: shop.depositsEnabled,
    depositAmountPence: BOOKING_DEPOSIT_PENCE,
    collectReady,
    canManagePayouts,
    connect: {
      accountId: canManagePayouts ? connect.accountId : null,
      accountLinked: Boolean(connect.accountId),
      chargesEnabled: connect.chargesEnabled,
      detailsSubmitted: connect.detailsSubmitted,
    },
    policy: {
      cancellationWindowHours: shop.cancellationWindowHours,
      rescheduleWindowHours: shop.rescheduleWindowHours,
      maxClientReschedules: shop.maxClientReschedules,
      refundInWindow: true,
      forfeitOutsideWindowOrNoShow: true,
      shopCancelRefunds: true,
    },
  });
};

export const PATCH: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requireAnyPermission(access, ['shop.settings', 'billing.manage']);
  if (denied) return denied;

  const body = (await ctx.request.json().catch(() => null)) as { depositsEnabled?: unknown } | null;
  if (!body || typeof body.depositsEnabled !== 'boolean') {
    return json({ error: 'depositsEnabled boolean required.' }, 400);
  }

  const shop = await prisma.shopSettings.findUnique({
    where: { id: access.shopId },
    select: {
      id: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      stripeConnectAccountId: true,
      stripeConnectChargesEnabled: true,
    },
  });
  if (!shop) return json({ error: 'Shop not found.' }, 404);
  if (!isPaidShop(shop)) {
    return json({ error: 'Deposits are available after your KERSIVO subscription is active.' }, 403);
  }
  if (body.depositsEnabled && (!shop.stripeConnectAccountId || !shop.stripeConnectChargesEnabled)) {
    return json({ error: 'Connect Stripe and finish onboarding before enabling deposits.' }, 400);
  }

  const updated = await prisma.shopSettings.update({
    where: { id: shop.id },
    data: { depositsEnabled: body.depositsEnabled },
    select: { depositsEnabled: true },
  });

  return json({ depositsEnabled: updated.depositsEnabled });
};

/** Start or continue Stripe Connect Express onboarding. Owner / billing.manage only. */
export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requirePermission(access, 'billing.manage');
  if (denied) return denied;

  const shop = await prisma.shopSettings.findUnique({
    where: { id: access.shopId },
    select: {
      id: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      stripeConnectAccountId: true,
      owner: { select: { email: true } },
    },
  });
  if (!shop) return json({ error: 'Shop not found.' }, 404);
  if (!isPaidShop(shop)) {
    return json({ error: 'Connect Stripe after your KERSIVO subscription is active.' }, 403);
  }

  let accountId = shop.stripeConnectAccountId;
  if (!accountId) {
    const created = await createConnectExpressAccount({
      shopId: shop.id,
      email: shop.owner?.email ?? undefined,
    });
    accountId = created.id;
    await prisma.shopSettings.update({
      where: { id: shop.id },
      data: { stripeConnectAccountId: accountId },
    });
  }

  const base = getPublicSiteUrl();
  // Settings live as an AdminPanel section — not a standalone /admin/barbershop-settings page.
  const link = await createConnectAccountLink({
    accountId,
    refreshUrl: `${base}/admin?section=barbershop_settings&connect=refresh`,
    returnUrl: `${base}/admin?section=barbershop_settings&connect=return`,
  });

  return json({ url: link.url, accountId });
};
