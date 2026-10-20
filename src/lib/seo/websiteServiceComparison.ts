/**
 * Presentation adapter for Section 02.
 * Display wording: `barbershopWebsiteCostComparisonOffers.ts`
 * Canonical catalogue: `barbershopWebsiteCostOffers.ts`
 */

import {
  BARBERSHOP_WEBSITE_COST_OFFERS,
  COST_OFFER_PRIMARY_IDS,
  COST_OFFERS_COMPARISON_ASSUMPTION,
  COST_OFFERS_RESEARCH_CHECKED_LABEL,
  getPrimaryCostOffers,
  type CostOffer,
  type CostOfferScopeStatus,
  type WebsiteDeliveryKind,
} from '@/lib/seo/barbershopWebsiteCostComparisonOffers';

export type ScopeChipStatus = CostOfferScopeStatus;

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
  deliveryMethodKind: WebsiteDeliveryKind;
  deliveryMethodLabel: string;
  deliveryMethodSummary: string;
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
  /** Short link label for the footer cluster. */
  sourceShortLabel?: string;
  emphasized?: boolean;
  /** Optional factual category label for featured row (e.g. Integrated platform). */
  categoryLabel?: string;
  includedSummary?: readonly string[];
  caveat?: string;
  pricingConfidence?: CostOffer['pricing']['confidence'];
};

export const WEBSITE_SERVICE_COMPARISON_SECTION_ID = 'website-service-comparison';

export const WEBSITE_SERVICE_COMPARISON_PRICES_CHECKED_LABEL =
  COST_OFFERS_RESEARCH_CHECKED_LABEL;

export const WEBSITE_SERVICE_COMPARISON_ASSUMPTION = COST_OFFERS_COMPARISON_ASSUMPTION;

/**
 * Visible Care-column definition for Section 02 (desktop + mobile).
 * Hosting / platform uptime alone is not Care.
 */
export const WEBSITE_SERVICE_COMPARISON_CARE_NOTE =
  'Care means supplier-managed website content updates, not hosting alone.';

/**
 * Primary desktop/mobile table order (six providers).
 * Prices and identity come from WEBSITE_COST_OFFERS via the thin adapter.
 */
export const WEBSITE_SERVICE_COMPARISON_PRIMARY_IDS = COST_OFFER_PRIMARY_IDS;

export const SCOPE_CHIP_LABELS: Record<ScopeChipKey, string> = {
  website: 'Website',
  /** Supplier-managed website content care — not ordinary hosting alone. */
  care: 'Care',
  booking: 'Booking',
  shopTools: 'Shop tools',
};

const STATUS_META: Record<
  ScopeChipStatus,
  { label: string; display: string; symbol: string }
> = {
  included: { label: 'Included', display: 'Included', symbol: '✓' },
  external: { label: 'External / separate software', display: 'Separate software', symbol: '↗' },
  separate: { label: 'Separate charge', display: 'Extra', symbol: '+' },
  project: { label: 'Project scope', display: 'Project', symbol: '·' },
  'not-in-tier': { label: 'Not in quoted tier', display: 'Not in tier', symbol: '—' },
  'not-confirmed': { label: 'Not publicly confirmed', display: 'Not confirmed', symbol: '?' },
};

/** Care-column labels distinguish content care from hosting. */
const CARE_STATUS_META: Partial<
  Record<ScopeChipStatus, { label: string; display: string; symbol: string }>
> = {
  included: {
    label: 'Supplier-managed website content care included',
    display: 'Included',
    symbol: '✓',
  },
  separate: {
    label: 'Website content care available as a separate charge',
    display: 'Extra',
    symbol: '+',
  },
  'not-in-tier': {
    label: 'No done-for-you website content care in this tier (hosting alone does not count)',
    display: 'Not in tier',
    symbol: '—',
  },
  'not-confirmed': {
    label: 'Website content care not publicly confirmed',
    display: 'Not confirmed',
    symbol: '?',
  },
};

function chips(statuses: CostOffer['features']): readonly ScopeChip[] {
  return (Object.keys(SCOPE_CHIP_LABELS) as ScopeChipKey[]).map((key) => {
    const status = statuses[key];
    const meta =
      key === 'care' ? (CARE_STATUS_META[status] ?? STATUS_META[status]) : STATUS_META[status];
    return {
      key,
      label: SCOPE_CHIP_LABELS[key],
      status,
      statusLabel: meta.label,
      statusDisplay: meta.display,
      statusSymbol: meta.symbol,
    };
  });
}

function toComparisonOption(offer: CostOffer): WebsiteServiceComparisonOption {
  const primarySource = offer.sources[0];
  return {
    id: offer.id,
    name: offer.name,
    kind: offer.kind,
    scopeLabel: offer.packageName,
    deliveryMethodKind: offer.delivery.kind,
    deliveryMethodLabel: offer.delivery.label,
    deliveryMethodSummary: offer.delivery.summary,
    priceFigure: offer.pricing.figure,
    priceFigureSecondary: offer.pricing.figureSecondary,
    priceCaption: offer.pricing.caption,
    priceNote: offer.pricing.note,
    pricePrimary: offer.pricing.primary,
    priceSecondary: offer.pricing.secondary,
    billingModel: offer.billingModel,
    websiteDelivery: offer.websiteDeliveryLong,
    bookingsRetail: offer.bookingsRetail,
    whatToCheck: offer.whatToCheck,
    whatToCheckShort: offer.whatToCheckShort,
    whatToCheckPoints: offer.whatToCheckPoints,
    bookingApproach: offer.bookingApproach,
    mobileHighlight: offer.mobileHighlight,
    scopeChips: chips(offer.features),
    sourceHref: primarySource?.href,
    sourceLabel: primarySource?.label,
    sourceShortLabel: primarySource?.shortLabel ?? offer.name,
    emphasized: offer.emphasized,
    categoryLabel: offer.categoryLabel,
    includedSummary: offer.includedSummary,
    caveat: offer.caveat,
    pricingConfidence: offer.pricing.confidence,
  };
}

/** Full catalogue mapped for tests and research (includes archived rows). */
export const WEBSITE_SERVICE_COMPARISON_OPTIONS: readonly WebsiteServiceComparisonOption[] =
  BARBERSHOP_WEBSITE_COST_OFFERS.map(toComparisonOption);

export function getPrimaryWebsiteServiceComparisonOptions(): WebsiteServiceComparisonOption[] {
  return getPrimaryCostOffers().map(toComparisonOption);
}
