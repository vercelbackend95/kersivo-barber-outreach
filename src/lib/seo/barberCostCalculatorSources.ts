import {
  BOOKSY_FACTS_CHECKED_DATE,
  BOOKSY_FACTS_CHECKED_ISO,
  BOOKSY_PAYMENT_FACTS_CHECKED_DATE,
  BOOKSY_PAYMENT_FACTS_CHECKED_ISO,
  BOOKSY_SOURCE_BOOST,
  BOOKSY_SOURCE_NO_SHOW_PROTECTION,
  BOOKSY_SOURCE_PAYMENTS,
  BOOKSY_SOURCE_PRICING,
} from '@/lib/seo/booksyFacts';
import {
  FRESHA_FACTS_CHECKED_DATE,
  FRESHA_FACTS_CHECKED_ISO,
  type FreshaSourceId,
  getFreshaSource,
} from '@/lib/seo/freshaFacts';
import { NEARCUT_FACTS_CHECKED_DATE, NEARCUT_FACTS_CHECKED_ISO, NEARCUT_SOURCES } from '@/lib/seo/nearcutFacts';
import { STRIPE_FACTS_CHECKED_DATE, STRIPE_FACTS_CHECKED_ISO, STRIPE_SOURCE_UK_PRICING } from '@/lib/seo/stripeFacts';

export type CostCalculatorSource = {
  provider: 'Booksy' | 'Fresha' | 'Nearcut' | 'Stripe' | 'KERSIVO';
  label: string;
  supports: string;
  url: string;
  external: boolean;
  checkedIso?: string;
  checkedLabel?: string;
};

/** Deposit payment facts were re-checked separately from the subscription facts. */
const PAYMENT_CHECK = { checkedIso: '2026-10-01', checkedLabel: '1 October 2026' } as const;

const FRESHA_SOURCES: readonly { id: FreshaSourceId; checked?: typeof PAYMENT_CHECK }[] = [
  { id: 'pricingUk' },
  { id: 'marketplaceFee' },
  { id: 'bookingLinks' },
  { id: 'paymentsOverview' },
  { id: 'paymentPolicies', checked: PAYMENT_CHECK },
];

export const COST_CALCULATOR_SOURCES: readonly CostCalculatorSource[] = [
  {
    provider: 'Booksy',
    label: 'Booksy UK Pricing',
    supports: 'UK base subscription, additional users, VAT and the standard Marketplace model',
    url: BOOKSY_SOURCE_PRICING,
    external: true,
    checkedIso: BOOKSY_FACTS_CHECKED_ISO,
    checkedLabel: BOOKSY_FACTS_CHECKED_DATE,
  },
  {
    provider: 'Booksy',
    label: 'Booksy Boost',
    supports: 'the optional Boost one-time new-client fee and its minimum',
    url: BOOKSY_SOURCE_BOOST,
    external: true,
    checkedIso: BOOKSY_FACTS_CHECKED_ISO,
    checkedLabel: BOOKSY_FACTS_CHECKED_DATE,
  },
  {
    provider: 'Booksy',
    label: 'Booksy No-Show Protection',
    supports: 'online booking deposits taken through Booksy Mobile Payments',
    url: BOOKSY_SOURCE_NO_SHOW_PROTECTION,
    external: true,
    checkedIso: BOOKSY_PAYMENT_FACTS_CHECKED_ISO,
    checkedLabel: BOOKSY_PAYMENT_FACTS_CHECKED_DATE,
  },
  {
    provider: 'Booksy',
    label: 'Booksy Payments',
    supports: 'the Mobile Payments processing rate used for deposits',
    url: BOOKSY_SOURCE_PAYMENTS,
    external: true,
    checkedIso: BOOKSY_PAYMENT_FACTS_CHECKED_ISO,
    checkedLabel: BOOKSY_PAYMENT_FACTS_CHECKED_DATE,
  },
  ...FRESHA_SOURCES.map(({ id, checked }) => {
    const source = getFreshaSource(id);
    return {
      provider: 'Fresha' as const,
      label: source.label,
      supports: source.supports,
      url: source.url,
      external: true,
      checkedIso: checked?.checkedIso ?? FRESHA_FACTS_CHECKED_ISO ?? undefined,
      checkedLabel: checked?.checkedLabel ?? FRESHA_FACTS_CHECKED_DATE ?? undefined,
    };
  }),
  ...NEARCUT_SOURCES.map((source) => ({
    provider: 'Nearcut' as const,
    label: source.label,
    supports: source.supports,
    url: source.url,
    external: true,
    checkedIso: NEARCUT_FACTS_CHECKED_ISO,
    checkedLabel: NEARCUT_FACTS_CHECKED_DATE,
  })),
  {
    provider: 'Stripe',
    label: 'Stripe UK pricing',
    supports: 'the standard UK card rate used for KERSIVO deposits through Stripe Checkout',
    url: STRIPE_SOURCE_UK_PRICING,
    external: true,
    checkedIso: STRIPE_FACTS_CHECKED_ISO,
    checkedLabel: STRIPE_FACTS_CHECKED_DATE,
  },
  {
    provider: 'KERSIVO',
    label: 'KERSIVO pricing',
    supports: 'the flat monthly price per location, included barbers and 0% KERSIVO commission',
    url: '/#pricing',
    external: false,
  },
];
