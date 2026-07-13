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

export function buildSetupDepositStripeMetadata(
  planId: SetupPlanId,
  fields: {
    customerName: string;
    email: string;
    shopName: string;
    shopSize: string;
    currentStack: string;
  },
  attribution: Record<string, string> = {},
): Record<string, string> {
  const plan = getSetupPlan(planId);
  const metadata: Record<string, string> = {
    type: 'setup_deposit',
    plan: planId,
    package: plan.packageSlug,
    package_name: plan.name,
    total_setup_amount: String(plan.setupTotalPence),
    deposit_amount: String(plan.depositPence),
    remaining_amount: String(plan.remainingPence),
    customerName: fields.customerName,
    email: fields.email,
    shopName: fields.shopName,
    shopSize: fields.shopSize,
    currentStack: fields.currentStack,
  };

  // Stripe metadata values max 500 chars; keep attribution short.
  for (const [key, raw] of Object.entries(attribution)) {
    const value = raw.trim().slice(0, 200);
    if (!value) continue;
    if (metadata[key]) continue;
    metadata[key] = value;
  }

  return metadata;
}
