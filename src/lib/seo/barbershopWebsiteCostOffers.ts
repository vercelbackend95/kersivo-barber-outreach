/**
 * KERSIVO /barbershop-website-cost-uk — supplier and package research source of truth.
 *
 * STATUS: DRAFT — owner review required before using any record in public copy.
 * Checked: 20 October 2026. Primary sources are the suppliers' own pages.
 *
 * Scope: one physical UK barbershop location with four barbers. Compare what a
 * buyer needs to procure (website + bookings + operating tools), not an arbitrarily
 * cheap Starter tier or the highest-priced tier available.
 *
 * NOT YET WIRED TO WebsiteCostServiceComparison or WebsiteCostScenarios.
 * Section 02 and approved Section 03 remain untouched. Do not publish
 * comparison/price claims from this research before owner approval and QA.
 *
 * “not-confirmed” means no sufficient public evidence, NOT "the supplier
 * does not have this feature". A quoted price without an applicable module,
 * domain, VAT or hosting fee is NOT a complete comparable cost.
 */
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

export const WEBSITE_COST_RESEARCH_CHECKED_AT = '2026-10-20';
export const WEBSITE_COST_RESEARCH_PUBLICATION_STATE = 'draft-owner-approval-required' as const;

export const WEBSITE_COST_RESEARCH_BUYER = {
  country: 'GB',
  locationCount: 1,
  bookableBarbers: 4,
  needs: [
    'branded public website with useful separate content areas',
    'services, gallery and team presentation',
    'real-time individual barber bookings and deposits',
    'automated email and SMS reminders',
    'shop diary and client management',
    'booking or business reporting',
    'retail pickup capability where confirmed',
  ],
} as const;

export type CostFeatureStatus =
  | 'confirmed-in-plan'
  | 'confirmed-external'
  | 'additional-quote-needed'
  | 'not-in-selected-plan'
  | 'not-publicly-confirmed';

export type CostFeatureKey =
  | 'multiPageWebsite'
  | 'teamPresentation'
  | 'gallery'
  | 'onlineBookings'
  | 'staffCalendars'
  | 'deposits'
  | 'emailReminders'
  | 'smsReminders'
  | 'clientManagement'
  | 'businessReports'
  | 'retailPickup'
  | 'hosting'
  | 'customDomain';

export type CostPriceVat = 'ex-VAT' | 'VAT-included' | 'no-VAT-currently-added' | 'not-confirmed';
export type OfferDecision = 'primary-candidate' | 'reserve' | 'exclude-until-quoted';
export type OfferKind = 'agency-website' | 'barber-website-service' | 'integrated-platform' | 'beauty-platform';
export type CostFeatureCoverage = Record<CostFeatureKey, CostFeatureStatus>;

export type WebsiteCostResearchedOffer = {
  id: string;
  provider: string;
  selectedPackage: string;
  kind: OfferKind;
  decision: OfferDecision;
  rationale: string;
  pricing: {
    /** Null = not publicly established; never render as £0. */
    setupGbp: number | null;
    /** Null = not a fixed published recurring amount for the compared full scope. */
    recurringGbpPerMonth: number | null;
    vat: CostPriceVat;
    minimumTermMonths: number | null;
    pricingNotes: readonly string[];
    /** Other real published charges, not silently folded into base price. */
    possibleAdditionalCosts: readonly string[];
  };
  scope: string;
  limits: readonly string[];
  features: CostFeatureCoverage;
  sources: readonly string[];
  /** Public copy must not suggest full feature or fee equivalence. */
  fullKersivoScopeEquivalenceConfirmed: false;
};

