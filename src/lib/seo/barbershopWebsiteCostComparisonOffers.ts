/**
 * Section 02 presentation rows for `/barbershop-website-cost-uk`.
 *
 * Deeper supplier research (feature matrices, quote requests, draft TCO policy)
 * lives in `barbershopWebsiteCostOffers.ts`. This file is the display adapter
 * input: delivery labels, published/indicative figures and short copy.
 *
 * Treat figures as research drafts requiring verification against linked sources.
 * Comparison assumption: one UK barbershop with four bookable barbers.
 */

import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

export type WebsiteDeliveryKind =
  | 'self-build'
  | 'self-setup'
  | 'platform-website'
  | 'done-for-you'
  | 'not-confirmed';

export type CostOfferPricingConfidence =
  | 'published'
  | 'indicative'
  | 'custom-quote'
  | 'conflict';

export type CostOfferScopeStatus =
  | 'included'
  | 'external'
  | 'separate'
  | 'project'
  | 'not-in-tier'
  | 'not-confirmed';

export type CostOfferSource = {
  href: string;
  label: string;
  shortLabel?: string;
};

export type CostOffer = {
  id: string;
  name: string;
  packageName: string;
  kind: 'kersivo' | 'named' | 'category';
  /** Position in the primary six-provider comparison; null = archived research only. */
  primaryOrder: number | null;
  delivery: {
    kind: WebsiteDeliveryKind;
    /** Short badge shown under the provider name. */
    label: string;
    summary: string;
  };
  pricing: {
    figure: string;
    figureSecondary?: string;
    caption: string;
    note?: string;
    primary: string;
    secondary?: string;
    confidence: CostOfferPricingConfidence;
    components?: readonly string[];
    unresolvedIssues?: readonly string[];
  };
  features: {
    website: CostOfferScopeStatus;
    care: CostOfferScopeStatus;
    booking: CostOfferScopeStatus;
    shopTools: CostOfferScopeStatus;
  };
  billingModel: string;
  websiteDeliveryLong: string;
  bookingsRetail: string;
  whatToCheck: string;
  whatToCheckShort: string;
  whatToCheckPoints: readonly string[];
  bookingApproach: string;
  mobileHighlight: string;
  sources: readonly CostOfferSource[];
  emphasized?: boolean;
  categoryLabel?: string;
  includedSummary?: readonly string[];
  caveat?: string;
  researchNotes?: readonly string[];
};

export const COST_OFFERS_COMPARISON_ASSUMPTION =
  'Example: one UK barbershop with four bookable barbers.';

export const COST_OFFERS_RESEARCH_CHECKED_LABEL = '20 October 2026';

/** Primary Section 02 order. */
export const COST_OFFER_PRIMARY_IDS = [
  'vagaro-pro-mysite',
  'fresha-team-smart-website',
  'nearcut-subscription',
  'setora',
  'uxhm-salon-growth-booksy',
  'full-kersivo',
] as const;

export type CostOfferPrimaryId = (typeof COST_OFFER_PRIMARY_IDS)[number];

export const WEBSITE_DELIVERY_KIND_LABELS: Record<WebsiteDeliveryKind, string> = {
  'self-build': 'Self-build website',
  'self-setup': 'Self-setup / configurable website',
  'platform-website': 'Platform website',
  'done-for-you': 'Done-for-you website',
  'not-confirmed': 'Website setup not confirmed',
};

