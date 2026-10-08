import { formatGbp, requireVerifiedFreshaFact, FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS } from '@/lib/seo/freshaFacts';
import { requireIllustrativeNearcutFact } from '@/lib/seo/nearcutFacts';
import {
  DEPOSIT_BENCHMARK_GBP,
  type CostScenarioInput,
  type LineItemId,
  type ProviderId,
  type ValidationIssueCode,
} from './barberSoftwareCostEngine';
import type { CostPeriod } from './costPeriod';

/**
 * Static UI configuration for the barber software cost calculator.
 * Labels and defaults only: provider costs come exclusively from the calculation engine.
 */

export const CALC_PANEL_LABEL = 'YOUR BARBERSHOP';

type NumericScenarioKey =
  | 'bookableBarbers'
  | 'monthlyAppointments'
  | 'averageAppointmentValueGbp'
  | 'marketplaceClients'
  | 'booksyBoostClients'
  | 'freshaMarketplaceClients'
  | 'depositBookingsPerMonth'
  | 'nearcutMonthlyQuoteGbp'
  | 'phorestMonthlyQuoteGbp';

type BooleanScenarioKey = Exclude<keyof CostScenarioInput, NumericScenarioKey | 'phorestQuoteVatPercent'>;

export type NumberFieldConfig = {
  id: string;
  name: NumericScenarioKey;
  label: string;
  helper?: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
};

export const BARBERS_FIELD: NumberFieldConfig = {
  id: 'calc-barbers',
  name: 'bookableBarbers',
  label: 'Bookable barbers',
  defaultValue: 3,
  min: 1,
  max: 30,
  step: 1,
};

export const APPOINTMENTS_FIELD: NumberFieldConfig = {
  id: 'calc-appointments',
  name: 'monthlyAppointments',
  label: 'Monthly appointments',
  helper: 'Approximate total bookings across the shop.',
  defaultValue: 400,
  min: 0,
  max: 20000,
  step: 1,
};

export const APPOINTMENT_VALUE_FIELD: NumberFieldConfig = {
  id: 'calc-appointment-value',
  name: 'averageAppointmentValueGbp',
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

type ToggleConfig = { id: string; name: BooleanScenarioKey; label: string; defaultOn: boolean };

export const BOOST_TOGGLE = {
  id: 'calc-boost',
  name: 'booksyBoostEnabled',
  label: 'Booksy Boost',
  helper: 'Optional paid promotion on the Booksy Marketplace. Leave off if you don’t use it.',
  defaultOn: false,
} as const satisfies ToggleConfig & { helper: string };

export const SPLIT_ASSUMPTIONS_TOGGLE = {
  id: 'calc-split-assumptions',
  name: 'splitMarketplaceAssumptions',
  label: 'Use different assumptions for Booksy and Fresha',
  defaultOn: false,
} as const satisfies ToggleConfig;

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
  defaultValue: 'no' as 'no' | 'yes',
} as const satisfies { name: BooleanScenarioKey } & Record<string, unknown>;

const smartWebsite = requireVerifiedFreshaFact('smartWebsiteAddOn');
const clientLoyalty = requireVerifiedFreshaFact('clientLoyaltyAddOn');