export const WEBSITE_COST_OFFERS = [
  {
    id: 'full-kersivo',
    provider: 'KERSIVO',
    selectedPackage: 'Full KERSIVO',
    kind: 'integrated-platform',
    decision: 'primary-candidate',
    rationale: 'Reference platform for the page; customer buys one branded website and shop operating platform.',
    pricing: {
      setupGbp: 0,
      recurringGbpPerMonth: SAAS_MONTHLY_GBP,
      vat: 'no-VAT-currently-added',
      minimumTermMonths: null,
      pricingNotes: [
        '£39/month per physical shop location; billed from purchase rather than website launch.',
        'No separate standard setup fee; not a promise that £39 stays unchanged for 36 months.',
      ],
      possibleAdditionalCosts: [
        'Stripe card-processing charges',
        'premium or above-standard domain where separately agreed',
        'out-of-scope work separately agreed',
      ],
    },
    scope: 'Prepared branded website, own standard domain arrangement, booking, deposits, diary, CRM, email confirmations/reminders, SMS reminders, reporting and retail pickup.',
    limits: [
      'SMS reminders subject to a monthly allowance; not unlimited.',
      'Reasonable fair use; single location; source code and platform hosting are not transferred on cancellation.',
      'Commercial Offer is the intended source of truth; confirm live feature delivery before publishing.',
    ],
    features: {
      multiPageWebsite: 'confirmed-in-plan',
      teamPresentation: 'confirmed-in-plan',
      gallery: 'confirmed-in-plan',
      onlineBookings: 'confirmed-in-plan',
      staffCalendars: 'confirmed-in-plan',
      deposits: 'confirmed-in-plan',
      emailReminders: 'confirmed-in-plan',
      smsReminders: 'confirmed-in-plan',
      clientManagement: 'confirmed-in-plan',
      businessReports: 'confirmed-in-plan',
      retailPickup: 'confirmed-in-plan',
      hosting: 'confirmed-in-plan',
      customDomain: 'confirmed-in-plan',
    },
    sources: ['/pricing', 'KERSIVO Commercial Offer v1.0.pdf'],
    fullKersivoScopeEquivalenceConfirmed: false,
  },
  {
    id: 'jones-digital-pro',
    provider: 'Jones Digital',
    selectedPackage: 'Pro website',
    kind: 'agency-website',
    decision: 'primary-candidate',
    rationale: 'Pro has up to ten pages, making it closer to a full barbershop website than the £199 one-page Starter. Booking software remains an additional procurement consideration.',
    pricing: {
      setupGbp: 999,
      recurringGbpPerMonth: null,
      vat: 'not-confirmed',
      minimumTermMonths: null,
      pricingNotes: [
        'Pro £999 one-off for up to 10 pages.',
        'Supplier Hosted £29/month, Care £49/month or Growth £129/month are separately published; 30 days post-launch care included.',
        'Custom from £1,999 is separately scoped and NOT a complete booking/e-commerce quote.',
      ],
      possibleAdditionalCosts: [
        'ongoing hosting after initial included period',
        'Booksy or other external booking service if chosen',
        'website integration work subject to supplier quote',
        'domain and optional CMS / self-manage area where applicable',
      ],
    },
    scope: 'Up to ten-page web design project, review integration and SEO foundations; separate operating platform not priced in Pro.',
    limits: [
      'The Pro tier is not an all-in-one booking, CRM and retail system.',
      'A Custom project starts from £1,999 but the actual integrated build price must be quoted.',
      'Ownership of the finished website and domain is explicitly advertised; different from a SaaS platform licence.',
    ],
    features: {
      multiPageWebsite: 'confirmed-in-plan',
      teamPresentation: 'not-publicly-confirmed',
      gallery: 'confirmed-in-plan',
      onlineBookings: 'additional-quote-needed',
      staffCalendars: 'confirmed-external',
      deposits: 'confirmed-external',
      emailReminders: 'confirmed-external',
      smsReminders: 'confirmed-external',
      clientManagement: 'confirmed-external',
      businessReports: 'confirmed-external',
      retailPickup: 'additional-quote-needed',
      hosting: 'confirmed-external',
      customDomain: 'confirmed-in-plan',
    },
    sources: [
      'https://jonesdigital.co.uk/for/salons/',
      'https://jonesdigital.co.uk/',
    ],
    fullKersivoScopeEquivalenceConfirmed: false,
  },
  {
    id: 'barberflow-pro',
    provider: 'BarberFlow',
    selectedPackage: 'Pro website',
    kind: 'barber-website-service',
    decision: 'primary-candidate',
    rationale: 'Select the more capable published Pro package, rather than the Starter currently shown in Section 02.',
    pricing: {
      setupGbp: 249,
      recurringGbpPerMonth: 59,
      vat: 'not-confirmed',
      minimumTermMonths: null,
      pricingNotes: [
        'Published Pro: £249 setup + £59/month.',
        'Launch case-study discounts and minimum term apply only in qualifying promotional cases; do not apply generally.',
      ],
      possibleAdditionalCosts: [
        'external Booksy/Fresha/Nearcut subscription if used',
        'VAT and domain registration are not confirmed',
        'separate booking/retail capabilities not provided by the website package itself',
      ],
    },
    scope: 'Barbershop website with gallery, prices, booking-link setup, hosting and an owner-editable content backend.',
    limits: [
      'Owner-editable website backend is not evidence of appointment CRM or business reporting.',
      'A booking link is not equivalent to integrated bookings within the provider website.',
      'No confirmed included retail pickup store.',
    ],
    features: {
      multiPageWebsite: 'not-publicly-confirmed',
      teamPresentation: 'not-publicly-confirmed',
      gallery: 'confirmed-in-plan',
      onlineBookings: 'confirmed-external',
      staffCalendars: 'confirmed-external',
      deposits: 'not-publicly-confirmed',
      emailReminders: 'not-publicly-confirmed',
      smsReminders: 'not-publicly-confirmed',
      clientManagement: 'not-publicly-confirmed',
      businessReports: 'not-publicly-confirmed',
      retailPickup: 'not-publicly-confirmed',
      hosting: 'confirmed-in-plan',
      customDomain: 'not-publicly-confirmed',
    },
    sources: ['https://barberflow.co.uk/'],
    fullKersivoScopeEquivalenceConfirmed: false,
  },
  {
    id: 'uxhm-salon-growth',
    provider: 'UXHM',
    selectedPackage: 'Salon Growth website',
    kind: 'agency-website',
    decision: 'primary-candidate',
    rationale: 'Clear multi-page salon design with team page; realistic starting point for buying a separate Booksy subscription.',
    pricing: {
      setupGbp: 499,
      recurringGbpPerMonth: null,
      vat: 'not-confirmed',
      minimumTermMonths: null,
      pricingNotes: [
        'Salon Growth £499 one-off, includes up to eight pages and stylist team bios.',
        'Optional Essential Care £20/month for hosting, weekly backups, updates and 30 minutes of changes; first month free.',
        'The price of an external booking platform is not included.',
      ],
      possibleAdditionalCosts: [
        'hosting / care (supplier lists £20/month Essential Care)',
        'Booksy or other external booking subscription',
        'domain registration or renewal not confirmed',
        'VAT not confirmed',
        'retail / e-commerce beyond quoted website scope',
      ],
    },
    scope: 'Up to eight-page salon website including gallery, services, about and team; externally linked or integrated third-party booking link.',
    limits: [
      'Supplier serves the wider salon / beauty market, not exclusively barbershops.',
      'A connected booking link does not mean appointments run on the agency website backend.',
      'No published inclusive retail pickup and barbershop reports.',
    ],
    features: {
      multiPageWebsite: 'confirmed-in-plan',
      teamPresentation: 'confirmed-in-plan',
      gallery: 'confirmed-in-plan',
      onlineBookings: 'confirmed-external',
      staffCalendars: 'confirmed-external',
      deposits: 'confirmed-external',
      emailReminders: 'confirmed-external',
      smsReminders: 'confirmed-external',
      clientManagement: 'confirmed-external',
      businessReports: 'confirmed-external',
      retailPickup: 'not-publicly-confirmed',
      hosting: 'confirmed-external',
      customDomain: 'not-publicly-confirmed',
    },
    sources: ['https://uxhm.co.uk/for-salons/'],
    fullKersivoScopeEquivalenceConfirmed: false,
  },
  {
    id: 'barberque-book-pay',
    provider: 'Barberque',
    selectedPackage: 'Book & Pay',
    kind: 'barber-website-service',
    decision: 'primary-candidate',
    rationale: 'Most functionally relevant published Barberque plan: website, bookings, up to five staff calendars, deposits, email and SMS reminders.',
    pricing: {
      setupGbp: null,
      recurringGbpPerMonth: 50,
      vat: 'ex-VAT',
      minimumTermMonths: null,
      pricingNotes: [
        '£50/month excluding VAT for Book & Pay; up to five calendars.',
        'Conflicting public copy: “Free set up!” and “£80 One-time website set up for any plan”.',
        'No guaranteed setup amount should be used for complete-cost comparison before clarification.',
      ],
      possibleAdditionalCosts: [
        'ambiguous one-time setup',
        'Stripe transaction fees',
        'registration/renewal of a custom domain not confirmed',
        'retail pickup and full CRM/reporting not publicly confirmed',
      ],
    },
    scope: 'Custom one-page website with booking, deposits/full booking payments, staff calendars, SMS/email reminders.',
    limits: [
      'One-page website, not a confirmed separate pages site.',
      'Provider describes using best-in-class scheduling software; do not claim a proprietary native booking engine.',
      'Retail pickup and deeper CRM/reporting capabilities not publicly confirmed.',
    ],
    features: {
      multiPageWebsite: 'not-in-selected-plan',
      teamPresentation: 'not-publicly-confirmed',
      gallery: 'not-publicly-confirmed',
      onlineBookings: 'confirmed-in-plan',
      staffCalendars: 'confirmed-in-plan',
      deposits: 'confirmed-in-plan',
      emailReminders: 'confirmed-in-plan',
      smsReminders: 'confirmed-in-plan',
      clientManagement: 'not-publicly-confirmed',
      businessReports: 'not-publicly-confirmed',
      retailPickup: 'not-publicly-confirmed',
      hosting: 'not-publicly-confirmed',
      customDomain: 'confirmed-external',
    },
    sources: ['https://www.barberque.co.uk/'],
    fullKersivoScopeEquivalenceConfirmed: false,
  },
  {
    id: 'setora-core',
    provider: 'Setora',
    selectedPackage: 'Standard platform',
    kind: 'integrated-platform',
    decision: 'primary-candidate',
    rationale: 'Direct UK barber/salon booking and management competitor with a branded public Shop Website layer; include despite not having a full gallery/team-style website confirmed.',
    pricing: {
      setupGbp: null,
      recurringGbpPerMonth: 59,
      vat: 'ex-VAT',
      minimumTermMonths: null,
      pricingNotes: [
        '£59/month per location before VAT where applicable.',
        'Unlimited staff; no Setora booking commission; 14-day free trial.',
        'No one-off setup fee appears in the public plan; do not silently assert a guaranteed £0.',
      ],
      possibleAdditionalCosts: [
        'SMS reminders sold separately as credits',
        'Stripe card processing',
        'custom domain purchase/renewal not confirmed',
        'retail pickup not publicly confirmed',
      ],
    },
    scope: 'Online bookings, staff diaries, client records, reports, email reminders, optional paid SMS and public Shop Website with homepage/location pages.',
    limits: [
      'The public Shop Website is a separate homepage/location-page layer linked to booking pages, not confirmed equivalent to KERSIVO gallery/team/services/retail website.',
      'Custom-domain concierge support mentioned; exact domain charges not confirmed.',
      'A multi-page bespoke site or retail pickup is not evidenced.',
    ],
    features: {
      multiPageWebsite: 'not-publicly-confirmed',
      teamPresentation: 'not-publicly-confirmed',
      gallery: 'not-publicly-confirmed',
      onlineBookings: 'confirmed-in-plan',
      staffCalendars: 'confirmed-in-plan',
      deposits: 'confirmed-in-plan',
      emailReminders: 'confirmed-in-plan',
      smsReminders: 'confirmed-external',
      clientManagement: 'confirmed-in-plan',
      businessReports: 'confirmed-in-plan',
      retailPickup: 'not-publicly-confirmed',
      hosting: 'confirmed-in-plan',
      customDomain: 'additional-quote-needed',
    },
    sources: ['https://www.setora.co.uk/', 'https://www.setora.co.uk/ai-info'],
    fullKersivoScopeEquivalenceConfirmed: false,
  },
  {
    id: 'aura-full-suite',
    provider: 'Aura Systems Design',
    selectedPackage: 'Full Suite (monthly rolling)',
    kind: 'beauty-platform',
    decision: 'reserve',
    rationale: 'Functionally close managed website + CRM/SMS/reporting system, but beauty-focused and includes bespoke build/onboarding/hardware at a materially different service level.',
    pricing: {
      setupGbp: 1999,
      recurringGbpPerMonth: 249,
      vat: 'not-confirmed',
      minimumTermMonths: null,
      pricingNotes: [
        'Full Suite £1,999 one-off + £249/month on monthly rolling plan.',
        '12-month discounted subscription is advertised, but not substituted into these prices.',
      ],
      possibleAdditionalCosts: [
        'Stripe fees',
        'VAT not confirmed',
        'retail pickup not confirmed',
      ],
    },
    scope: 'Up to six-page custom beauty website, booking/deposits, CRM, staff management, revenue and booking analytics, owner portal and up to 500 SMS reminders/month.',
    limits: [
      'The offer includes agency-like bespoke design and configured terminal; not a like-for-like KERSIVO service promise.',
      'Retail pickup unconfirmed; higher price is not sufficient reason to select this offer.',
    ],
    features: {
      multiPageWebsite: 'confirmed-in-plan',
      teamPresentation: 'confirmed-in-plan',
      gallery: 'confirmed-in-plan',
      onlineBookings: 'confirmed-in-plan',
      staffCalendars: 'confirmed-in-plan',
      deposits: 'confirmed-in-plan',
      emailReminders: 'confirmed-in-plan',
      smsReminders: 'confirmed-in-plan',
      clientManagement: 'confirmed-in-plan',
      businessReports: 'confirmed-in-plan',
      retailPickup: 'not-publicly-confirmed',
      hosting: 'confirmed-in-plan',
      customDomain: 'not-publicly-confirmed',
    },
    sources: ['https://aurasystemsdesign.co.uk/'],
    fullKersivoScopeEquivalenceConfirmed: false,
  },
  {
    id: 'mintbook-team',
    provider: 'Mintbook',
    selectedPackage: 'Team',
    kind: 'beauty-platform',
    decision: 'reserve',
    rationale: 'Useful branded-booking SaaS challenger; publication does not establish an equivalent multi-page barbershop website or retail pickup.',
    pricing: {
      setupGbp: 0,
      recurringGbpPerMonth: 249,
      vat: 'VAT-included',
      minimumTermMonths: null,
      pricingNotes: ['Team £249/month including VAT, no setup fee, no booking commission according to supplier.'],
      possibleAdditionalCosts: ['transaction fees where relevant', 'multi-page website / retail pickup not publicly confirmed'],
    },
    scope: 'Branded booking site with owner dashboard, automatic reminders, team calendars, packages and memberships.',
    limits: ['A branded booking site is not automatically an independent multi-page website.', 'Broader shop reports and retail pickup are not publicly confirmed.'],
    features: {
      multiPageWebsite: 'not-publicly-confirmed',
      teamPresentation: 'not-publicly-confirmed',
      gallery: 'not-publicly-confirmed',
      onlineBookings: 'confirmed-in-plan',
      staffCalendars: 'confirmed-in-plan',
      deposits: 'not-publicly-confirmed',
      emailReminders: 'not-publicly-confirmed',
      smsReminders: 'not-publicly-confirmed',
      clientManagement: 'not-publicly-confirmed',
      businessReports: 'not-publicly-confirmed',
      retailPickup: 'not-publicly-confirmed',
      hosting: 'confirmed-in-plan',
      customDomain: 'not-publicly-confirmed',
    },
    sources: ['https://mintbook.co.uk/'],
    fullKersivoScopeEquivalenceConfirmed: false,
  },
  {
    id: 'fadefoundry-founding',
    provider: 'FadeFoundry',
    selectedPackage: 'Founding Website',
    kind: 'barber-website-service',
    decision: 'exclude-until-quoted',
    rationale: 'Only an explicitly one-page founding package is publicly priced; extra pages are custom-quoted. Do not portray it as a comparable full website.',
    pricing: {
      setupGbp: 149,
      recurringGbpPerMonth: 12,
      vat: 'not-confirmed',
      minimumTermMonths: 12,
      pricingNotes: ['Founding offer £149 setup + £12/month care; £293 first 12 months before any applicable VAT.'],
      possibleAdditionalCosts: ['multi-page upgrade requires quote', 'new domain', 'external booking account', 'major changes'],
    },
    scope: 'One-page barbershop website, gallery/reviews and external booking-link integration.',
    limits: ['No public price for a suitably broader package.', 'Founding offer limited to qualifying UK shops.'],
    features: {
      multiPageWebsite: 'not-in-selected-plan',
      teamPresentation: 'not-in-selected-plan',
      gallery: 'confirmed-in-plan',
      onlineBookings: 'confirmed-external',
      staffCalendars: 'confirmed-external',
      deposits: 'not-publicly-confirmed',
      emailReminders: 'not-publicly-confirmed',
      smsReminders: 'not-publicly-confirmed',
      clientManagement: 'not-publicly-confirmed',
      businessReports: 'not-publicly-confirmed',
      retailPickup: 'not-publicly-confirmed',
      hosting: 'confirmed-in-plan',
      customDomain: 'confirmed-external',
    },
    sources: ['https://fadefoundry.co.uk/pricing/', 'https://fadefoundry.co.uk/terms/'],
    fullKersivoScopeEquivalenceConfirmed: false,
  },
] as const satisfies readonly WebsiteCostResearchedOffer[];

