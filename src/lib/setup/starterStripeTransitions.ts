import { opsLogError } from '@/lib/ops/opsLog';
import { loadKersivoAccess } from '@/lib/shop/kersivoAccess';
import { ACCOUNT_LIFECYCLE_ACTIONS, recordAccountLifecycleEvent } from './accountLifecycleAudit';

export type StarterStripeTransition = {
  action:
    | typeof ACCOUNT_LIFECYCLE_ACTIONS.STARTER_STRIPE_READY
    | typeof ACCOUNT_LIFECYCLE_ACTIONS.STARTER_STRIPE_PAUSED;
  meta: Record<string, string>;
};

/**
 * READY / PAUSED transition implied by a persisted Connect state change, or null. Only Stripe
 * Standard counts (legacy Express is never Starter-ready). Callers pass the state they read
 * before persisting, so whichever path (webhook or settings refresh) applies a change first
 * records it and the later path sees no transition.
 */
export function resolveStarterStripeTransition(input: {
  accountType: string | null | undefined;
  before: { chargesEnabled: boolean; disconnected: boolean };
  after: { chargesEnabled: boolean; disconnected: boolean };
  pausedReason?: 'not_payment_ready' | 'disconnected';
}): StarterStripeTransition | null {
  if (input.accountType !== 'STANDARD') return null;
  const wasReady = input.before.chargesEnabled && !input.before.disconnected;
  const isReady = input.after.chargesEnabled && !input.after.disconnected;
  if (!wasReady && isReady) {
    return { action: ACCOUNT_LIFECYCLE_ACTIONS.STARTER_STRIPE_READY, meta: { accountType: 'STANDARD' } };
  }
  if (wasReady && !isReady) {
    return {
      action: ACCOUNT_LIFECYCLE_ACTIONS.STARTER_STRIPE_PAUSED,
      meta: {
        reason: input.pausedReason ?? (input.after.disconnected ? 'disconnected' : 'not_payment_ready'),
        accountType: 'STANDARD',
      },
    };
  }
  return null;
}

/**
 * Starter Stripe analytics enrichment. Runs only after the Connect state has been persisted and
 * must never fail the caller: a webhook 500 would make Stripe retry an already-applied transition,
 * which then looks like ready → ready and the transition event would be lost for good.
 */
export async function recordStarterStripeTransition(
  source: string,
  shopId: string,
  transition: StarterStripeTransition,
): Promise<void> {
  try {
    const access = await loadKersivoAccess(shopId);
    if (access.state !== 'FREE_BOOKING') return;
    await recordAccountLifecycleEvent({ action: transition.action, shopId, meta: transition.meta });
  } catch (error) {
    opsLogError('stripe.connect', 'starter_stripe_analytics_failed', error, {
      source,
      shopId,
      action: transition.action,
    });
  }
}
