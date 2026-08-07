import type { SaasSubscription, SaasSubscriptionStatus } from '@prisma/client';
import {
  periodEndFromUnixSeconds,
  saasSubscriptionGrantsAccess,
  type SaasSubscriptionAccessFields,
} from '@/lib/setup/saasEntitlement';
import {
  getSubscriptionCurrentPeriodEnd,
  retrieveSubscription,
  type StripeSession,
  type StripeSubscription,
} from '@/lib/shop/stripe';

export const SUBSCRIPTION_NOT_ACTIVE_CODE = 'SUBSCRIPTION_NOT_ACTIVE' as const;

export type VerifiedLiveClaimSnapshot = {
  stripeSubscriptionId: string;
  status: 'ACTIVE';
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
};

export type ClaimEntitlementResult =
  | { ok: true; verifiedLive?: VerifiedLiveClaimSnapshot }
  | { ok: false; code: typeof SUBSCRIPTION_NOT_ACTIVE_CODE; reason: string }
  | { ok: false; code: 'STRIPE_SUBSCRIPTION_LOOKUP_FAILED'; reason: string };

function subscriptionIdFromSession(session: StripeSession): string | null {
  const sub = session.subscription;
  if (typeof sub === 'string' && sub.trim()) return sub.trim();
  if (sub && typeof sub === 'object' && typeof sub.id === 'string' && sub.id.trim()) {
    return sub.id.trim();
  }
  return null;
}

export function entitlementFieldsFromRecord(
  record: Pick<
    SaasSubscription,
    'status' | 'currentPeriodEnd' | 'pastDueSince' | 'cancelAtPeriodEnd'
  >,
): SaasSubscriptionAccessFields {
  return {
    status: record.status,
    currentPeriodEnd: record.currentPeriodEnd,
    pastDueSince: record.pastDueSince,
    cancelAtPeriodEnd: record.cancelAtPeriodEnd,
  };
}

/**
 * Claim-recovery allowlist for LOCAL PENDING rows only.
 * Does NOT use mapStripeSubscriptionStatus (too liberal for unpaid→PAST_DUE / unknown→ACTIVE).
 * KERSIVO SaaS checkout does not configure trials — only Stripe `active` with a future period end.
 */
export function assertStrictLiveActiveForPendingClaim(
  stripeSub: StripeSubscription,
  now: Date = new Date(),
): ClaimEntitlementResult {
  const rawStatus = (stripeSub.status ?? '').trim().toLowerCase();
  if (rawStatus !== 'active') {
    return {
      ok: false,
      code: SUBSCRIPTION_NOT_ACTIVE_CODE,
      reason: `Live Stripe subscription status ${stripeSub.status || 'empty'} is not active.`,
    };
  }

  const periodEndUnix = getSubscriptionCurrentPeriodEnd(stripeSub);
  const currentPeriodEnd = periodEndFromUnixSeconds(periodEndUnix);
  if (!currentPeriodEnd || currentPeriodEnd.getTime() <= now.getTime()) {
    return {
      ok: false,
      code: SUBSCRIPTION_NOT_ACTIVE_CODE,
      reason: 'Live Stripe subscription has no valid future current period end.',
    };
  }

  const stripeSubscriptionId =
    typeof stripeSub.id === 'string' && stripeSub.id.trim() ? stripeSub.id.trim() : '';
  if (!stripeSubscriptionId) {
    return {
      ok: false,
      code: SUBSCRIPTION_NOT_ACTIVE_CODE,
      reason: 'Live Stripe subscription is missing an id.',
    };
  }

  return {
    ok: true,
    verifiedLive: {
      stripeSubscriptionId,
      status: 'ACTIVE',
      currentPeriodEnd,
      cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
    },
  };
}

/**
 * Whether a SaasSubscription row currently grants paid access for claim/rehydrate.
 * PENDING requires a live Stripe Subscription retrieve with a strict active-only allowlist.
 */
export async function assertClaimEntitlement(input: {
  record: Pick<
    SaasSubscription,
    | 'status'
    | 'currentPeriodEnd'
    | 'pastDueSince'
    | 'cancelAtPeriodEnd'
    | 'stripeSubscriptionId'
  >;
  session: StripeSession;
  now?: Date;
  retrieveSubscriptionFn?: (id: string) => Promise<StripeSubscription>;
}): Promise<ClaimEntitlementResult> {
  const now = input.now ?? new Date();
  const status = String(input.record.status) as SaasSubscriptionStatus | string;

  if (status !== 'PENDING') {
    const fields = entitlementFieldsFromRecord(input.record);
    if (!saasSubscriptionGrantsAccess(fields, now)) {
      return {
        ok: false,
        code: SUBSCRIPTION_NOT_ACTIVE_CODE,
        reason: `Subscription status ${status} does not grant access.`,
      };
    }
    return { ok: true };
  }

  const subId =
    input.record.stripeSubscriptionId?.trim() ||
    subscriptionIdFromSession(input.session);
  if (!subId) {
    return {
      ok: false,
      code: SUBSCRIPTION_NOT_ACTIVE_CODE,
      reason: 'PENDING subscription has no Stripe subscription id yet.',
    };
  }

  const retrieve = input.retrieveSubscriptionFn ?? retrieveSubscription;
  let stripeSub: StripeSubscription;
  try {
    stripeSub = await retrieve(subId);
  } catch (error) {
    return {
      ok: false,
      code: 'STRIPE_SUBSCRIPTION_LOOKUP_FAILED',
      reason: error instanceof Error ? error.message : 'Stripe subscription lookup failed.',
    };
  }

  return assertStrictLiveActiveForPendingClaim(stripeSub, now);
}
