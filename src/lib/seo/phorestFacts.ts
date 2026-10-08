/**
 * Phorest UK facts / calculator source of truth.
 * First-party research checked 8 October 2026.
 *
 * Pricing: Phorest requests a quote, NOT a universal verified GBP monthly fee.
 * Do not invent a plan subscription, VAT treatment, setup, processing or per-staff charge.
 * The published SMS rates are plan-specific, not a complete all-in cost quote.
 */
export const PHOREST_FACTS_CHECKED_ISO = '2026-10-08';
export const PHOREST_FACTS_CHECKED_DATE = '8 October 2026';

export type PhorestSourceId = 'pricing' | 'features' | 'booking' | 'dataExport' | 'transactionsExport';
export type PhorestSource = {
  id: PhorestSourceId;
  label: string;
  url: string;
  supports: string;
};
export const PHOREST_SOURCES: readonly PhorestSource[] = [
  { id: 'pricing', label: 'Phorest UK pricing and plan comparison',
    url: 'https://www.phorest.com/gb/pricing/',
    supports: 'Starter, Grow, Ultimate and Elite; personalised quote; unlimited staff; published SMS rates; plan-specific app, POS, marketing and loyalty tools' },
  { id: 'features', label: 'Phorest UK product features',
    url: 'https://www.phorest.com/gb/features/',
    supports: 'Online bookings, CRM, reminders, branded booking app, marketing, POS, stock and retail' },
  { id: 'booking', label: 'Phorest online booking and deposits',
    url: 'https://www.phorest.com/gb/features/online-booking/',
    supports: 'Website/social booking, custom deposit amounts and booking rules' },
  { id: 'dataExport', label: 'Phorest Support: how to export your data',
    url: 'https://support.phorest.com/hc/en-us/articles/360019038240-How-can-I-export-my-data-from-Phorest',
    supports: 'Client, future appointment, service, product and other report export methods; exclusions and export-charge caveat' },
  { id: 'transactionsExport', label: 'Phorest Support: CSV transaction exports',
    url: 'https://support.phorest.com/hc/en-us/articles/360016362219-How-can-I-export-sales-transaction-information-to-CSV',
    supports: 'Manager > Business > CSV Export for transaction and purchase records' },
];

export function getPhorestSource(id: PhorestSourceId): PhorestSource {
  const found = PHOREST_SOURCES.find(item => item.id === id);
  if (!found) throw new Error(`Unknown Phorest source: ${id}`);
  return found;
}

export type PhorestPlanId = 'starter' | 'grow' | 'ultimate' | 'elite';
export type PhorestFactStatus = 'verified' | 'unresolved' | 'quote_required';
export type PhorestFact = {
  status: PhorestFactStatus;
  sourceId: PhorestSourceId;
  checkedIso: string;
  unit?: string;
  amountGbp?: number;
  value?: number | boolean;
  vatBasis?: 'not_stated' | 'included' | 'excluded';
  note?: string;
};

