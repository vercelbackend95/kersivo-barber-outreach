/**
 * Timely commercial source of truth for UK comparisons and the barber software cost calculator.
 *
 * Checked against Timely's public pricing page (Great Britain selected) and Help Centre on
 * 14 November 2026. Timely now sells three UK plans (Run, Boost, Thrive) billed WEEKLY, with
 * unlimited team members and a price that "adjusts based on bookings". Only the published
 * "starting from" prices are known; how the weekly bill rises with booking volume is not
 * published, so never extrapolate a busier shop's Timely bill from these figures.
 */
export const TIMELY_FACTS_CHECKED_ISO = '2026-11-14';
export const TIMELY_FACTS_CHECKED_DATE = '14 November 2026';

export const TIMELY_SOURCES = [
  {
    id: 'pricing',
    label: 'Timely official plans and pricing (Great Britain)',
    url: 'https://www.gettimely.com/pricing/',
    supports:
      'Run, Boost and Thrive weekly “starting from” prices, booking-based billing, unlimited team members, plan features, add-ons, transaction fees, SMS rates and 14 days’ cancellation notice',
  },
  {
    id: 'ukPayments',
    label: 'TimelyPay fees (UK, 2026)',
    url: 'https://help.gettimely.com/hc/en-gb/articles/4404189908503-TimelyPay-Fees',
    supports: 'UK online card rates after 5 August 2026: domestic 1.85% + 30p; international and Amex 3% + 30p',
  },
  {
    id: 'rateUpdate',
    label: 'TimelyPay rate changes effective 5 August 2026',
    url: 'https://help.gettimely.com/hc/en-gb/articles/41624400479767-Payment-rate-updates-for-Australia-and-UK-2026',
    supports: 'UK 2026 processing rate change and customer-specific exceptions; check Timely account for personalised fees',
  },
  {
    id: 'exports',
    label: 'Timely Help Centre: data exports',
    url: 'https://help.gettimely.com/hc/en-gb/articles/20753162121239-How-to-request-and-access-your-Timely-data-export',
    supports: 'Export requested through Timely support, up to 48 hours; clients, appointments, services, client notes, products and product purchases',
  },
] as const;

export type TimelySourceId = (typeof TIMELY_SOURCES)[number]['id'];
export const getTimelySource = (id: TimelySourceId) => {
  const source = TIMELY_SOURCES.find((item) => item.id === id);
  if (!source) throw new Error(`Unknown Timely source: ${id}`);
  return source;
};

type FactMeta = { sourceId: TimelySourceId; checkedIso: string; note: string };

export type TimelyFact =
  | ({ status: 'verified'; amountGbp: number; unit: string } & FactMeta)
  | ({ status: 'verified'; value: number | boolean; unit: string } & FactMeta)
  | ({ status: 'verified'; percent: number; fixedGbp: number; unit: string } & FactMeta)
  | ({ status: 'unresolved' } & FactMeta);

const checkedIso = TIMELY_FACTS_CHECKED_ISO;

