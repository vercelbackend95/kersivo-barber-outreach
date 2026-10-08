/**
 * Source-backed SQUIRE comparison facts for the UK /squire-alternative landing page.
 * Keep US-dollar prices labelled as public USD list prices. Do not infer UK GBP pricing.
 * SQUIRE has an operating UK presence, independently of GBP pricing availability.
 */
export const SQUIRE_FACTS_CHECKED_DATE = '8 October 2026';
export const SQUIRE_FACTS_CHECKED_ISO = '2026-10-08';

export const SQUIRE_OFFICIAL_SOURCES = [
  {id:'pricing', label:'SQUIRE official pricing', url:'https://www.getsquire.com/pricing', supports:'Public USD subscription tiers, plan features and add-on prices'},
  {id:'payments', label:'SQUIRE payments overview', url:'https://getsquire.com/features/payments', supports:'Online and in-shop payment options, POS, Auto Payout and Rent Collect'},
  {id:'ukShop', label:'SQUIRE: Envy Barbers, Covent Garden', url:'https://getsquire.com/discover/barbershop/envy-barbers-covent-garden-covent-garden', supports:'Example of a live publicly listed UK barbershop on SQUIRE'},
  {id:'ukEntity', label:'SQUIRE data processing agreement', url:'https://getsquire.com/data-processing-agreement', supports:'Squire Europe Limited as a UK service provider'},
  {id:'tapToPay', label:'SQUIRE Tap to Pay availability',url:'https://getsquire.com/using-squire/tap-to-pay',supports:'UK Android Tap to Pay availability and platform-specific restrictions'},
] as const;

export const SQUIRE_US_LIST_PLANS = [
  {id:'independent', label:'INDEPENDENT', usdMonthly:30, audience:'Individual barbers', notes:['Online booking, scheduling and no-show protection','Automated email and SMS reminders']},
  {id:'pro',label:'PRO',usdMonthly:50,audience:'Single-location shops',notes:['Multiple barber accounts','Google and Instagram booking, waitlist and client transfer']},
  {id:'executive',label:'EXECUTIVE',usdMonthly:150,audience:'High-growth shops · per shop',notes:['Commission and rent collection','Email/SMS marketing and optional branded landing page ($25/month)']},
  {id:'titan',label:'TITAN',usdMonthly:250,audience:'Multi-location brands · per shop',notes:['Multi-location tools and branded app','Gift cards, loyalty, inventory tracking and client chat']},
] as const;

export const SQUIRE_COMPARISON_FOOTNOTE =
  'SQUIRE features and publicly listed USD subscription prices were checked against its official website on 8 October 2026. UK barbershops use SQUIRE, but a complete UK-specific GBP price list, local transaction charges and plan eligibility were not verified. Some functions are tier-specific or paid add-ons. Confirm terms directly with SQUIRE.';

export type SquireCompareSectionId='bookings'|'payments'|'brand'|'retail'|'clients'|'reports';
export type SquireCompareSection={
  id:SquireCompareSectionId;
  title:string; subtitle:string;
  squireLead:string; squirePoints:readonly string[];
  kersivoLead:string; kersivoPoints:readonly string[];
};
export const SQUIRE_COMPARE_SECTIONS:readonly SquireCompareSection[]=[
  {id:'bookings',title:'Bookings',subtitle:'The diary, booking journey and reminders.',
   squireLead:'Online bookings and barbershop scheduling with reminders, no-show tools and a waitlist on relevant plans.',
   squirePoints:['Bookings and appointment scheduling','Automated email/SMS reminders','No-show protection and group appointments','Google and Instagram bookings on Pro'],
   kersivoLead:'Practical booking operations, with an optional own-domain experience on Full.',
   kersivoPoints:['Unlimited bookings on Starter and Full','Starter: hosted page for up to four active bookable barbers','Email reminders on both plans; SMS on Full under its allowance','Full: booking journey on your barbershop website']},
  {id:'payments',title:'Payments & Deposits',subtitle:'How appointments and in-shop payments work.',
   squireLead:'Integrated in-person and online payments, plus staff payout workflows on applicable plans.',
   squirePoints:['Online payments and pre-payments','In-shop register/POS and contactless payments','Auto Payout and Rent Collect for qualifying shops','Processing rates and any client-facing charges need UK confirmation'],
   kersivoLead:'Stripe-powered online booking payments with 0% KERSIVO platform commission.',
   kersivoPoints:['Starter: public bookings require £5 online payment or Pay in full','Full: owner-controlled Pay at shop, £5 deposit or Pay in full','Standard Stripe processing fees apply','KERSIVO does not offer SQUIRE-style register or automatic barber payouts']},
  {id:'brand',title:'Brand & Domain',subtitle:'What clients see when they book.',
   squireLead:'Hosted booking discovery and branded experiences, with features depending on plan.',
   squirePoints:['Public SQUIRE-hosted shop booking pages','Google and Instagram booking on Pro','Branded landing pages offered as an Executive add-on','Branded apps are advertised on eligible plans'],
   kersivoLead:'Full KERSIVO places the complete website and booking flow on your own shop domain.',
   kersivoPoints:['Full: branded website and standard domain included','Your brand, services, team and booking steps in one experience','Starter: KERSIVO-hosted booking page with shop name and logo','No consumer marketplace required for direct booking']},
  {id:'retail',title:'Retail & POS',subtitle:'Online products versus physical retail operations.',
   squireLead:'Broad in-shop POS capabilities plus inventory tools on higher tiers.',
   squirePoints:['In-shop register for walk-ins and checkout','Card and contactless payment support','Inventory tracking and purchase orders on Titan','Integrated staff payment workflows'],
   kersivoLead:'A Full-only branded online retail pickup experience.',
   kersivoPoints:['Products available to order from your own website on Full','Shop pickup orders managed in KERSIVO','No KERSIVO commission on Full retail payments','Not a replacement for a physical POS or inventory procurement suite']},
  {id:'clients',title:'Clients & Communication',subtitle:'Retention, reminders and customer relationships.',
   squireLead:'Client management with reminders, marketing and loyalty capabilities varying by plan.',
   squirePoints:['Booking confirmations and reminders','Unlimited email/SMS marketing with Engage on Executive','Loyalty programme and client chat on Titan','Customer-facing SQUIRE booking experience'],
   kersivoLead:'Client records connected to your own booking journey.',
   kersivoPoints:['Clients Core on Starter, advanced client information on Full','Email appointment reminders on both plans','SMS reminders on Full, subject to allowance','Bookings on your own domain with Full']},
  {id:'reports',title:'Reports & Team',subtitle:'The operational tools behind the diary.',
   squireLead:'Wider business management with staff and multi-location tools on eligible plans.',
   squirePoints:['Earnings and reporting insights','Commission and rent collection on Executive','Inventory and multi-location functionality on Titan','Advanced POS and payout workflow'],
   kersivoLead:'Focused management for independent UK barbershops.',
   kersivoPoints:['Bookings, services, team and limited clients on Starter','Full reports, advanced clients and retail orders','Full includes larger teams subject to fair use','£39/month per location, not per barber']},
];