/** Distinguish subscription price, add-ons and payment rates before any price estimate. */
export const PHOREST_UK_COMMERCIAL_FACTS = {
  monthlySubscriptionGbp: {
    status: 'quote_required', sourceId: 'pricing', checkedIso: PHOREST_FACTS_CHECKED_ISO,
    vatBasis: 'not_stated',
    note: 'Phorest does not publish a universal UK GBP monthly subscription. A written, shop-specific quote is required.',
  },
  setupFeeGbp: {
    status: 'unresolved', sourceId: 'pricing', checkedIso: PHOREST_FACTS_CHECKED_ISO,
    note: 'Public UK pricing does not establish one universally applicable setup fee.',
  },
  ukSubscriptionVat: {
    status: 'unresolved', sourceId: 'pricing', checkedIso: PHOREST_FACTS_CHECKED_ISO,
    note: 'Quote-specific VAT treatment is not established by a public universal GBP price.',
  },
  addedStaffSubscriptionGbp: {
    status: 'unresolved', sourceId: 'pricing', checkedIso: PHOREST_FACTS_CHECKED_ISO,
    note: 'Phorest advertises unlimited staff on plans; that does not prove a universally fixed per-staff fee of £0 in every quotation.',
  },
  onlinePaymentProcessingGbp: {
    status: 'unresolved', sourceId: 'booking', checkedIso: PHOREST_FACTS_CHECKED_ISO,
    note: 'PhorestPay processing fees vary by commercial terms; request a current quote. No Stripe rate can be substituted.',
  },
  smsRateStarterPence: { status:'verified', sourceId:'pricing', checkedIso:PHOREST_FACTS_CHECKED_ISO, value:9.5, unit:'pence per SMS on Starter', vatBasis:'not_stated' },
  smsRateGrowPence: { status:'verified', sourceId:'pricing', checkedIso:PHOREST_FACTS_CHECKED_ISO, value:8.2, unit:'pence per SMS on Grow', vatBasis:'not_stated' },
  smsRateUltimatePence: { status:'verified', sourceId:'pricing', checkedIso:PHOREST_FACTS_CHECKED_ISO, value:7, unit:'pence per SMS on Ultimate', vatBasis:'not_stated' },
  eliteIncludedSmsMonthly: { status:'verified', sourceId:'pricing', checkedIso:PHOREST_FACTS_CHECKED_ISO, value:500, unit:'SMS included per month, Elite plan', vatBasis:'not_stated' },
  smsRateEliteAfterAllowancePence: {
    status:'unresolved', sourceId:'pricing', checkedIso:PHOREST_FACTS_CHECKED_ISO,
    note:'The price for SMS above the Elite allowance is not clearly established in the published table.',
  },
} as const satisfies Record<string, PhorestFact>;
export type PhorestCommercialFactKey = keyof typeof PHOREST_UK_COMMERCIAL_FACTS;

/** Calculator guard: only verified numerical facts can be read as a published rate. */
export function requireVerifiedPhorestNumericFact(key: PhorestCommercialFactKey): number {
  const fact: PhorestFact = PHOREST_UK_COMMERCIAL_FACTS[key];
  if (fact.status !== 'verified' || typeof fact.value !== 'number') {
    throw new Error(`Phorest fact "${key}" is ${fact.status}; no verified numeric rate available.`);
  }
  return fact.value;
}

export const PHOREST_UK_PLANS = [
  {id:'starter',label:'Starter',monthlySubscriptionGbp:null,smsPence:9.5,includedSmsMonthly:null,
   notes:'Scheduling, booking deposits, reminders, POS and stock tools'},
  {id:'grow',label:'Grow',monthlySubscriptionGbp:null,smsPence:8.2,includedSmsMonthly:null,
   notes:'Starter plus additional retention, online shop and reputation tools'},
  {id:'ultimate',label:'Ultimate',monthlySubscriptionGbp:null,smsPence:7,includedSmsMonthly:null,
   notes:'Grow plus a branded booking app and further loyalty features'},
  {id:'elite',label:'Elite',monthlySubscriptionGbp:null,smsPence:null,includedSmsMonthly:500,
   notes:'Ultimate plus two-way SMS, memberships and Ads Manager tools'},
] as const;

/**
 * No self-contained official Phorest UK total can be calculated without a real quote.
 * Return null rather than converting "quote required" to £0 or guessing.
 */
export function getPublishedPhorestSubscriptionGbp(_plan: PhorestPlanId): null {
  return null;
}

/**
 * A later calculator may accept the user's *actual written monthly quote*.
 * This is a user-provided scenario, NOT an advertised Phorest subscription.
 * Do not imply VAT, processing fees, setup or SMS are included.
 */
export function useUserProvidedPhorestMonthlyQuoteGbp(quotedGbp: number | null | undefined): number | null {
  if (quotedGbp == null) return null;
  if (!Number.isFinite(quotedGbp) || quotedGbp < 0) throw new Error('Phorest quote must be a finite, non-negative GBP amount');
  return Math.round(quotedGbp * 100) / 100;
}

