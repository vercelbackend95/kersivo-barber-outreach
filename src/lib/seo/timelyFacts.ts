/**
 * Timely commercial source of truth for UK comparisons and a FUTURE cost calculator.
 * Verified public list prices are currently displayed in USD for the USA.
 * Never silently convert those rates to GBP or represent them as UK prices.
 * Checked against first-party Timely pricing/help pages on 8 October 2026.
 */
export const TIMELY_FACTS_CHECKED_ISO = '2026-10-08';
export const TIMELY_FACTS_CHECKED_DATE = '8 October 2026';

export const TIMELY_SOURCES = [
  {
    id: 'pricing',
    label: 'Timely official plans and pricing',
    url: 'https://www.gettimely.com/pricing/',
    supports: 'Build, Elevate and Innovate USD per-staff public prices (USA view); trial, included features and no new-client fees',
  },
  {
    id: 'plans',
    label: 'Timely Help Centre: plans',
    url: 'https://help.gettimely.com/hc/en-gb/articles/360060949974-Timely-plans-find-the-perfect-plan-for-your-business',
    supports: 'Build, Elevate and Innovate features, staff-seat subscription model; NZD example is not a UK quotation',
  },
  {
    id: 'ukPayments',
    label: 'Timely Help Centre: UK payments',
    url: 'https://help.gettimely.com/hc/en-gb/articles/4406148282391-Updated-payment-providers-in-the-UK',
    supports: 'TimelyPay, deposit support and UK payment-provider restrictions; no universal present-day UK processing rate inferred',
  },
  {
    id: 'exports',
    label: 'Timely Help Centre: data exports',
    url: 'https://help.gettimely.com/hc/en-gb/articles/20753162121239-How-to-receive-download-and-export-your-data-from-Timely',
    supports: 'Requesting an export via support and documented categories of exportable records',
  },
] as const;

export type TimelySourceId = (typeof TIMELY_SOURCES)[number]['id'];
export const getTimelySource = (id: TimelySourceId) => {
  const source = TIMELY_SOURCES.find((item) => item.id === id);
  if (!source) throw new Error(`Unknown Timely source: ${id}`);
  return source;
};

export type TimelyFact =
  | { status: 'verified'; amount: number; currency: 'USD'; market: 'US'; unit: string; sourceId: TimelySourceId; checkedIso: string; note: string }
  | { status: 'verified'; value: number | boolean; market: 'public-plans'; unit: string; sourceId: TimelySourceId; checkedIso: string; note: string }
  | { status: 'unresolved'; market: 'UK'; sourceId: TimelySourceId; checkedIso: string; note: string };

const checkedIso = TIMELY_FACTS_CHECKED_ISO;

/** A URL showing USD for USA does not establish a GBP subscription or a UK tax/processing rate. */
export const TIMELY_COMMERCIAL_FACTS = {
  buildUsMonthlyPerStaff: {
    status: 'verified', amount: 26, currency: 'USD', market: 'US',
    unit: 'USD per bookable staff member per month, billed monthly',
    sourceId: 'pricing', checkedIso,
    note: 'USA selected on the public pricing view; not a UK GBP price.',
  },
  elevateUsMonthlyPerStaff: {
    status: 'verified', amount: 39, currency: 'USD', market: 'US',
    unit: 'USD per bookable staff member per month, billed monthly',
    sourceId: 'pricing', checkedIso,
    note: 'USA selected on the public pricing view; not a UK GBP price.',
  },
  innovateUsMonthlyPerStaff: {
    status: 'verified', amount: 47, currency: 'USD', market: 'US',
    unit: 'USD per bookable staff member per month, billed monthly',
    sourceId: 'pricing', checkedIso,
    note: 'USA selected on the public pricing view; not a UK GBP price.',
  },
  trialDays: {
    status: 'verified', value: 14, market: 'public-plans',
    unit: 'days for the publicly advertised free trial',
    sourceId: 'pricing', checkedIso,
    note: 'Timely advertises a 14-day trial; confirm local eligibility.',
  },
  noNewClientFees: {
    status: 'verified', value: true, market: 'public-plans',
    unit: 'Timely pricing page advertises no new-client fees',
    sourceId: 'pricing', checkedIso,
    note: 'This does not mean card processing or subscription is free.',
  },
  billingByStaff: {
    status: 'verified', value: true, market: 'public-plans',
    unit: 'public plan prices are quoted per staff member',
    sourceId: 'pricing', checkedIso,
    note: 'Timely states its plan price grows with team size and part-time staff count as full-time.',
  },
  ukMonthlyPerStaffGbp: {
    status: 'unresolved', market: 'UK', sourceId: 'pricing', checkedIso,
    note: 'A reliable official GBP price for each UK Timely plan was not independently verified. Obtain a current UK quote.',
  },
  ukVatTreatment: {
    status: 'unresolved', market: 'UK', sourceId: 'pricing', checkedIso,
    note: 'UK VAT inclusion, VAT charge and invoice basis require verification for the individual quote.',
  },
  ukOnlinePaymentProcessing: {
    status: 'unresolved', market: 'UK', sourceId: 'ukPayments', checkedIso,
    note: 'USD pricing-page processing fees must NOT be reused as GBP TimelyPay UK rates.',
  },
  ukInPersonPaymentProcessing: {
    status: 'unresolved', market: 'UK', sourceId: 'ukPayments', checkedIso,
    note: 'Current UK TimelyPay in-person rates and terminal costs require confirmation.',
  },
  ukAddOnsAndOverages: {
    status: 'unresolved', market: 'UK', sourceId: 'pricing', checkedIso,
    note: 'Check current UK overage SMS rates, paid features and add-on applicability.',
  },
} as const satisfies Record<string, TimelyFact>;

export type TimelyCommercialFactKey = keyof typeof TIMELY_COMMERCIAL_FACTS;

/** Guards a future calculator against treating a missing UK fact as a confirmed amount. */
export function requireVerifiedTimelyFact(key: TimelyCommercialFactKey): Extract<TimelyFact, { status: 'verified' }> {
  const fact: TimelyFact = TIMELY_COMMERCIAL_FACTS[key];
  if (fact.status !== 'verified') throw new Error(`Timely fact "${key}" is unresolved; a current UK quote is required.`);
  return fact;
}

/**
 * Conservative future-calculator adapter: returns null without a real shop-specific UK quote.
 * Monthly quote is the TOTAL for the selected shop/team, not a US price converted to GBP.
 * VAT, processing and extras must be calculated separately only when verified.
 */
export function resolveTimelyMonthlyShopQuoteGbp(quotedGbp: number | null | undefined): number | null {
  if (quotedGbp == null) return null;
  if (!Number.isFinite(quotedGbp) || quotedGbp < 0) throw new Error('Timely UK monthly quote must be a non-negative finite GBP amount');
  return Math.round(quotedGbp * 100) / 100;
}

export const TIMELY_TRADEMARK_DISCLAIMER =
  'Timely is a trademark of its respective owner. KERSIVO is not affiliated with, endorsed by or sponsored by Timely.';
export const TIMELY_COMPARISON_FOOTNOTE =
  'Timely feature and plan information checked 8 October 2026. Public pricing view showed USD for the USA. UK GBP subscriptions, tax and TimelyPay processing require a current UK quote.';
