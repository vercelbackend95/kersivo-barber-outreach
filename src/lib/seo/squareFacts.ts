/** Verified Square Appointments UK claims, checked 8 October 2026. */
export const SQUARE_FACTS_CHECKED_ISO = '2026-10-08';
export const SQUARE_FACTS_CHECKED_DATE = '8 October 2026';
export const SQUARE_SOURCES = [
  {label:'Square Appointments UK pricing',url:'https://squareup.com/gb/en/appointments/pricing',supports:'Free, Plus and Premium subscriptions, processing fees and staff calendars'},
  {label:'Square Appointments overview',url:'https://squareup.com/gb/en/appointments',supports:'Booking website, reminders, point of sale and plan features'},
  {label:'Square deposits guide',url:'https://squareup.com/help/gb/en/article/8096-deposits-on-square-appointments',supports:'Fixed or percentage deposits on Free, Plus and Premium'},
  {label:'Square cancellations and no-show policies',url:'https://squareup.com/help/gb/en/article/5493-set-a-custom-cancellation-policy-with-square-appointments',supports:'Plus/Premium cancellation and no-show rules'},
  {label:'Square Help Centre: customer CSV export and separate card-on-file procedure',url:'https://squareup.com/help/gb/en/article/7871-export-card-on-file-to-third-party-payment-processors',supports:'Customer Directory CSV export instructions (Export customer data section); the separate PCI-compliant card-data export is NOT a KERSIVO migration promise'},
  {label:'Square UK payment fee schedule',url:'https://squareup.com/gb/en/legal/general/fees',supports:'UK and non-UK online rates, in-person, card on file, manually keyed, invoices and international-card fee disclosure'},
  {label:'Square online booking websites',url:'https://squareup.com/help/gb/en/article/5355-set-up-online-booking-with-square-appointments',supports:'Simple booking site and a full Square Online website (including a free option)'},
  {label:'Square reports export',url:'https://squareup.com/help/gb/en/article/8362-print-export-or-email-your-reports',supports:'CSV report export'},
] as const;
export const SQUARE_UK_PLANS = [
 { name:'Free',monthlyGbp:0,description:'Single-location free scheduling plan; processing fees still apply.' },
 { name:'Plus',monthlyGbp:29,description:'Additional scheduling tools, waitlist, reports and cancellation policies.' },
 { name:'Premium',monthlyGbp:69,description:'Advanced access and staff/resource management capabilities.' }
] as const;
export const SQUARE_UK_PAYMENT_FACTS = {
 inPersonFreePercent:1.75,
 inPersonPaidPercent:1.6,
 onlineUkPercent:1.4,
 onlineUkFixedPence:25,
 onlineNonUkPercent:2.5,
 onlineNonUkFixedPence:25
} as const;

/**
 * CALCULATOR SOURCE OF TRUTH — Square Appointments UK.
 *
 * This module is the only supported source for a future Square adapter to
 * barberSoftwareCostEngine.ts. Square is NOT integrated into the calculator yet.
 *
 * CRITICAL:
 * - Square advertises a Free plan; Plus and Premium are fixed public GBP headlines.
 * - Square's appointment-plan pages DO NOT explicitly confirm the VAT treatment
 *   of the £29 / £69 plan prices. Do not silently add 20% VAT or call them inclusive.
 * - £1.40% + 25p is for enumerated Square *online payment products*, NOT verified as
 *   the fee charged for every Square Appointments deposit/card-on-file transaction.
 * - Do not model appointment deposits using the online-product rate without separate
 *   transaction-method verification.
 * - Non-UK cards can be subject to international fees. Do not silently add 1.5%
 *   to a published non-UK rate: confirm applicability/stacking first.
 * - Any custom pricing is shop-specific. Only use public standard rates by default.
 */

export type SquarePlanId = 'free' | 'plus' | 'premium';
export type SquareVatBasis = 'inclusive' | 'exclusive' | 'not-applicable' | 'unverified';
export type SquarePaymentChannel =
  | 'in-person-uk'
  | 'square-online-uk'
  | 'square-online-non-uk'
  | 'manual-or-card-on-file-uk'
  | 'appointments-online-deposit';

export type SquareFact = {
  status: 'verified' | 'unresolved';
  sourceUrl: string;
  checkedIso: typeof SQUARE_FACTS_CHECKED_ISO;
  note: string;
  vatBasis: SquareVatBasis;
  valueGbp?: number;
  percentage?: number;
  fixedPence?: number;
  per: string;
};

/**
 * Per-location subscription headliners; VAT basis is explicitly unresolved
 * for the paid Square Appointments plans in the retrieved UK pricing page.
 */