export const TIMELY_COMMERCIAL_FACTS = {
  runFromWeekly: {
    status: 'verified', amountGbp: 4, unit: 'GBP per week, “starting from” price for the Run plan',
    sourceId: 'pricing', checkedIso,
    note: 'Lowest advertised price. Timely says the price adjusts based on bookings.',
  },
  boostFromWeekly: {
    status: 'verified', amountGbp: 7, unit: 'GBP per week, “starting from” price for the Boost plan',
    sourceId: 'pricing', checkedIso,
    note: 'Lowest advertised price. Timely labels Boost “Most popular”.',
  },
  thriveFromWeekly: {
    status: 'verified', amountGbp: 9, unit: 'GBP per week, “starting from” price for the Thrive plan',
    sourceId: 'pricing', checkedIso,
    note: 'Lowest advertised price. Timely says the price adjusts based on bookings.',
  },
  advancedTeamAddOnWeekly: {
    status: 'verified', amountGbp: 8, unit: 'GBP per week for the Advanced team management add-on',
    sourceId: 'pricing', checkedIso,
    note: 'Adds staff targets, tiered pricing by experience, team performance and activity log.',
  },
  bookingBasedBilling: {
    status: 'verified', value: true, unit: 'weekly bill calculated from the number of bookings taken',
    sourceId: 'pricing', checkedIso,
    note: 'Timely: the weekly bill is calculated from the number of bookings taken each week.',
  },
  unlimitedTeamMembers: {
    status: 'verified', value: true, unit: 'unlimited team members on every plan',
    sourceId: 'pricing', checkedIso,
    note: 'Team size no longer sets the Timely subscription price.',
  },
  trialDays: {
    status: 'verified', value: 14, unit: 'days for the publicly advertised free trial',
    sourceId: 'pricing', checkedIso,
    note: 'No credit card required, according to Timely.',
  },
  noNewClientFees: {
    status: 'verified', value: true, unit: 'Timely pricing page advertises no new-client fees',
    sourceId: 'pricing', checkedIso,
    note: 'This does not mean card processing or the subscription is free.',
  },
  cancellationNoticeDays: {
    status: 'verified', value: 14, unit: 'days’ notice to cancel; no contracts',
    sourceId: 'pricing', checkedIso,
    note: 'Timely FAQ: no contracts, cancel with 14 days’ notice.',
  },
  ukOnlinePaymentProcessing: {
    status: 'verified', percent: 1.85, fixedGbp: 0.3, unit: 'domestic UK online card transaction (deposits, cancellation fees)',
    sourceId: 'ukPayments', checkedIso,
    note: 'Published standard TimelyPay rate from 5 August 2026; custom rates may differ.',
  },
  ukInternationalOnlinePaymentProcessing: {
    status: 'verified', percent: 3, fixedGbp: 0.3, unit: 'international card online transaction',
    sourceId: 'ukPayments', checkedIso,
    note: 'Published TimelyPay UK online rate for international cards.',
  },
  ukInPersonPaymentProcessing: {
    status: 'verified', percent: 1.59, fixedGbp: 0.05, unit: 'in-salon payment by Tap to Pay or a Timely terminal',
    sourceId: 'pricing', checkedIso,
    note: 'Plus the cost of a terminal (not needed for Tap to Pay). Custom rates possible above 15 bookings a week.',
  },
  smsOverageRunPence: {
    status: 'verified', value: 8, unit: 'pence per extra SMS on Run',
    sourceId: 'pricing', checkedIso, note: 'Boost 5p, Thrive 4p per extra SMS.',
  },
  bookingVolumeScale: {
    status: 'unresolved', sourceId: 'pricing', checkedIso,
    note: 'Timely does not publish how far the weekly bill rises with booking volume. Use a real invoice.',
  },
  ukVatTreatment: {
    status: 'unresolved', sourceId: 'pricing', checkedIso,
    note: 'Whether the weekly prices include VAT is not stated on the pricing page.',
  },
  ownDomainWebsite: {
    status: 'unresolved', sourceId: 'pricing', checkedIso,
    note: 'Timely lists a branded, customisable mini-website; whether your own domain is included is not stated.',
  },
} as const satisfies Record<string, TimelyFact>;

export const TIMELY_UK_DOMESTIC_ONLINE_PERCENT = TIMELY_COMMERCIAL_FACTS.ukOnlinePaymentProcessing.percent;
export const TIMELY_UK_DOMESTIC_ONLINE_FIXED_GBP = TIMELY_COMMERCIAL_FACTS.ukOnlinePaymentProcessing.fixedGbp;

export type TimelyCommercialFactKey = keyof typeof TIMELY_COMMERCIAL_FACTS;

/** Guards copy and calculators against treating an unpublished UK fact as a confirmed amount. */
export function requireVerifiedTimelyFact(key: TimelyCommercialFactKey): Extract<TimelyFact, { status: 'verified' }> {
  const fact: TimelyFact = TIMELY_COMMERCIAL_FACTS[key];
  if (fact.status !== 'verified') throw new Error(`Timely fact "${key}" is unresolved; a current UK invoice is required.`);
  return fact;
}

/** Converts a weekly price to its average monthly equivalent (52 weeks / 12 months). */
export function weeklyToMonthlyGbp(weeklyGbp: number): number {
  return Math.round(((weeklyGbp * 52) / 12) * 100) / 100;
}

/**
 * Calculator adapter: returns null without a real shop-specific UK invoice.
 * The amount is the shop's MONTHLY equivalent INCLUDING ANY VAT CHARGED (Timely bills weekly;
 * multiply a typical weekly invoice by 52 and divide by 12). A "from" price is never a quote.
 */
export function resolveTimelyMonthlyShopQuoteGbp(quotedGbp: number | null | undefined): number | null {
  if (quotedGbp == null || quotedGbp === 0) return null; // 0 means no confirmed quote, never a free UK plan
  if (!Number.isFinite(quotedGbp) || quotedGbp < 0) throw new Error('Timely UK monthly quote must be a non-negative finite GBP amount');
  return Math.round(quotedGbp * 100) / 100;
}

export const TIMELY_TRADEMARK_DISCLAIMER =
  'Timely is a trademark of its respective owner. KERSIVO is not affiliated with, endorsed by or sponsored by Timely.';
export const TIMELY_COMPARISON_FOOTNOTE =
  'Timely plan and fee information checked 14 November 2026 on the Great Britain pricing page. Timely bills weekly; the published prices are “starting from” figures that adjust with booking volume. Your real weekly invoice is the only reliable Timely cost.';
