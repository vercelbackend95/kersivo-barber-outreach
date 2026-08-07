import type { SaasSubscription, SaasSubscriptionStatus } from '@prisma/client';
import {
  mapStripeSubscriptionStatus,
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

export type ClaimEntitlementResult =
  | { ok: true }
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

export function entitlementFieldsFromStripeSubscription(
  stripeSub: StripeSubscription,
): SaasSubscriptionAccessFields {
  const status = mapStripeSubscriptionStatus(stripeSub.status);
  const periodEndUnix = getSubscriptionCurrentPeriodEnd(stripeSub);
  return {
    status,
    currentPeriodEnd: periodEndFromUnixSeconds(periodEndUnix),
    pastDueSince: status === 'PAST_DUE' ? new Date() : null,
    cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
  };
}

/**
 * Whether a SaasSubscription row currently grants paid access for claim/rehydrate.
 * PENDING requires a live Stripe Subscription retrieve (caller supplies retrieve fn).
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

  const fields = entitlementFieldsFromStripeSubscription(stripeSub);
  if (!saasSubscriptionGrantsAccess(fields, now)) {
    return {
      ok: false,
      code: SUBSCRIPTION_NOT_ACTIVE_CODE,
      reason: `Live Stripe subscription status ${stripeSub.status} does not grant access.`,
    };
  }
  return { ok: true };
}
