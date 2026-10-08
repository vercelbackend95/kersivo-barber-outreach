/**
 * Official Treatwell UK source of truth, checked 8 October 2026.
 *
 * Shared by /treatwell-alternative and future cost-calculator integration.
 * Important: "Start for free" is NOT a guaranteed perpetual £0 monthly plan.
 * The published 35% commission is NOT levied on every appointment; eligibility
 * is contract-/source-/client-history-dependent. 2026 terms include a 365-day
 * successful-visit test and other conditions.
 */
export const TREATWELL_FACTS_CHECKED_ISO = '2026-10-08';
export const TREATWELL_FACTS_CHECKED_DATE = '8 October 2026';
/** Sentinel: monthly quote VAT has not been confirmed. */
export const TREATWELL_QUOTE_VAT_UNKNOWN = 99;

export type TreatwellSourceId = 'pricingUk' | 'partnerTerms' | 'paymentSolutions' | 'salonSoftware';
export type TreatwellSource = {
  id: TreatwellSourceId;
  label: string;
  url: string;
  supports: string;
};

export const TREATWELL_SOURCES: readonly TreatwellSource[] = [
  {
    id: 'pricingUk',
    label: 'Treatwell UK partner pricing',
    url: 'https://www.treatwell.co.uk/partners/pricing/',
    supports: '35% eligible new marketplace booking commission, 0% repeat/direct commission, 2.5% prepayment processing, Freelancer and Advanced plan information',
  },
  {
    id: 'partnerTerms',
    label: 'Treatwell Partner Terms of Business (September 2026)',
    url: 'https://www.treatwell.co.uk/info/supplier-terms-and-conditions/',
    supports: 'new versus repeat client conditions (including the 365-day rule), contract-specific fees, cancellation and other booking software restrictions',
  },
  {
    id: 'salonSoftware',
    label: 'Treatwell Connect salon software',
    url: 'https://www.treatwell.co.uk/partners/solutions/salon-software/',
    supports: 'Treatwell Connect booking, client, team, reporting and product sales features',
  },
  {
    id: 'paymentSolutions',
    label: 'Treatwell Pay UK payment rates',
    url: 'https://www.treatwell.co.uk/partners/solutions/payments/',
    supports: 'online 2.5% excl. VAT, Tap to Pay/card machine 1.1% + 20p excl. VAT, £199 one-off terminal cost',
  },
];

export function getTreatwellSource(id: TreatwellSourceId): TreatwellSource {
  const source = TREATWELL_SOURCES.find((item) => item.id === id);
  if (!source) throw new Error('Unknown Treatwell source: ' + id);
  return source;
}

export type TreatwellPlanId = 'freelancer' | 'advanced' | 'both';
export type TreatwellFact = (
  | {
      status: 'verified';
      percent?: number;
      amountGbp?: number;
      fixedGbp?: number;
      value?: number | boolean | string;
      vat: 'exclusive' | 'not-applicable';
      payer: 'barbershop' | 'client' | 'none';
      per: string;
    }
  | {
      status: 'unresolved';
      note: string;
    }
) & {
  plan: TreatwellPlanId;
  sourceId: TreatwellSourceId;
  checkedIso: string;
  note?: string;
};

const CHECKED = TREATWELL_FACTS_CHECKED_ISO;

/**
 * Published rates, NOT the user's signed commercial agreement.
 * A quoted monthly subscription is unresolved even when an offer says
 * "Start for free"; do not infer that every salon has a £0 monthly plan.
 */
