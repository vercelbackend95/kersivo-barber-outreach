import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { BARBERSHOP_WEBSITE_COST_PRICES_CHECKED_LABEL } from '@/lib/seo/barbershopWebsiteCostPage';

export type ScopeChipStatus =
  | 'included'
  | 'external'
  | 'separate'
  | 'project'
  | 'not-in-tier';

export type ScopeChipKey = 'website' | 'care' | 'booking' | 'shopTools';

export type ScopeChip = {
  key: ScopeChipKey;
  label: string;
  status: ScopeChipStatus;
  statusLabel: string;
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
 * Primary desktop/mobile table order (reference visual). Full catalogue remains in
 * WEBSITE_SERVICE_COMPARISON_OPTIONS for research/tests; BarberFlow, freelance and
 * agency are intentionally not rendered in the primary three-row comparison.
 */
export const WEBSITE_SERVICE_COMPARISON_PRIMARY_IDS = [
  'jones-digital',
  'fadefoundry',
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

const STATUS_LABEL: Record<ScopeChipStatus, string> = {
  included: 'Included',
  external: 'External link',
  separate: 'Separate charge',
  project: 'Project scope',
  'not-in-tier': 'Not in quoted tier',
};

function chips(
  statuses: Record<ScopeChipKey, ScopeChipStatus>,
): readonly ScopeChip[] {
  return (Object.keys(SCOPE_CHIP_LABELS) as ScopeChipKey[]).map((key) => ({
    key,
    label: SCOPE_CHIP_LABELS[key],
    status: statuses[key],
    statusLabel: STATUS_LABEL[statuses[key]],
  }));
}

export const WEBSITE_SERVICE_COMPARISON_OPTIONS: readonly WebsiteServiceComparisonOption[] = [
  {
    id: 'full-kersivo',
    name: 'Full KERSIVO',
    kind: 'kersivo',
    scopeLabel: 'Integrated managed platform',
    priceFigure: `£${SAAS_MONTHLY_GBP}`,
    priceCaption: 'Per month / location',
    priceNote: '£0 separate standard setup fee',
    pricePrimary: `£${SAAS_MONTHLY_GBP}/month per physical location`,
    priceSecondary: '£0 separate standard setup fee',
    billingModel: 'Monthly subscription — billing starts on purchase',
    websiteDelivery:
      'Branded website prepared for your shop (standard scope), with standard own-domain arrangement, hosting, SSL and platform updates.',
    bookingsRetail:
      'Integrated online booking, retail pickup shop, and everyday shop management tools. 0% KERSIVO commission on bookings and retail.',
    whatToCheck:
      'Standard Stripe payment-processing fees remain separate. SMS allowances and domain exceptions apply. Platform source code is not transferred on cancellation.',
    whatToCheckShort:
      'Stripe processing fees remain separate. Source code is not transferred on cancellation.',
    whatToCheckPoints: [
      'Stripe processing fees remain separate',
      'SMS allowances and domain exceptions apply',
      'Source code is not transferred on cancellation',
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
    scopeLabel: 'One-page website project',
    priceFigure: '£199',
    priceCaption: 'One-off starter',
    priceNote: 'Optional care from £29/month',
    pricePrimary: '£199 one-off',
    priceSecondary: 'Optional care from £29/month where selected',
    billingModel: 'One-off Starter package; higher tiers and custom work priced separately',
    websiteDelivery:
      'One-page Starter website prepared for the salon or barbershop. Supplier advertises website and domain ownership for the customer.',
    bookingsRetail:
      'Starter package is a website project — not an integrated native booking platform. More complex booking, e-commerce and custom tools are separately scoped.',
    whatToCheck:
      'Hosting/care is optional and separate. Confirm what the Starter package includes versus Standard, Pro or Custom quotes.',
    whatToCheckShort: 'Hosting/care optional. Integrated booking not included in Starter.',
    whatToCheckPoints: [
      'Hosting/care optional and separately charged',
      'Integrated booking not included in Starter',
      'Site and domain ownership advertised',
    ],
    bookingApproach: 'Not included as a native booking platform in Starter',
    mobileHighlight: 'One-page Starter; booking/e-commerce separately scoped',
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
    scopeLabel: 'Managed one-page founding offer',
    priceFigure: '£149',
    priceFigureSecondary: '+ £12/mo',
    priceCaption: 'Setup + monthly care',
    priceNote: 'First checkout £161 · 12-month minimum',
    pricePrimary: '£149 setup + £12/month',
    priceSecondary: 'First checkout £161 (founding offer)',
    billingModel: 'Limited founding offer for qualifying UK shops; 12-month minimum care term',
    websiteDelivery:
      'One-page website prepared and maintained, with hosting and routine maintenance included. One small content update per month under the published founding offer.',
    bookingsRetail:
      'Existing Nearcut, Booksy or Fresha booking links can be connected. A paid external booking platform subscription is separate — not an independently integrated booking platform.',
    whatToCheck:
      'Founding offer is not universally available. New domain, major changes and extra pages may cost extra.',
    whatToCheckShort: 'Limited founding offer. External booking subscription charged separately.',
    whatToCheckPoints: [
      'Limited founding offer; 12-month care minimum',
      'External booking subscription charged separately',
      'Extra pages and major changes cost more',
    ],
    bookingApproach: 'External booking links (subscription separate)',
    mobileHighlight: 'Founding offer; 12-month care; external booking SaaS separate',
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
    scopeLabel: 'Specialist barber website starter',
    priceFigure: '£149',
    priceFigureSecondary: '+ £39/mo',
    priceCaption: 'Setup + monthly',
    priceNote: 'Hosting and basic support included',
    pricePrimary: '£149 setup + £39/month',
    billingModel: 'Published Starter package with hosting and basic support',
    websiteDelivery:
      'Barbershop website with mobile-first design, services and prices, gallery and review section, plus contact and social links.',
    bookingsRetail:
      'Booking-link setup when needed — distinct from a proprietary integrated booking and shop-management system. Retail is outside the published Starter scope.',
    whatToCheck:
      'This comparison covers the published Starter package only. Other functions may be available under separate arrangements.',
    whatToCheckShort:
      'Starter package only. Booking-link setup is not an integrated booking platform. Retail outside published scope.',
    whatToCheckPoints: [
      'Published Starter package only',
      'Booking-link setup is not an integrated platform',
      'Retail outside the published Starter scope',
    ],
    bookingApproach: 'Booking-link setup when needed',
    mobileHighlight: 'Starter website package; booking link ≠ integrated platform',
    scopeChips: chips({
      website: 'included',
      care: 'included',
      booking: 'external',
      shopTools: 'not-in-tier',
    }),
    sourceHref: 'https://barberflow.co.uk/',
    sourceLabel: 'View supplier pricing',
    sourceShortLabel: 'BarberFlow',
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
