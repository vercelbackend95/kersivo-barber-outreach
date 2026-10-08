/** Official Nearcut UK facts; checked 8 October 2026. Never assume a quoted subscription price. */
export const NEARCUT_FACTS_CHECKED_ISO = '2026-10-08';
export const NEARCUT_FACTS_CHECKED_DATE = '8 October 2026';
/** All commercial claims must use official Nearcut UK sources and checked date. */
export type NearcutSourceId = 'pricingUk' | 'onlinePayments' | 'memberships';
export type NearcutSource = {
  id: NearcutSourceId;
  label: string;
  url: string;
  supports: string;
};

export const NEARCUT_SOURCES: readonly NearcutSource[] = [
  {
    id: 'pricingUk',
    label: 'Nearcut UK pricing',
    url: 'https://nearcut.com/en-GB/pricing',
    supports: 'Free for You, Subscription quotes, example customer booking charge, VAT and business boosters',
  },
  {
    id: 'onlinePayments',
    label: 'Nearcut Help Centre: online payments',
    url: 'https://help.nearcut.com/en/articles/5672099-about-online-payments-and-how-to-set-it-up',
    supports: 'standard processing rates and 30-day payment-volume thresholds; plan applicability must be checked',
  },
  {
    id: 'memberships',
    label: 'Nearcut Help Centre: memberships',
    url: 'https://help.nearcut.com/en/articles/5107569-how-to-create-a-membership-scheme',
    supports: 'memberships as an additional Nearcut capability',
  },
];

export function getNearcutSource(id: NearcutSourceId): NearcutSource {
  const source = NEARCUT_SOURCES.find(entry => entry.id === id);
  if (!source) throw new Error(`Unknown Nearcut source: ${id}`);
  return source;
}

export type NearcutPlanId = 'free-for-you' | 'subscription';
export type NearcutVatBasis = 'exclusive' | 'inclusive' | 'not-applicable' | 'unverified';
export type NearcutPayer = 'barbershop' | 'client' | 'none' | 'unverified';

type NearcutFactBase = {
  plan: NearcutPlanId | 'both';
  per: string;
  sourceId: NearcutSourceId;
  checkedIso: string;
  note?: string;
};
export type NearcutVerifiedCommercialFact = NearcutFactBase & {
  status: 'verified';
  amountGbp?: number;
  percent?: number;
  value?: number | boolean;
  vat: NearcutVatBasis;
  payer: NearcutPayer;
};
export type NearcutIllustrativeCommercialFact = NearcutFactBase & {
  status: 'illustrative';
  amountGbp: number;
  exampleServicePriceGbp: number;
  vat: NearcutVatBasis;
  payer: NearcutPayer;
  note: string;
};
export type NearcutUnresolvedCommercialFact = {
  status: 'unresolved';
  plan: NearcutPlanId | 'both';
  note: string;
  sourceId: NearcutSourceId;
  checkedIso: string;
};
export type NearcutCommercialFact =
  | NearcutVerifiedCommercialFact
  | NearcutIllustrativeCommercialFact
  | NearcutUnresolvedCommercialFact;

const CHECKED = NEARCUT_FACTS_CHECKED_ISO;

/**
 * Calculator-ready Nearcut UK commercial facts.
 *
 * IMPORTANT: The £1.50 charge is one example for a £20 haircut, NOT a universal
 * customer booking fee. Subscription pricing is shop-specific and unpublished.
 * Nearcut's Free for You page advertises zero fees for optional online payments,
 * whereas the Help Centre quotes generic card-processing rates. Never apply
 * the Help Centre rates to Free for You without confirmation of the plan terms.
 *
 * These facts DO NOT mean Nearcut is already wired into the calculator engine.
 */
