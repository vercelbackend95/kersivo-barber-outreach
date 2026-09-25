export type SetupPlanId = 'launch' | 'priority';

/** Public package slug used in Stripe metadata / analytics (priority → priority_growth). */
export type SetupPackageSlug = 'launch' | 'priority_growth';

export const SETUP_PLANS = {
  launch: {
    id: 'launch',
    name: 'Launch',
    packageSlug: 'launch' as const satisfies SetupPackageSlug,
    setupTotalPence: 19900,
    depositPence: 9950,
    remainingPence: 9950,
  },
  priority: {
    id: 'priority',
    name: 'Priority Growth',
    packageSlug: 'priority_growth' as const satisfies SetupPackageSlug,
    setupTotalPence: 29900,
    depositPence: 14950,
    remainingPence: 14950,
  },
} as const;

export type SetupPlan = (typeof SETUP_PLANS)[SetupPlanId];

export function isSetupPlanId(value: string): value is SetupPlanId {
  return value === 'launch' || value === 'priority';
}

export function getSetupPlan(planId: SetupPlanId): SetupPlan {
  return SETUP_PLANS[planId];
}

/**
 * Minimised Stripe Checkout metadata for legacy setup deposits.
 * Direct customer/shop PII lives on the Neon PENDING SetupDeposit row, not in Stripe metadata.
 * Campaign attribution is intentionally not persisted (setup fees currently disabled / 410).
 */
export function buildSetupDepositStripeMetadata(planId: SetupPlanId): Record<string, string> {
  return {
    type: 'setup_deposit',
    plan: planId,
  };
}
