export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess, requireVerifiedEmail } from '@/lib/admin/auth';
import { requirePermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { createBillingPortalSession } from '@/lib/shop/stripe';

/**
 * Opens Stripe Customer Portal for the shop's SaaS subscription.
 * Requires Customer Portal enabled in Stripe Dashboard (cancel at period end, cards, invoices).
 */
export const POST: APIRoute = async (context) => {
  const access = await resolveAdminAccess(context);
  if (!access || access.via !== 'session') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const denied = requirePermission(access, 'billing.manage');
  if (denied) return denied;
  const unverified = requireVerifiedEmail(access);
  if (unverified) return unverified;

  const subscription = await prisma.saasSubscription.findFirst({
    where: {
      shopId: access.shopId,
      status: { in: ['ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED'] },
      stripeCustomerId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      stripeCustomerId: true,
    },
  });

  let customerId = subscription?.stripeCustomerId?.trim() || null;

  if (!customerId) {
    const shop = await prisma.shopSettings.findUnique({
      where: { id: access.shopId },
      select: { owner: { select: { email: true } } },
    });
    const ownerEmail = shop?.owner?.email?.trim().toLowerCase();
    if (ownerEmail) {
      // Orphan rows from anonymous /setup checkout only — never another shop's sub.
      const byEmail = await prisma.saasSubscription.findFirst({
        where: {
          shopId: null,
          customerEmail: { equals: ownerEmail, mode: 'insensitive' },
          status: { in: ['ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED'] },
          stripeCustomerId: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, stripeCustomerId: true, shopId: true },
      });
      customerId = byEmail?.stripeCustomerId?.trim() || null;
      if (byEmail && !byEmail.shopId) {
        await prisma.saasSubscription.update({
          where: { id: byEmail.id },
          data: { shopId: access.shopId },
        });
      }
    }
  }

  if (!customerId) {
    return new Response(
      JSON.stringify({
        error: 'No Stripe customer on file for this shop. Complete subscription checkout first.',
      }),
      { status: 404 },
    );
  }

  try {
    const returnUrl = `${getPublicSiteUrl()}/admin`;
    const session = await createBillingPortalSession({
      customerId,
      returnUrl,
    });
    return new Response(JSON.stringify({ url: session.url }), { status: 200 });
  } catch (error) {
    console.error('[billing-portal] session create failed', error);
    return new Response(JSON.stringify({ error: 'Unable to open billing portal.' }), { status: 500 });
  }
};