/** Booksy is a separate real subscription, not assumed free/included with an agency website. */
export const WEBSITE_COST_BOOKSY_UK = {
  source: 'https://biz.booksy.com/en-gb/pricing',
  baseMonthlyExVatGbp: 40,
  eachAdditionalUserMonthlyExVatGbp: 5,
  typicalUkVatRate: 0.2,
  scenarioBarberCount: WEBSITE_COST_RESEARCH_BUYER.bookableBarbers,
  caveats: [
    'Adds marketplace booking/management capability, not a custom multi-page shop website.',
    'Standard Booksy booking is not subject to a blanket booking commission; optional Boost may charge separately.',
    'Card processing is separate; first-party official tariff explicitly adds VAT.',
    'Do not add Booksy again when comparing an offer that already includes booking (e.g. Barberque Book & Pay).',
  ],
} as const;

export function getBooksyMonthlyPriceGbp(
  users: number,
  vat: 'excluding' | 'including' = 'excluding',
): number {
  if (!Number.isInteger(users) || users < 1) throw new RangeError('users must be a positive integer');
  const preVat = WEBSITE_COST_BOOKSY_UK.baseMonthlyExVatGbp
    + (users - 1) * WEBSITE_COST_BOOKSY_UK.eachAdditionalUserMonthlyExVatGbp;
  return vat === 'including' ? Math.round(preVat * (1 + WEBSITE_COST_BOOKSY_UK.typicalUkVatRate) * 100) / 100 : preVat;
}

