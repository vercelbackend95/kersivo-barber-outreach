export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess } from '@/lib/admin/auth';
import { requirePermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';
import {
  ACCOUNT_LIFECYCLE_ACTIONS,
  recordAccountLifecycleEvent,
} from '@/lib/setup/accountLifecycleAudit';
import { applyStripeSubscriptionToSaasRecord } from '@/lib/setup/saasSubscriptionLifecycle';
import { cancelSubscriptionAtPeriodEnd } from '@/lib/shop/stripe';

/**
 * Cancel SaaS subscription at period end via Stripe, then sync local state from Stripe response.
 * Does not delete the account or shop.
 */
export const POST: APIRoute = async (context) => {
  const access = await resolveAdminAccess(context);
  if (!access || access.via !== 'session') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const denied = requirePermission(access, 'billing.manage');
  if (denied) return denied;

  const subscription = await prisma.saasSubscription.findFirst({
    where: {
      shopId: access.shopId,
      status: { in: ['ACTIVE', 'PAST_DUE', 'SUSPENDED'] },
      stripeSubscriptionId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription?.stripeSubscriptionId?.trim()) {
    return new Response(
      JSON.stringify({
        error: 'No cancellable KERSIVO subscription found for this shop.',
      }),
      { status: 404 },
    );
  }

  if (subscription.cancelAtPeriodEnd) {
    return new Response(
      JSON.stringify({
        ok: true,
        alreadyScheduled: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        status: subscription.status,
      }),
      { status: 200 },
    );
  }

  try {
    const stripeSub = await cancelSubscriptionAtPeriodEnd(subscription.stripeSubscriptionId);
    const sync = await applyStripeSubscriptionToSaasRecord(stripeSub);

    await recordAccountLifecycleEvent({
      action: ACCOUNT_LIFECYCLE_ACTIONS.SUBSCRIPTION_CANCEL_REQUESTED,
      userId: access.userId,
      email: access.userEmail ?? null,
      shopId: access.shopId,
      meta: {
        stripeSubscriptionId: stripeSub.id,
        cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
        currentPeriodEnd: sync.record?.currentPeriodEnd?.toISOString() ?? null,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        alreadyScheduled: false,
        cancelAtPeriodEnd: Boolean(sync.record?.cancelAtPeriodEnd ?? stripeSub.cancel_at_period_end),
        currentPeriodEnd: sync.record?.currentPeriodEnd?.toISOString() ?? null,
        status: sync.record?.status ?? subscription.status,
      }),
      { status: 200 },
    );
  } catch (error) {
    console.error('[cancel-subscription] failed', error);
    return new Response(
      JSON.stringify({ error: 'Unable to cancel subscription with Stripe.' }),
      { status: 500 },
    );
  }
};