export const TREATWELL_UK_COMMERCIAL_FACTS = {
  newMarketplaceClientCommission: {
    status: 'verified', plan: 'both', percent: 35,
    vat: 'exclusive', payer: 'barbershop',
    per: 'qualifying new-client booking introduced via marketplace',
    sourceId: 'pricingUk', checkedIso: CHECKED,
    note: 'Subject to location and signed partner agreement; Treatwell defines new/repeat status in its terms, including a 365-day successful-visit rule.',
  },
  repeatBookingMarketplaceCommission: {
    status: 'verified', plan: 'both', percent: 0,
    vat: 'not-applicable', payer: 'barbershop',
    per: 'qualifying repeat booking',
    sourceId: 'pricingUk', checkedIso: CHECKED,
  },
  directBookingMarketplaceCommission: {
    status: 'verified', plan: 'both', percent: 0,
    vat: 'not-applicable', payer: 'barbershop',
    per: 'direct booking, including own website/social booking buttons',
    sourceId: 'pricingUk', checkedIso: CHECKED,
    note: 'Online prepayment processing may apply separately.',
  },
  onlinePrepaymentProcessing: {
    status: 'verified', plan: 'both', percent: 2.5,
    vat: 'exclusive', payer: 'barbershop',
    per: 'online prepaid transaction',
    sourceId: 'pricingUk', checkedIso: CHECKED,
  },
  tapToPayProcessing: {
    status: 'verified', plan: 'both', percent: 1.1, fixedGbp: 0.20,
    vat: 'exclusive', payer: 'barbershop',
    per: 'Tap to Pay transaction; not online prepayment',
    sourceId: 'paymentSolutions', checkedIso: CHECKED,
  },
  cardMachineProcessing: {
    status: 'verified', plan: 'both', percent: 1.1, fixedGbp: 0.20,
    vat: 'exclusive', payer: 'barbershop',
    per: 'physical card machine transaction; not online prepayment',
    sourceId: 'paymentSolutions', checkedIso: CHECKED,
  },
  cardMachineOneOff: {
    status: 'verified', plan: 'both', amountGbp: 199,
    vat: 'exclusive', payer: 'barbershop',
    per: 'one-off card terminal purchase',
    sourceId: 'paymentSolutions', checkedIso: CHECKED,
  },
  softwareMonthlySubscription: {
    status: 'unresolved', plan: 'both',
    note: 'Both UK plans invite partners to “Start for free”, but no universal ongoing monthly amount is published. The pricing FAQ refers to a monthly fee. Obtain a venue-specific quote and VAT treatment; do not model £0 by default.',
    sourceId: 'pricingUk', checkedIso: CHECKED,
  },
  newClientEligibility: {
    status: 'unresolved', plan: 'both',
    note: 'Eligibility must be determined from booking source and client history under the signed agreement; September 2026 terms include an inactivity/365-day successful-appointment test and cancellation conditions. Cannot be inferred from first-ever flag alone.',
    sourceId: 'partnerTerms', checkedIso: CHECKED,
  },
} as const satisfies Record<string, TreatwellFact>;

export type TreatwellCommercialFactKey = keyof typeof TREATWELL_UK_COMMERCIAL_FACTS;
export type VerifiedTreatwellFact = Extract<TreatwellFact, { status: 'verified' }>;

export function requireVerifiedTreatwellFact(key: TreatwellCommercialFactKey): VerifiedTreatwellFact {
  const fact: TreatwellFact = TREATWELL_UK_COMMERCIAL_FACTS[key];
  if (fact.status !== 'verified') {
    throw new Error('Treatwell fact "' + key + '" is unresolved: cannot be used as a guaranteed rate.');
  }
  return fact;
}

/**
 * Calculator-safe, deliberately conservative variable-fee estimate.
 *
 * Explicitly supply eligibility and prepayment; 'unknown' produces null,
 * not a silently invented zero. VAT is optional and NEVER defaulted. The
 * returned subtotal EXCLUDES monthly software fees, which require a quote.
 * No location-specific / contract-specific overrides are assumed.
 */
export type TreatwellBookingEligibility = 'eligible-new-marketplace' | 'repeat-or-direct' | 'unknown';
export type TreatwellPrepaymentStatus = 'yes' | 'no' | 'unknown';
export type TreatwellPublishedFeeEstimate = {
  commissionExVatGbp: number | null;
  processingExVatGbp: number | null;
  totalExVatGbp: number | null;
  totalInclVatGbp: number | null;
  monthlySoftwareCostKnown: false;
  isPublishedRateIllustration: true;
};
const money = (amount: number): number => Math.round((amount + Number.EPSILON) * 100) / 100;

export function estimateTreatwellPublishedBookingFees(input: {
  servicePriceGbp: number;
  eligibility: TreatwellBookingEligibility;
  onlinePrepaid: TreatwellPrepaymentStatus;
  /** Explicit VAT assumption only (e.g. 20); omit for unknown VAT-inclusive totals. */
  vatPercent?: number;
}): TreatwellPublishedFeeEstimate {
  const { servicePriceGbp, eligibility, onlinePrepaid, vatPercent } = input;
  if (!Number.isFinite(servicePriceGbp) || servicePriceGbp < 0) {
    throw new Error('servicePriceGbp must be non-negative and finite');
  }
  if (!['eligible-new-marketplace', 'repeat-or-direct', 'unknown'].includes(eligibility)) {
    throw new Error('eligibility must be selected explicitly');
  }
  if (!['yes', 'no', 'unknown'].includes(onlinePrepaid)) {
    throw new Error('onlinePrepaid must be selected explicitly');
  }
  if (vatPercent !== undefined && (!Number.isFinite(vatPercent) || vatPercent < 0 || vatPercent > 100)) {
    throw new Error('vatPercent must be a percentage between 0 and 100');
  }

  const commissionRate = requireVerifiedTreatwellFact('newMarketplaceClientCommission').percent!;
  const prepaymentRate = requireVerifiedTreatwellFact('onlinePrepaymentProcessing').percent!;
  const commissionExVatGbp = eligibility === 'unknown' ? null :
    (eligibility === 'eligible-new-marketplace' ? money(servicePriceGbp * commissionRate / 100) : 0);
  const processingExVatGbp = onlinePrepaid === 'unknown' ? null :
    (onlinePrepaid === 'yes' ? money(servicePriceGbp * prepaymentRate / 100) : 0);
  const totalExVatGbp = commissionExVatGbp === null || processingExVatGbp === null
    ? null : money(commissionExVatGbp + processingExVatGbp);

  return {
    commissionExVatGbp,
    processingExVatGbp,
    totalExVatGbp,
    totalInclVatGbp: totalExVatGbp === null || vatPercent === undefined
      ? null : money(totalExVatGbp * (1 + vatPercent / 100)),
    monthlySoftwareCostKnown: false,
    isPublishedRateIllustration: true,
  };
}