/**
 * NON-EQUIVALENT published package subtotal only, before VAT/optional extras.
 * Null setup/recurring values MUST NOT be treated as zero or used as a full TCO.
 * Output does not prove feature parity; application must display package scope.
 */
export function getPublishedPackageSubtotalGbp(
  offer: WebsiteCostResearchedOffer,
  months: 12 | 36,
): number | null {
  const { setupGbp, recurringGbpPerMonth } = offer.pricing;
  if (setupGbp === null || recurringGbpPerMonth === null) return null;
  return setupGbp + months * recurringGbpPerMonth;
}

/** Discussion shortlist, NOT permission to replace approved Section 02 yet. */
export const WEBSITE_COST_PROPOSED_PRIMARY_IDS = [
  'jones-digital-pro',
  'barberflow-pro',
  'uxhm-salon-growth',
  'barberque-book-pay',
  'setora-core',
  'full-kersivo',
] as const;

/**
 * Publication gates:
 * 1) Approve which providers and packages belong in the public comparison.
 * 2) Verify actual current KERSIVO feature delivery against Commercial Offer.
 * 3) Reconfirm pricing, VAT, setup/domain and contract conditions near publish.
 * 4) Never say every provider has equal scope or that missing features cost £0.
 * 5) Surface unknown costs as unknown; do not promise exact 12/36-month TCO.
 * 6) Keep Jones/UXHM/BarberFlow + Booksy composites separate and label add-ons.
 * 7) Record owner approval, then wire Section 02/04 to THIS catalogue.
 * 8) Do not edit approved Section 03 without owner instruction.
 */