export const NEARCUT_UK_COMMERCIAL_FACTS = {
  freeForYouMonthlySubscription: {
    status: 'verified', plan: 'free-for-you', amountGbp: 0,
    vat: 'not-applicable', payer: 'barbershop', per: 'month',
    sourceId: 'pricingUk', checkedIso: CHECKED,
  },
  freeForYouCustomerBookingFeeExample: {
    status: 'illustrative', plan: 'free-for-you',
    amountGbp: 1.5, exampleServicePriceGbp: 20,
    vat: 'unverified', payer: 'client',
    per: 'sample online booking at £20 service price',
    sourceId: 'pricingUk', checkedIso: CHECKED,
    note: 'Illustration on Nearcut UK pricing page, not a published universal per-booking rate.',
  },
  freeForYouOnlinePayments: {
    status: 'verified', plan: 'free-for-you', percent: 0, amountGbp: 0,
    vat: 'not-applicable', payer: 'barbershop',
    per: 'optional online payment; zero transaction fees advertised on Free for You pricing page',
    sourceId: 'pricingUk', checkedIso: CHECKED,
    note: 'Different standard processing rates appear in the Help Centre. Confirm which apply before estimating.',
  },
  subscriptionMonthlyPrice: {
    status: 'unresolved', plan: 'subscription', sourceId: 'pricingUk', checkedIso: CHECKED,
    note: 'Subscription monthly cost depends on location and barber count. Nearcut asks the shop to request a quote; VAT is extra.',
  },
  subscriptionCustomerBookingFee: {
    status: 'verified', plan: 'subscription', amountGbp: 0,
    vat: 'not-applicable', payer: 'client', per: 'online booking',
    sourceId: 'pricingUk', checkedIso: CHECKED,
  },
  subscriptionFreeTrialDays: {
    status: 'verified', plan: 'subscription', value: 30,
    vat: 'not-applicable', payer: 'none', per: 'initial free trial in days',
    sourceId: 'pricingUk', checkedIso: CHECKED,
  },
  setupFee: {
    status: 'verified', plan: 'both', amountGbp: 0,
    vat: 'not-applicable', payer: 'barbershop', per: 'website and booking-system setup',
    sourceId: 'pricingUk', checkedIso: CHECKED,
  },
  servicePriceCommission: {
    status: 'verified', plan: 'both', percent: 0,
    vat: 'not-applicable', payer: 'barbershop', per: 'service price',
    sourceId: 'pricingUk', checkedIso: CHECKED,
  },
  standardOnlinePaymentProcessing: {
    status: 'verified', plan: 'both', percent: 2.9, amountGbp: 0.2,
    vat: 'unverified', payer: 'barbershop', per: 'standard online card payment before qualifying volume thresholds',
    sourceId: 'onlinePayments', checkedIso: CHECKED,
    note: 'Generic Help Centre rate. Not necessarily chargeable on Free for You; confirm applicable plan/rates.',
  },
  subscriptionBoosterPrice: {
    status: 'unresolved', plan: 'subscription', sourceId: 'pricingUk', checkedIso: CHECKED,
    note: 'Business Booster amounts shown in varying currencies on Nearcut pages; no verified UK GBP plan-specific fee.',
  },
  standardProcessingAboveGbp30000: {
    status: 'unresolved', plan: 'both', sourceId: 'onlinePayments', checkedIso: CHECKED,
    note: 'Nearcut asks shops with £30,000+ previous-30-day online volume to request tailored pricing.',
  },
} as const satisfies Record<string, NearcutCommercialFact>;

export type NearcutCommercialFactKey = keyof typeof NEARCUT_UK_COMMERCIAL_FACTS;

export function requireVerifiedNearcutFact(key: NearcutCommercialFactKey): NearcutVerifiedCommercialFact {
  const fact: NearcutCommercialFact = NEARCUT_UK_COMMERCIAL_FACTS[key];
  if (fact.status !== 'verified') {
    throw new Error(`Nearcut fact "${key}" is ${fact.status} and must not be used as a guaranteed price.`);
  }
  return fact;
}

export function requireIllustrativeNearcutFact(key: NearcutCommercialFactKey): NearcutIllustrativeCommercialFact {
  const fact: NearcutCommercialFact = NEARCUT_UK_COMMERCIAL_FACTS[key];
  if (fact.status !== 'illustrative') {
    throw new Error(`Nearcut fact "${key}" is not a labelled illustration.`);
  }
  return fact;
}

export type NearcutOnlinePaymentTier = {
  minPrevious30DayVolumeGbp: number;
  percent: number;
  fixedGbp: number;
  sourceId: NearcutSourceId;
  checkedIso: string;
};

/** Generic Help Centre thresholds; do not assume applicability to the Free for You plan. */
export const NEARCUT_STANDARD_ONLINE_PAYMENT_TIERS: readonly NearcutOnlinePaymentTier[] = [
  { minPrevious30DayVolumeGbp: 0, percent: 2.9, fixedGbp: 0.2, sourceId: 'onlinePayments', checkedIso: CHECKED },
  { minPrevious30DayVolumeGbp: 2500, percent: 2.4, fixedGbp: 0.2, sourceId: 'onlinePayments', checkedIso: CHECKED },
  { minPrevious30DayVolumeGbp: 5000, percent: 2, fixedGbp: 0.2, sourceId: 'onlinePayments', checkedIso: CHECKED },
  { minPrevious30DayVolumeGbp: 10000, percent: 1.8, fixedGbp: 0.2, sourceId: 'onlinePayments', checkedIso: CHECKED },
];

/** Use only when the shop confirms the generic Help Centre card-processing schedule applies. */
export function estimateNearcutStandardPaymentFeeGbp(
  amountGbp: number,
  previous30DayOnlineVolumeGbp: number,
): number | null {
  if (!Number.isFinite(amountGbp) || amountGbp < 0) throw new Error('amountGbp must be non-negative');
  if (!Number.isFinite(previous30DayOnlineVolumeGbp) || previous30DayOnlineVolumeGbp < 0) {
    throw new Error('previous30DayOnlineVolumeGbp must be non-negative');
  }
  if (previous30DayOnlineVolumeGbp >= 30000) return null; // quote required
  const tier = [...NEARCUT_STANDARD_ONLINE_PAYMENT_TIERS]
    .reverse()
    .find(t => previous30DayOnlineVolumeGbp >= t.minPrevious30DayVolumeGbp);
  if (!tier) throw new Error('No Nearcut payment processing tier found');
  return Math.round((amountGbp * tier.percent / 100 + tier.fixedGbp) * 100) / 100;
}

