/**
 * Pure maths for /treatwell-alternative (server and browser safe, no DOM, no GSAP).
 * Every Treatwell figure comes from treatwellFacts.
 */
import { estimateTreatwellPublishedBookingFees } from '@/lib/seo/treatwellFacts';

export const TW_RULE_WINDOW_MONTHS = 12;
export const TW_ASSUMED_VAT_PERCENT = 20;

export type TwRuleChannel = 'marketplace' | 'direct';
export type TwRuleOutcome = {
  status: 'repeat' | 'new-again' | 'direct';
  commissionExVatGbp: number;
  commissionInclVatGbp: number;
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Published-rate reading of one returning client under Treatwell's 365-day test. Over 12 months
 * since the last successful visit, a marketplace booking can count as new again.
 */
export function readRuleScenario(input: { monthsSinceVisit: number; channel: TwRuleChannel; priceGbp: number }): TwRuleOutcome {
  const lapsed = input.monthsSinceVisit > TW_RULE_WINDOW_MONTHS;
  const status: TwRuleOutcome['status'] = input.channel === 'direct' ? 'direct' : lapsed ? 'new-again' : 'repeat';
  const fees = estimateTreatwellPublishedBookingFees({
    servicePriceGbp: Math.max(0, input.priceGbp),
    eligibility: status === 'new-again' ? 'eligible-new-marketplace' : 'repeat-or-direct',
    onlinePrepaid: 'no',
    vatPercent: TW_ASSUMED_VAT_PERCENT,
  });
  return {
    status,
    commissionExVatGbp: fees.commissionExVatGbp ?? 0,
    commissionInclVatGbp: fees.totalInclVatGbp ?? 0,
  };
}

export type TwMonthlyEstimate = { exVatGbp: number; inclVatGbp: number; yearlyInclVatGbp: number };

/** Published new-client commission for a month of eligible marketplace first visits. */
export function estimateMonthlyCommission(input: { newClients: number; firstVisitGbp: number }): TwMonthlyEstimate {
  const clients = Math.max(0, Math.round(input.newClients));
  const perBooking = estimateTreatwellPublishedBookingFees({
    servicePriceGbp: Math.max(0, input.firstVisitGbp),
    eligibility: 'eligible-new-marketplace',
    onlinePrepaid: 'no',
  }).commissionExVatGbp!;
  const exVatGbp = round2(perBooking * clients);
  const inclVatGbp = round2(exVatGbp * (1 + TW_ASSUMED_VAT_PERCENT / 100));
  return { exVatGbp, inclVatGbp, yearlyInclVatGbp: round2(inclVatGbp * 12) };
}

export function formatGbp(value: number): string {
  const whole = Math.abs(value - Math.round(value)) < 0.005;
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}
