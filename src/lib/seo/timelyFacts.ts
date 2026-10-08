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
  | { status: 'verified'; percent: number; fixedGbp: number; market: 'UK'; unit: string; sourceId: TimelySourceId; checkedIso: string; note: string }
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
    status: 'verified', percent: 1.85, fixedGbp: 0.30, market: 'UK',
    unit: 'domestic UK online card transaction',
    sourceId: 'ukPayments', checkedIso,
    note: 'Published standard TimelyPay domestic UK online rate effective 5 August 2026; custom/legacy rates may differ. Fee VAT treatment is not established.',
  },
  ukInternationalOnlinePaymentProcessing: {
    status: 'verified', percent: 3, fixedGbp: 0.30, market: 'UK',
    unit: 'international or American Express online card transaction',
    sourceId: 'ukPayments', checkedIso,
    note: 'Published TimelyPay UK online rate effective 5 August 2026; actual card mix must be confirmed.',
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
 * Monthly quote is the shop's real MONTHLY INVOICE AMOUNT INCLUDING ANY VAT CHARGED,
 * not a US price converted to GBP. Its VAT component cannot be inferred without an invoice.
 * TimelyPay standard UK card processing can be estimated separately from the published UK rate.
 */
export function resolveTimelyMonthlyShopQuoteGbp(quotedGbp: number | null | undefined): number | null {
  if (quotedGbp == null || quotedGbp === 0) return null; // 0 means no confirmed quote, never a free UK plan
  if (!Number.isFinite(quotedGbp) || quotedGbp < 0) throw new Error('Timely UK monthly quote must be a non-negative finite GBP amount');
  return Math.round(quotedGbp * 100) / 100;
}

export const TIMELY_TRADEMARK_DISCLAIMER =
  'Timely is a trademark of its respective owner. KERSIVO is not affiliated with, endorsed by or sponsored by Timely.';
export const TIMELY_COMPARISON_FOOTNOTE =
  'Timely feature and plan information checked 8 October 2026. Public pricing view showed USD for the USA. UK GBP subscription prices and tax treatment require a current UK invoice; published standard TimelyPay domestic online processing is 1.85% + 30p from 5 August 2026.';

export const TIMELY_COMPARE_SECTIONS = [
 {id:'bookings',title:'Online bookings',subtitle:'Appointment scheduling and the customer journey',timelyLead:'Timely combines 24/7 self-service booking with appointment and team diaries.',timelyPoints:['Online appointment calendar and client self-booking','Tools designed for salon, beauty and wellness operations','Booking links and integrations for existing websites'],kersivoLead:'Starter bookings and an own-domain Full booking experience.',kersivoPoints:['Starter: free hosted booking page for up to four barbers','Full: branded website and booking flow on your domain','Service, barber, availability and appointment management']},
 {id:'payments',title:'Payments and deposits',subtitle:'What the customer pays and when',timelyLead:'TimelyPay supports deposits and cancellation-related payments in supported markets.',timelyPoints:['Online payments and deposit options, depending on setup','Processing charges and payment rules should be verified for your market','No assumed universal per-booking commission or processing rate'],kersivoLead:'Stripe-powered booking payments without KERSIVO platform commission.',kersivoPoints:['Starter: £5 deposit toward the service or full prepayment','0% KERSIVO commission; Stripe fees apply','Full adds editable options including Pay at shop']},
 {id:'brand',title:'Brand and website',subtitle:'Who owns the customer-facing experience',timelyLead:'Timely offers social booking links and a mini website alongside website booking integrations.',timelyPoints:['Online booking tools linked to your business','Website booking integrations and branded booking options','Confirm included website scope and domain terms with Timely'],kersivoLead:'Full KERSIVO includes the branded site and standard domain.',kersivoPoints:['Full includes a branded barbershop website and standard domain','Starter offers a hosted KERSIVO booking page','Direct booking journey without a consumer marketplace']},
 {id:'retail',title:'Retail and stock',subtitle:'Products, orders and inventory requirements',timelyLead:'Timely advertises stock-level management as part of its salon workflow.',timelyPoints:['Salon retail and stock-related tools are part of the wider Timely offering','Check plan-specific inventory features and any costs','Useful for shops requiring broader inventory workflows'],kersivoLead:'Full KERSIVO focuses on online pickup sales, not full inventory management.',kersivoPoints:['Full includes an online retail pickup shop','Clients buy products online and collect in-store','No full inventory management or shipping feature is claimed']},
 {id:'clients',title:'Client tools and marketing',subtitle:'Records, return visits and communication',timelyLead:'Timely combines client records with plan-dependent campaigns and consultations.',timelyPoints:['Client records and salon-focused retention tools','Marketing and messaging availability varies by plan','Check specific loyalty and promotional requirements'],kersivoLead:'Starter client essentials or Full advanced CRM and SMS.',kersivoPoints:['Starter Clients Core and email reminders','Full Advanced Clients / CRM and SMS reminders','Full booking and retail data within the dashboard']},
 {id:'reports',title:'Reporting and teams',subtitle:'Operational visibility and staff',timelyLead:'Timely reporting and team tools include sales targets on qualifying higher plans.',timelyPoints:['Reporting, schedules and team-management capabilities','Subscription costs and eligibility may depend on selected setup','Check payroll, commissions and reporting needs carefully'],kersivoLead:'Full KERSIVO reports and per-location subscription pricing.',kersivoPoints:['Starter supports four active bookable barbers at one location','Full reports and larger teams under per-location pricing','£39/month Full per physical location, fair use applies']},
 ] as const;
export type TimelyCompareSectionId = (typeof TIMELY_COMPARE_SECTIONS)[number]['id'];