export type AddOnOption = {
  id: string;
  name: 'freshaSmartWebsite' | 'freshaClientLoyalty';
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

export const NEARCUT_SUBSCRIPTION_TOGGLE = {
  id: 'calc-nearcut-subscription',
  name: 'nearcutSubscription',
  label: 'Nearcut Subscription (instead of Free for You)',
  helper: 'Subscription removes the client booking charge. Pricing is quoted by Nearcut for your shop, plus VAT.',
  defaultOn: false,
  fieldsId: 'calc-nearcut-quote-fields',
} as const satisfies ToggleConfig & { helper: string; fieldsId: string };

export const NEARCUT_QUOTE_FIELD: NumberFieldConfig = {
  id: 'calc-nearcut-quote',
  name: 'nearcutMonthlyQuoteGbp',
  label: 'Your Nearcut monthly quote (ex VAT)',
  helper: 'Enter the monthly figure Nearcut quoted to your shop, excluding VAT. Leave 0 if unknown; the result will say Custom pricing.',
  defaultValue: 0,
  min: 0, max: 20000, step: 0.01,
};

export const PHOREST_QUOTE_FIELD: NumberFieldConfig = {
  id: 'calc-phorest-quote', name: 'phorestMonthlyQuoteGbp',
  label: 'Your Phorest monthly subscription quote (ex VAT)',
  helper: 'Enter only the subscription amount shown in your own Phorest quote, before VAT. Leave zero if unknown — no price is assumed.',
  defaultValue: 0, min: 0, max: 20000, step: 0.01,
};

/** 99 means unknown, so no Phorest cash total can be calculated yet. */
export const PHOREST_QUOTE_VAT = {
  name: 'phorestQuoteVatPercent',
  legend: 'Does your Phorest quote add VAT?',
  options: [
    { value: 99, label: 'Not sure' },
    { value: 20, label: 'Yes · standard UK VAT' },
    { value: 0, label: 'No VAT added' },
  ],
  defaultValue: 99,
} as const;

export const NEARCUT_EXAMPLE = requireIllustrativeNearcutFact('freeForYouCustomerBookingFeeExample');

export const DEPOSIT_PROCESSING_TOGGLE = {
  id: 'calc-deposit-processing',
  name: 'includeDepositProcessing',
  label: 'Include booking deposit processing',
  defaultOn: false,
  fieldsId: 'calc-deposit-fields',
} as const satisfies ToggleConfig & { fieldsId: string };

export const DEPOSIT_BOOKINGS_FIELD: NumberFieldConfig = {
  id: 'calc-deposit-bookings',
  name: 'depositBookingsPerMonth',
  label: 'Online bookings taking a deposit / month',
  helper: `Uses a ${formatGbp(DEPOSIT_BENCHMARK_GBP)} online deposit benchmark. Nearcut Free for You advertises zero transaction fees; Nearcut Subscription rates require confirmation. The remaining appointment balance and in-person card payments are not modelled.`,
  defaultValue: 0,
  min: 0,
  max: APPOINTMENTS_FIELD.max,
  step: 1,
};

/** Defaults shared by the server-rendered results and the form controls. */
export const DEFAULT_SCENARIO: CostScenarioInput = {
  bookableBarbers: BARBERS_FIELD.defaultValue,
  monthlyAppointments: APPOINTMENTS_FIELD.defaultValue,
  averageAppointmentValueGbp: APPOINTMENT_VALUE_FIELD.defaultValue,
  marketplaceClients: MARKETPLACE_CLIENTS_FIELD.defaultValue,
  booksyBoostEnabled: BOOST_TOGGLE.defaultOn,
  splitMarketplaceAssumptions: SPLIT_ASSUMPTIONS_TOGGLE.defaultOn,
  booksyBoostClients: SPLIT_FIELDS[0].defaultValue,
  freshaMarketplaceClients: SPLIT_FIELDS[1].defaultValue,
  freshaSmartWebsite: false,
  freshaClientLoyalty: false,
  nearcutSubscription: NEARCUT_SUBSCRIPTION_TOGGLE.defaultOn,
  nearcutMonthlyQuoteGbp: NEARCUT_QUOTE_FIELD.defaultValue,
  phorestMonthlyQuoteGbp: PHOREST_QUOTE_FIELD.defaultValue,
  phorestQuoteVatPercent: PHOREST_QUOTE_VAT.defaultValue,
  vatRegistered: VAT_OPTIONS.defaultValue === 'yes',
  includeDepositProcessing: DEPOSIT_PROCESSING_TOGGLE.defaultOn,
  depositBookingsPerMonth: DEPOSIT_BOOKINGS_FIELD.defaultValue,
};

/* --------------------------------- Results --------------------------------- */

export const RESULTS_HEADING = 'Your cost comparison';
export const RESULTS_SUPPORTING = 'Based on the barbershop numbers above.';
export const RESULTS_INVALID = 'Check the highlighted inputs to see your cost comparison.';

export type PeriodOption = {
  value: CostPeriod;
  label: string;
  resultLabel: string;
};

export const PERIOD_OPTIONS: readonly PeriodOption[] = [
  { value: 'monthly', label: 'Monthly', resultLabel: 'Estimated monthly cash cost' },
  { value: 'annual', label: '12 months', resultLabel: 'Estimated 12-month cash cost' },
  { value: 'threeYear', label: '3 years', resultLabel: 'Estimated 3-year cash cost' },
];

export const DEFAULT_PERIOD: CostPeriod = 'monthly';

export const periodResultLabel = (period: CostPeriod) =>
  PERIOD_OPTIONS.find((option) => option.value === period)!.resultLabel;

/** Listed with the shared assumptions whenever a projected period is selected. */
export const PROJECTION_ASSUMPTION =
  '12-month and 3-year projections assume the monthly scenario remains unchanged and use the currently stored provider prices.';

/** Visible under the period selector for the 3-year view only. */
export const THREE_YEAR_NOTE =
  'Projection uses today’s published prices and does not predict future price changes.';

/** Shown wherever a monetary value cannot be calculated from the current inputs. */
export const PLACEHOLDER_VALUE = '—';
export const PLACEHOLDER_TOTAL = '£—';
export const NOT_CALCULATED_SR = 'Not calculated. Check the highlighted inputs.';

export const NOT_INCLUDED = 'Not included';
export const NOT_ESTIMATED = 'Not estimated';
export const CUSTOM_PRICING = 'Custom pricing';
export const CUSTOM_PRICING_NOTE = `Fresha lists custom Enterprise pricing above ${FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS} bookable team members, so a complete total cannot be estimated.`;
export const PHOREST_CUSTOM_PRICING_NOTE = 'Phorest subscription pricing requires your own monthly quote and confirmed VAT treatment. Extra SMS, add-ons and PhorestPay fees are excluded. When deposit processing is selected for paid deposits, a complete total cannot be estimated without PhorestPay rates.';
export const NEARCUT_CUSTOM_PRICING_NOTE = 'Nearcut Subscription is quote-based. Enter your monthly quote excluding VAT. When online deposit processing is included, confirm your plan-specific processing rates with Nearcut; no full total is estimated without them.';
export const NET_IF_VAT_RECOVERABLE_LABEL = 'Estimated net if VAT is fully recoverable:';

export type SummaryRowId = 'before-vat' | 'vat' | 'payments';

export const SUMMARY_ROWS: readonly { id: SummaryRowId; label: string }[] = [
  { id: 'before-vat', label: 'Before VAT' },
  { id: 'vat', label: 'VAT charged' },
  { id: 'payments', label: 'Payment processing' },
];

/** Breakdown rows map to engine line items by id; `vat` maps to the provider VAT amount. */
export type BreakdownRowId = LineItemId | 'vat';

export type ProviderResultConfig = {
  id: ProviderId;
  name: string;
  breakdown: readonly { id: BreakdownRowId; label: string }[];
};

export const PROVIDER_RESULTS: readonly ProviderResultConfig[] = [
  {
    id: 'booksy',
    name: 'Booksy',
    breakdown: [
      { id: 'booksy-base-subscription', label: 'Base subscription' },
      { id: 'booksy-additional-users', label: 'Additional users' },
      { id: 'booksy-boost', label: 'Boost' },
      { id: 'vat', label: 'VAT' },
      { id: 'booksy-deposit-processing', label: 'Booking deposit processing' },
    ],
  },
  {
    id: 'fresha',
    name: 'Fresha',
    breakdown: [
      { id: 'fresha-subscription', label: 'Subscription' },
      { id: 'fresha-marketplace-fees', label: 'Marketplace fees' },
      { id: 'fresha-smart-website', label: 'Smart Website' },
      { id: 'fresha-client-loyalty', label: 'Client Loyalty' },
      { id: 'vat', label: 'VAT' },
      { id: 'fresha-deposit-processing', label: 'Booking deposit processing' },
    ],
  },
  {
    id: 'nearcut',
    name: 'Nearcut',
    breakdown: [
      { id: 'nearcut-subscription', label: 'Subscription / shop cost' },
      { id: 'vat', label: 'VAT' },
      { id: 'nearcut-deposit-processing', label: 'Online deposit processing' },
    ],
  },
  {
    id: 'setora',
    name: 'Setora',
    breakdown: [
      { id: 'setora-subscription', label: 'Subscription / location' },
      { id: 'setora-additional-staff', label: 'Additional staff' },
      { id: 'setora-commission', label: 'Setora commission' },
      { id: 'vat', label: 'VAT currently charged' },
      { id: 'setora-deposit-processing', label: 'Stripe deposit processing' },
    ],
  },
  {
    id: 'phorest',
    name: 'Phorest',
    breakdown: [
      { id: 'phorest-subscription', label: 'Your quoted subscription (ex VAT)' },
      { id: 'vat', label: 'VAT if confirmed' },
      { id: 'phorest-deposit-processing', label: 'PhorestPay deposit processing' },
    ],
  },
  {
    id: 'kersivo',
    name: 'KERSIVO',
    breakdown: [
      { id: 'kersivo-subscription', label: 'Subscription' },
      { id: 'kersivo-additional-barbers', label: 'Additional barbers' },
      { id: 'kersivo-commission', label: 'KERSIVO commission' },
      { id: 'vat', label: 'VAT' },
      { id: 'kersivo-deposit-processing', label: 'Stripe deposit processing' },
    ],
  },
];

export const SHARE_SCENARIO = {
  label: 'Copy scenario link',
  copied: 'Scenario link copied',
  failed: 'Could not copy link',
  invalid: 'Fix the highlighted inputs to copy a link',
} as const;

export const NOTES_LABEL = 'Assumptions & notes';
export const caveatLabel = (count: number) => (count === 1 ? '1 caveat' : `${count} caveats`);
export const SHARED_NOTES_LABEL = 'Shared assumptions';

export const INSIGHT_EYEBROW = 'BIGGEST COST DRIVER';
export const INSIGHT_INVALID = 'The cost driver will appear once the highlighted inputs are valid.';

/* -------------------------------- Validation -------------------------------- */

export const EXCEEDS_APPOINTMENTS_MESSAGE =
  'Marketplace clients cannot be greater than total monthly appointments.';

export const DEPOSIT_EXCEEDS_APPOINTMENTS_MESSAGE =
  'Bookings taking a deposit cannot be greater than total monthly appointments.';

export function validationMessage(code: ValidationIssueCode, field: NumberFieldConfig | null): string {
  switch (code) {
    case 'not-a-number':
      return 'Enter a number.';
    case 'not-finite':
      return 'Enter a realistic number.';
    case 'not-integer':
      return 'Enter a whole number.';
    case 'below-minimum':
      return field ? `Enter ${field.min} or more.` : 'Enter a larger number.';
    case 'invalid-phorest-vat':
      return 'Choose the VAT treatment shown in your Phorest quote.';
    case 'not-boolean':
      return 'Choose an option.';
    case 'exceeds-monthly-appointments':
      return EXCEEDS_APPOINTMENTS_MESSAGE;
    case 'deposit-bookings-exceed-monthly-appointments':
      return DEPOSIT_EXCEEDS_APPOINTMENTS_MESSAGE;
  }
}

export const NUMBER_FIELDS: readonly NumberFieldConfig[] = [
  BARBERS_FIELD,
  APPOINTMENTS_FIELD,
  APPOINTMENT_VALUE_FIELD,
  MARKETPLACE_CLIENTS_FIELD,
  ...SPLIT_FIELDS,
  DEPOSIT_BOOKINGS_FIELD,
  NEARCUT_QUOTE_FIELD,
  PHOREST_QUOTE_FIELD,
];