export const BARBERSHOP_WEBSITE_COST_OFFERS: readonly CostOffer[] = [
  {
    id: 'vagaro-pro-mysite',
    name: 'Vagaro Pro + MySite',
    packageName: 'Vagaro Pro + MySite',
    kind: 'named',
    primaryOrder: 1,
    delivery: {
      kind: 'self-build',
      label: 'Self-build website',
      summary:
        'MySite is a website builder. Optional professional design exists as a separate or limited-time promotion — not a permanent done-for-you entitlement.',
    },
    pricing: {
      figure: '£65',
      caption: 'Per month · published subtotal',
      note: 'Promotional first calendar · VAT to confirm · extras may apply',
      primary: '£65/month published subscription subtotal for four calendars + MySite',
      secondary:
        '£20 first calendar + £30 for three additional calendars (£10 each) + £15 MySite. Not an all-inclusive cost.',
      confidence: 'published',
      components: [
        'First bookable calendar: £20/month (advertised UK rate; limited-time framing on pricing)',
        'Three additional calendars: £10/month each (£30)',
        'MySite: £15/month after publish',
      ],
      unresolvedIssues: [
        'VAT applicability must be confirmed at checkout',
        'Domain charges, payment fees and marketplace fees may apply',
        'Optional professional MySite design (£699 UK list, sometimes free for a limited time) is separate from the £65 subtotal',
      ],
    },
    features: {
      website: 'included',
      care: 'not-confirmed',
      booking: 'included',
      shopTools: 'included',
    },
    billingModel:
      'Monthly Vagaro Pro subscription scaled by bookable calendars, plus MySite after publish. Optional design and premium add-ons are separate.',
    websiteDeliveryLong:
      'Ordinary MySite is a self-build website builder and hosting layer. You configure and publish the site. Vagaro also advertises an optional professional design service (UK list price and limited-time promotions vary) — that is not the default MySite product.',
    bookingsRetail:
      'Integrated online booking, client management, reporting and online retail features are part of the Vagaro platform. Marketplace and payment fees may apply depending on use.',
    whatToCheck:
      '£65 is a published subscription subtotal, not a guaranteed all-in cost. Confirm VAT, domain charges, payment processing, marketplace fees and whether any professional design promotion still applies.',
    whatToCheckShort:
      'MySite is a builder, not an agency build. £65 is a published subtotal — VAT, domain and marketplace fees may still apply.',
    whatToCheckPoints: [
      'Self-build MySite — optional design is separate/promotional',
      '£65 = 4 calendars + MySite before unverified extras',
      'Confirm VAT, domain, payments and marketplace fees',
    ],
    bookingApproach: 'Integrated Vagaro booking + calendars',
    mobileHighlight: '£65/mo published subtotal · self-build MySite',
    sources: [
      {
        href: 'https://www.vagaro.com/en-gb/pro/pricing',
        label: 'Vagaro UK pricing',
        shortLabel: 'Vagaro pricing',
      },
      {
        href: 'https://support.vagaro.com/hc/en-us/articles/26688722409243-Vagaro-MySite-Pricing',
        label: 'Vagaro MySite pricing',
        shortLabel: 'MySite pricing',
      },
    ],
    researchNotes: [
      'Four-barber subtotal uses official UK calendar rates (£20 + 3×£10) plus MySite £15 = £65.',
      'Do not treat limited-time free design promotions as a permanent entitlement.',
    ],
  },
  {
    id: 'fresha-team-smart-website',
    name: 'Fresha Team + Smart Website',
    packageName: 'Team + Smart Website',
    kind: 'named',
    primaryOrder: 2,
    delivery: {
      kind: 'self-setup',
      label: 'Self-setup / configurable website',
      summary:
        'Smart Website is configured inside Fresha. Not a bespoke agency-built multi-page website.',
    },
    pricing: {
      figure: '£52.75',
      figureSecondary: '£63.30 inc. VAT',
      caption: 'Indicative UK pricing / month',
      note: 'Excl. VAT £52.75 · confirm at official GBP checkout',
      primary: 'Indicative £52.75/month excluding VAT for four Team seats + Smart Website',
      secondary: '£63.30/month including 20% VAT if VAT applies at that rate',
      confidence: 'indicative',
      components: [
        'Four bookable Team members: 4 × £9.95/month',
        'Smart Website add-on: £12.95/month',
      ],
      unresolvedIssues: [
        'Official GBP checkout should be re-confirmed before treating figures as contracted rates',
        'Marketplace new-client fees, SMS overages and payment processing are separate',
      ],
    },
    features: {
      website: 'included',
      care: 'not-in-tier',
      booking: 'included',
      shopTools: 'included',
    },
    billingModel:
      'Monthly Fresha Team subscription per bookable team member, plus optional Smart Website. Rates typically listed exclusive of VAT.',
    websiteDeliveryLong:
      'Fresha Smart Website is a configurable website layer you set up and maintain inside Fresha. Do not portray it as a bespoke website prepared by an agency.',
    bookingsRetail:
      'Bookings, calendars, client management, reporting, inventory and online product store options are part of the Fresha platform. Email/SMS allowances apply; marketplace and processing fees may apply.',
    whatToCheck:
      'Treat £52.75 as indicative UK research pending checkout confirmation. Confirm VAT, marketplace fees, SMS allowances and payment processing before budgeting.',
    whatToCheckShort:
      'Indicative £52.75 excl. VAT. Self-configured Smart Website — marketplace, SMS and processing fees may apply.',
    whatToCheckPoints: [
      'Indicative UK subtotal — confirm official GBP checkout',
      'Self-configured Smart Website, not an agency build',
      'Marketplace, SMS and processing fees may apply',
    ],
    bookingApproach: 'Integrated Fresha booking + team calendars',
    mobileHighlight: 'Indicative £52.75/mo excl. VAT · configurable Smart Website',
    sources: [
      {
        href: 'https://www.fresha.com/en-GB/pricing',
        label: 'Fresha UK pricing',
        shortLabel: 'Fresha pricing',
      },
    ],
    researchNotes: [
      '4 × £9.95 + £12.95 = £52.75 excl. VAT; ×1.2 = £63.30 inc. VAT at 20%.',
      'Fresha.com geo-pricing can differ by locale — mark as indicative until checkout is verified.',
    ],
  },
  {
    id: 'nearcut-subscription',
    name: 'Nearcut Subscription',
    packageName: 'Subscription',
    kind: 'named',
    primaryOrder: 3,
    delivery: {
      kind: 'platform-website',
      label: 'Personalised platform website',
      summary:
        'Nearcut advertises a personalised barbershop website with the Subscription package. Exact setup responsibility should be confirmed with Nearcut — not assumed to be a bespoke agency build.',
    },
    pricing: {
      figure: 'Custom quote',
      caption: 'Monthly subscription',
      note: 'Priced for shop needs and team size · not £1.50/booking',
      primary: 'Custom monthly quote based on shop needs and team size',
      secondary:
        'Customers do not pay an extra Nearcut booking fee under Subscription. Do not confuse with Nearcut’s separate Free for You customer-fee model.',
      confidence: 'custom-quote',
      unresolvedIssues: [
        'No public fixed four-barber GBP subscription figure to publish as a total',
        'Product sales/stock may require separately advertised UK Business Booster',
        'Retail pickup not confirmed from public materials',
      ],
    },
    features: {
      website: 'included',
      care: 'not-confirmed',
      booking: 'included',
      shopTools: 'separate',
    },
    billingModel:
      'Nearcut Subscription is a shop-paid monthly subscription quoted for needs and team size. Separate Free for You model charges customers a booking fee instead — that is not this package’s price.',
    websiteDeliveryLong:
      'Nearcut Subscription includes a personalised barbershop website with bookings and team diaries. Public materials do not clearly establish a full done-for-you agency build versus guided platform setup — confirm responsibilities before purchase.',
    bookingsRetail:
      'Website, bookings, team diaries and customer tools are offered. Product sales/stock management may require the separately advertised UK Business Booster. Retail pickup remains unconfirmed.',
    whatToCheck:
      'Ask Nearcut for a Subscription quote for four barbers. Do not treat the Free for You £1.50 booking-fee example as the Subscription price. Confirm website setup responsibility, Business Booster needs and retail capabilities.',
    whatToCheckShort:
      'Custom monthly quote — not a £1.50/booking plan. Confirm website setup responsibility and any Business Booster add-ons.',
    whatToCheckPoints: [
      'Custom Subscription quote for team size — not Free for You pricing',
      'Confirm who configures the personalised website',
      'Stock/retail tools may need Business Booster; pickup unconfirmed',
    ],
    bookingApproach: 'Integrated Nearcut diaries and customer booking',
    mobileHighlight: 'Custom Subscription quote · personalised platform website',
    sources: [
      {
        href: 'https://www.nearcut.com/pricing',
        label: 'Nearcut pricing',
        shortLabel: 'Nearcut',
      },
    ],
    researchNotes: [
      'Free for You example (£1.50 on a £20 cut) is a customer-fee model — not a verified shop invoice of £1.50 per booking under Subscription.',
      'Hypothetical economic offset scenarios are research notes only and must not be shown as published Subscription pricing.',
    ],
  },
  {
    id: 'setora',
    name: 'Setora',
    packageName: 'Platform plan',
    kind: 'named',
    primaryOrder: 4,
    delivery: {
      kind: 'platform-website',
      label: 'Platform Shop Website',
      summary:
        'Setora includes a Shop Website / branded booking-site layer. Do not imply a bespoke multi-page agency design service matching Full KERSIVO’s website scope.',
    },
    pricing: {
      figure: '£59',
      caption: 'Per month / location',
      note: 'Owner-selected headline · see pricing conflict note',
      primary: '£59/month per location (owner-selected published headline)',
      secondary:
        'Research also recorded a conflicting £39/month figure on an official pricing reading. VAT wording also conflicts across Setora pages — confirm live charged rate and tax status. Do not publish a guaranteed 12/36-month TCO until resolved.',
      confidence: 'conflict',
      components: ['Platform subscription per location', 'Unlimited staff seats advertised'],
      unresolvedIssues: [
        'Conflicting official price readings: £59 (homepage/Terms) vs £39 (alternate official pricing reading)',
        'VAT status unresolved across “exclude VAT where applicable” vs “not VAT-registered / no VAT currently added” wording',
        'SMS credits and Stripe processing are separate',
      ],
    },
    features: {
      website: 'included',
      care: 'included',
      booking: 'included',
      shopTools: 'not-confirmed',
    },
    billingModel:
      'Monthly platform subscription per location after trial. No per-staff fees advertised. SMS credits and card processing separate.',
    websiteDeliveryLong:
      'Setora Shop Websites provide a public brand/homepage and location pages that route to a Booking Page. Content is managed in the platform. This is not confirmed as a bespoke multi-page design service with gallery/retail parity to Full KERSIVO.',
    bookingsRetail:
      'Booking calendars, clients, reports and email reminders are included in the platform pitch. SMS credits are charged separately. Retail pickup and full shop-tool parity with KERSIVO are not confirmed.',
    whatToCheck:
      'Confirm the live charged rate (£59 vs previously observed £39), VAT treatment, Shop Website scope versus a full branded site, and SMS credit costs.',
    whatToCheckShort:
      '£59/mo/location selected headline; another official reading showed £39 — confirm the live rate. SMS and Stripe separate.',
    whatToCheckPoints: [
      'Headline £59/mo/location — confirm against live checkout',
      'Shop Website ≠ confirmed full multi-page agency build',
      'SMS credits and Stripe processing billed separately',
    ],
    bookingApproach: 'Integrated Setora booking + diary',
    mobileHighlight: '£59/mo per location · platform Shop Website',
    sources: [
      {
        href: 'https://www.setora.co.uk/',
        label: 'Setora homepage',
        shortLabel: 'Setora',
      },
      {
        href: 'https://www.setora.co.uk/pricing',
        label: 'Setora pricing',
        shortLabel: 'Setora pricing',
      },
    ],
    researchNotes: [
      'Owner decision (Oct 2026): show £59/month as the primary published amount.',
      'Preserve £39 conflict in research — do not erase or claim every official page agrees on £59.',
      'Checked 20 Oct 2026: homepage and /pricing presently advertise £59; conflict retained for diligence.',
    ],
  },
  {
    id: 'uxhm-salon-growth-booksy',
    name: 'UXHM + Booksy',
    packageName: 'Salon Growth + Booksy Biz',
    kind: 'named',
    primaryOrder: 5,
    delivery: {
      kind: 'done-for-you',
      label: 'Done-for-you website',
      summary:
        'UXHM builds the website. Booksy Biz is a separate third-party booking subscription — Booksy does not build the multi-page site.',
    },
    pricing: {
      figure: '£499',
      figureSecondary: '+ £66/mo',
      caption: 'Website build + Booksy (inc. VAT)',
      note: 'Optional UXHM care £20/mo · website VAT/domain to confirm',
      primary: '£499 one-off UXHM Salon Growth website + £66/month Booksy Biz including VAT for four users',
      secondary:
        'Booksy excl. VAT is £55/month (£40 base + 3 × £5). Optional UXHM Essential Care £20/month (first month often advertised free) is not unavoidable.',
      confidence: 'published',
      components: [
        'UXHM Salon Growth website build: £499 one-off',
        'Booksy Biz four users: £40 + 3 × £5 = £55/month excl. VAT → £66/month incl. 20% VAT',
        'Optional UXHM care: £20/month',
      ],
      unresolvedIssues: [
        'Website VAT treatment and domain costs require confirmation with UXHM',
        'Retail integration between UXHM site and Booksy is not confirmed',
        'Booksy payment-processing and optional Boost fees are separate',
      ],
    },
    features: {
      website: 'included',
      care: 'separate',
      booking: 'external',
      shopTools: 'not-confirmed',
    },
    billingModel:
      'One-off website project with UXHM plus a separate monthly Booksy Biz subscription. Optional website care is monthly and cancellable.',
    websiteDeliveryLong:
      'UXHM Salon Growth is a done-for-you website build (up to eight pages in the published Growth package, including relevant team and service pages). Booking software is purchased separately from Booksy — never imply Booksy builds the multi-page website.',
    bookingsRetail:
      'Booksy Biz supplies booking calendars, client tools, reminders and marketplace access. Retail integration with the UXHM site is not confirmed. Payment-processing fees are separate.',
    whatToCheck:
      'Budget both the £499 website build and ongoing Booksy fees. Confirm website VAT/domain, whether you need UXHM care, and that Booksy remains a separate vendor relationship.',
    whatToCheckShort:
      '£499 UXHM build + £66/mo Booksy (inc. VAT). Optional £20/mo care. Booking is a separate third-party service.',
    whatToCheckPoints: [
      'Done-for-you website by UXHM — Booksy does not build the site',
      '£499 one-off + £66/mo Booksy for four users (inc. VAT)',
      'Optional care £20/mo; retail integration not confirmed',
    ],
    bookingApproach: 'Separate Booksy Biz booking software',
    mobileHighlight: '£499 site + £66/mo Booksy · done-for-you website',
    sources: [
      {
        href: 'https://uxhm.co.uk/for-salons',
        label: 'UXHM salon websites',
        shortLabel: 'UXHM',
      },
      {
        href: 'https://biz.booksy.com/en-gb/pricing',
        label: 'Booksy UK pricing',
        shortLabel: 'Booksy',
      },
    ],
    researchNotes: [
      'Booksy four-user maths uses verified UK facts: £40 + 3×£5 = £55 excl. VAT; £66 incl. 20% VAT.',
      'UXHM Growth £499 and Care from £20/mo sourced from UXHM public product messaging (Apr 2026 LinkedIn / company materials).',
    ],
  },
  {
    id: 'full-kersivo',
    name: 'Full KERSIVO',
    packageName: 'Full KERSIVO',
    kind: 'kersivo',
    primaryOrder: 6,
    delivery: {
      kind: 'done-for-you',
      label: 'Done-for-you branded website',
      summary:
        'KERSIVO prepares a branded barbershop website within standard scope, with integrated booking and shop tools — not unlimited bespoke development.',
    },
    pricing: {
      figure: `£${SAAS_MONTHLY_GBP}`,
      caption: 'Per month / location',
      note: '£0 separate standard setup · no VAT currently added',
      primary: `£${SAAS_MONTHLY_GBP}/month per physical location`,
      secondary: 'No separate standard setup fee; no VAT currently added',
      confidence: 'published',
      components: [
        `£${SAAS_MONTHLY_GBP}/month covers one physical location`,
        'Four or six barbers at the same location included subject to fair use',
      ],
      unresolvedIssues: [
        'SMS is allowance-based, not unlimited',
        'Standard Stripe processing fees remain separate',
        'Premium domains and out-of-scope work may cost extra',
        'No guaranteed lifetime £39 price',
      ],
    },
    features: {
      website: 'included',
      care: 'included',
      booking: 'included',
      shopTools: 'included',
    },
    billingModel: 'Monthly subscription — billing starts on purchase',
    websiteDeliveryLong:
      'Done-for-you branded website within KERSIVO’s standard website scope, with standard own-domain arrangement, hosting, SSL and platform updates. Not unlimited bespoke website development and not a source-code handover product.',
    bookingsRetail:
      'Integrated appointment bookings and barber calendars, booking deposits, email confirmations/reminders, SMS appointment reminders (allowance applies), client management, admin dashboard, booking and retail reporting, and retail pickup shop. 0% KERSIVO commission on bookings and retail.',
    whatToCheck:
      'Standard Stripe payment-processing fees remain separate. SMS allowances and domain exceptions apply. Platform source code is not transferred on cancellation. Confirm fair-use barber limits for your location.',
    whatToCheckShort:
      'Stripe fees separate. SMS allowance applies. Four–six barbers at one location included subject to fair use; source code is not transferred.',
    whatToCheckPoints: [
      'Done-for-you branded website + integrated shop tools',
      '£39/mo per location — Stripe and SMS limits still apply',
      'Not unlimited bespoke development; no source-code handover',
    ],
    bookingApproach: 'Integrated bookings + retail pickup',
    mobileHighlight: '£39/mo · done-for-you website + bookings + retail',
    sources: [
      {
        href: '/pricing',
        label: 'View KERSIVO pricing',
        shortLabel: 'KERSIVO pricing',
      },
    ],
    emphasized: true,
    categoryLabel: 'Integrated platform',
    includedSummary: [
      'Branded website prepared for your shop',
      'Integrated bookings and barber calendars',
      'Retail pickup shop',
      'Hosting, SSL, updates and standard support',
    ],
    caveat: 'Standard Stripe payment-processing fees remain separate.',
    researchNotes: [
      'Align every advertised feature with the Commercial Offer and live product.',
      'Six-barber fair-use statement applies to KERSIVO only — do not extend to competitors.',
    ],
  },

  // —— Archived research (previous Section 02 rows; not rendered in primary six) ——
  {
    id: 'jones-digital',
    name: 'Jones Digital',
    packageName: 'Starter',
    kind: 'named',
    primaryOrder: null,
    delivery: {
      kind: 'done-for-you',
      label: 'Done-for-you website',
      summary: 'One-page Starter website prepared for the salon or barbershop.',
    },
    pricing: {
      figure: '£199',
      caption: 'One-off starter',
      note: 'Archived from prior comparison',
      primary: '£199 one-off Starter',
      confidence: 'published',
    },
    features: {
      website: 'included',
      care: 'separate',
      booking: 'not-in-tier',
      shopTools: 'not-in-tier',
    },
    billingModel: 'One-off Starter package; optional monthly care after 30 days',
    websiteDeliveryLong: 'One-page Starter website prepared for the salon or barbershop.',
    bookingsRetail: 'Starter is a website project, not a native booking platform.',
    whatToCheck: 'Confirm Starter versus higher barber packages advertised from £999.',
    whatToCheckShort: 'Archived research row — not in primary six-provider comparison.',
    whatToCheckPoints: ['Archived research row'],
    bookingApproach: 'Not included as a native booking platform in Starter',
    mobileHighlight: 'Archived',
    sources: [
      {
        href: 'https://jonesdigital.co.uk/for/salons/',
        label: 'Jones Digital salons',
        shortLabel: 'Jones Digital',
      },
    ],
    researchNotes: ['Retained for historical research; removed from primary comparison Oct 2026.'],
  },
  {
    id: 'fadefoundry',
    name: 'FadeFoundry',
    packageName: 'Founding Website',
    kind: 'named',
    primaryOrder: null,
    delivery: {
      kind: 'done-for-you',
      label: 'Done-for-you website',
      summary: 'One-page website prepared and maintained under founding offer.',
    },
    pricing: {
      figure: '£149',
      figureSecondary: '+ £12/mo',
      caption: 'Setup + monthly care',
      note: 'Archived from prior comparison',
      primary: '£149 setup + £12/month',
      confidence: 'published',
    },
    features: {
      website: 'included',
      care: 'included',
      booking: 'external',
      shopTools: 'not-in-tier',
    },
    billingModel: 'Founding offer with 12-month minimum care term',
    websiteDeliveryLong: 'One-page website prepared and maintained.',
    bookingsRetail: 'External booking links (Nearcut, Booksy, Fresha) — subscription separate.',
    whatToCheck: 'External booking SaaS and minimum term apply.',
    whatToCheckShort: 'Archived research row — not in primary six-provider comparison.',
    whatToCheckPoints: ['Archived research row'],
    bookingApproach: 'External booking links',
    mobileHighlight: 'Archived',
    sources: [
      {
        href: 'https://fadefoundry.co.uk/pricing/',
        label: 'FadeFoundry pricing',
        shortLabel: 'FadeFoundry',
      },
    ],
    researchNotes: ['Retained for historical research; removed from primary comparison Oct 2026.'],
  },
  {
    id: 'barberflow',
    name: 'BarberFlow',
    packageName: 'Starter',
    kind: 'named',
    primaryOrder: null,
    delivery: {
      kind: 'done-for-you',
      label: 'Done-for-you website',
      summary: 'Starter website package with hosting and basic support.',
    },
    pricing: {
      figure: '£149',
      figureSecondary: '+ £39/mo',
      caption: 'Setup + monthly',
      note: 'Archived from prior comparison',
      primary: '£149 setup + £39/month',
      confidence: 'published',
    },
    features: {
      website: 'included',
      care: 'included',
      booking: 'external',
      shopTools: 'not-in-tier',
    },
    billingModel: 'Published Starter package with hosting and basic support',
    websiteDeliveryLong: 'Premium barbershop website package as published for Starter.',
    bookingsRetail: 'Booking-link setup when needed — not a native booking platform.',
    whatToCheck: 'External booking and VAT/domain confirmation needed.',
    whatToCheckShort: 'Archived research row — not in primary six-provider comparison.',
    whatToCheckPoints: ['Archived research row'],
    bookingApproach: 'External booking-link setup',
    mobileHighlight: 'Archived',
    sources: [
      {
        href: 'https://barberflow.co.uk/',
        label: 'BarberFlow',
        shortLabel: 'BarberFlow',
      },
    ],
    researchNotes: ['Retained for historical research; removed from primary comparison Oct 2026.'],
  },
  {
    id: 'barberque',
    name: 'Barberque',
    packageName: 'Book & Pay',
    kind: 'named',
    primaryOrder: null,
    delivery: {
      kind: 'done-for-you',
      label: 'Done-for-you website',
      summary: 'Custom website design with Book & Pay booking package.',
    },
    pricing: {
      figure: '£50',
      caption: 'Per month excl. VAT',
      note: 'Archived from prior comparison',
      primary: '£50/month excluding VAT (Book & Pay)',
      confidence: 'conflict',
      unresolvedIssues: ['Free set up vs £80 website setup conflict on official site'],
    },
    features: {
      website: 'included',
      care: 'not-confirmed',
      booking: 'included',
      shopTools: 'not-confirmed',
    },
    billingModel: 'Monthly packages excluding VAT',
    websiteDeliveryLong: 'Custom website design with essential shop information.',
    bookingsRetail: 'Book & Pay includes online booking and payments via Stripe.',
    whatToCheck: 'Confirm setup fee conflict and VAT.',
    whatToCheckShort: 'Archived research row — not in primary six-provider comparison.',
    whatToCheckPoints: ['Archived research row'],
    bookingApproach: 'Integrated Book & Pay booking',
    mobileHighlight: 'Archived',
    sources: [
      {
        href: 'https://www.barberque.co.uk/',
        label: 'Barberque',
        shortLabel: 'Barberque',
      },
    ],
    researchNotes: ['Retained for historical research; removed from primary comparison Oct 2026.'],
  },
  {
    id: 'freelance',
    name: 'Freelance web developer',
    packageName: 'Custom project',
    kind: 'category',
    primaryOrder: null,
    delivery: {
      kind: 'not-confirmed',
      label: 'Project-dependent',
      summary: 'Depends on the individual contract.',
    },
    pricing: {
      figure: 'Custom quote',
      caption: 'Project-based',
      primary: 'Custom quote',
      confidence: 'custom-quote',
    },
    features: {
      website: 'project',
      care: 'project',
      booking: 'project',
      shopTools: 'project',
    },
    billingModel: 'One-off project fee and/or ongoing care — depends on the contract',
    websiteDeliveryLong: 'A personalised website project scoped with the developer.',
    bookingsRetail: 'Depends on project.',
    whatToCheck: 'Clarify ownership, hosting and booking support.',
    whatToCheckShort: 'Archived category row — not in primary six-provider comparison.',
    whatToCheckPoints: ['Archived research row'],
    bookingApproach: 'Depends on project',
    mobileHighlight: 'Archived',
    sources: [],
    researchNotes: ['Category research row retained; not shown in primary comparison.'],
  },
  {
    id: 'agency',
    name: 'Web design agency',
    packageName: 'Custom project',
    kind: 'category',
    primaryOrder: null,
    delivery: {
      kind: 'done-for-you',
      label: 'Done-for-you website',
      summary: 'Proposal-based agency website project.',
    },
    pricing: {
      figure: 'Custom quote',
      caption: 'Proposal-based',
      note: 'StudioDG example £2k–£6k template builds (not a UK average)',
      primary: 'Custom quote',
      confidence: 'custom-quote',
    },
    features: {
      website: 'project',
      care: 'project',
      booking: 'project',
      shopTools: 'project',
    },
    billingModel: 'Proposal-based project; hosting and maintenance often separate',
    websiteDeliveryLong: 'Bespoke or template-led design and development as agreed.',
    bookingsRetail: 'Depends on project.',
    whatToCheck: 'Confirm deliverables, ownership and ongoing fees.',
    whatToCheckShort: 'Archived category row — not in primary six-provider comparison.',
    whatToCheckPoints: ['Archived research row'],
    bookingApproach: 'Depends on project',
    mobileHighlight: 'Archived',
    sources: [
      {
        href: 'https://studiodigitalgroup.co.uk/insights/cost-of-a-website-uk-2026',
        label: 'StudioDG example',
        shortLabel: 'StudioDG example',
      },
    ],
    researchNotes: ['Category research row retained; not shown in primary comparison.'],
  },
] as const;

export function getCostOfferById(id: string): CostOffer | undefined {
  return BARBERSHOP_WEBSITE_COST_OFFERS.find((offer) => offer.id === id);
}

export function getPrimaryCostOffers(): CostOffer[] {
  return COST_OFFER_PRIMARY_IDS.map((id) => {
    const offer = getCostOfferById(id);
    if (!offer) {
      throw new Error(`Missing primary cost offer: ${id}`);
    }
    return offer;
  });
}
