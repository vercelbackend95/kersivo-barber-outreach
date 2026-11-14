/** Pure helpers for /pricing (tested; no DOM). */

export const PRICING_SPLIT_MIN = 1;
export const PRICING_SPLIT_MAX = 12;

export type PricingFitState = 'empty' | 'full' | 'starter';

/**
 * Every question is a reason for Full KERSIVO, so any "yes" recommends Full. With nothing
 * ticked we only say Starter could be enough once the visitor has interacted.
 */
export function recommendPlan(selected: readonly string[], touched: boolean): PricingFitState {
  if (selected.length > 0) return 'full';
  return touched ? 'starter' : 'empty';
}

export function clampBarbers(n: number): number {
  if (!Number.isFinite(n)) return PRICING_SPLIT_MIN;
  return Math.min(PRICING_SPLIT_MAX, Math.max(PRICING_SPLIT_MIN, Math.round(n)));
}

/** Flat location price shared across the team, in pounds (2 dp). */
export function pricePerBarber(monthlyGbp: number, barbers: number): number {
  return Math.round((monthlyGbp / clampBarbers(barbers)) * 100) / 100;
}

export function formatPounds(value: number): string {
  return `£${value.toFixed(2)}`;
}
