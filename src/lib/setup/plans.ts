export type SetupPlanId = 'launch' | 'priority';

export const SETUP_PLANS = {
  launch: {
    id: 'launch',
    name: 'Launch',
    setupTotalPence: 19900,
    depositPence: 9950,
    remainingPence: 9950,
  },
  priority: {
    id: 'priority',
    name: 'Priority Growth',
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
