import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { BARBERSHOP_WEBSITE_COST_PRICES_CHECKED_LABEL } from '@/lib/seo/barbershopWebsiteCostPage';

export type ScopeChipStatus =
  | 'included'
  | 'external'
  | 'separate'
  | 'project'
  | 'not-in-tier'
  | 'not-confirmed';

export type ScopeChipKey = 'website' | 'care' | 'booking' | 'shopTools';

export type ScopeChip = {
  key: ScopeChipKey;
  label: string;
  status: ScopeChipStatus;
  /** Full meaning for accessibility / disclosures. */
  statusLabel: string;
  /** Compact visible status in the Scope Snapshot matrix. */
  statusDisplay: string;
  /** Decorative status symbol; hide from assistive tech when statusDisplay is present. */
  statusSymbol: string;
};

export type WebsiteServiceComparisonOption = {
  id: string;
  name: string;
  kind: 'kersivo' | 'named' | 'category';
  scopeLabel: string;
  /** Large display amount for the price column (e.g. £39, £199, Custom quote). */
  priceFigure: string;
  /** Optional second figure line for setup + monthly packages. */
  priceFigureSecondary?: string;
  /** Uppercase billing caption under the figure. */
  priceCaption: string;
  /** Optional secondary note under the caption. */
  priceNote?: string;
  /** Kept for tests / longer mobile detail. */
  pricePrimary: string;
  priceSecondary?: string;
  billingModel: string;
  websiteDelivery: string;
  bookingsRetail: string;
  whatToCheck: string;
  /** Short cell copy for desktop What to check column. */
  whatToCheckShort: string;
  /** Scan-friendly micro-points for What to check (2–3 lines). */
  whatToCheckPoints: readonly string[];
  bookingApproach: string;
  mobileHighlight: string;
  scopeChips: readonly ScopeChip[];
  sourceHref?: string;
  sourceLabel?: string;
  /** Short link label for the footer cluster (e.g. Jones Digital). */
  sourceShortLabel?: string;
  emphasized?: boolean;
  /** Optional factual category label for featured row (e.g. Integrated platform). */
  categoryLabel?: string;
  includedSummary?: readonly string[];
  caveat?: string;
};

export const WEBSITE_SERVICE_COMPARISON_SECTION_ID = 'website-service-comparison';

export const WEBSITE_SERVICE_COMPARISON_PRICES_CHECKED_LABEL =
  BARBERSHOP_WEBSITE_COST_PRICES_CHECKED_LABEL;

/**
 * Primary desktop/mobile table order. Full catalogue remains in
 * WEBSITE_SERVICE_COMPARISON_OPTIONS for research/tests; freelance and agency
 * category rows are not rendered in the primary five-provider comparison.
 */
export const WEBSITE_SERVICE_COMPARISON_PRIMARY_IDS = [
  'jones-digital',
  'fadefoundry',
  'barberflow',
  'barberque',
  'full-kersivo',
] as const;

export function getPrimaryWebsiteServiceComparisonOptions(): WebsiteServiceComparisonOption[] {
  return WEBSITE_SERVICE_COMPARISON_PRIMARY_IDS.map((id) => {
    const row = WEBSITE_SERVICE_COMPARISON_OPTIONS.find((option) => option.id === id);
    if (!row) {
      throw new Error(`Missing primary comparison option: ${id}`);
    }
    return row;
  });
}

export const SCOPE_CHIP_LABELS: Record<ScopeChipKey, string> = {
  website: 'Website',
  care: 'Care',
  booking: 'Booking',
  shopTools: 'Shop tools',
};

const STATUS_META: Record<
  ScopeChipStatus,
  { label: string; display: string; symbol: string }
> = {
  included: { label: 'Included', display: 'Included', symbol: '✓' },
  external: { label: 'External link', display: 'External link', symbol: '↗' },
  separate: { label: 'Separate charge', display: 'Extra', symbol: '+' },
  project: { label: 'Project scope', display: 'Project', symbol: '·' },
  'not-in-tier': { label: 'Not in quoted tier', display: 'Not in tier', symbol: '—' },
  'not-confirmed': { label: 'Not publicly confirmed', display: 'Not confirmed', symbol: '?' },
};

function chips(
  statuses: Record<ScopeChipKey, ScopeChipStatus>,
): readonly ScopeChip[] {
  return (Object.keys(SCOPE_CHIP_LABELS) as ScopeChipKey[]).map((key) => {
    const meta = STATUS_META[statuses[key]];
    return {
      key,
      label: SCOPE_CHIP_LABELS[key],
      status: statuses[key],
      statusLabel: meta.label,
      statusDisplay: meta.display,
      statusSymbol: meta.symbol,
    };
  });
}

