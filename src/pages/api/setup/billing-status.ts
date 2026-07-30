export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess } from '@/lib/admin/auth';
import { requirePermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';
import {
  graceEndsAt,
  resolveSaasBillingPhase,
  saasSubscriptionAllowsDataExport,
  saasSubscriptionGrantsAccess,
} from '@/lib/setup/saasEntitlement';
import { subscriptionBlocksAccountDeletion } from '@/lib/setup/accountDeletionGate';

const subscriptionSelect = {
  status: true,
  cancelAtPeriodEnd: true,
  currentPeriodEnd: true,
  pastDueSince: true,
  suspendedAt: true,
  retentionEndsAt: true,
  canceledAt: true,
  dataExportDownloadedAt: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  monthlyPence: true,
  currency: true,
} as const;

export const GET: APIRoute = async (context) => {
  const access = await resolveAdminAccess(context);
  if (!access || access.via !== 'session') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const denied = requirePermission(access, 'billing.manage');
  if (denied) return denied;

  let subscription = await prisma.saasSubscription.findFirst({
    where: {
      shopId: access.shopId,
      status: { not: 'PENDING' },
    },
    orderBy: { createdAt: 'desc' },
    select: subscriptionSelect,
  });

  if (!subscription) {
    const shop = await prisma.shopSettings.findUnique({
      where: { id: access.shopId },
      select: { owner: { select: { email: true } } },
    });
    const ownerEmail = shop?.owner?.email?.trim().toLowerCase();
    if (ownerEmail) {
      subscription = await prisma.saasSubscription.findFirst({
        where: {
          customerEmail: { equals: ownerEmail, mode: 'insensitive' },
          status: { not: 'PENDING' },
        },
        orderBy: { createdAt: 'desc' },
        select: subscriptionSelect,
      });
    }
  }

  if (!subscription) {
    return new Response(
      JSON.stringify({
        hasSubscription: false,
        status: null,
        phase: 'none',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        pastDueSince: null,
        suspendedAt: null,
        retentionEndsAt: null,
        graceEndsAt: null,
        hasPortalAccess: false,
        grantsAccess: false,
        allowsExport: false,
        exportConsumed: false,
        blocksAccountDeletion: false,
        canCancelSubscription: false,
      }),
      { status: 200 },
    );
  }

  const phase = resolveSaasBillingPhase(subscription);
  const graceEnd =
    subscription.pastDueSince && phase === 'grace'
      ? graceEndsAt(subscription.pastDueSince)
      : null;
  const blocksAccountDeletion = subscriptionBlocksAccountDeletion(subscription);
  const canCancelSubscription =
    blocksAccountDeletion &&
    Boolean(subscription.stripeSubscriptionId) &&
    !subscription.cancelAtPeriodEnd;

  return new Response(
    JSON.stringify({
      hasSubscription: true,
      status: subscription.status,
      phase,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      pastDueSince: subscription.pastDueSince?.toISOString() ?? null,
      suspendedAt: subscription.suspendedAt?.toISOString() ?? null,
      retentionEndsAt: subscription.retentionEndsAt?.toISOString() ?? null,
      graceEndsAt: graceEnd?.toISOString() ?? null,
      hasPortalAccess: Boolean(subscription.stripeCustomerId),
      grantsAccess: saasSubscriptionGrantsAccess(subscription),
      allowsExport: saasSubscriptionAllowsDataExport(subscription),
      exportConsumed: Boolean(subscription.dataExportDownloadedAt),
      blocksAccountDeletion,
      canCancelSubscription,
      monthlyPence: subscription.monthlyPence,
      currency: subscription.currency,
    }),
    { status: 200 },
  );
};
