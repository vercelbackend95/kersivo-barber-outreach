/**
 * Section 02 thin presentation adapter for `/barbershop-website-cost-uk`.
 *
 * Canonical supplier identity, prices, VAT confidence, feature/care status,
 * delivery classification, additional charges and evidence live in
 * `barbershopWebsiteCostOffers.ts`. This file may hold display-only wording
 * and archived research rows — never a second independent price catalogue.
 */

import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  WEBSITE_COST_CURRENT_FINDINGS,
  WEBSITE_COST_OFFERS,
  WEBSITE_COST_PRIMARY_IDS,
  WEBSITE_COST_RESEARCH_BUYER,
  WEBSITE_COST_RESEARCH_CHECKED_LABEL,
  formatWebsiteCostGbp,
  getComparableWebsiteCostFigures,
  requireWebsiteCostOfferById,
  type ComparisonScopeStatus,
  type CostPricingConfidence,
  type WebsiteCostPrimaryId,
  type WebsiteCostResearchedOffer,
  type WebsiteDeliveryKind,
} from '@/lib/seo/barbershopWebsiteCostOffers';

export type {
  ComparisonScopeStatus as CostOfferScopeStatus,
  CostPricingConfidence as CostOfferPricingConfidence,
  WebsiteDeliveryKind,
};

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
    confidence: CostPricingConfidence;
    components?: readonly string[];
    unresolvedIssues?: readonly string[];
  };
  features: {
    website: ComparisonScopeStatus;
    care: ComparisonScopeStatus;
    booking: ComparisonScopeStatus;
    shopTools: ComparisonScopeStatus;
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

export const COST_OFFERS_RESEARCH_CHECKED_LABEL = WEBSITE_COST_RESEARCH_CHECKED_LABEL;

/** Primary Section 02 order — identical to the canonical catalogue. */
export const COST_OFFER_PRIMARY_IDS = WEBSITE_COST_PRIMARY_IDS;

export type CostOfferPrimaryId = WebsiteCostPrimaryId;

export const WEBSITE_DELIVERY_KIND_LABELS: Record<WebsiteDeliveryKind, string> = {
  'self-build': 'Self-build website',
  'self-setup': 'Self-setup / configurable website',
  'platform-website': 'Platform website',
  'done-for-you': 'Done-for-you website',
  'not-confirmed': 'Website setup not confirmed',
};

type PresentationCopy = {
  name: string;
  packageName: string;
  kind: CostOffer['kind'];
  billingModel: string;
  websiteDeliveryLong: string;
  bookingsRetail: string;
  whatToCheck: string;
  whatToCheckShort: string;
  whatToCheckPoints: readonly string[];
  bookingApproach: string;
  mobileHighlight: (figures: ReturnType<typeof getComparableWebsiteCostFigures>) => string;
  sourceLabels: readonly { hrefMatch: string; label: string; shortLabel?: string }[];
  emphasized?: boolean;
  categoryLabel?: string;
  includedSummary?: readonly string[];
  caveat?: string;
  researchNotes?: readonly string[];
  pricingCaption: string;
  pricingNote?: string;
  pricingPrimary: (figures: ReturnType<typeof getComparableWebsiteCostFigures>) => string;
  pricingSecondary?: (figures: ReturnType<typeof getComparableWebsiteCostFigures>) => string;
  pricingComponents?: (figures: ReturnType<typeof getComparableWebsiteCostFigures>) => readonly string[];
  unresolvedIssues?: readonly string[];
};

const BARBERS = WEBSITE_COST_RESEARCH_BUYER.bookableBarbers;

const PRIMARY_PRESENTATION: Record<WebsiteCostPrimaryId, PresentationCopy> = {
  'vagaro-mysite': {
    name: 'Vagaro Pro + MySite',
    packageName: 'Vagaro Pro + MySite',
    kind: 'named',
    billingModel:
      'Monthly Vagaro Pro subscription scaled by bookable calendars, plus MySite after publish. Optional design and premium add-ons are separate.',
    websiteDeliveryLong:
      'Ordinary MySite is a self-build website builder and hosting layer. You configure and publish the site. Vagaro also advertises an optional professional design service (UK list price and limited-time promotions vary) — that is not the default MySite product.',
    bookingsRetail:
      'Integrated online booking, client management, reporting and online retail features are part of the Vagaro platform. Marketplace and payment fees may apply depending on use.',
    whatToCheck:
      'The published subscription subtotal is not a guaranteed all-in cost. Confirm VAT, domain charges, payment processing, marketplace fees and whether any professional design promotion still applies.',
    whatToCheckShort:
      'MySite is a builder, not an agency build. The published subtotal still excludes unverified VAT, domain and marketplace fees.',
    whatToCheckPoints: [
      'Self-build MySite — optional design is separate/promotional',
      `${BARBERS} calendars + MySite before unverified extras`,
      'Confirm VAT, domain, payments and marketplace fees',
    ],
    bookingApproach: 'Integrated Vagaro booking + calendars',
    mobileHighlight: (f) =>
      `${formatWebsiteCostGbp(f.recurringGbpPerMonth!)}/mo published subtotal · self-build MySite`,
    sourceLabels: [
      {
        hrefMatch: 'vagaro.com/en-gb/pro/pricing',
        label: 'Vagaro UK pricing',
        shortLabel: 'Vagaro pricing',
      },
      {
        hrefMatch: 'Vagaro-MySite-Pricing',
        label: 'Vagaro MySite pricing',
        shortLabel: 'MySite pricing',
      },
    ],
    researchNotes: [
      'Four-barber subtotal uses vagaroUkPublishedMonthlySubtotalGbp from the canonical catalogue.',
      'Do not treat limited-time free design promotions as a permanent entitlement.',
    ],
    pricingCaption: 'Per month · published subtotal',
    pricingNote: 'Promotional first calendar · VAT to confirm · extras may apply',
    pricingPrimary: (f) =>
      `${formatWebsiteCostGbp(f.recurringGbpPerMonth!)}/month published subscription subtotal for four calendars + MySite`,
    pricingSecondary: () =>
      '£20 first calendar + £30 for three additional calendars (£10 each) + £15 MySite. Not an all-inclusive cost.',
    pricingComponents: () => [
      'First bookable calendar: £20/month (advertised UK rate; limited-time framing on pricing)',
      'Three additional calendars: £10/month each (£30)',
      'MySite: £15/month after publish',
    ],
    unresolvedIssues: [
      'VAT applicability must be confirmed at checkout',
      'Domain charges, payment fees and marketplace fees may apply',
      'Optional professional MySite design (£699 UK list, sometimes free for a limited time) is separate from the published calendar + MySite subtotal',
    ],
  },
  'fresha-team-smart-website': {
    name: 'Fresha Team + Smart Website',
    packageName: 'Team + Smart Website',
    kind: 'named',
    billingModel:
      'Monthly Fresha Team subscription per bookable team member, plus optional Smart Website. Rates typically listed exclusive of VAT.',
    websiteDeliveryLong:
      'Fresha Smart Website is a configurable website layer you set up and maintain inside Fresha. Do not portray it as a bespoke website prepared by an agency.',
    bookingsRetail:
      'Bookings, calendars, client management, reporting, inventory and online product store options are part of the Fresha platform. Email/SMS allowances apply; marketplace and processing fees may apply.',
    whatToCheck:
      'Treat the ex-VAT subtotal as indicative UK research pending checkout confirmation. Confirm VAT, marketplace fees, SMS allowances and payment processing before budgeting.',
    whatToCheckShort:
      'Indicative ex-VAT subtotal. Self-configured Smart Website — marketplace, SMS and processing fees may apply.',
    whatToCheckPoints: [
      'Indicative UK subtotal — confirm official GBP checkout',
      'Self-configured Smart Website, not an agency build',
      'Marketplace, SMS and processing fees may apply',
    ],
    bookingApproach: 'Integrated Fresha booking + team calendars',
    mobileHighlight: (f) =>
      `Indicative ${formatWebsiteCostGbp(f.recurringGbpPerMonth!)}/mo excl. VAT · configurable Smart Website`,
    sourceLabels: [
      {
        hrefMatch: 'fresha.com',
        label: 'Fresha UK pricing',
        shortLabel: 'Fresha pricing',
      },
    ],
    researchNotes: [
      'Derived from freshaUkIndicatedMonthlySubtotalGbp in the canonical catalogue.',
      'Fresha.com geo-pricing can differ by locale — mark as indicative until checkout is verified.',
    ],
    pricingCaption: 'Indicative UK pricing / month',
    pricingNote: undefined,
    pricingPrimary: (f) =>
      `Indicative ${formatWebsiteCostGbp(f.recurringGbpPerMonth!)}/month excluding VAT for four Team seats + Smart Website`,
    pricingSecondary: (f) =>
      `${formatWebsiteCostGbp(f.recurringIncludingVatGbp!)}/month including 20% VAT if VAT applies at that rate`,
    pricingComponents: () => [
      `Four bookable Team members: 4 × £9.95/month`,
      'Smart Website add-on: £12.95/month',
    ],
    unresolvedIssues: [
      'Official GBP checkout should be re-confirmed before treating figures as contracted rates',
      'Marketplace new-client fees, SMS overages and payment processing are separate',
    ],
  },
  'nearcut-subscription': {
    name: 'Nearcut Subscription',
    packageName: 'Subscription',
    kind: 'named',
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
    mobileHighlight: () => 'Custom Subscription quote · personalised platform website',
    sourceLabels: [
      {
        hrefMatch: 'nearcut.com',
        label: 'Nearcut pricing',
        shortLabel: 'Nearcut',
      },
    ],
    researchNotes: [
      'Free for You example (£1.50 on a £20 cut) is a customer-fee model — not a verified shop invoice under Subscription.',
      'Hypothetical economic offset scenarios are research notes only and must not be shown as published Subscription pricing.',
    ],
    pricingCaption: 'Monthly subscription',
    pricingNote: 'Priced for shop needs and team size · not £1.50/booking',
    pricingPrimary: () => 'Custom monthly quote based on shop needs and team size',
    pricingSecondary: () =>
      'Customers do not pay an extra Nearcut booking fee under Subscription. Do not confuse with Nearcut’s separate Free for You customer-fee model.',
    unresolvedIssues: [
      'No public fixed four-barber GBP subscription figure to publish as a total',
      'Product sales/stock may require separately advertised UK Business Booster',
      'Retail pickup not confirmed from public materials',
    ],
  },
  'setora-core': {
    name: 'Setora',
    packageName: 'Platform plan',
    kind: 'named',
    billingModel:
      'Monthly platform subscription per location after trial. No per-staff fees advertised. SMS credits and card processing separate.',
    websiteDeliveryLong:
      'Setora Shop Websites provide a public brand/homepage and location pages that route to a Booking Page. Content is managed in the platform by the shop. This is not confirmed as a bespoke multi-page design service with gallery/retail parity to Full KERSIVO, and platform hosting is not the same as done-for-you content care.',
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
    mobileHighlight: (f) =>
      `${formatWebsiteCostGbp(f.recurringGbpPerMonth!)}/mo per location · platform Shop Website`,
    sourceLabels: [
      { hrefMatch: 'https://www.setora.co.uk/', label: 'Setora homepage', shortLabel: 'Setora' },
      {
        hrefMatch: 'https://www.setora.co.uk/pricing',
        label: 'Setora pricing',
        shortLabel: 'Setora pricing',
      },
    ],
    researchNotes: [
      'Owner decision (Oct 2026): show £59/month as the primary published amount via ownerApprovedRecurringGbp.',
      'Preserve £39 conflict in canonical conflictingPublishedRecurringGbp — do not erase it.',
      'Care column is not-in-tier: hosting ≠ supplier-managed website content care.',
    ],
    pricingCaption: 'Per month / location',
    pricingNote: 'Owner-selected headline · see pricing conflict note',
    pricingPrimary: (f) =>
      `${formatWebsiteCostGbp(f.recurringGbpPerMonth!)}/month per location (owner-selected published headline)`,
    pricingSecondary: () =>
      `Research also recorded a conflicting ${formatWebsiteCostGbp(WEBSITE_COST_CURRENT_FINDINGS.setoraOfficialSourceConflictGbp)}/month figure on an official pricing reading. VAT wording also conflicts across Setora pages — confirm live charged rate and tax status. Do not publish a guaranteed 12/36-month TCO until resolved.`,
    pricingComponents: () => [
      'Platform subscription per location',
      'Unlimited staff seats advertised',
    ],
    unresolvedIssues: [
      'Conflicting official price readings: £59 (homepage/Terms) vs £39 (alternate official pricing reading)',
      'VAT status unresolved across “exclude VAT where applicable” vs “not VAT-registered / no VAT currently added” wording',
      'SMS credits and Stripe processing are separate',
    ],
  },
  'uxhm-salon-growth': {
    name: 'UXHM + Booksy',
    packageName: 'Salon Growth + Booksy Biz',
    kind: 'named',
    billingModel:
      'One-off website project with UXHM plus a separate monthly Booksy Biz subscription. Optional website care is monthly and cancellable.',
    websiteDeliveryLong:
      'UXHM Salon Growth is a done-for-you website build (up to eight pages in the published Growth package, including relevant team and service pages). Booking software is purchased separately from Booksy — never imply Booksy builds the multi-page website.',
    bookingsRetail:
      'Booksy Biz supplies booking calendars, client tools, reminders and marketplace access. Retail integration with the UXHM site is not confirmed. Payment-processing fees are separate.',
    whatToCheck:
      'Budget both the website build and ongoing Booksy fees. Confirm website VAT/domain, whether you need UXHM care, and that Booksy remains a separate vendor relationship.',
    whatToCheckShort:
      'UXHM build + Booksy monthly (inc. VAT). Optional £20/mo care. Booking is a separate third-party service.',
    whatToCheckPoints: [
      'Done-for-you website by UXHM — Booksy does not build the site',
      'One-off UXHM build + Booksy for four users (inc. VAT)',
      'Optional care £20/mo; retail integration not confirmed',
    ],
    bookingApproach: 'Separate Booksy Biz booking software',
    mobileHighlight: (f) =>
      `${formatWebsiteCostGbp(f.setupGbp!)} site + ${formatWebsiteCostGbp(f.externalBooksyMonthlyIncVatGbp!)}/mo Booksy · done-for-you website`,
    sourceLabels: [
      { hrefMatch: 'uxhm.co.uk', label: 'UXHM salon websites', shortLabel: 'UXHM' },
      { hrefMatch: 'booksy.com', label: 'Booksy UK pricing', shortLabel: 'Booksy' },
    ],
    researchNotes: [
      'Booksy four-user maths uses getBooksyMonthlyPriceGbp from the canonical catalogue.',
      'UXHM Growth £499 and Care from £20/mo sourced from UXHM public product messaging.',
    ],
    pricingCaption: 'Website build + Booksy (inc. VAT)',
    pricingNote: 'Optional UXHM care £20/mo · website VAT/domain to confirm',
    pricingPrimary: (f) =>
      `${formatWebsiteCostGbp(f.setupGbp!)} one-off UXHM Salon Growth website + ${formatWebsiteCostGbp(f.externalBooksyMonthlyIncVatGbp!)}/month Booksy Biz including VAT for four users`,
    pricingSecondary: (f) =>
      `Booksy excl. VAT is ${formatWebsiteCostGbp(f.externalBooksyMonthlyExVatGbp!)}/month (£40 base + 3 × £5). Optional UXHM Essential Care £20/month (first month often advertised free) is not unavoidable.`,
    pricingComponents: (f) => [
      `UXHM Salon Growth website build: ${formatWebsiteCostGbp(f.setupGbp!)} one-off`,
      `Booksy Biz four users: £40 + 3 × £5 = ${formatWebsiteCostGbp(f.externalBooksyMonthlyExVatGbp!)}/month excl. VAT → ${formatWebsiteCostGbp(f.externalBooksyMonthlyIncVatGbp!)}/month incl. 20% VAT`,
      'Optional UXHM care: £20/month',
    ],
    unresolvedIssues: [
      'Website VAT treatment and domain costs require confirmation with UXHM',
      'Retail integration between UXHM site and Booksy is not confirmed',
      'Booksy payment-processing and optional Boost fees are separate',
    ],
  },
  'full-kersivo': {
    name: 'Full KERSIVO',
    packageName: 'Full KERSIVO',
    kind: 'kersivo',
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
      `£${SAAS_MONTHLY_GBP}/mo per location — Stripe and SMS limits still apply`,
      'Not unlimited bespoke development; no source-code handover',
    ],
    bookingApproach: 'Integrated bookings + retail pickup',
    mobileHighlight: (f) =>
      `${formatWebsiteCostGbp(f.recurringGbpPerMonth!)}/mo · done-for-you website + bookings + retail`,
    sourceLabels: [{ hrefMatch: '/pricing', label: 'View KERSIVO pricing', shortLabel: 'KERSIVO pricing' }],
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
      'Recurring price is SAAS_MONTHLY_GBP from the canonical Full KERSIVO record.',
      'Six-barber fair-use statement applies to KERSIVO only — do not extend to competitors.',
    ],
    pricingCaption: 'Per month / location',
    pricingNote: '£0 separate standard setup · no VAT currently added',
    pricingPrimary: (f) =>
      `${formatWebsiteCostGbp(f.recurringGbpPerMonth!)}/month per physical location`,
    pricingSecondary: () => 'No separate standard setup fee; no VAT currently added',
    pricingComponents: (f) => [
      `${formatWebsiteCostGbp(f.recurringGbpPerMonth!)}/month covers one physical location`,
      'Four or six barbers at the same location included subject to fair use',
    ],
    unresolvedIssues: [
      'SMS is allowance-based, not unlimited',
      'Standard Stripe processing fees remain separate',
      'Premium domains and out-of-scope work may cost extra',
      'No guaranteed lifetime £39 price',
    ],
  },
};

