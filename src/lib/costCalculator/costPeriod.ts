/** The only place the calculator defines how many months each display period covers. */

export const COST_PERIODS = ['monthly', 'annual', 'threeYear'] as const;

export type CostPeriod = (typeof COST_PERIODS)[number];

export const PERIOD_MONTHS: Readonly<Record<CostPeriod, number>> = {
  monthly: 1,
  annual: 12,
  threeYear: 36,
};

export function isCostPeriod(value: unknown): value is CostPeriod {
  return typeof value === 'string' && (COST_PERIODS as readonly string[]).includes(value);
}