export const NEARCUT_TRADEMARK_DISCLAIMER = 'Nearcut is a trademark of its respective owner. KERSIVO is not affiliated with, endorsed by or sponsored by Nearcut.';
export const NEARCUT_COMPARISON_FOOTNOTE = 'Nearcut information is based on its official UK pricing page and Help Centre, checked 8 October 2026. Pricing and features can change.';
export const NEARCUT_COMPARE_SECTIONS = [
{id:'bookings',title:'Bookings',subtitle:'Scheduling, confirmations and booking journeys.',nearcutLead:'A barber-focused online booking service with a personalised booking site.',nearcutPoints:['Online booking, availability and staff schedules','Personalised booking website and social Book Now integration','Email confirmations and appointment reminders','Unlimited SMS reminders for online bookings on Free for You','Waitlist cancellation features'],kersivoLead:'One booking engine shared across Starter and Full.',kersivoPoints:['Up to four bookable barbers on Starter; expanded team on Full','Hosted booking page on Starter; full branded website on Full','Email reminders on Starter; SMS reminders added with Full','Manual booking and staff availability management']},
{id:'payments',title:'Payments & Deposits',subtitle:'Compare payment models and client charges.',nearcutLead:'Free for You puts a booking charge on online customers; Subscription removes that client booking charge.',nearcutPoints:['Free for You: £0/month to the shop, with a separate customer booking charge','Nearcut advertises £1.50 as an illustrative booking charge on its pricing page','Subscription: quote-based monthly price, with no customer booking charge','Optional online deposits and payments; Free for You advertises zero transaction fees, while other Nearcut payment terms may differ'],kersivoLead:'No KERSIVO booking charge or percentage commission.',kersivoPoints:['Starter: £0/month; customer pays £5 deposit or full service price online','Both plans: 0% KERSIVO commission; standard Stripe processing fees apply','Full: £39/month per location with selectable booking payment modes','Full can offer Pay at shop, deposits or full payment']},
{id:'brand',title:'Brand & Domain',subtitle:'How each solution presents your shop.',nearcutLead:'Nearcut already supports customised websites for barbershops.',nearcutPoints:['Personalised booking website included in its plans','Subscription advertises a custom website or integration with an existing website','Facebook and Instagram Book Now integration','Nearcut is not a marketplace selling competitor placements'],kersivoLead:'A staged path from hosted bookings to an own-domain experience.',kersivoPoints:['Starter uses a KERSIVO-hosted booking page','Full includes a branded website on your own standard domain','Full includes a retail pickup experience on the site','Direct bookings without a consumer marketplace']},
{id:'retail',title:'Retail & Growth Tools',subtitle:'Compare optional growth features and retail.',nearcutLead:'Nearcut offers Business Boosters on subscription.',nearcutPoints:['Optional product sales and stock-management booster','Other boosters include memberships, loyalty and gift vouchers','Individual booster prices and availability should be checked with Nearcut','Nearcut has a broader set of add-on tools than KERSIVO in some areas'],kersivoLead:'Retail pickup included in Full KERSIVO.',kersivoPoints:['Sell grooming products online for in-shop collection on Full','Product and order management on Full','No shipping or full inventory management is claimed','0% KERSIVO retail commission; Stripe processing fees apply']},
{id:'clients',title:'Clients',subtitle:'Customer records and repeat visits.',nearcutLead:'Customer records and optional loyalty/membership features.',nearcutPoints:['Online customer booking accounts','Customer history and preferences in booking workflows','Optional memberships and loyalty through Business Boosters'],kersivoLead:'Core contacts on Starter and advanced client management on Full.',kersivoPoints:['Starter Clients Core and rolling 90-day booking history','Full Advanced Clients / CRM','Full retained history, notes and reporting where supported']},
{id:'reports',title:'Reports & Shop Operations',subtitle:'Business visibility beyond the calendar.',nearcutLead:'Business reporting and additional features vary by plan and boosters.',nearcutPoints:['Scheduling and operational booking workflows','Optional growth and retail capabilities through Business Boosters','Request plan-specific reporting details directly from Nearcut'],kersivoLead:'One dashboard with reports available on Full.',kersivoPoints:['Bookings, Team and Services on Starter','Reports and Retail Sales modules on Full','Full subscription is a flat £39/month per location']},
] as const;

export type NearcutCompareSectionId = (typeof NEARCUT_COMPARE_SECTIONS)[number]['id'];