export const PHOREST_TRADEMARK_DISCLAIMER = 'Phorest is a trademark of its respective owner. KERSIVO is not affiliated with, endorsed by or sponsored by Phorest.';
export const PHOREST_COMPARISON_FOOTNOTE = 'Phorest UK pricing and plan information checked against official Phorest pages on 8 October 2026. Monthly subscription, processing fees and VAT require your individual quote. SMS rates may change.';

export const PHOREST_COMPARE_SECTIONS=[
{id:'bookings',title:'Bookings',subtitle:'Booking pages, appointments and reminders.',phorestLead:'An established salon platform with online appointment booking.',phorestPoints:['Booking through a website, social media and branded app','Online deposits and booking rules','SMS and email appointment communications','Scheduling, rebooking and team calendars'],kersivoLead:'Barber-focused bookings from a free entry plan.',kersivoPoints:['Starter: £0/month for up to four active bookable barbers','Starter: hosted booking page and automated email reminders','Full: own branded website and standard domain','Full: SMS reminders subject to allowance']},
{id:'payments',title:'Payments & Deposits',subtitle:'What clients can pay and when.',phorestLead:'Flexible salon payment and deposit options.',phorestPoints:['Online deposits with configurable rules','Integrated salon POS and PhorestPay options','Confirm payment-processing charges in your individual quote'],kersivoLead:'Clear KERSIVO subscription and card-fee separation.',kersivoPoints:['Starter: £5 online deposit or full upfront payment for public bookings','Full: configurable Pay at shop, deposits or full payment','0% KERSIVO commission on booking payments','Standard Stripe processing fees still apply']},
{id:'brand',title:'Brand & Domain',subtitle:'Where your customer experience lives.',phorestLead:'Online bookings integrated with websites and a branded client app.',phorestPoints:['Online booking integration with the shop website','Branded booking app available depending on plan and options','Website and domain arrangements should be confirmed in the quote'],kersivoLead:'An own-domain branded website in Full.',kersivoPoints:['Starter: booking page hosted by KERSIVO','Full: branded barbershop website and one standard domain','Your identity stays central to the Full booking experience','No KERSIVO consumer marketplace']},
{id:'retail',title:'Retail & Marketing',subtitle:'Growth tools, products and sales.',phorestLead:'A comprehensive salon marketing and retail stack.',phorestPoints:['Salon POS and inventory management','Email/SMS marketing, loyalty and retention features','Online selling options; exact plan scope varies'],kersivoLead:'Focused product pickup and business operation on Full.',kersivoPoints:['Retail pickup shop with online payments on Full','Product/order tools on Full; not full stock management','0% KERSIVO commission on Full retail payments','No claim to match Phorest’s wider marketing toolset']},
{id:'clients',title:'Clients',subtitle:'Customer records and follow-up.',phorestLead:'Established salon client-management features.',phorestPoints:['Client records and appointment history','Marketing and rebooking tools','Client management linked with salon operations'],kersivoLead:'Clients Core or advanced management by plan.',kersivoPoints:['Starter: Clients Core and 90-day past booking history','Full: Advanced Clients / CRM and retained full history','Direct client booking experience in the Full website']},
{id:'reports',title:'Reports & Operations',subtitle:'Performance visibility and day-to-day running.',phorestLead:'Broader salon management and reporting capabilities.',phorestPoints:['Staff management and scheduling','Business reports and stock/POS workflows','More advanced salon-wide tools than KERSIVO in several areas'],kersivoLead:'Barber-focused workflow with clear upgrade path.',kersivoPoints:['Bookings, Team and Services in Starter','Full: reporting, retail orders and sales','£39/month per location for Full, fair-use terms apply']},
] as const;
export type PhorestCompareSectionId=(typeof PHOREST_COMPARE_SECTIONS)[number]['id'];