export const TREATWELL_TRADEMARK_DISCLAIMER =
  'Treatwell is a trademark of its respective owner. KERSIVO is not affiliated with, endorsed by or sponsored by Treatwell.';
export const TREATWELL_COMPARISON_FOOTNOTE =
  'Treatwell pricing and September 2026 partner terms checked 8 October 2026. The published 35% rate is subject to eligible marketplace bookings, venue location and signed terms. Fees are subject to VAT.';
export const TREATWELL_COMPARE_SECTIONS = [
{id:'bookings',title:'Bookings',subtitle:'Scheduling, staff diaries and booking journeys.',treatwellLead:'Online bookings through marketplace listings and direct channels.',treatwellPoints:['Treatwell marketplace discovery, website and social booking integrations','Appointment calendar, availability, reminders and team management','Suitable for hair and beauty businesses including men’s grooming'],kersivoLead:'Direct-booking system designed for independent UK barbershops.',kersivoPoints:['Starter: hosted booking page for up to four active bookable barbers','Full: branded website on a standard domain and larger barber teams','Email reminders on Starter; SMS reminders on Full']},
{id:'payments',title:'Payments & Deposits',subtitle:'Marketplace commission versus online payment processing.',treatwellLead:'Different charges apply to qualifying marketplace clients and online prepayments.',treatwellPoints:['35% + VAT published commission on eligible new-client marketplace bookings; client eligibility follows Treatwell terms, including the 365-day rule','0% marketplace commission for qualifying repeat customers and direct website/social bookings','Published online prepayment processing fee of 2.5% + VAT, separate from commission; exact terms depend on contract'],kersivoLead:'No KERSIVO booking commission; card processing is separate.',kersivoPoints:['Starter: public bookings require a £5 deposit towards service or pay in full via Stripe','Both plans: 0% KERSIVO booking commission; Stripe processing fees apply','Full: Pay at shop, £5 deposit or full online payment modes']},
{id:'brand',title:'Brand & Domain',subtitle:'Marketplace visibility versus a branded direct-booking site.',treatwellLead:'Marketplace discovery alongside direct booking options.',treatwellPoints:['Treatwell listing gives customers another way to discover your business','Booking widgets and connections with existing websites/social profiles','Marketplace listing is not the same offering as a bespoke branded shop site'],kersivoLead:'One direct path from your shop’s links to your booking journey.',kersivoPoints:['Starter: KERSIVO-hosted booking page','Full: branded website plus one standard domain per location','Use your own public Google, Instagram, website and QR booking links']},
{id:'retail',title:'Retail & Growth Tools',subtitle:'Compare salon POS tools and retail pickup.',treatwellLead:'Broader salon operating features on eligible plans.',treatwellPoints:['POS and product sales capabilities','Marketing, reviews and retention tools','Feature availability depends on plan and contract'],kersivoLead:'Focused retail pickup with Full KERSIVO.',kersivoPoints:['Full: online product orders for in-shop collection','Product/order tools rather than a full POS or stock-management replacement','No KERSIVO retail commission; Stripe payment fees still apply']},
{id:'clients',title:'Clients',subtitle:'Records and repeat appointments.',treatwellLead:'Client records, repeat booking and review tools.',treatwellPoints:['Client database and booking history','Reviews and repeat-visit marketing features','Repeat-booking commission is advertised as 0% for bookings that qualify as repeat under current terms'],kersivoLead:'Starter core records and richer Full client tools.',kersivoPoints:['Starter: Clients Core and rolling 90-day booking history','Full: Advanced Clients / CRM and complete booking history','Direct customer booking experience focused on your brand']},
{id:'reports',title:'Reports & Shop Operations',subtitle:'Understand your operational toolkit.',treatwellLead:'Salon software with reporting and POS-related capabilities.',treatwellPoints:['Calendar, team scheduling and business reporting','Marketing and payment features depending on plan','Useful if you want a wider beauty/salon ecosystem and marketplace discovery'],kersivoLead:'Clear barber-focused day-to-day tools.',kersivoPoints:['Starter: booking, team and service management','Full: reports, advanced clients, retail pickup and SMS reminders','Full costs £39/month per shop location, with no per-barber subscription charge subject to fair use']},
] as const;
export type TreatwellCompareSectionId = (typeof TREATWELL_COMPARE_SECTIONS)[number]['id'];
