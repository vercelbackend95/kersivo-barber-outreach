export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess, requireVerifiedEmail } from '@/lib/admin/auth';
import { requirePermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';
import { CURRENT_TERMS_VERSION } from '@/lib/legal/termsVersion';
import {
  graceEndsAt,
  resolveSaasBillingPhase,
  saasSubscriptionAllowsDataExport,
  saasSubscriptionGrantsAccess,
} from '@/lib/setup/saasEntitlement';
import { subscriptionBlocksAccountDeletion } from '@/lib/setup/accountDeletionGate';
import { loadStarterPublicLaunchReadiness } from '@/lib/setup/starterPublicLaunchReadiness';

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
  postFullPlan: true,
  postFullPlanChosenAt: true,
  postFullTermsVersion: true,
} as const;

export const GET: APIRoute = async (context) => {
  const access = await resolveAdminAccess(context);
  if (!access || access.via !== 'session') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const denied = requirePermission(access, 'billing.manage');
  if (denied) return denied;
  const unverified = requireVerifiedEmail(access);
  if (unverified) return unverified;

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
          shopId: null,
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
        postFullPlan: null,
        postFullPlanChosenAt: null,
        postFullTermsCurrent: true,
        postFullPlanChoiceRequired: false,
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
  const postFullPlan = String(subscription.postFullPlan ?? 'UNDECIDED');
  const staleStarterTerms =
    postFullPlan === 'STARTER' &&
    subscription.postFullTermsVersion !== CURRENT_TERMS_VERSION;
  const postFullPlanChoiceRequired =
    (
      staleStarterTerms &&
      (subscription.cancelAtPeriodEnd || phase === 'canceled')
    ) ||
    (
      subscription.cancelAtPeriodEnd &&
      phase !== 'canceled' &&
      postFullPlan !== 'STARTER' &&
      postFullPlan !== 'LEAVE'
    );
  // Full → Starter review: what would pause new public bookings once Starter is effective.
  const starterPublicLaunch =
    postFullPlan !== 'LEAVE' ? await loadStarterPublicLaunchReadiness(access.shopId) : null;

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
      postFullPlan,
      postFullPlanChosenAt: subscription.postFullPlanChosenAt?.toISOString() ?? null,
      postFullTermsCurrent: !staleStarterTerms,
      postFullPlanChoiceRequired,
      starterPublicLaunch,
    }),
    { status: 200 },
  );
};