export const WEBSITE_SERVICE_COMPARISON_OPTIONS: readonly WebsiteServiceComparisonOption[] = [
  {
    id: 'full-kersivo',
    name: 'Full KERSIVO',
    kind: 'kersivo',
    scopeLabel: 'Integrated managed platform',
    priceFigure: `£${SAAS_MONTHLY_GBP}`,
    priceCaption: 'Per month / location',
    priceNote: '£0 separate standard setup · no VAT currently added',
    pricePrimary: `£${SAAS_MONTHLY_GBP}/month per physical location`,
    priceSecondary: '£0 separate standard setup fee; no VAT currently added',
    billingModel: 'Monthly subscription — billing starts on purchase',
    websiteDelivery:
      'Branded website prepared for your shop (standard scope), with standard own-domain arrangement, hosting, SSL and platform updates.',
    bookingsRetail:
      'Integrated online booking, retail pickup shop, and everyday shop management tools. 0% KERSIVO commission on bookings and retail.',
    whatToCheck:
      'Standard Stripe payment-processing fees remain separate. SMS allowances and domain exceptions apply. Platform source code is not transferred on cancellation.',
    whatToCheckShort:
      'Stripe processing fees separate. SMS and domain limits apply; platform source code is not transferred.',
    whatToCheckPoints: [
      'Stripe processing fees remain separate',
      'SMS allowances and domain exceptions apply',
      'Platform source code is not transferred on cancellation',
    ],
    bookingApproach: 'Integrated bookings + retail pickup',
    mobileHighlight: 'Website, bookings, retail and management in one monthly fee',
    scopeChips: chips({
      website: 'included',
      care: 'included',
      booking: 'included',
      shopTools: 'included',
    }),
    sourceHref: '/pricing',
    sourceLabel: 'View KERSIVO pricing',
    sourceShortLabel: 'KERSIVO pricing',
    emphasized: true,
    categoryLabel: 'Integrated platform',
    includedSummary: [
      'Branded website prepared for your shop',
      'Integrated bookings',
      'Retail pickup',
      'Shop management and hosting',
    ],
    caveat: 'Standard Stripe payment-processing fees remain separate.',
  },
  {
    id: 'jones-digital',
    name: 'Jones Digital',
    kind: 'named',
    scopeLabel: 'One-page Starter website',
    priceFigure: '£199',
    priceCaption: 'One-off starter',
    priceNote: '30 days’ post-launch care included',
    pricePrimary: '£199 one-off Starter',
    priceSecondary:
      '30 days’ post-launch care included; after that independent hosting is required (supplier Hosted £29/mo, Care £49/mo, Growth £129/mo are optional)',
    billingModel:
      'One-off Starter package; optional monthly care plans after the included 30 days; higher barber/salon packages and custom work priced separately',
    websiteDelivery:
      'One-page Starter website prepared for the salon or barbershop, live in about five days. Supplier advertises website and domain ownership for the customer. The barber/salon page also advertises fixed-price packages from £999 — a different published scope from the £199 Starter.',
    bookingsRetail:
      'Starter is a website project, not a native booking platform. Custom booking applications are separately scoped (custom work advertised from £1,999). The supplier may connect third-party booking systems in other packages.',
    whatToCheck:
      'After 30 days, hosting is separate — customers can use Jones Digital Hosted/Care/Growth plans or arrange hosting elsewhere. Confirm Starter versus Standard, Pro (£999) or Custom scopes. Do not treat the £199 Starter and £999+ barber packages as identical.',
    whatToCheckShort:
      '30 days’ care included. Hosting afterwards is separate; barber-focused packages also advertised from £999.',
    whatToCheckPoints: [
      '30 days’ post-launch care included; hosting afterwards is separate',
      'Optional Hosted £29 / Care £49 / Growth £129 per month, or host elsewhere',
      'Barber/salon packages also advertised from £999 — different published scope',
    ],
    bookingApproach: 'Not included as a native booking platform in Starter',
    mobileHighlight: '£199 one-page Starter; 30 days’ care then hosting separate',
    scopeChips: chips({
      website: 'included',
      care: 'separate',
      booking: 'not-in-tier',
      shopTools: 'not-in-tier',
    }),
    sourceHref: 'https://jonesdigital.co.uk/for/salons/',
    sourceLabel: 'View supplier pricing',
    sourceShortLabel: 'Jones Digital',
  },
  {
    id: 'fadefoundry',
    name: 'FadeFoundry',
    kind: 'named',
    scopeLabel: 'Founding Website offer',
    priceFigure: '£149',
    priceFigureSecondary: '+ £12/mo',
    priceCaption: 'Setup + monthly care',
    priceNote: 'First checkout £161 · 12-month minimum · £293 year 1',
    pricePrimary: '£149 setup + £12/month',
    priceSecondary:
      'First checkout £161; £293 over the 12-month minimum before any applicable VAT (founding offer)',
    billingModel:
      'Limited founding offer for qualifying UK shops; 12-month minimum care term. Prices exclude VAT unless checkout/invoice expressly states otherwise; legally applicable VAT is shown before payment.',
    websiteDelivery:
      'One-page website prepared and maintained, with hosting and routine maintenance included. One small content update per month under the published founding offer. Client retains domain/branding; FadeFoundry retains reusable source components under a perpetual licence with conditional static export — not outright ownership of all underlying code.',
    bookingsRetail:
      'Existing Nearcut, Booksy or Fresha booking links can be connected. A paid external booking platform subscription is separate — not an independently integrated booking platform.',
    whatToCheck:
      'Founding offer is limited. New domain, major changes and extra pages may cost extra. Early cancellation without qualifying contractual grounds leaves remaining minimum-term monthly charges payable. VAT follows published terms.',
    whatToCheckShort:
      '£161 upfront; £293 over 12 months. External booking and new domain extra; minimum term applies.',
    whatToCheckPoints: [
      '£161 first checkout; £293 over 12 paid months before applicable VAT',
      'External booking subscription and new domain charged separately',
      '12-month minimum; early exit can leave remaining months payable',
    ],
    bookingApproach: 'External booking links (subscription separate)',
    mobileHighlight: 'Founding offer; £293 first year; external booking SaaS separate',
    scopeChips: chips({
      website: 'included',
      care: 'included',
      booking: 'external',
      shopTools: 'not-in-tier',
    }),
    sourceHref: 'https://fadefoundry.co.uk/pricing/',
    sourceLabel: 'View supplier pricing',
    sourceShortLabel: 'FadeFoundry',
  },
  {
    id: 'barberflow',
    name: 'BarberFlow',
    kind: 'named',
    scopeLabel: 'Starter website package',
    priceFigure: '£149',
    priceFigureSecondary: '+ £39/mo',
    priceCaption: 'Setup + monthly',
    priceNote: 'Hosting and basic support included',
    pricePrimary: '£149 setup + £39/month',
    priceSecondary:
      'Launch offer: setup may be reduced or waived for qualifying early customers in exchange for a case study (3-month minimum applies to that arrangement)',
    billingModel:
      'Published Starter package with hosting and basic support. A separate Pro package (£249 setup + £59/month) adds an owner-editable backend and is outside this Starter comparison. VAT treatment and domain registration charges are not confirmed on the public site.',
    websiteDelivery:
      'Premium barbershop website with mobile-first design, services and prices, gallery and Google reviews section, plus call, directions and Instagram buttons. Hosting and basic support included in the published Starter price.',
    bookingsRetail:
      'Booking-link setup when needed (Booksy, Fresha, Square, Nearcut or similar). BarberFlow does not include a native booking system in Starter. Retail/shop-management platform features are outside the published Starter scope.',
    whatToCheck:
      'Starter only — do not attribute Pro backend features to this tier. Setup fee may be reduced or waived for qualifying early customers in exchange for a case study; a three-month minimum is stated for that discounted-setup arrangement. VAT, domain costs and any standard contract term outside that promotion should be confirmed with the supplier.',
    whatToCheckShort:
      'External booking separate. VAT, domain costs and standard contract term should be confirmed.',
    whatToCheckPoints: [
      'External booking-link setup — not a native booking platform',
      'Setup may be reduced/waived for early case-study customers (3-month minimum for that offer)',
      'VAT, domain costs and standard contract term not confirmed publicly',
    ],
    bookingApproach: 'External booking-link setup when needed',
    mobileHighlight: 'Starter £149 + £39/mo; booking link ≠ integrated platform',
    scopeChips: chips({
      website: 'included',
      care: 'included',
      booking: 'external',
      shopTools: 'not-in-tier',
    }),
    sourceHref: 'https://barberflow.co.uk/',
    sourceLabel: 'View supplier pricing',
    sourceShortLabel: 'BarberFlow',
    caveat:
      'Launch offer: setup fee can be reduced or waived for qualifying early customers in exchange for a case study; a three-month minimum applies when setup is discounted.',
  },
  {
    id: 'barberque',
    name: 'Barberque',
    kind: 'named',
    scopeLabel: 'Book & Pay package',
    priceFigure: '£50',
    priceCaption: 'Per month excl. VAT',
    priceNote: 'Book & Pay · Online Booking from £25/mo excl. VAT',
    pricePrimary: '£50/month excluding VAT (Book & Pay)',
    priceSecondary:
      'Online Booking available at £25/month excl. VAT (one calendar; +£5/mo excl. VAT per extra calendar). Website-only listed at £18/month excl. VAT.',
    billingModel:
      'Monthly packages excluding VAT. Cancel anytime is advertised. Setup messaging conflicts on the same page (“Free set up!” alongside “£80” for Website).',
    websiteDelivery:
      'Custom website design with essential shop information. Book & Pay includes the website plus online booking setup. The site simultaneously advertises “Free set up!” and an £80 Website price — confirm the current setup charge before purchase.',
    bookingsRetail:
      'Book & Pay includes online booking, deposits or full payment via Stripe, up to five calendars, and advertised unlimited SMS/email reminders. Stripe processing fees are separate. Wider retail/CRM platform capabilities are not confirmed from the public page.',
    whatToCheck:
      'All listed package prices exclude VAT. A cheaper Online Booking option is £25/month excl. VAT. The official site shows both “Free set up!” and “£80” for Website — do not treat either as a guaranteed unconditional setup fee without confirmation. Stripe fees apply on Book & Pay.',
    whatToCheckShort:
      'Online Booking from £25/mo excl. VAT. £80 website setup is listed alongside a free-setup claim — confirm the current charge.',
    whatToCheckPoints: [
      'Book & Pay £50/mo excl. VAT; Online Booking £25/mo excl. VAT',
      '“Free set up!” and £80 Website price both published — confirm current charge',
      'Stripe processing fees separate on Book & Pay',
    ],
    bookingApproach: 'Integrated online booking with payments (Book & Pay)',
    mobileHighlight: '£50/mo excl. VAT Book & Pay; setup fee conflict on official site',
    scopeChips: chips({
      website: 'included',
      care: 'not-confirmed',
      booking: 'included',
      shopTools: 'not-confirmed',
    }),
    sourceHref: 'https://www.barberque.co.uk/',
    sourceLabel: 'View supplier pricing',
    sourceShortLabel: 'Barberque',
  },
  {
    id: 'freelance',
    name: 'Freelance web developer',
    kind: 'category',
    scopeLabel: 'Custom project category',
    priceFigure: 'Custom quote',
    priceCaption: 'Project-based',
    priceNote: 'Fee and care depend on contract',
    pricePrimary: 'Custom quote',
    billingModel: 'One-off project fee and/or ongoing care — depends on the contract',
    websiteDelivery:
      'A personalised website project scoped with the developer. Design depth, pages and delivery timeline vary by agreement.',
    bookingsRetail:
      'Depends on project. Custom booking integrations and e-commerce are possible when specified — not assumed included.',
    whatToCheck:
      'Clarify code ownership, hosting responsibility, maintenance after launch, and who supports bookings once live.',
    whatToCheckShort:
      'Clarify ownership, hosting, maintenance and who supports bookings after launch.',
    whatToCheckPoints: [
      'Clarify code ownership and hosting responsibility',
      'Agree maintenance after launch',
      'Confirm who supports bookings once live',
    ],
    bookingApproach: 'Depends on project',
    mobileHighlight: 'Scope, ownership and ongoing care vary by contract',
    scopeChips: chips({
      website: 'project',
      care: 'project',
      booking: 'project',
      shopTools: 'project',
    }),
  },
  {
    id: 'agency',
    name: 'Web design agency',
    kind: 'category',
    scopeLabel: 'Custom project category',
    priceFigure: 'Custom quote',
    priceCaption: 'Proposal-based',
    priceNote: 'StudioDG example £2k–£6k template builds (not a UK average)',
    pricePrimary: 'Custom quote',
    priceSecondary:
      'Example template-based range £2,000–£6,000 cited by Studio Digital Group (not a UK average)',
    billingModel: 'Proposal-based project; hosting and maintenance often separate',
    websiteDelivery:
      'Bespoke or template-led design and development with CMS configuration as agreed in the proposal.',
    bookingsRetail:
      'Depends on project. Booking systems, e-commerce and custom integrations can be included when scoped and priced.',
    whatToCheck:
      'Confirm deliverables, ownership rights, ongoing fees and what happens after the build completes. The £2,000–£6,000 figure is an attributed publisher example for template-based builds, not a barbershop-specific quote.',
    whatToCheckShort:
      'Confirm deliverables, ownership and ongoing fees. £2k–£6k is an attributed template-build example, not a barbershop quote.',
    whatToCheckPoints: [
      'Confirm deliverables, ownership and ongoing fees',
      'Bookings/retail only if scoped in the proposal',
      '£2k–£6k is an attributed template-build example, not a barbershop quote',
    ],
    bookingApproach: 'Depends on project',
    mobileHighlight: 'Proposal-based; bookings/retail only if scoped',
    scopeChips: chips({
      website: 'project',
      care: 'project',
      booking: 'project',
      shopTools: 'project',
    }),
    sourceHref: 'https://studiodigitalgroup.co.uk/insights/cost-of-a-website-uk-2026',
    sourceLabel: 'View cited pricing example',
    sourceShortLabel: 'StudioDG example',
  },
] as const;