// ---------------------------------------------------------------------------
// UK COMMERCIAL FACTS — calculator contract
// ---------------------------------------------------------------------------
// This is intentionally separate from the verified US-dollar list-price table.
// No USD-to-GBP conversion, assumed VAT, invented UK transaction percentage,
// or implied zero-fee defaults are permissible.
//
// A SQUIRE plan can only become a numerical GBP calculator result after its
// UK-specific plan fee, tax basis and deposit-processing terms are verified.

export type SquireSourceId = (typeof SQUIRE_OFFICIAL_SOURCES)[number]['id'];
export type SquirePlanId = (typeof SQUIRE_US_LIST_PLANS)[number]['id'];

export type SquireUnresolvedCommercialFact = {
  status: 'unresolved';
  reason: string;
  sourceId: SquireSourceId;
  checkedIso: string;
};

export type SquireVerifiedUkCommercialFact = {
  status: 'verified';
  currency: 'GBP';
  /** Subscription amount, optional add-on amount, or fixed component of a transaction fee. */
  amountGbp?: number;
  /** A percentage such as the variable component of an online payment fee. */
  percent?: number;
  /** Minimum fee, if published. */
  minimumGbp?: number;
  vat: 'inclusive' | 'exclusive' | 'not-applicable';
  per: string;
  sourceId: SquireSourceId;
  checkedIso: string;
};

export type SquireUkCommercialFact =
  | SquireUnresolvedCommercialFact
  | SquireVerifiedUkCommercialFact;

/**
 * UK pricing facts needed for future calculator integration.
 * IMPORTANT: "unresolved" is not a £0 charge, a missing fee or a free service.
 * Published USD plans are separately recorded in SQUIRE_US_LIST_PLANS.
 */
