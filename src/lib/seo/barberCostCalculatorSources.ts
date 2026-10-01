import {
  BOOKSY_FACTS_CHECKED_DATE,
  BOOKSY_FACTS_CHECKED_ISO,
  BOOKSY_SOURCE_BOOST,
  BOOKSY_SOURCE_PRICING,
} from '@/lib/seo/booksyFacts';
import {
  FRESHA_FACTS_CHECKED_DATE,
  FRESHA_FACTS_CHECKED_ISO,
  type FreshaSourceId,
  getFreshaSource,
} from '@/lib/seo/freshaFacts';

export type CostCalculatorSource = {
  provider: 'Booksy' | 'Fresha' | 'KERSIVO';
  label: string;
  supports: string;
  url: string;
  external: boolean;
  checkedIso?: string;
  checkedLabel?: string;
};

const FRESHA_SOURCE_IDS: readonly FreshaSourceId[] = [
  'pricingUk',
  'marketplaceFee',
  'bookingLinks',
  'paymentsOverview',
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
  ...FRESHA_SOURCE_IDS.map((id) => {
    const source = getFreshaSource(id);
    return {
      provider: 'Fresha' as const,
      label: source.label,
      supports: source.supports,
      url: source.url,
      external: true,
      checkedIso: FRESHA_FACTS_CHECKED_ISO ?? undefined,
      checkedLabel: FRESHA_FACTS_CHECKED_DATE ?? undefined,
    };
  }),
  {
    provider: 'KERSIVO',
    label: 'KERSIVO pricing',
    supports: 'the flat monthly price per location, included barbers and 0% KERSIVO commission',
    url: '/#pricing',
    external: false,
  },
];
