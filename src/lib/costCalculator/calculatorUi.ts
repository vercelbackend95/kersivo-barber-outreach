import { formatGbp, requireVerifiedFreshaFact, FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS } from '@/lib/seo/freshaFacts';
import type {
  CostScenarioInput,
  LineItemId,
  ProviderId,
  ValidationIssueCode,
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
  | 'freshaMarketplaceClients';

type BooleanScenarioKey = Exclude<keyof CostScenarioInput, NumericScenarioKey>;

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

export const PAYMENTS_TOGGLE = {
  id: 'calc-payments',
  name: 'includePayments',
  label: 'Include payment processing',
  defaultOn: false,
  unavailableNote: 'Payment processing comparison will be added in the next calculation stage.',
} as const satisfies ToggleConfig & { unavailableNote: string };

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
  vatRegistered: VAT_OPTIONS.defaultValue === 'yes',
  includePayments: false,
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
      { id: 'payment-processing', label: 'Payment processing' },
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
      { id: 'payment-processing', label: 'Payment processing' },
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
      { id: 'payment-processing', label: 'Stripe processing' },
    ],
  },
];

export const NOTES_LABEL = 'Assumptions & notes';
export const caveatLabel = (count: number) => (count === 1 ? '1 caveat' : `${count} caveats`);
export const SHARED_NOTES_LABEL = 'Assumptions used for all three';

export const INSIGHT_EYEBROW = 'BIGGEST COST DRIVER';
export const INSIGHT_INVALID = 'The cost driver will appear once the highlighted inputs are valid.';

/* -------------------------------- Validation -------------------------------- */

export const EXCEEDS_APPOINTMENTS_MESSAGE =
  'Marketplace clients cannot be greater than total monthly appointments.';

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
    case 'not-boolean':
      return 'Choose an option.';
    case 'exceeds-monthly-appointments':
      return EXCEEDS_APPOINTMENTS_MESSAGE;
  }
}

export const NUMBER_FIELDS: readonly NumberFieldConfig[] = [
  BARBERS_FIELD,
  APPOINTMENTS_FIELD,
  APPOINTMENT_VALUE_FIELD,
  MARKETPLACE_CLIENTS_FIELD,
  ...SPLIT_FIELDS,
];