function mapSources(
  offer: WebsiteCostResearchedOffer,
  labels: PresentationCopy['sourceLabels'],
): CostOfferSource[] {
  const mapped: CostOfferSource[] = [];
  const used = new Set<string>();
  for (const rule of labels) {
    const exact = offer.sources.find((source) => source === rule.hrefMatch);
    const href =
      exact ??
      offer.sources.find(
        (source) => !used.has(source) && source.includes(rule.hrefMatch),
      );
    if (href) {
      used.add(href);
      mapped.push({
        href,
        label: rule.label,
        shortLabel: rule.shortLabel,
      });
    }
  }
  if (mapped.length === 0 && offer.sources[0]) {
    mapped.push({
      href: offer.sources[0],
      label: offer.provider,
      shortLabel: offer.provider,
    });
  }
  return mapped;
}

function buildPrimaryCostOffer(id: WebsiteCostPrimaryId, order: number): CostOffer {
  const offer = requireWebsiteCostOfferById(id);
  const copy = PRIMARY_PRESENTATION[id];
  const figures = getComparableWebsiteCostFigures(id);
  const delivery = offer.websiteDelivery;
  const scope = offer.comparisonScope;
  if (!delivery || !scope) {
    throw new Error(`Primary offer ${id} is missing websiteDelivery or comparisonScope`);
  }

  let figure: string;
  let figureSecondary: string | undefined;

  if (id === 'nearcut-subscription') {
    figure = 'Custom quote';
  } else if (id === 'uxhm-salon-growth') {
    figure = formatWebsiteCostGbp(figures.setupGbp!);
    figureSecondary = `+ ${formatWebsiteCostGbp(figures.externalBooksyMonthlyIncVatGbp!)}/mo`;
  } else {
    figure = formatWebsiteCostGbp(figures.recurringGbpPerMonth!);
    if (id === 'fresha-team-smart-website' && figures.recurringIncludingVatGbp != null) {
      figureSecondary = `${formatWebsiteCostGbp(figures.recurringIncludingVatGbp)} inc. VAT`;
    }
  }

  const pricingNote =
    id === 'fresha-team-smart-website'
      ? `Excl. VAT ${formatWebsiteCostGbp(figures.recurringGbpPerMonth!)} · confirm at official GBP checkout`
      : copy.pricingNote;

  return {
    id,
    name: copy.name,
    packageName: copy.packageName,
    kind: copy.kind,
    primaryOrder: order,
    delivery: {
      kind: delivery.kind,
      label: delivery.label,
      summary: delivery.summary,
    },
    pricing: {
      figure,
      figureSecondary,
      caption: copy.pricingCaption,
      note: pricingNote,
      primary: copy.pricingPrimary(figures),
      secondary: copy.pricingSecondary?.(figures),
      confidence: figures.confidence,
      components: copy.pricingComponents?.(figures),
      unresolvedIssues: copy.unresolvedIssues,
    },
    features: scope,
    billingModel: copy.billingModel,
    websiteDeliveryLong: copy.websiteDeliveryLong,
    bookingsRetail: copy.bookingsRetail,
    whatToCheck: copy.whatToCheck,
    whatToCheckShort: copy.whatToCheckShort,
    whatToCheckPoints: copy.whatToCheckPoints,
    bookingApproach: copy.bookingApproach,
    mobileHighlight: copy.mobileHighlight(figures),
    sources: mapSources(offer, copy.sourceLabels),
    emphasized: copy.emphasized,
    categoryLabel: copy.categoryLabel,
    includedSummary: copy.includedSummary,
    caveat: copy.caveat,
    researchNotes: copy.researchNotes,
  };
}

