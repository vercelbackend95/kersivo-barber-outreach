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
export const WEBSITE_COST_RESEARCH_PUBLICATION_STATE = 'draft-quote-required-before-publication' as const;

export const WEBSITE_COST_COSTING_POLICY = {
  purpose: 'Calculate the full cost of the comparable package, not its entry price',
  normalisedScenario: 'one UK barbershop, one location, four bookable barbers',
  secondaryScenario: 'six bookable barbers at the same location',
  horizons: [12, 36],
  mandatoryComponents: [
    'selected website scope and design/setup',
    'booking and per-bookable-barber subscription',
    'domain registration and renewal',
    'hosting/support where mandatory',
    'email/SMS reminders to the defined usage level',
    'CRM/reporting and retail pickup required for the target scope',
    'applicable VAT on all line items',
  ],
  perTransactionCosts: 'Not a fixed 12/36-month price unless an explicit number and value of transactions is defined; report separately.',
  unpublishedPricing: 'QUOTE_REQUIRED — never replace with £0 or borrow another providers fees',
  finalTotalRule: 'Show a FULL TCO only when all mandatory line items have confirmed amounts and applicability, otherwise withhold total and seek an itemised supplier quote',
} as const;

export const WEBSITE_COST_QUOTE_REQUESTS = {
  nearcut: 'Subscription quote for one UK site with 4 and 6 barbers; confirm that Subscription has no customer booking charge and whether the shop may instead directly cover the Free for You booking charge; separately confirm actual variable booking-charge tariff, VAT, multi-page site, product pickup, domain, reporting and £7.50 product Booster terms.',
  vagaro: 'Confirmed full UK recurring price for one location with 4 and 6 active calendars + MySite, VAT, domain and optional done-for-you website design; online product pickup and transaction costs.',
  fresha: 'Live GBP checkout price for Team with 4 and 6 bookable members + Smart Website, VAT, SMS limits/overage, domain registration, online retail pickup payment fees.',
  uxhm: 'Itemised £499 Salon Growth quote with 4/6 staff profiles, UK VAT, domain registration/renewal, Essential Care plus 3-year terms and booking integration/retail requirements.',
  barberque: 'Resolve contradictory FREE vs £80 setup fee; one-page/multi-page difference, domain, VAT and confirmation of retail, reports, CRM with 4/6 staff.',
  setora: 'Exact VAT status on £59/month, full shop website page structure/domain prices, SMS bundles and retail pickup support.',
} as const;

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
  fullKersivoScopeEquivalenceConfirmed: boolean;
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
    fullKersivoScopeEquivalenceConfirmed: true,
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
    decision: 'reserve',
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
    selectedPackage: 'One-location platform — published price conflict',
    kind: 'integrated-platform',
    decision: 'primary-candidate',
    rationale: 'Direct UK barber/salon booking and management competitor with a branded public Shop Website layer; include despite not having a full gallery/team-style website confirmed.',
    pricing: {
      setupGbp: null,
      recurringGbpPerMonth: null,
      vat: 'not-confirmed',
      minimumTermMonths: null,
      pricingNotes: [
        'PRICE CONFLICT — official /pricing states £39/month/location (including six barbers), whereas homepage, /ai-info and /terms-conditions state £59/month/location.',
        'Terms disclose that Setora is not VAT-registered at the stated update, and a separate 2026 blog states no VAT currently added; this conflicts with generic “exclusive of VAT” price wording. Reconcile current invoice/tax status before publication.',
        'Unlimited staff; no Setora booking commission; 14-day free trial.',
        'No one-off setup fee appears in the public plan; do not silently assert a guaranteed £0.',
      ],
      possibleAdditionalCosts: [
        'SMS reminders sold separately as credits; no dependable public unit price identified',
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
    sources: [
      'https://www.setora.co.uk/pricing',
      'https://www.setora.co.uk/terms-conditions',
      'https://www.setora.co.uk/',
      'https://www.setora.co.uk/blog/hidden-cost-free-barbershop-software',
    ],
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
    id: 'nearcut-subscription',
    provider: 'Nearcut',
    selectedPackage: 'Subscription (quoted for 4 or 6 bookable barbers)',
    kind: 'integrated-platform',
    decision: 'primary-candidate',
    rationale: 'Barber-specific personalised/custom website plus appointment operations, staff calendars, email and SMS reminders; product sales are offered as an optional booster. Higher functional fit than most standalone web design agencies.',
    pricing: {
      setupGbp: 0,
      recurringGbpPerMonth: null,
      vat: 'ex-VAT',
      minimumTermMonths: 0,
      pricingNotes: [
        'Nearcut offers TWO publicly described models: (1) Free for You: £0 shop subscription, customers pay a separate checkout booking charge; Nearcut illustrates £1.50 on a £20 haircut, not a confirmed universal per-booking rate. (2) Subscription: shop pays a tailored monthly price excluding VAT, customers pay NO Nearcut booking charge.',
        'No third Nearcut plan charging the BARBERSHOP exactly £1.50 per booking has been verified; merchant-funding an equivalent amount is a modelling assumption, never an official Nearcut offer.',
        'Its subscription price depends on barber/location count; the publicly accessible page directs customers to request a quote. No verified 4- or 6-barber price.',
        'Official pricing states no setup fees; Subscription has a 30-day free trial, no long commitment, and is quote-based by barbers and locations.',
      ],
      possibleAdditionalCosts: [
        '4- and 6-barber subscription quotation needed',
        'product sales & stock management Business Booster listed at £7.50/month on the UK pricing page; verify applicability/terms (other locale versions may display $10)',
        'custom domain pricing and expanded standalone pages (beyond the confirmed Homepage and Gallery) not publicly confirmed',
        'payment processing fees, where applicable: Help Centre standard schedule 2.9% + £0.20 with volume reductions; Free for You advertising simultaneously mentions optional online payments at zero transaction fees, so plan-specific applicability needs confirmation',
        'other optional Business Boosters, where applicable',
      ],
    },
    scope: 'Personalised/custom shop website, online booking, appointment diaries, email reminders, SMS where in selected plan, payments and optional product sales/stock management booster.',
    limits: [
      'The £1.50 charge is shown for a £20 haircut in Free for You, where the customer (NOT the shop) pays; it is not confirmed as the universal amount or as a shop-billed tariff.',
      'UK Nearcut pricing page publicly displays Product sales & stock management at £7.50/month, while other localisations show different currencies. Only GBP UK source is relevant.',
      'Nearcut Help Centre confirms Homepage and separate Gallery page plus staff bios; separately navigable Team, About and Retail pages analogous to KERSIVO are not all established.',
      'Nearcut has online product sales and stock management via the Business Booster; click-and-collect checkout / pickup promise not confirmed.',
      'Nearcut Free for You advertises optional deposits/online payments without transaction fees, but the generic Help Centre states ordinary online processing 2.9% + £0.20 with volume reductions. Do not present either as universal across both pricing models.',
    ],
    features: {
      multiPageWebsite: 'confirmed-in-plan',
      teamPresentation: 'confirmed-in-plan',
      gallery: 'confirmed-in-plan',
      onlineBookings: 'confirmed-in-plan',
      staffCalendars: 'confirmed-in-plan',
      deposits: 'confirmed-in-plan',
      emailReminders: 'confirmed-in-plan',
      smsReminders: 'not-publicly-confirmed',
      clientManagement: 'confirmed-in-plan',
      businessReports: 'confirmed-in-plan',
      retailPickup: 'not-publicly-confirmed',
      hosting: 'confirmed-in-plan',
      customDomain: 'not-publicly-confirmed',
    },
    sources: [
      'https://nearcut.com/en-GB/pricing',
      'https://nearcut.com/en-GB',
      'https://help.nearcut.com/en/articles/16147775-how-to-edit-the-website',
      'https://help.nearcut.com/en/articles/4518646-how-to-set-up-product-sales',
      'https://help.nearcut.com/en/articles/4518709-how-to-sell-products',
      'https://help.nearcut.com/en/articles/5672099-about-online-payments-and-how-to-set-it-up',
    ],
    fullKersivoScopeEquivalenceConfirmed: false,
  },
  {
    id: 'fresha-team-smart-website',
    provider: 'Fresha',
    selectedPackage: 'Team + Smart Website',
    kind: 'integrated-platform',
    decision: 'primary-candidate',
    rationale: 'Strongest evidence of full operating stack: booking, calendars, CRM, reporting, SMS/email, Smart Website, online product store and in-store pickup. Keep it in comparison even if it is cheaper in some situations.',
    pricing: {
      setupGbp: null,
      recurringGbpPerMonth: null,
      vat: 'ex-VAT',
      minimumTermMonths: null,
      pricingNotes: [
        'UK £9.95/bookable team member/month and Smart Website £12.95/month +20% VAT are corroborated in October 2026 UK research but cannot currently be verified on the location-adjusted official Fresha price page: it renders in non-GBP from remote browsing.',
        'Illustrative 4 bookable members: £39.80 + £12.95 = £52.75 ex VAT / £63.30 inc VAT. Six members: £59.70 + £12.95 = £72.65 ex VAT / £87.18 inc VAT. NOT a signed checkout quote.',
        'Core reporting is included without paid Insights; do not force optional premium reporting add-on.',
        'The dynamic Fresha pricing page displayed non-GBP currencies when accessed remotely, so UK checkout prices and exact reminder allowance MUST be independently reconfirmed before publication.',
        'SMS usage above monthly free allowance, optional marketplace new-client fee, and online card processing are usage-dependent, not a single fixed monthly amount.',
      ],
      possibleAdditionalCosts: [
        'independently verify live UK Team and Smart Website rates',
        'custom domain purchase/renewal if required',
        'SMS allowance and per-text UK cost — independent October pricing references 20 included per bookable member then 6p each; reconfirm in official UK checkout',
        'optional marketplace acquisition fees for qualified newly acquired clients',
        'online card processing (required for online product store)',
      ],
    },
    scope: 'Fresha Team scheduling, clients and reports, Smart Website content for team/services, optional retail inventory and product store with in-store pickup using Fresha Payments.',
    limits: [
      'Smart Website is a configurable product, not necessarily an agency-built fully bespoke site.',
      'The official Fresha online store help explicitly confirms free store setup, inventory, online payment requirement and in-store pickup.',
      'Smart Website page structure and separate branded content pages must still be verified.',
    ],
    features: {
      multiPageWebsite: 'not-publicly-confirmed',
      teamPresentation: 'confirmed-in-plan',
      gallery: 'not-publicly-confirmed',
      onlineBookings: 'confirmed-in-plan',
      staffCalendars: 'confirmed-in-plan',
      deposits: 'confirmed-in-plan',
      emailReminders: 'confirmed-in-plan',
      smsReminders: 'confirmed-in-plan',
      clientManagement: 'confirmed-in-plan',
      businessReports: 'confirmed-in-plan',
      retailPickup: 'confirmed-in-plan',
      hosting: 'confirmed-in-plan',
      customDomain: 'confirmed-external',
    },
    sources: [
      'https://www.fresha.com/pricing',
      'https://www.fresha.com/help-center/knowledge-base/online-presence',
      'https://www.fresha.com/help-center/knowledge-base/inventory/163-create-and-manage-an-online-product-store',
      'https://kersivo.co.uk/fresha-alternative',
      'https://cobbtree.com/blog/fresha-pricing-explained',
      'https://www.fresha.com/help-center/knowledge-base/billing-and-fees/188-marketplace-new-client-fees',
    ],
    fullKersivoScopeEquivalenceConfirmed: false,
  },
  {
    id: 'vagaro-mysite',
    provider: 'Vagaro',
    selectedPackage: 'Vagaro booking + MySite, one location (4 or 6 calendars)',
    kind: 'integrated-platform',
    decision: 'primary-candidate',
    rationale: 'Very close feature model: branded customizable website, team/services/gallery, bookable calendars, reminders, reports, e-commerce products and shop pickup. UK provider also advertises an optional done-for-you website design service.',
    pricing: {
      setupGbp: null,
      recurringGbpPerMonth: null,
      vat: 'not-confirmed',
      minimumTermMonths: null,
      pricingNotes: [
        'Vagaro UK advertises MySite as a £15/month add-on.',
        'UK Vagaro Pro official FAQ explicitly states promotional £20/month for first calendar plus £10 per additional calendar, up to 7; independent of dynamic button rendering.',
        'Four calendars: £20 + 3×£10 + £15 MySite = £65/month; six: £20 + 5×£10 + £15 MySite = £85/month, before unverified VAT and domain.',
        'The £20 calendar starting amount appears next to crossed-out £30 on the UK pricing page; long-term availability of promotion not guaranteed.',
        'Official UK Terms contain nuanced channel-dependent first-booking charges: Marketplace/partner/new-client activity may attract 20% plus VAT; ordinary existing-client bookings and direct-channel bookings with Fill My Books disabled should not be incorrectly shown as charged 20%.',
        'UK MySite design service advertises a limited-time no-fee custom design (£699 stated value), subject to conditions/possible other fees. Never treat this as permanent setup £0.',
      ],
      possibleAdditionalCosts: [
        'promotion expiration or post-promotion first-calendar rate',
        'domain registration/renewal if purchased',
        'whether limited-time promotional free designer-assisted multi-page setup (£699 stated value) is available for the specific shop; additional design/pages/copy may cost extra',
        'merchant payment processing',
        '20% one-time New Client Connection Fee on qualifying first appointments via UK Vagaro marketplace (plus VAT where applicable), and further conditional partner/Fill My Books channel charges under its terms',
        'optional branded text marketing from £15/month (do not confuse with included automated appointment reminders)',
        'merchant-services incentive conditions: free reader may entail a £100 early-exit charge if merchant processing is terminated before 12 months',
        'any optional marketing modules',
      ],
    },
    scope: 'Integrated bookings, client records, inventory and reports; MySite can show staff, gallery, services and integrated products, and online shop supports pickup.',
    limits: [
      'Website builder is not identical to a managed custom build unless the design service is purchased/confirmed.',
      'Vagaro is a wider beauty/wellness system, rather than barber-exclusive software.',
      '4/6-calendar base monthly formulas are publicly established; fixed total still excludes VAT where applicable, own-domain costs, payment fees and any design outside promotional scope.',
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
      customDomain: 'confirmed-external',
    },
    sources: [
      'https://www.vagaro.com/en-gb/pro/pricing',
      'https://www.vagaro.com/en-gb/pro',
      'https://mysite.vagaro.com/vagaroukio/mysite',
      'https://www.vagaro.com/en-gb/pro/vagaro-customer-participation-agreement',
      'https://support.vagaro.com/hc/en-us/articles/35429794470555-MySite-FAQ',
      'https://www.vagaro.com/en-gb/pro/online-store',
      'https://mysite.vagaro.com/vagaroukio/mysite',
    ],
    fullKersivoScopeEquivalenceConfirmed: false,
  },
  {
    id: 'square-appointments-online-plus',
    provider: 'Square',
    selectedPackage: 'Appointments Plus + Square Online Plus',
    kind: 'integrated-platform',
    decision: 'reserve',
    rationale: 'Verified alternative for owners willing to build and administer their own site: appointment diaries, SMS/email, client records, reports, own-domain website and in-store product pickup.',
    pricing: {
      setupGbp: 0,
      recurringGbpPerMonth: 49,
      vat: 'not-confirmed',
      minimumTermMonths: null,
      pricingNotes: [
        'Square Appointments Plus is £29/month/location; Square Online Plus is £20/month when billed annually, and is NOT a month-to-month website price.',
        'Square Online Plus includes custom-domain connection and a standard free domain for the first year; renewal price thereafter depends on the domain.',
        'Verify VAT treatment, product coupling and overlapping appointment integration in a UK merchant account before publication.',
      ],
      possibleAdditionalCosts: [
        'VAT treatment of each Square subscription',
        'domain renewal after year one',
        'online/in-person card processing',
        'shop-specific setup and human design time, if requested',
      ],
    },
    scope: 'Self-configured Square Appointments Plus for bookings/reports and Square Online Plus for a branded ecommerce site including click and collect.',
    limits: [
      'Not a done-for-you barbershop website; user creates/configures it.',
      'Prices are for two combined Square subscriptions, with the website paid annually.',
    ],
    features: {
      multiPageWebsite: 'confirmed-in-plan',
      teamPresentation: 'not-publicly-confirmed',
      gallery: 'not-publicly-confirmed',
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
    sources: [
      'https://squareup.com/gb/en/appointments/pricing',
      'https://squareup.com/gb/en/online-store/plans',
      'https://squareup.com/gb/en/solutions/barbershop',
    ],
    fullKersivoScopeEquivalenceConfirmed: false,
  },
  {
    id: 'jena-pro',
    provider: 'JENA',
    selectedPackage: 'Pro',
    kind: 'beauty-platform',
    decision: 'reserve',
    rationale: 'Website and own-domain connection, bookings, email/SMS reminders, deposits and reports in a single UK monthly plan. Product focuses on independent professionals/solo businesses rather than proven 4–6-barber shops.',
    pricing: {
      setupGbp: 0,
      recurringGbpPerMonth: 29,
      vat: 'VAT-included',
      minimumTermMonths: null,
      pricingNotes: ['JENA Pro £29/month including VAT, 14-day free trial.'],
      possibleAdditionalCosts: ['domain registration', 'payment processing', 'multi-barber permissions and retail pickup not verified'],
    },
    scope: 'Website builder, booking, deposits, email/SMS reminders, reports and customer care.',
    limits: ['Four- and six-bookable-barber functionality and costs not confirmed.', 'Retail pickup not confirmed.'],
    features: {
      multiPageWebsite: 'not-publicly-confirmed',
      teamPresentation: 'not-publicly-confirmed',
      gallery: 'not-publicly-confirmed',
      onlineBookings: 'confirmed-in-plan',
      staffCalendars: 'not-publicly-confirmed',
      deposits: 'confirmed-in-plan',
      emailReminders: 'confirmed-in-plan',
      smsReminders: 'confirmed-in-plan',
      clientManagement: 'confirmed-in-plan',
      businessReports: 'confirmed-in-plan',
      retailPickup: 'not-publicly-confirmed',
      hosting: 'confirmed-in-plan',
      customDomain: 'confirmed-external',
    },
    sources: ['https://www.jena.so/'],
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


/** Public £15 UK MySite add-on, and UK official Vagaro Pro FAQ's £20+£10/extra calendar. */
export function vagaroUkPublishedMonthlySubtotalGbp(bookableBarbers: number): number {
  if (!Number.isInteger(bookableBarbers) || bookableBarbers < 1) {
    throw new RangeError('bookableBarbers must be a positive integer');
  }
  // UK pricing FAQ: £20 initial calendar + £10 per extra up to seven; £80 at 7+.
  const calendarsGbp = Math.min(80, 20 + 10 * (bookableBarbers - 1));
  return calendarsGbp + 15;
}

/**
 * SECONDARY-VERIFIED UK indication, NOT an officially verified UK checkout quote.
 * VAT at 20% is the rate stated by UK secondary comparisons, not a guarantee
 * about the merchant's tax invoice. Messaging/marketplace/processing excluded.
 */
export function freshaUkIndicatedMonthlySubtotalGbp(
  bookableBarbers: number,
  includeVat: boolean = false,
): number {
  if (!Number.isInteger(bookableBarbers) || bookableBarbers < 1) {
    throw new RangeError('bookableBarbers must be a positive integer');
  }
  const exVat = bookableBarbers * 9.95 + 12.95;
  return Math.round(exVat * (includeVat ? 1.2 : 1) * 100) / 100;
}

/** Research confidence record; not a public price quote. */
/**
 * Nearcut's £1.50 is a PUBLISHED MARKETING EXAMPLE OF A CUSTOMER FEE in
 * Free for You, NOT an officially verified price payable by the barbershop.
 *
 * Merchant-absorbed scenario: for research ONLY, simulate a shop voluntarily
 * offsetting the client's illustrative £1.50 fee (e.g. by lowering its service
 * price), without claiming Nearcut bills the shop £1.50. This assumes one
 * offset for each eligible chargeable, completed online booking. Actual amount,
 * refunds, tax, eligibility and whether an offset can be implemented must be
 * verified. Customer can still pay Nearcut directly.
 *
 * Not comparable with a fixed Subscription quote without separately defining
 * bookings volume. Booking fee and card-processing fee are DIFFERENT charges.
 */
export const NEARCUT_BOOKING_FEE_MODELS = {
  freeForYou: {
    publishedPlanName: 'Free for You',
    subscriptionGbpPerMonth: 0,
    nearcutBookingChargePayer: 'customer',
    publishedIllustrativeCustomerBookingChargeGbp: 1.50,
    fixedChargeForAllBookingsConfirmed: false,
    merchantCanPayFeeDirectlyToNearcutConfirmed: false,
    source: 'https://nearcut.com/en-GB/pricing',
  },
  subscription: {
    publishedPlanName: 'Subscription',
    monthlyShopPrice: 'QUOTE_REQUIRED_FOR_BARBER_COUNT',
    nearcutBookingChargePayer: 'none',
    shopPaysQuotedSubscription: true,
    source: 'https://nearcut.com/en-GB/pricing',
  },
  hypotheticalMerchantOffset: {
    modelName: 'Merchant offsets the illustrative client charge',
    isRealNearcutTariff: false,
    perChargeableBookingEquivalentGbp: 1.50,
    pricingMethod: 'merchant voluntarily offsets the equivalent fee, e.g. through service pricing',
    caveat: 'Customer-funded Free for You is unchanged. Nearcut has not verified a shop-billed £1.50 per-booking plan.',
  },
} as const;

/** Merchant's illustrative economic subsidy, NOT a Nearcut merchant invoice. */
export function nearcutIllustrativeMerchantOffsetGbp(
  eligibleChargeableOnlineBookings: number,
  months: 12 | 36,
): number {
  if (!Number.isInteger(eligibleChargeableOnlineBookings) || eligibleChargeableOnlineBookings < 0) {
    throw new RangeError('eligibleChargeableOnlineBookings must be a non-negative integer per month');
  }
  return eligibleChargeableOnlineBookings
    * NEARCUT_BOOKING_FEE_MODELS.hypotheticalMerchantOffset.perChargeableBookingEquivalentGbp
    * months;
}

export const WEBSITE_COST_CURRENT_FINDINGS = {
  vagaroUkFourBarbersPlusMySite: 65,
  vagaroUkSixBarbersPlusMySite: 85,
  freshaUkIndicativeFourIncVat: 63.30,
  freshaUkIndicativeSixIncVat: 87.18,
  nearcutMonthlySubscription: 'QUOTE_REQUIRED',
  nearcutProductBoosterUkAdvertisedMonthlyGbp: 7.50,
  nearcutPublishedCustomerBookingChargeIllustrationGbp: 1.50,
  nearcutMerchantBilledChargePerBooking: 'NOT_CONFIRMED',
  setoraPublicPriceConflict: [39, 59],
  exact12And36MonthTcoStatus: 'BLOCKED_WITHOUT_ALL_MANDATORY_CHARGES_AND_USAGE',
  legalNote: 'UK CMA UCP price transparency rules are aimed at consumers; B2B suppliers can use bespoke quotations. Ads must still avoid misleading price presentation; ASA/CAP applies to prices in ads.',
} as const;

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
  'vagaro-mysite',
  'fresha-team-smart-website',
  'nearcut-subscription',
  'setora-core',
  'uxhm-salon-growth',
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
