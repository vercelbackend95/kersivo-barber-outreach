/**
 * Pure maths for /booksy-alternative (server and browser safe, no DOM, no GSAP).
 * Every Booksy figure comes from booksyFacts; KERSIVO's price from defaults.
 */
import {
  BOOKSY_UK_VAT_PERCENT,
  addBooksyUkVat,
  estimateBooksyBoostFee,
  estimateBooksyMonthlySubscription,
} from '@/lib/seo/booksyFacts';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

export const BK_TEAM_MIN = 1;
export const BK_TEAM_MAX = 12;
export const BK_STARTER_LIMIT = 4;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const clampInt = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));

export type BkBillEstimate = {
  teamSize: number;
  additionalUsers: number;
  booksyExVatGbp: number;
  booksyVatGbp: number;
  booksyIncVatGbp: number;
  kersivoFullGbp: number;
  starterEligible: boolean;
  /** Booksy subscription incl. VAT minus Full KERSIVO, over 12 months. Subscription only. */
  yearlyDifferenceGbp: number;
};

/** Monthly subscription only: Booksy base + additional users (+VAT) against Full KERSIVO flat. */
export function estimateBill(teamSize: number): BkBillEstimate {
  const size = clampInt(teamSize, BK_TEAM_MIN, BK_TEAM_MAX);
  const booksy = estimateBooksyMonthlySubscription(size);
  return {
    teamSize: size,
    additionalUsers: booksy.additionalUsers,
    booksyExVatGbp: booksy.exVatGbp,
    booksyVatGbp: round2(booksy.incVatGbp - booksy.exVatGbp),
    booksyIncVatGbp: booksy.incVatGbp,
    kersivoFullGbp: SAAS_MONTHLY_GBP,
    starterEligible: size <= BK_STARTER_LIMIT,
    yearlyDifferenceGbp: round2((booksy.incVatGbp - SAAS_MONTHLY_GBP) * 12),
  };
}

export type BkBoostEstimate = {
  perClientExVatGbp: number;
  monthlyExVatGbp: number;
  monthlyIncVatGbp: number;
  yearlyIncVatGbp: number;
};

/** Optional Boost: one-time fee per brand-new client Booksy brings in, over a month and a year. */
export function estimateBoost(input: { newClients: number; firstVisitGbp: number }): BkBoostEstimate {
  const clients = Math.max(0, Math.round(input.newClients));
  const perClientExVatGbp = estimateBooksyBoostFee(Math.max(0, input.firstVisitGbp));
  const monthlyExVatGbp = round2(perClientExVatGbp * clients);
  const monthlyIncVatGbp = addBooksyUkVat(monthlyExVatGbp);
  return {
    perClientExVatGbp,
    monthlyExVatGbp,
    monthlyIncVatGbp,
    yearlyIncVatGbp: round2(monthlyIncVatGbp * 12),
  };
}

export const BK_VAT_PERCENT = BOOKSY_UK_VAT_PERCENT;

export function formatGbp(value: number): string {
  const whole = Math.abs(value - Math.round(value)) < 0.005;
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}