/** Archived prior Section 02 rows — not in the primary six; display-only history. */
const ARCHIVED_COST_OFFERS: readonly CostOffer[] = [
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
    researchNotes: [
      'Retained for historical research; removed from primary comparison Oct 2026.',
      'Canonical research package is jones-digital-pro — not this archived Starter row.',
    ],
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
    researchNotes: [
      'Retained for historical research; canonical id is fadefoundry-founding.',
    ],
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
    researchNotes: [
      'Retained for historical research; canonical research package is barberflow-pro.',
    ],
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
    researchNotes: [
      'Retained for historical research; canonical id is barberque-book-pay.',
    ],
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
];

export const BARBERSHOP_WEBSITE_COST_OFFERS: readonly CostOffer[] = [
  ...COST_OFFER_PRIMARY_IDS.map((id, index) => buildPrimaryCostOffer(id, index + 1)),
  ...ARCHIVED_COST_OFFERS,
];

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

/** Ensures the presentation adapter still resolves every canonical primary id. */
export function assertPrimaryOffersBoundToCanonicalCatalogue(): void {
  for (const id of COST_OFFER_PRIMARY_IDS) {
    requireWebsiteCostOfferById(id);
    const presentation = getCostOfferById(id);
    if (!presentation) {
      throw new Error(`Presentation adapter missing primary id ${id}`);
    }
    if (!WEBSITE_COST_OFFERS.some((offer) => offer.id === id)) {
      throw new Error(`Canonical catalogue missing primary id ${id}`);
    }
  }
}