export const SQUARE_SUBSCRIPTION_FACTS: Record<SquarePlanId, SquareFact> = {
  free: {
    status: 'verified', sourceUrl: SQUARE_SOURCES[0].url,
    checkedIso: SQUARE_FACTS_CHECKED_ISO, note: 'Free is £0/month for a single location.',
    vatBasis: 'not-applicable', valueGbp: 0, per: 'single location per month',
  },
  plus: {
    status: 'verified', sourceUrl: SQUARE_SOURCES[0].url,
    checkedIso: SQUARE_FACTS_CHECKED_ISO,
    note: '£29/month per location advertised. Whether this headline includes VAT has not been verified.',
    vatBasis: 'unverified', valueGbp: 29, per: 'location per month',
  },
  premium: {
    status: 'verified', sourceUrl: SQUARE_SOURCES[0].url,
    checkedIso: SQUARE_FACTS_CHECKED_ISO,
    note: '£69/month per location advertised. Whether this headline includes VAT has not been verified.',
    vatBasis: 'unverified', valueGbp: 69, per: 'location per month',
  },
};

export const SQUARE_PAYMENT_CHANNEL_FACTS: Record<SquarePaymentChannel, SquareFact> = {
  'in-person-uk': {
    status: 'verified',sourceUrl:SQUARE_SOURCES[0].url,checkedIso:SQUARE_FACTS_CHECKED_ISO,
    note:'Rate depends on appointment plan: Free 1.75%; Plus/Premium 1.6%. UK card-present transactions only.',
    vatBasis:'unverified',per:'UK card-present transaction',
  },
  'square-online-uk': {
    status:'verified',sourceUrl:'https://squareup.com/gb/en/legal/general/fees',checkedIso:SQUARE_FACTS_CHECKED_ISO,
    note:'Applies to listed Square Online/Online Checkout/eCommerce products; not automatically to Appointments deposits.',
    vatBasis:'unverified',percentage:1.4,fixedPence:25,per:'UK-card transaction on listed Square online products',
  },
  'square-online-non-uk': {
    status:'verified',sourceUrl:'https://squareup.com/gb/en/legal/general/fees',checkedIso:SQUARE_FACTS_CHECKED_ISO,
    note:'Published non-UK online rate; any further international surcharge must be confirmed for the payment scenario.',
    vatBasis:'unverified',percentage:2.5,fixedPence:25,per:'non-UK-card transaction on listed Square online products',
  },
  'manual-or-card-on-file-uk': {
    status:'verified',sourceUrl:'https://squareup.com/gb/en/legal/general/fees',checkedIso:SQUARE_FACTS_CHECKED_ISO,
    note:'Manually entered/Card on File listed at 2.5%; not a confirmed rate for every Appointments deposit.',
    vatBasis:'unverified',percentage:2.5,fixedPence:0,per:'UK-card manually entered or stored-card transaction',
  },
  'appointments-online-deposit': {
    status:'unresolved',sourceUrl:'https://squareup.com/help/gb/en/article/8096-deposits-on-square-appointments',
    checkedIso:SQUARE_FACTS_CHECKED_ISO,
    note:'Square confirms online deposit collection, but these sources do not establish the payment-processing channel for every Appointments deposit. Do not price using generic online fees.',
    vatBasis:'unverified',per:'Square Appointments customer-paid deposit',
  },
};

export const SQUARE_CALCULATOR_LIMITS = {
  standardPlanPriceAvailable: true,
  paidSubscriptionVatVerified: false,
  appDepositProcessingRateVerified: false,
  refundsOrChargebacksModelled: false,
  internationalSurchargeStackingVerified: false,
  customRatesSupported: false,
} as const;

/** Only a published Square subscription headline, NOT a VAT-inclusive final bill. */
export function squareBaseMonthlyPriceGbp(plan: SquarePlanId): number {
  const fact = SQUARE_SUBSCRIPTION_FACTS[plan];
  if (!fact || fact.status !== 'verified' || fact.valueGbp === undefined) {
    throw new Error('Unverified Square subscription plan');
  }
  return fact.valueGbp;
}

/**
 * Deterministic fee for a supported, EXPLICITLY IDENTIFIED payment channel.
 * Returns null for Square Appointments online deposits until their transaction
 * fee classification is independently confirmed.
 *
 * Only models the published base processing rate, not tax, refunds, custom terms
 * or an unverified extra international fee.
 */
export function estimateSquarePaymentFeeGbp(
  amountGbp: number,
  plan: SquarePlanId,
  channel: SquarePaymentChannel,
): number | null {
  if (!Number.isFinite(amountGbp) || amountGbp < 0) {
    throw new Error('amountGbp must be a finite non-negative amount');
  }
  if (!SQUARE_SUBSCRIPTION_FACTS[plan]) throw new Error('Unknown Square Appointments plan');
  const fact = SQUARE_PAYMENT_CHANNEL_FACTS[channel];
  if (!fact) throw new Error('Unknown Square payment channel');
  if (fact.status !== 'verified') return null;
  if (amountGbp === 0) return 0;
  const percentage = channel === 'in-person-uk'
    ? (plan === 'free' ? SQUARE_UK_PAYMENT_FACTS.inPersonFreePercent : SQUARE_UK_PAYMENT_FACTS.inPersonPaidPercent)
    : fact.percentage;
  if (percentage === undefined) return null;
  const amountPence = Math.round(amountGbp * 100);
  return Math.round(amountPence * percentage / 100 + (fact.fixedPence ?? 0)) / 100;
}