export const SQUIRE_UK_COMMERCIAL_FACTS = {
  independentSubscription: {
    status: 'unresolved',
    reason: 'No verified UK GBP monthly subscription and VAT treatment for Independent.',
    sourceId: 'pricing',
    checkedIso: SQUIRE_FACTS_CHECKED_ISO,
  },
  proSubscription: {
    status: 'unresolved',
    reason: 'No verified UK GBP monthly subscription and VAT treatment for Pro.',
    sourceId: 'pricing',
    checkedIso: SQUIRE_FACTS_CHECKED_ISO,
  },
  executiveSubscription: {
    status: 'unresolved',
    reason: 'No verified UK GBP monthly subscription and VAT treatment for Executive.',
    sourceId: 'pricing',
    checkedIso: SQUIRE_FACTS_CHECKED_ISO,
  },
  titanSubscription: {
    status: 'unresolved',
    reason: 'No verified UK GBP monthly subscription and VAT treatment for Titan.',
    sourceId: 'pricing',
    checkedIso: SQUIRE_FACTS_CHECKED_ISO,
  },
  additionalBarberFee: {
    status: 'unresolved',
    reason: 'UK plan rules and any applicable additional-barber charges require confirmation.',
    sourceId: 'pricing',
    checkedIso: SQUIRE_FACTS_CHECKED_ISO,
  },
  onlineDepositProcessing: {
    status: 'unresolved',
    reason: 'Verified UK percentage, fixed-per-transaction charge and VAT treatment for online deposit payments are unavailable.',
    sourceId: 'payments',
    checkedIso: SQUIRE_FACTS_CHECKED_ISO,
  },
  inPersonProcessing: {
    status: 'unresolved',
    reason: 'A complete UK in-person card-processing rate and tax treatment have not been verified.',
    sourceId: 'payments',
    checkedIso: SQUIRE_FACTS_CHECKED_ISO,
  },
  bookingOrPlatformFee: {
    status: 'unresolved',
    reason: 'Whether, when and how UK customer-facing booking/platform fees are charged needs plan-specific confirmation.',
    sourceId: 'pricing',
    checkedIso: SQUIRE_FACTS_CHECKED_ISO,
  },
  acquisitionFee: {
    status: 'unresolved',
    reason: 'No verified statement establishing the complete UK new-client acquisition fee policy; do not assume a zero charge.',
    sourceId: 'pricing',
    checkedIso: SQUIRE_FACTS_CHECKED_ISO,
  },
  brandedLandingPageAddOn: {
    status: 'unresolved',
    reason: 'The public US-dollar landing-page add-on price does not establish its UK GBP price or VAT treatment.',
    sourceId: 'pricing',
    checkedIso: SQUIRE_FACTS_CHECKED_ISO,
  },
} as const satisfies Record<string, SquireUkCommercialFact>;

export type SquireUkCommercialFactKey = keyof typeof SQUIRE_UK_COMMERCIAL_FACTS;

export const SQUIRE_UK_PLAN_SUBSCRIPTION_KEYS = {
  independent: 'independentSubscription',
  pro: 'proSubscription',
  executive: 'executiveSubscription',
  titan: 'titanSubscription',
} as const satisfies Record<SquirePlanId, SquireUkCommercialFactKey>;

export function getSquireSource(id: SquireSourceId): (typeof SQUIRE_OFFICIAL_SOURCES)[number] {
  const entry = SQUIRE_OFFICIAL_SOURCES.find((source) => source.id === id);
  if (!entry) throw new Error('Unknown SQUIRE source: ' + id);
  return entry;
}

export function isVerifiedSquireUkFact(
  fact: SquireUkCommercialFact,
): fact is SquireVerifiedUkCommercialFact {
  return fact.status === 'verified' && fact.currency === 'GBP';
}

/** Fail closed: unresolved SQUIRE UK amounts can never quietly enter the calculator as zero. */
export function requireVerifiedSquireUkFact(
  key: SquireUkCommercialFactKey,
): SquireVerifiedUkCommercialFact {
  const fact: SquireUkCommercialFact = SQUIRE_UK_COMMERCIAL_FACTS[key];
  if (!isVerifiedSquireUkFact(fact)) {
    throw new Error('SQUIRE UK commercial fact "' + key + '" has not been verified; a GBP total cannot be calculated.');
  }
  return fact;
}

export type SquireUkCalculatorReadiness =
  | {
      status: 'ready';
      currency: 'GBP';
      plan: SquirePlanId;
      missingFacts: readonly [];
    }
  | {
      status: 'unresolved-uk-pricing';
      currency: 'GBP';
      plan: SquirePlanId;
      missingFacts: readonly SquireUkCommercialFactKey[];
    };

/**
 * Side-effect-free adapter for a future fourth calculator provider.
 * Check readiness BEFORE building a numerical result. The optional SQUIRE
 * USD marketing prices must never be used in GBP cost-engine arithmetic.
 *
 * Scope matches the calculator's existing subscription + online £5 deposit
 * model; marketplace and add-on totals require their own verified decisions.
 */
export function getSquireUkCalculatorReadiness(plan: SquirePlanId): SquireUkCalculatorReadiness {
  const requiredKeys: readonly SquireUkCommercialFactKey[] = [
    SQUIRE_UK_PLAN_SUBSCRIPTION_KEYS[plan],
    'additionalBarberFee',
    'onlineDepositProcessing',
    'bookingOrPlatformFee',
    'acquisitionFee',
  ];
  const missingFacts = requiredKeys.filter(
    (key) => {
      const fact: SquireUkCommercialFact = SQUIRE_UK_COMMERCIAL_FACTS[key];
      if (!isVerifiedSquireUkFact(fact)) return true;
      if (key === 'onlineDepositProcessing') return fact.percent === undefined || fact.amountGbp === undefined;
      return fact.amountGbp === undefined && fact.percent === undefined;
    },
  );
  return missingFacts.length === 0
    ? { status: 'ready', currency: 'GBP', plan, missingFacts: [] }
    : { status: 'unresolved-uk-pricing', currency: 'GBP', plan, missingFacts };
}
