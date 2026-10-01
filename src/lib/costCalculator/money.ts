/**
 * Deterministic GBP arithmetic for the cost calculator.
 * All calculation happens in integer pence; values are only converted back to pounds for output.
 * Inputs are expected to be non-negative, so Math.round gives round-half-up.
 */

const PENCE_PER_POUND = 100;

/** Strips binary floating-point noise (e.g. 1234.4999999998 → 1234.5) before rounding. */
function stabilise(value: number): number {
  return Number(value.toPrecision(12));
}

export function gbpToPence(gbp: number): number {
  return Math.round(stabilise(gbp * PENCE_PER_POUND));
}

export function penceToGbp(pence: number): number {
  return pence / PENCE_PER_POUND;
}

/** `percent` is expressed as a whole percentage, e.g. 20 for 20%. */
export function percentOfPence(pence: number, percent: number): number {
  return Math.round(stabilise((pence * percent) / 100));
}

export function roundGbp(gbp: number): number {
  return penceToGbp(gbpToPence(gbp));
}

/** Locale-independent pounds-and-pence display, e.g. 35.8 → "£35.80". */
export function formatMoneyGbp(gbp: number): string {
  return `£${penceToGbp(gbpToPence(gbp)).toFixed(2)}`;
}
