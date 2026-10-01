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

/** Per-transaction card fee: percent of the amount rounded to the nearest penny, plus a fixed fee. */
export function transactionFeePence(amountPence: number, percent: number, fixedPence: number): number {
  return percentOfPence(amountPence, percent) + fixedPence;
}

export function roundGbp(gbp: number): number {
  return penceToGbp(gbpToPence(gbp));
}

/** Multiplies a pounds amount by a whole-number factor exactly, via integer pence. */
export function multiplyGbp(gbp: number, factor: number): number {
  if (!Number.isInteger(factor)) throw new Error('multiplyGbp factor must be an integer');
  return penceToGbp(gbpToPence(gbp) * factor);
}

/** Locale-independent pounds-and-pence display, e.g. 12345.6 → "£12,345.60". */
export function formatMoneyGbp(gbp: number): string {
  const [pounds, pence] = penceToGbp(gbpToPence(gbp)).toFixed(2).split('.');
  return `£${pounds.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${pence}`;
}
