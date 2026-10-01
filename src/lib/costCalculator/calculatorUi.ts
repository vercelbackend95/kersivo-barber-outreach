import { formatGbp, requireVerifiedFreshaFact } from '@/lib/seo/freshaFacts';

/**
 * Static UI configuration for the barber software cost calculator shell.
 * Phase 2 is input/results structure only: nothing in this module prices a provider.
 */

export const CALC_PANEL_LABEL = 'YOUR BARBERSHOP';

export type NumberFieldConfig = {
  id: string;
  name: string;
  label: string;
  helper?: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
};

export const BARBERS_FIELD: NumberFieldConfig = {
  id: 'calc-barbers',
  name: 'barbers',
  label: 'Bookable barbers',
  defaultValue: 3,
  min: 1,
  max: 30,
  step: 1,
};

export const APPOINTMENTS_FIELD: NumberFieldConfig = {
  id: 'calc-appointments',
  name: 'appointments',
  label: 'Monthly appointments',
  helper: 'Approximate total bookings across the shop.',
  defaultValue: 400,
  min: 0,
  max: 20000,
  step: 1,
};

export const APPOINTMENT_VALUE_FIELD: NumberFieldConfig = {
  id: 'calc-appointment-value',
  name: 'appointmentValue',
  label: 'Average appointment value',
  helper: 'In pounds sterling, per appointment.',
  defaultValue: 25,
  min: 0,
  max: 500,
  step: 0.5,
};

export const MARKETPLACE_HEADING = 'MARKETPLACE ACTIVITY';

export const MARKETPLACE_CLIENTS_FIELD: NumberFieldConfig = {
  id: 'calc-marketplace-clients',
  name: 'marketplaceClients',
  label: 'Qualifying new marketplace clients / month',
  helper:
    'Use this to model acquisition fees only. It does not assume each platform would generate the same number of clients.',
  defaultValue: 0,
  min: 0,
  max: 1000,
  step: 1,
};

export const BOOST_TOGGLE = {
  id: 'calc-boost',
  name: 'booksyBoost',
  label: 'Booksy Boost',
  helper: 'Optional paid promotion on the Booksy Marketplace. Leave off if you don’t use it.',
  defaultOn: false,
} as const;

export const SPLIT_ASSUMPTIONS_TOGGLE = {
  id: 'calc-split-assumptions',
  name: 'splitMarketplace',
  label: 'Use different assumptions for Booksy and Fresha',
  defaultOn: false,
} as const;

export const SPLIT_FIELDS: readonly NumberFieldConfig[] = [
  {
    id: 'calc-boost-clients',
    name: 'booksyBoostClients',
    label: 'Booksy Boost clients / month',
    defaultValue: 0,
    min: 0,
    max: 1000,
    step: 1,
  },
  {
    id: 'calc-fresha-marketplace-clients',
    name: 'freshaMarketplaceClients',
    label: 'Fresha Marketplace clients / month',
    defaultValue: 0,
    min: 0,
    max: 1000,
    step: 1,
  },
];

export const ADVANCED_COSTS_LABEL = 'Advanced costs';

export const VAT_OPTIONS = {
  name: 'vatRegistered',
  legend: 'VAT registered?',
  options: [
    { value: 'no', label: 'No' },
    { value: 'yes', label: 'Yes' },
  ],
  defaultValue: 'no',
} as const;

const smartWebsite = requireVerifiedFreshaFact('smartWebsiteAddOn');
const clientLoyalty = requireVerifiedFreshaFact('clientLoyaltyAddOn');

export type AddOnOption = {
  id: string;
  name: string;
  label: string;
  priceLabel: string;
};

export const FRESHA_ADD_ONS_LEGEND = 'Fresha add-ons';

export const FRESHA_ADD_ONS: readonly AddOnOption[] = [
  {
    id: 'calc-fresha-smart-website',
    name: 'freshaSmartWebsite',
    label: 'Smart Website',
    priceLabel: `${formatGbp(smartWebsite.amountGbp!)}/month + VAT`,
  },
  {
    id: 'calc-fresha-client-loyalty',
    name: 'freshaClientLoyalty',
    label: 'Client Loyalty',
    priceLabel: `${formatGbp(clientLoyalty.amountGbp!)}/location/month + VAT`,
  },
];

export const PAYMENTS_TOGGLE = {
  id: 'calc-payments',
  name: 'includePayments',
  label: 'Include payment processing',
  defaultOn: false,
  pendingNote:
    'Payment assumptions, such as card mix and online versus in-person payments, will be configured in the calculation stage.',
} as const;

/* --------------------------------- Results --------------------------------- */

export const RESULTS_HEADING = 'Your cost comparison';
export const RESULTS_SUPPORTING = 'Based on the barbershop numbers above.';

export type PeriodOption = {
  value: 'monthly' | 'annual' | 'threeYear';
  label: string;
  resultLabel: string;
};

export const PERIOD_OPTIONS: readonly PeriodOption[] = [
  { value: 'monthly', label: 'Monthly', resultLabel: 'Estimated monthly cost' },
  { value: 'annual', label: '12 months', resultLabel: 'Estimated 12-month cost' },
  { value: 'threeYear', label: '3 years', resultLabel: 'Estimated 3-year cost' },
];

export const DEFAULT_PERIOD: PeriodOption['value'] = 'monthly';

export const THREE_YEAR_NOTE =
  'Projection uses today’s published prices and does not predict future price changes.';

/** Shown wherever a monetary value will appear once the calculation is connected. */
export const PLACEHOLDER_VALUE = '—';
export const PLACEHOLDER_TOTAL = '£—';

export const SUMMARY_ROWS: readonly string[] = [
  'Platform & acquisition',
  'Payment processing',
  'VAT charged',
];

export type ProviderResultConfig = {
  id: 'booksy' | 'fresha' | 'kersivo';
  name: string;
  breakdown: readonly string[];
};

export const PROVIDER_RESULTS: readonly ProviderResultConfig[] = [
  {
    id: 'booksy',
    name: 'Booksy',
    breakdown: ['Base subscription', 'Additional users', 'Boost', 'VAT', 'Payment processing'],
  },
  {
    id: 'fresha',
    name: 'Fresha',
    breakdown: [
      'Subscription',
      'Marketplace fees',
      'Smart Website',
      'Client Loyalty',
      'VAT',
      'Payment processing',
    ],
  },
  {
    id: 'kersivo',
    name: 'KERSIVO',
    breakdown: ['Subscription', 'Additional barbers', 'KERSIVO commission', 'VAT', 'Stripe processing'],
  },
];

export const INSIGHT_EYEBROW = 'BIGGEST COST DRIVER';
export const INSIGHT_PENDING = 'Your cost insight will appear here once the calculation is connected.';