/** Status must be checked before using any Square rate in a comparison engine. */
export function requireVerifiedSquarePaymentFact(channel: SquarePaymentChannel): SquareFact {
  const fact = SQUARE_PAYMENT_CHANNEL_FACTS[channel];
  if (!fact || fact.status !== 'verified') {
    throw new Error(`Square payment channel "${channel}" is unresolved and must not be priced`);
  }
  return fact;
}

export const SQUARE_COMPARISON_FOOTNOTE = 'Square Appointments UK prices and features checked 8 October 2026 against official Square UK pages. Card-processing fees are separate. Prices and plan features may change.';
export const SQUARE_TRADEMARK_DISCLAIMER = 'Square and Square Appointments are trademarks of their respective owners. KERSIVO is not affiliated with, endorsed by or sponsored by Square.';
export const SQUARE_COMPARE_SECTIONS = [
 { id:'bookings',title:'Appointments & Scheduling',subtitle:'Staff calendars, booking websites and availability.',squareLead:'Appointments with unlimited staff calendars and online booking.',squarePoints:['Free, Plus and Premium offer unlimited staff calendars','Online booking website and social integrations','Automated email and text reminders on Free'],kersivoLead:'A booking system tailored to independent UK barbershops.',kersivoPoints:['Starter: hosted booking page, up to four active bookable barbers','Full: own-domain branded barbershop website','Email reminders on both plans; SMS reminders on Full'] },
 { id:'payments',title:'Payments & Deposits',subtitle:'What happens when your customers pay.',squareLead:'Integrated Square payment processing and configurable deposits.',squarePoints:['Free: 1.75% in-person card processing; Plus/Premium: 1.6%','UK online card transactions: 1.4% + 25p on published standard rates','Square offers fixed or percentage service deposits on all three plans'],kersivoLead:'Shop-connected Stripe payments and zero KERSIVO commission.',kersivoPoints:['Both plans: 0% KERSIVO commission; Stripe processing fees apply','Starter: £5 deposit or Pay in full required for public bookings','Full: configurable Pay at shop, £5 deposit or full prepayment'] },
 { id:'brand',title:'Brand & Website',subtitle:'How customers find and book your shop.',squareLead:'Square provides a customisable booking website and wider commerce ecosystem.',squarePoints:['Online booking website on Square','Bookings and payments integrated into Square’s services','Useful if Square POS is central to your shop'],kersivoLead:'Full KERSIVO focuses on your complete own-domain shop experience.',kersivoPoints:['Starter: simple KERSIVO-hosted booking page','Full: branded barbershop website with a standard domain','No consumer marketplace required for direct bookings'] },
 { id:'retail',title:'Retail & Point of Sale',subtitle:'The difference between POS and online pickup.',squareLead:'Broader integrated POS and payment hardware ecosystem.',squarePoints:['In-person checkout and payment hardware','Square can support wider retail workflows','May be better if your business needs integrated point-of-sale hardware'],kersivoLead:'Product pickup through your barbershop website on Full.',kersivoPoints:['Online retail orders paid through Stripe and collected in shop','Full product and order management','KERSIVO does not claim to replace Square POS hardware or stock control'] },
 { id:'clients',title:'Customer Records',subtitle:'Direct relationships and data portability.',squareLead:'Customer Directory and records across its tools.',squarePoints:['Customer Directory records and booking history','Customer Directory can be exported as CSV','Card-on-file migration is a separate PCI-compliant process'],kersivoLead:'Simple contacts in Starter, expanded client tools on Full.',kersivoPoints:['Starter: Clients Core plus a rolling 90 days of past booking history','Full: advanced client management and retained history','Migration assistance for usable supported CSV exports'] },
 { id:'reports',title:'Reporting & Business Tools',subtitle:'Understand operations and growth.',squareLead:'Appointment reports on Plus and more advanced tools on Premium.',squarePoints:['Waitlist and appointment reporting on Plus','Premium offers advanced staff and resource controls','Reports can be exported where supported'],kersivoLead:'Full business reporting alongside bookings and retail.',kersivoPoints:['Starter: essential Bookings, Team and Services','Full: Reports and retail Sales modules','Full is £39/month per physical location, subject to fair use'] }
] as const;
export type SquareCompareSectionId = (typeof SQUARE_COMPARE_SECTIONS)[number]['id'];
