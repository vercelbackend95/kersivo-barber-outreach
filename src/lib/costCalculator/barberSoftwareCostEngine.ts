/**
 * Pure monthly cost engine for Booksy, Fresha, Nearcut, Treatwell, Setora, Square, Phorest and KERSIVO.
 *
 * No DOM, browser or Astro dependencies. Every price comes from the central facts modules.
 * Payment processing covers online booking deposits only; multi-period projections live elsewhere.
 */

import {
  BOOKSY_ADDITIONAL_USER_GBP,
  BOOKSY_BASE_PRICE_GBP,
  BOOKSY_BOOST_COMMISSION_PERCENT,
  BOOKSY_BOOST_MINIMUM_GBP,
  BOOKSY_MOBILE_PAYMENTS_FIXED_GBP,
  BOOKSY_MOBILE_PAYMENTS_PERCENT,
  BOOKSY_MOBILE_PAYMENTS_VAT,
  BOOKSY_PRICES_VAT,
} from '@/lib/seo/booksyFacts';
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_ADDS_VAT, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS,
  formatGbp,
  formatPercent,
  requireVerifiedFreshaFact,
  type FreshaCommercialFactKey,
  type VerifiedCommercialFact,
} from '@/lib/seo/freshaFacts';
import {
  KERSIVO_DEPOSIT_APPLICATION_FEE_GBP,
  STRIPE_CARD_CAVEAT,
  STRIPE_FEE_PAYER_CAVEAT,
  STRIPE_FEE_VAT_CHARGED,
  STRIPE_UK_STANDARD_CARD_FIXED_GBP,
  STRIPE_UK_STANDARD_CARD_PERCENT,
} from '@/lib/seo/stripeFacts';
import { requireVerifiedNearcutFact } from '@/lib/seo/nearcutFacts';
import { TREATWELL_QUOTE_VAT_UNKNOWN, requireVerifiedTreatwellFact } from '@/lib/seo/treatwellFacts';
import { requireVerifiedSetoraFact } from '@/lib/seo/setoraFacts';
import { PHOREST_QUOTE_VAT_UNKNOWN, useUserProvidedPhorestMonthlyQuoteGbp } from '@/lib/seo/phorestFacts';
import { SQUARE_CALCULATOR_LIMITS, SQUARE_PAYMENT_CHANNEL_FACTS, squareBaseMonthlyPriceGbp, type SquarePlanId } from '@/lib/seo/squareFacts';
import { gbpToPence, penceToGbp, percentOfPence, transactionFeePence } from './money';
import { UK_STANDARD_VAT_PERCENT } from './vat';

/* ---------------------------------- Input ---------------------------------- */

export type CostScenarioInput = {
  bookableBarbers: number;
  monthlyAppointments: number;
  averageAppointmentValueGbp: number;
  marketplaceClients: number;
  booksyBoostEnabled: boolean;
  splitMarketplaceAssumptions: boolean;
  booksyBoostClients: number;
  freshaMarketplaceClients: number;
  /** Eligible Treatwell new-marketplace appointments, not all first-time clients; September 2026 eligibility terms apply. */
  treatwellMarketplaceClients: number;
  freshaSmartWebsite: boolean;
  freshaClientLoyalty: boolean;
  nearcutSubscription: boolean;
  /** Shop-provided Nearcut Subscription quote before VAT; 0 means not known. */
  nearcutMonthlyQuoteGbp: number;
  /** Real Treatwell monthly software quote (ex VAT); 0 means unknown, not a free subscription. */
  treatwellMonthlyQuoteGbp: number;
  /** Treatwell quote VAT treatment: 99 unknown; 0 no VAT; 20 standard UK VAT. */
  treatwellQuoteVatPercent: number;
  /** Actual shop-provided Phorest monthly subscription quote, before VAT. 0 = unknown. */
  phorestMonthlyQuoteGbp: number;
  /** VAT treatment confirmed from the actual quote: 99 unknown, 0 no VAT, 20 UK standard VAT. */
  phorestQuoteVatPercent: number;
  /** Square Appointments UK subscription, chosen independently from the other providers. */
  squarePlan: SquarePlanId;
  vatRegistered: boolean;
  includeDepositProcessing: boolean;
  /** Only read and validated when `includeDepositProcessing` is true. */
  depositBookingsPerMonth: number;
};

/** The same online booking deposit is modelled for every provider. */
export const DEPOSIT_BENCHMARK_GBP = KERSIVO_BOOKING_DEPOSIT_GBP;

export type ValidationIssueCode =
  | 'not-a-number'
  | 'not-finite'
  | 'not-integer'
  | 'below-minimum'
  | 'not-boolean'
  | 'exceeds-monthly-appointments'
  | 'deposit-bookings-exceed-monthly-appointments'
  | 'invalid-phorest-vat'
  | 'invalid-treatwell-vat';

export type ValidationIssue = {
  field: keyof CostScenarioInput;
  code: ValidationIssueCode;
};

type NumberRule = { integer: boolean; min: number };

const NUMBER_RULES: Record<
  | 'bookableBarbers'
  | 'monthlyAppointments'
  | 'averageAppointmentValueGbp'
  | 'marketplaceClients'
  | 'booksyBoostClients'
  | 'freshaMarketplaceClients'
  | 'treatwellMarketplaceClients',
  NumberRule
> = {
  bookableBarbers: { integer: true, min: 1 },
  monthlyAppointments: { integer: true, min: 0 },
  averageAppointmentValueGbp: { integer: false, min: 0 },
  marketplaceClients: { integer: true, min: 0 },
  booksyBoostClients: { integer: true, min: 0 },
  freshaMarketplaceClients: { integer: true, min: 0 },
  treatwellMarketplaceClients: { integer: true, min: 0 },
};

const BOOLEAN_FIELDS = [
  'booksyBoostEnabled',
  'splitMarketplaceAssumptions',
  'freshaSmartWebsite',
  'freshaClientLoyalty',
  'nearcutSubscription',
  'vatRegistered',
  'includeDepositProcessing',
] as const satisfies readonly (keyof CostScenarioInput)[];

const DEPOSIT_BOOKINGS_RULE: NumberRule = { integer: true, min: 0 };

function numberIssue(field: keyof CostScenarioInput, value: unknown, rule: NumberRule): ValidationIssue | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return { field, code: 'not-a-number' };
  if (!Number.isFinite(value)) return { field, code: 'not-finite' };
  if (rule.integer && !Number.isInteger(value)) return { field, code: 'not-integer' };
  if (value < rule.min) return { field, code: 'below-minimum' };
  return null;
}

export function validateCostScenario(input: CostScenarioInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [field, rule] of Object.entries(NUMBER_RULES) as [keyof typeof NUMBER_RULES, NumberRule][]) {
    const issue = numberIssue(field, input[field], rule);
    if (issue) issues.push(issue);
  }

  for (const field of BOOLEAN_FIELDS) {
    if (typeof input[field] !== 'boolean') issues.push({ field, code: 'not-boolean' });
  }

  if (!['free', 'plus', 'premium'].includes(input.squarePlan)) issues.push({ field: 'squarePlan', code: 'not-a-number' });
  issues.push(...validateMarketplaceAgainstAppointments(input, issues));
  issues.push(...validateDepositBookings(input, issues));
  const treatwellQuoteIssue = numberIssue('treatwellMonthlyQuoteGbp', input.treatwellMonthlyQuoteGbp, { integer: false, min: 0 });
  if (treatwellQuoteIssue) issues.push(treatwellQuoteIssue);
  if (![TREATWELL_QUOTE_VAT_UNKNOWN, 0, UK_STANDARD_VAT_PERCENT].includes(input.treatwellQuoteVatPercent)) issues.push({ field: 'treatwellQuoteVatPercent', code: 'invalid-treatwell-vat' });
  const phorestQuoteIssue = numberIssue('phorestMonthlyQuoteGbp', input.phorestMonthlyQuoteGbp, { integer: false, min: 0 });
  if (phorestQuoteIssue) issues.push(phorestQuoteIssue);
  if (![PHOREST_QUOTE_VAT_UNKNOWN, 0, UK_STANDARD_VAT_PERCENT].includes(input.phorestQuoteVatPercent)) issues.push({ field: 'phorestQuoteVatPercent', code: 'invalid-phorest-vat' });
  if (input.nearcutSubscription === true) {
    const quoteIssue = numberIssue('nearcutMonthlyQuoteGbp', input.nearcutMonthlyQuoteGbp, { integer: false, min: 0 });
    if (quoteIssue) issues.push(quoteIssue);
  }
  return issues;
}

/**
 * Deposit bookings are a subset of monthly appointments. A stale value is ignored while
 * deposit processing is off, so it can never block the rest of the calculation.
 */
function validateDepositBookings(input: CostScenarioInput, basicIssues: readonly ValidationIssue[]): ValidationIssue[] {
  if (input.includeDepositProcessing !== true) return [];
  const field = 'depositBookingsPerMonth';
  const issue = numberIssue(field, input[field], DEPOSIT_BOOKINGS_RULE);
  if (issue) return [issue];
  if (basicIssues.some((entry) => entry.field === 'monthlyAppointments')) return [];
  return input[field] > input.monthlyAppointments
    ? [{ field, code: 'deposit-bookings-exceed-monthly-appointments' }]
    : [];
}

/**
 * Qualifying new marketplace clients are appointments within the same month, so the active
 * counts cannot exceed monthly appointments. Inactive fields are never checked.
 */
function validateMarketplaceAgainstAppointments(
  input: CostScenarioInput,
  basicIssues: readonly ValidationIssue[],
): ValidationIssue[] {
  const invalid = new Set(basicIssues.map((issue) => issue.field));
  if (invalid.has('monthlyAppointments') || invalid.has('splitMarketplaceAssumptions')) return [];

  const active: (keyof typeof NUMBER_RULES)[] = input.splitMarketplaceAssumptions
    ? ['freshaMarketplaceClients', 'treatwellMarketplaceClients']
    : ['marketplaceClients'];
  if (input.splitMarketplaceAssumptions && input.booksyBoostEnabled === true) {
    active.unshift('booksyBoostClients');
  }

  return active
    .filter((field) => !invalid.has(field) && input[field] > input.monthlyAppointments)
    .map((field) => ({ field, code: 'exceeds-monthly-appointments' }));
}

/* --------------------------------- Results --------------------------------- */

export type ProviderId = 'booksy' | 'fresha' | 'nearcut' | 'treatwell' | 'setora' | 'square' | 'phorest' | 'kersivo';

export type CostCategory =
  | 'subscription'
  | 'team-or-users'
  | 'acquisition'
  | 'add-ons'
  | 'commission'
  | 'payment-processing';

export type LineItemId =
  | 'booksy-base-subscription'
  | 'booksy-additional-users'
  | 'booksy-boost'
  | 'fresha-subscription'
  | 'fresha-marketplace-fees'
  | 'fresha-smart-website'
  | 'fresha-client-loyalty'
  | 'nearcut-subscription'
  | 'nearcut-deposit-processing'
  | 'treatwell-subscription'
  | 'treatwell-new-client-commission'
  | 'treatwell-deposit-processing'
  | 'setora-subscription'
  | 'setora-additional-staff'
  | 'setora-commission'
  | 'setora-deposit-processing'
  | 'phorest-subscription'
  | 'phorest-deposit-processing'
  | 'square-subscription'
  | 'square-deposit-processing'
  | 'kersivo-subscription'
  | 'kersivo-additional-barbers'
  | 'kersivo-commission'
  | 'booksy-deposit-processing'
  | 'fresha-deposit-processing'
  | 'kersivo-deposit-processing';

export type LineItemStatus = 'calculated' | 'custom-pricing' | 'not-included';

export type PaymentMethod = 'booksy-mobile-payments' | 'fresha-online-payments' | 'nearcut-free-online-payments' | 'stripe-setora-standard-uk-card' | 'stripe-checkout-standard-uk-card' | 'treatwell-online-prepayment';

export type CostLineItem = {
  id: LineItemId;
  category: CostCategory;
  status: LineItemStatus;
  /** Null only when the provider does not publish a price (custom pricing). */
  exVatGbp: number | null;
  vatApplies: boolean;
  quantity: number;
  unitExVatGbp: number | null;
  plan?: 'independent' | 'team' | 'enterprise' | SquarePlanId;
  /** Source headline shown only where its VAT basis is unresolved (NOT an ex-VAT amount). */
  publishedHeadlineGbp?: number;
  /** Deposit processing lines only. */
  paymentMethod?: PaymentMethod;
};

export type MonthlyAmounts = {
  subscriptionExVatGbp: number;
  teamOrUserFeesExVatGbp: number;
  acquisitionFeesExVatGbp: number;
  addOnsExVatGbp: number;
  commissionExVatGbp: number;
  /** Online booking deposit processing only; 0 when not included, which does not mean free. */
  paymentProcessingExVatGbp: number;
  subtotalExVatGbp: number;
  vatChargedGbp: number;
  cashTotalGbp: number;
  /** Ex-VAT cost for VAT-registered scenarios; null otherwise. Not tax advice. */
  estimatedNetCostIfVatRecoverableGbp: number | null;
};

export type AssumptionCode =
  | 'single-location'
  | 'shared-marketplace-clients'
  | 'split-marketplace-clients'
  | 'booksy-users-equal-bookable-barbers'
  | 'booksy-boost-first-visit-equals-average-appointment-value'
  | 'fresha-plan-from-bookable-team-members'
  | 'fresha-first-appointment-equals-average-appointment-value'
  | 'kersivo-additional-barbers-included'
  | 'kersivo-no-vat-added'
  | 'vat-recovery-depends-on-circumstances'
  | 'deposit-processing-scope'
  | 'deposit-benchmark'
  | 'deposit-fee-rounding'
  | 'deposit-refunds-not-modelled'
  | 'nearcut-free-client-charge'
  | 'nearcut-free-online-payments'
  | 'nearcut-subscription-quote'
  | 'nearcut-subscription-unknown-payments'
  | 'treatwell-eligibility-365-days'
  | 'treatwell-quote-required'
  | 'treatwell-processing-deposits-only'
  | 'setora-current-vat'
  | 'setora-standard-stripe-benchmark'
  | 'setora-sms-excluded'
  | 'phorest-shop-quote'
  | 'phorest-sms-addons-excluded'
  | 'phorest-payments-unverified'
  | 'square-unlimited-staff'
  | 'square-fees-excluded'
  | 'kersivo-stripe-standard-uk-card'
  | 'kersivo-stripe-fee-payer'
  | 'stripe-fees-no-vat';

export type WarningCode = 'fresha-marketplace-cap-unresolved' | 'fresha-custom-pricing-above-team-limit' | 'nearcut-client-charge-not-universal' | 'nearcut-quoted-cost-unknown' | 'nearcut-processing-unresolved' | 'phorest-quote-required' | 'phorest-vat-unknown' | 'phorest-processing-unknown' | 'square-subscription-vat-unverified' | 'square-deposit-processing-unverified' | 'treatwell-monthly-quote-required' | 'treatwell-quote-vat-unknown';

export type EngineNotice<Code extends string> = { code: Code; message: string };

export const ASSUMPTION_MESSAGES: Record<AssumptionCode, string> = {
  'single-location': 'Costs are for a single barbershop location.',
  'shared-marketplace-clients':
    'The same qualifying new marketplace client count is used for Booksy Boost and Fresha Marketplace.',
  'split-marketplace-clients':
    'Separate qualifying new client counts are used for Booksy Boost and Fresha Marketplace.',
  'booksy-users-equal-bookable-barbers':
    'Each bookable barber is treated as one Booksy user: the first is covered by the base subscription and the rest are additional users. Real Booksy accounts may be configured differently.',
  'booksy-boost-first-visit-equals-average-appointment-value':
    'The average appointment value is used as the estimated first-visit value for Booksy Boost fees.',
  'fresha-plan-from-bookable-team-members': `One bookable team member uses the Fresha Independent plan. From two up to ${FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS} bookable team members use the Team plan per bookable team member. Above ${FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS}, Fresha lists custom Enterprise pricing, so no Fresha subscription estimate is given.`,
  'fresha-first-appointment-equals-average-appointment-value':
    'The average appointment value is used as the estimated first completed appointment value for Fresha Marketplace fees.',
  'kersivo-additional-barbers-included':
    'Additional barbers are included in the KERSIVO subscription within one location.',
  'kersivo-no-vat-added': 'KERSIVO does not currently add VAT to its subscription.',
  'vat-recovery-depends-on-circumstances':
    'VAT recovery depends on your business circumstances. The net figure is an estimate, not tax advice.',
  'deposit-processing-scope':
    'Payment processing compares online booking deposits only. It does not include the remaining appointment balance, in-person card payments or retail payments.',
  'deposit-benchmark': `The comparison uses a ${formatGbp(DEPOSIT_BENCHMARK_GBP)} online deposit benchmark where comparable processing terms are published.`,
  'nearcut-free-client-charge': 'Nearcut Free for You has a separate booking charge paid by the customer, not deducted from the barbershop. This customer charge is excluded from shop totals.',
  'nearcut-free-online-payments': 'Nearcut advertises zero online payment transaction fees on Free for You. Its separate Help Centre lists standard payment rates; confirm which terms apply to your shop.',
  'nearcut-subscription-quote': 'Nearcut Subscription has shop-specific pricing. Enter your actual monthly quote excluding VAT to model it. Optional Business Boosters are excluded.',
  'nearcut-subscription-unknown-payments': 'Nearcut Subscription online processing rates cannot be estimated reliably without confirmation of the plan-specific terms.',
  'treatwell-eligibility-365-days': `Treatwell new-client marketplace commission is estimated only on the manually entered eligible appointment count; eligibility depends on booking channel and partner terms, including an inactivity-related successful-appointment history rule. The published ${formatPercent(requireVerifiedTreatwellFact('newMarketplaceClientCommission').percent!)} + VAT may differ from your special cooperation agreement.`,
  'treatwell-quote-required': 'Treatwell advertises Start for free, but does not publish one ongoing subscription amount. Use your actual monthly quote (before VAT). A zero input means unknown, not a free plan.',
  'treatwell-processing-deposits-only': `Treatwell online prepayment processing is modelled at the published ${formatPercent(requireVerifiedTreatwellFact('onlinePrepaymentProcessing').percent!)} + VAT on the ${formatGbp(DEPOSIT_BENCHMARK_GBP)} benchmark deposit per selected booking, rounded per transaction. Other prepaid balances, in-person payments and other fees are excluded.`,
  'setora-current-vat': 'Setora currently states it does not add VAT to its UK subscription; its main pricing page says VAT applies where applicable. This estimate uses the present stated VAT treatment, not a guarantee about future invoices.',
  'setora-standard-stripe-benchmark': `Setora says Stripe processing is billed at Stripe rates without a Setora markup. The estimate assumes standard UK online cards at Stripe published ${formatPercent(STRIPE_UK_STANDARD_CARD_PERCENT)} + ${formatGbp(STRIPE_UK_STANDARD_CARD_FIXED_GBP)}. Premium, international, negotiated and other payment methods may cost more or less.`,
  'setora-sms-excluded': 'Setora SMS credits and optional messaging plans are not included because the shop-specific usage and rate are not provided. Its standard setup fee is advertised as zero; custom-domain registration costs are not confirmed and are excluded.',
  'phorest-shop-quote': 'Phorest has Starter, Grow, Ultimate and Elite plans, but no universal published GBP subscription price. Only your own pre-VAT monthly quote is modelled. Staff, locations, add-ons and contract conditions must be checked against that quote.',
  'phorest-sms-addons-excluded': 'Phorest SMS usage, payment processing, setup, add-ons and retail fees are not included. Published SMS rates vary by plan; the monthly quote alone is not a full cost of ownership.',
  'phorest-payments-unverified': 'PhorestPay online deposit-processing fees are not publicly confirmed for your shop. They are not replaced with Stripe or other providers’ rates.',
  'square-unlimited-staff': 'Square Appointments lists unlimited staff calendars for its Free, Plus and Premium plans and prices subscriptions per location. This assumes a single location.',
  'square-fees-excluded': 'Only the selected Square Appointments software subscription is modelled when deposit processing is off. In-person and retail card fees, hardware, optional add-ons, international fees, negotiated pricing and other transaction costs are excluded.',
  'deposit-fee-rounding': `Payment-processing estimates round each modelled ${formatGbp(DEPOSIT_BENCHMARK_GBP)} deposit transaction to the nearest penny before multiplying by the monthly deposit count. Provider invoice rounding may differ slightly.`,
  'deposit-refunds-not-modelled': 'Refund-related processing costs are not modelled.',
  'kersivo-stripe-standard-uk-card': STRIPE_CARD_CAVEAT,
  'kersivo-stripe-fee-payer': STRIPE_FEE_PAYER_CAVEAT,
  'stripe-fees-no-vat':
    'Stripe processing fees are modelled without VAT charged. Tax treatment can depend on business circumstances; this calculator is not tax advice.',
};

export const WARNING_MESSAGES: Record<WarningCode, string> = {
  'fresha-marketplace-cap-unresolved':
    'Fresha states that a maximum Marketplace new-client fee cap applies to higher-value services, but the cap amount is not published in the verified UK source. The estimate therefore applies the published percentage and minimum before any maximum cap and may overstate Marketplace fees for higher-value first visits.',
  'fresha-custom-pricing-above-team-limit':
    'Fresha lists custom Enterprise pricing above its published team size, so no subscription estimate is shown.',
  'nearcut-client-charge-not-universal': 'Nearcut illustrates a client booking charge but does not publish a universal per-booking rate. Client-paid costs are not included in barbershop totals.',
  'nearcut-quoted-cost-unknown': 'Nearcut Subscription requires a monthly quote for your shop. Without it the total is not estimated.',
  'nearcut-processing-unresolved': 'Nearcut Subscription deposit-processing fees require plan-specific confirmation. The total is not estimated when deposit processing is selected.',
  'treatwell-monthly-quote-required': 'Treatwell ongoing monthly subscription costs are not published as a universal figure. Enter the amount in your partner agreement; no complete total is guessed.',
  'treatwell-quote-vat-unknown': 'Confirm the VAT treatment of your Treatwell subscription quote. No complete cash total is estimated until the quote VAT basis is selected.',
  'square-subscription-vat-unverified': 'Square publishes paid per-location subscription prices, but the VAT basis of these UK headline prices is not verified. The headline is shown in the breakdown; no final cash total, VAT charge or VAT-recoverable figure is guessed.',
  'square-deposit-processing-unverified': 'Square Appointments offers deposits, but the precise processing rate for this appointment-deposit flow is not confirmed. Square Online and Card on File use different published rates. With deposits included, a complete Square total cannot be estimated.',
  'phorest-quote-required': 'Phorest does not publish a universal UK monthly subscription. Enter your own Phorest quote excluding VAT.',
  'phorest-vat-unknown': 'Confirm whether your Phorest quote is subject to UK standard VAT. A complete total cannot be estimated until this is known.',
  'phorest-processing-unknown': 'PhorestPay deposit-processing rates for this shop are unverified. A complete total cannot be shown when deposit processing is selected.',
};

type ProviderResultBase = {
  provider: ProviderId;
  currency: 'GBP';
  depositProcessingIncluded: boolean;
  lineItems: readonly CostLineItem[];
  assumptions: readonly EngineNotice<AssumptionCode>[];
  warnings: readonly EngineNotice<WarningCode>[];
};

export type CalculatedProviderResult = ProviderResultBase & {
  status: 'calculated';
  amounts: MonthlyAmounts;
};

export type CustomPricingProviderResult = ProviderResultBase & {
  status: 'custom-pricing';
  amounts: null;
};

export type ProviderMonthlyResult = CalculatedProviderResult | CustomPricingProviderResult;

export type MonthlyCostCalculation =
  | {
      ok: true;
      scenario: CostScenarioInput;
      effectiveMarketplaceClients: { booksyBoost: number; freshaMarketplace: number; treatwellMarketplace: number };
      assumptions: readonly EngineNotice<AssumptionCode>[];
      providers: readonly [ProviderMonthlyResult, ProviderMonthlyResult, ProviderMonthlyResult, ProviderMonthlyResult, ProviderMonthlyResult, ProviderMonthlyResult, ProviderMonthlyResult, ProviderMonthlyResult];
    }
  | { ok: false; errors: readonly ValidationIssue[] };

/* --------------------------------- Helpers --------------------------------- */

const assumption = (code: AssumptionCode): EngineNotice<AssumptionCode> => ({
  code,
  message: ASSUMPTION_MESSAGES[code],
});

const warning = (code: WarningCode): EngineNotice<WarningCode> => ({
  code,
  message: WARNING_MESSAGES[code],
});

/** Internal line representation in integer pence. */
type PenceLine = Omit<CostLineItem, 'exVatGbp' | 'unitExVatGbp'> & {
  pence: number | null;
  unitPence: number | null;
};

function toLineItem(line: PenceLine): CostLineItem {
  const { pence, unitPence, ...rest } = line;
  return {
    ...rest,
    exVatGbp: pence === null ? null : penceToGbp(pence),
    unitExVatGbp: unitPence === null ? null : penceToGbp(unitPence),
  };
}

type DepositFee = {
  id: 'booksy-deposit-processing' | 'fresha-deposit-processing' | 'nearcut-deposit-processing' | 'setora-deposit-processing' | 'kersivo-deposit-processing' | 'treatwell-deposit-processing';
  paymentMethod: PaymentMethod;
  percent: number;
  fixedPence: number;
  vatApplies: boolean;
};

/** Same benchmark deposit for every provider, so fees differ only by each provider's rate. */
function depositProcessingLine(scenario: CostScenarioInput, fee: DepositFee): PenceLine {
  const base = { id: fee.id, category: 'payment-processing' as const, vatApplies: fee.vatApplies, paymentMethod: fee.paymentMethod };
  if (!scenario.includeDepositProcessing) {
    return { ...base, status: 'not-included', pence: 0, quantity: 0, unitPence: null };
  }
  const unitPence = transactionFeePence(gbpToPence(DEPOSIT_BENCHMARK_GBP), fee.percent, fee.fixedPence);
  const quantity = scenario.depositBookingsPerMonth;
  return { ...base, status: 'calculated', pence: unitPence * quantity, quantity, unitPence };
}

function summarise(lines: readonly PenceLine[], vatRegistered: boolean): MonthlyAmounts {
  const byCategory = (category: CostCategory) =>
    lines.filter((line) => line.category === category).reduce((sum, line) => sum + (line.pence ?? 0), 0);

  const subtotal = lines.reduce((sum, line) => sum + (line.pence ?? 0), 0);
  const vatable = lines.filter((line) => line.vatApplies).reduce((sum, line) => sum + (line.pence ?? 0), 0);
  const vat = percentOfPence(vatable, UK_STANDARD_VAT_PERCENT);

  return {
    subscriptionExVatGbp: penceToGbp(byCategory('subscription')),
    teamOrUserFeesExVatGbp: penceToGbp(byCategory('team-or-users')),
    acquisitionFeesExVatGbp: penceToGbp(byCategory('acquisition')),
    addOnsExVatGbp: penceToGbp(byCategory('add-ons')),
    commissionExVatGbp: penceToGbp(byCategory('commission')),
    paymentProcessingExVatGbp: penceToGbp(byCategory('payment-processing')),
    subtotalExVatGbp: penceToGbp(subtotal),
    vatChargedGbp: penceToGbp(vat),
    cashTotalGbp: penceToGbp(subtotal + vat),
    estimatedNetCostIfVatRecoverableGbp: vatRegistered ? penceToGbp(subtotal) : null,
  };
}

/** One-time acquisition fee per qualifying client: max(value × percent, minimum). */
function acquisitionFeePence(firstVisitPence: number, percent: number, minimumPence: number): number {
  return Math.max(percentOfPence(firstVisitPence, percent), minimumPence);
}

function freshaFact(key: FreshaCommercialFactKey): VerifiedCommercialFact & { vatApplies: boolean } {
  const fact = requireVerifiedFreshaFact(key);
  if (fact.vat === 'inclusive') {
    throw new Error(`Fresha fact "${key}" is VAT-inclusive; the engine only supports exclusive pricing.`);
  }
  return { ...fact, vatApplies: fact.vat === 'exclusive' };
}

function requireAmountPence(fact: VerifiedCommercialFact, key: string): number {
  if (fact.amountGbp === undefined) throw new Error(`Fresha fact "${key}" has no amount.`);
  return gbpToPence(fact.amountGbp);
}

function sharedNotices(scenario: CostScenarioInput) {
  const assumptions = [assumption('single-location')];
  if (scenario.vatRegistered) assumptions.push(assumption('vat-recovery-depends-on-circumstances'));
  return { assumptions, warnings: [] as EngineNotice<WarningCode>[] };
}

const DEPOSIT_SCENARIO_ASSUMPTIONS = [
  'deposit-processing-scope',
  'deposit-benchmark',
  'deposit-fee-rounding',
  'deposit-refunds-not-modelled',
] as const satisfies readonly AssumptionCode[];

/* --------------------------------- Booksy ---------------------------------- */

function calculateBooksy(scenario: CostScenarioInput, boostClients: number): ProviderMonthlyResult {
  const vatApplies = BOOKSY_PRICES_VAT === 'exclusive';
  const basePence = gbpToPence(BOOKSY_BASE_PRICE_GBP);
  const userPence = gbpToPence(BOOKSY_ADDITIONAL_USER_GBP);
  const additionalUsers = Math.max(scenario.bookableBarbers - 1, 0);

  const boostQuantity = scenario.booksyBoostEnabled ? boostClients : 0;
  const boostUnitPence = scenario.booksyBoostEnabled
    ? acquisitionFeePence(
        gbpToPence(scenario.averageAppointmentValueGbp),
        BOOKSY_BOOST_COMMISSION_PERCENT,
        gbpToPence(BOOKSY_BOOST_MINIMUM_GBP),
      )
    : null;

  const lines: PenceLine[] = [
    {
      id: 'booksy-base-subscription',
      category: 'subscription',
      status: 'calculated',
      pence: basePence,
      vatApplies,
      quantity: 1,
      unitPence: basePence,
    },
    {
      id: 'booksy-additional-users',
      category: 'team-or-users',
      status: 'calculated',
      pence: userPence * additionalUsers,
      vatApplies,
      quantity: additionalUsers,
      unitPence: userPence,
    },
    {
      id: 'booksy-boost',
      category: 'acquisition',
      status: 'calculated',
      pence: (boostUnitPence ?? 0) * boostQuantity,
      vatApplies,
      quantity: boostQuantity,
      unitPence: boostUnitPence,
    },
    depositProcessingLine(scenario, {
      id: 'booksy-deposit-processing',
      paymentMethod: 'booksy-mobile-payments',
      percent: BOOKSY_MOBILE_PAYMENTS_PERCENT,
      fixedPence: gbpToPence(BOOKSY_MOBILE_PAYMENTS_FIXED_GBP),
      vatApplies: BOOKSY_MOBILE_PAYMENTS_VAT === 'exclusive',
    }),
  ];

  const shared = sharedNotices(scenario);
  const assumptions = [...shared.assumptions, assumption('booksy-users-equal-bookable-barbers')];
  if (scenario.booksyBoostEnabled) {
    assumptions.push(assumption('booksy-boost-first-visit-equals-average-appointment-value'));
  }

  return {
    provider: 'booksy',
    status: 'calculated',
    currency: 'GBP',
    depositProcessingIncluded: scenario.includeDepositProcessing,
    lineItems: lines.map(toLineItem),
    amounts: summarise(lines, scenario.vatRegistered),
    assumptions,
    warnings: shared.warnings,
  };
}

/* --------------------------------- Fresha ---------------------------------- */

function freshaDepositFee(): DepositFee {
  const key = 'onlinePayments';
  const fact = freshaFact(key);
  if (fact.percent === undefined) throw new Error('Fresha online payments fee requires a percentage.');
  return {
    id: 'fresha-deposit-processing',
    paymentMethod: 'fresha-online-payments',
    percent: fact.percent,
    fixedPence: requireAmountPence(fact, key),
    vatApplies: fact.vatApplies,
  };
}

function freshaSubscriptionLine(teamMembers: number): PenceLine {
  if (teamMembers > FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS) {
    return {
      id: 'fresha-subscription',
      category: 'subscription',
      status: 'custom-pricing',
      pence: null,
      vatApplies: freshaFact('teamPlanPerMember').vatApplies,
      quantity: teamMembers,
      unitPence: null,
      plan: 'enterprise',
    };
  }

  const isIndependent = teamMembers === 1;
  const key: FreshaCommercialFactKey = isIndependent ? 'independentPlan' : 'teamPlanPerMember';
  const fact = freshaFact(key);
  const unitPence = requireAmountPence(fact, key);

  return {
    id: 'fresha-subscription',
    category: 'subscription',
    status: 'calculated',
    pence: isIndependent ? unitPence : unitPence * teamMembers,
    vatApplies: fact.vatApplies,
    quantity: isIndependent ? 1 : teamMembers,
    unitPence,
    plan: isIndependent ? 'independent' : 'team',
  };
}

function freshaAddOnLine(
  id: 'fresha-smart-website' | 'fresha-client-loyalty',
  key: 'smartWebsiteAddOn' | 'clientLoyaltyAddOn',
  enabled: boolean,
): PenceLine {
  const fact = freshaFact(key);
  const unitPence = requireAmountPence(fact, key);
  const quantity = enabled ? 1 : 0;
  return {
    id,
    category: 'add-ons',
    status: 'calculated',
    pence: unitPence * quantity,
    vatApplies: fact.vatApplies,
    quantity,
    unitPence,
  };
}

function calculateFresha(scenario: CostScenarioInput, marketplaceClients: number): ProviderMonthlyResult {
  const marketplace = freshaFact('marketplaceNewClientFee');
  if (marketplace.percent === undefined || marketplace.minimumGbp === undefined) {
    throw new Error('Fresha Marketplace fee requires a percentage and a minimum.');
  }
  const marketplaceUnitPence = acquisitionFeePence(
    gbpToPence(scenario.averageAppointmentValueGbp),
    marketplace.percent,
    gbpToPence(marketplace.minimumGbp),
  );

  const subscription = freshaSubscriptionLine(scenario.bookableBarbers);
  const lines: PenceLine[] = [
    subscription,
    {
      id: 'fresha-marketplace-fees',
      category: 'acquisition',
      status: 'calculated',
      pence: marketplaceUnitPence * marketplaceClients,
      vatApplies: marketplace.vatApplies,
      quantity: marketplaceClients,
      unitPence: marketplaceUnitPence,
    },
    freshaAddOnLine('fresha-smart-website', 'smartWebsiteAddOn', scenario.freshaSmartWebsite),
    freshaAddOnLine('fresha-client-loyalty', 'clientLoyaltyAddOn', scenario.freshaClientLoyalty),
    depositProcessingLine(scenario, freshaDepositFee()),
  ];

  const shared = sharedNotices(scenario);
  const assumptions = [...shared.assumptions, assumption('fresha-plan-from-bookable-team-members')];
  const warnings = [...shared.warnings];

  if (marketplaceClients > 0) {
    assumptions.push(assumption('fresha-first-appointment-equals-average-appointment-value'));
    warnings.push(warning('fresha-marketplace-cap-unresolved'));
  }

  const base = {
    provider: 'fresha' as const,
    currency: 'GBP' as const,
    depositProcessingIncluded: scenario.includeDepositProcessing,
    lineItems: lines.map(toLineItem),
    assumptions,
  };

  if (subscription.status === 'custom-pricing') {
    return {
      ...base,
      status: 'custom-pricing',
      amounts: null,
      warnings: [warning('fresha-custom-pricing-above-team-limit'), ...warnings],
    };
  }

  return { ...base, status: 'calculated', amounts: summarise(lines, scenario.vatRegistered), warnings };
}

/* --------------------------------- Nearcut --------------------------------- */

/**
 * Free for You: £0 for the shop; the customer's extra booking charge is
 * deliberately never guessed or added to the shop cost.
 * Subscription: customer fee is removed, but subscription needs a shop quote.
 */
function calculateNearcut(scenario: CostScenarioInput): ProviderMonthlyResult {
  const subscription = scenario.nearcutSubscription;
  const quotePence = subscription ? gbpToPence(scenario.nearcutMonthlyQuoteGbp) : 0;
  const freeMonthly = requireVerifiedNearcutFact('freeForYouMonthlySubscription');
  const freePayments = requireVerifiedNearcutFact('freeForYouOnlinePayments');
  const quoteMissing = subscription && quotePence === 0;
  const paymentUnknown = subscription && scenario.includeDepositProcessing && scenario.depositBookingsPerMonth > 0;

  const lines: PenceLine[] = [
    {
      id: 'nearcut-subscription', category: 'subscription',
      status: quoteMissing ? 'custom-pricing' : 'calculated',
      pence: quoteMissing ? null : subscription ? quotePence : gbpToPence(freeMonthly.amountGbp!),
      unitPence: quoteMissing ? null : subscription ? quotePence : gbpToPence(freeMonthly.amountGbp!),
      vatApplies: subscription, quantity: 1,
    },
    {
      id: 'nearcut-deposit-processing', category: 'payment-processing',
      status: paymentUnknown ? 'custom-pricing' : scenario.includeDepositProcessing ? 'calculated' : 'not-included',
      pence: paymentUnknown ? null : 0,
      unitPence: paymentUnknown ? null : scenario.includeDepositProcessing && !subscription ? gbpToPence(freePayments.amountGbp!) : null,
      vatApplies: false,
      quantity: scenario.includeDepositProcessing ? scenario.depositBookingsPerMonth : 0,
      ...(scenario.includeDepositProcessing && !subscription ? { paymentMethod: 'nearcut-free-online-payments' as const } : {}),
    },
  ];
  const assumptions: EngineNotice<AssumptionCode>[] = [
    ...sharedNotices(scenario).assumptions,
    assumption(subscription ? 'nearcut-subscription-quote' : 'nearcut-free-client-charge'),
  ];
  const warnings: EngineNotice<WarningCode>[] = [];
  if (quoteMissing) warnings.push(warning('nearcut-quoted-cost-unknown'));
  if (paymentUnknown) {
    assumptions.push(assumption('nearcut-subscription-unknown-payments'));
    warnings.push(warning('nearcut-processing-unresolved'));
  }
  if (!subscription) {
    warnings.push(warning('nearcut-client-charge-not-universal'));
    if (scenario.includeDepositProcessing) assumptions.push(assumption('nearcut-free-online-payments'));
  }
  const base = {
    provider: 'nearcut' as const, currency: 'GBP' as const,
    depositProcessingIncluded: scenario.includeDepositProcessing,
    lineItems: lines.map(toLineItem), assumptions, warnings,
  };
  if (quoteMissing || paymentUnknown) return { ...base, status: 'custom-pricing', amounts: null };
  return { ...base, status: 'calculated', amounts: summarise(lines, scenario.vatRegistered) };
}


/* -------------------------------- Treatwell -------------------------------- */

/**
 * 35% marketplace commission applies only to manually-entered eligible new-client
 * marketplace bookings, NOT every new or repeat booking. Subscription has no
 * universal price. Verified 2.5% + VAT online processing is limited to the
 * same £5 benchmark deposits as the other providers.
 */
function calculateTreatwell(scenario: CostScenarioInput, eligibleClients: number): ProviderMonthlyResult {
  const quoteKnown = scenario.treatwellMonthlyQuoteGbp > 0;
  const vatKnown = scenario.treatwellQuoteVatPercent !== TREATWELL_QUOTE_VAT_UNKNOWN;
  const quotePence = quoteKnown ? gbpToPence(scenario.treatwellMonthlyQuoteGbp) : null;
  const commission = requireVerifiedTreatwellFact('newMarketplaceClientCommission');
  const prepayment = requireVerifiedTreatwellFact('onlinePrepaymentProcessing');
  const commissionUnitPence = percentOfPence(gbpToPence(scenario.averageAppointmentValueGbp), commission.percent!);
  const lines: PenceLine[] = [
    {
      id: 'treatwell-subscription', category: 'subscription',
      status: quoteKnown ? 'calculated' : 'custom-pricing',
      pence: quotePence, unitPence: quotePence, quantity: 1,
      vatApplies: scenario.treatwellQuoteVatPercent === UK_STANDARD_VAT_PERCENT,
    },
    {
      id: 'treatwell-new-client-commission', category: 'acquisition',
      status: 'calculated', quantity: eligibleClients,
      pence: eligibleClients * commissionUnitPence,
      unitPence: commissionUnitPence, vatApplies: commission.vat === 'exclusive',
    },
    depositProcessingLine(scenario, {
      id: 'treatwell-deposit-processing',
      paymentMethod: 'treatwell-online-prepayment',
      percent: prepayment.percent!, fixedPence: 0,
      vatApplies: prepayment.vat === 'exclusive',
    }),
  ];
  const warnings: EngineNotice<WarningCode>[] = [];
  if (!quoteKnown) warnings.push(warning('treatwell-monthly-quote-required'));
  if (!vatKnown) warnings.push(warning('treatwell-quote-vat-unknown'));
  const assumptions = [
    ...sharedNotices(scenario).assumptions,
    assumption('treatwell-eligibility-365-days'),
    assumption('treatwell-quote-required'),
    ...(scenario.includeDepositProcessing ? [assumption('treatwell-processing-deposits-only')] : []),
  ];
  const base = {
    provider: 'treatwell' as const, currency: 'GBP' as const,
    depositProcessingIncluded: scenario.includeDepositProcessing,
    lineItems: lines.map(toLineItem), warnings, assumptions,
  };
  if (!quoteKnown || !vatKnown) return { ...base, status: 'custom-pricing', amounts: null };
  return { ...base, status: 'calculated', amounts: summarise(lines, scenario.vatRegistered) };
}

/* ---------------------------------- Setora --------------------------------- */

/**
 * One location, standard non-promotional subscription. Setora explicitly says
 * no per-staff charge, no booking commission and no Stripe markup. Its current
 * barber pricing page says no VAT is added; that statement can change.
 * Optional SMS credits and unknown domain/setup costs are excluded, never
 * silently modelled as being free.
 */
function calculateSetora(scenario: CostScenarioInput): ProviderMonthlyResult {
  const subscriptionPence = gbpToPence(requireVerifiedSetoraFact('canonicalMonthlyGbp').value);
  const staffPence = gbpToPence(requireVerifiedSetoraFact('additionalStaffSubscriptionGbp').value);
  const commissionPercent = requireVerifiedSetoraFact('platformBookingCommissionPercent').value;
  const vatApplies = requireVerifiedSetoraFact('vatCurrentlyAdded').value;
  const extraStaff = Math.max(0, scenario.bookableBarbers - 1);
  const lines: PenceLine[] = [
    {
      id: 'setora-subscription', category: 'subscription', status: 'calculated',
      pence: subscriptionPence, unitPence: subscriptionPence,
      quantity: 1, vatApplies,
    },
    {
      id: 'setora-additional-staff', category: 'team-or-users', status: 'calculated',
      pence: extraStaff * staffPence, unitPence: staffPence,
      quantity: extraStaff, vatApplies,
    },
    {
      id: 'setora-commission', category: 'commission', status: 'calculated',
      pence: percentOfPence(gbpToPence(scenario.averageAppointmentValueGbp) * scenario.monthlyAppointments, commissionPercent),
      unitPence: 0, quantity: 0, vatApplies,
    },
    depositProcessingLine(scenario, {
      id: 'setora-deposit-processing',
      paymentMethod: 'stripe-setora-standard-uk-card',
      percent: STRIPE_UK_STANDARD_CARD_PERCENT,
      fixedPence: gbpToPence(STRIPE_UK_STANDARD_CARD_FIXED_GBP),
      vatApplies: STRIPE_FEE_VAT_CHARGED,
    }),
  ];
  const assumptions = [
    ...sharedNotices(scenario).assumptions,
    assumption('setora-current-vat'),
    assumption('setora-sms-excluded'),
  ];
  if (scenario.includeDepositProcessing) {
    assumptions.push(assumption('setora-standard-stripe-benchmark'));
  }
  return {
    provider: 'setora',
    status: 'calculated',
    currency: 'GBP',
    depositProcessingIncluded: scenario.includeDepositProcessing,
    lineItems: lines.map(toLineItem),
    amounts: summarise(lines, scenario.vatRegistered),
    assumptions,
    warnings: [],
  };
}

/* ----------------------------- Square Appointments ------------------------------ */

/**
 * Plans are published at £0 / £29 / £69 per location.
 * Do not invent VAT treatment for paid subscriptions or silently reuse Square Online's
 * card rate as the fee for Square Appointments deposits. Unknown totals are explicit.
 */
function calculateSquare(scenario: CostScenarioInput): ProviderMonthlyResult {
  const plan = scenario.squarePlan;
  const publishedHeadline = squareBaseMonthlyPriceGbp(plan);
  const paidVatUnknown = plan !== 'free' && !SQUARE_CALCULATOR_LIMITS.paidSubscriptionVatVerified;
  const processingUnknown =
    scenario.includeDepositProcessing &&
    scenario.depositBookingsPerMonth > 0 &&
    SQUARE_PAYMENT_CHANNEL_FACTS['appointments-online-deposit'].status !== 'verified';
  const subscriptionPence = paidVatUnknown ? null : gbpToPence(publishedHeadline);

  const lines: PenceLine[] = [
    {
      id: 'square-subscription', category: 'subscription',
      status: paidVatUnknown ? 'custom-pricing' : 'calculated',
      pence: subscriptionPence, unitPence: subscriptionPence,
      ...(paidVatUnknown ? { publishedHeadlineGbp: publishedHeadline } : {}),
      plan, quantity: 1, vatApplies: false,
    },
    {
      id: 'square-deposit-processing', category: 'payment-processing',
      status: processingUnknown ? 'custom-pricing' : scenario.includeDepositProcessing ? 'calculated' : 'not-included',
      pence: processingUnknown ? null : 0,
      unitPence: processingUnknown ? null : scenario.includeDepositProcessing ? 0 : null,
      quantity: scenario.includeDepositProcessing ? scenario.depositBookingsPerMonth : 0,
      vatApplies: false,
    },
  ];
  const warnings: EngineNotice<WarningCode>[] = [];
  if (paidVatUnknown) warnings.push(warning('square-subscription-vat-unverified'));
  if (processingUnknown) warnings.push(warning('square-deposit-processing-unverified'));
  const base = {
    provider: 'square' as const, currency: 'GBP' as const,
    depositProcessingIncluded: scenario.includeDepositProcessing,
    lineItems: lines.map(toLineItem),
    assumptions: [
      ...sharedNotices(scenario).assumptions,
      assumption('square-unlimited-staff'),
      assumption('square-fees-excluded'),
    ],
    warnings,
  };
  if (paidVatUnknown || processingUnknown) return { ...base, status: 'custom-pricing', amounts: null };
  return { ...base, status: 'calculated', amounts: summarise(lines, scenario.vatRegistered) };
}

/* --------------------------------- KERSIVO --------------------------------- */

function calculateKersivo(scenario: CostScenarioInput): ProviderMonthlyResult {
  const subscriptionPence = gbpToPence(SAAS_MONTHLY_GBP);
  const additionalBarbers = Math.max(scenario.bookableBarbers - 1, 0);

  const lines: PenceLine[] = [
    {
      id: 'kersivo-subscription',
      category: 'subscription',
      status: 'calculated',
      pence: subscriptionPence,
      vatApplies: SAAS_ADDS_VAT,
      quantity: 1,
      unitPence: subscriptionPence,
    },
    {
      id: 'kersivo-additional-barbers',
      category: 'team-or-users',
      status: 'calculated',
      pence: 0,
      vatApplies: SAAS_ADDS_VAT,
      quantity: additionalBarbers,
      unitPence: 0,
    },
    {
      id: 'kersivo-commission',
      category: 'commission',
      status: 'calculated',
      pence: 0,
      vatApplies: SAAS_ADDS_VAT,
      quantity: 0,
      unitPence: 0,
    },
    depositProcessingLine(scenario, {
      id: 'kersivo-deposit-processing',
      paymentMethod: 'stripe-checkout-standard-uk-card',
      percent: STRIPE_UK_STANDARD_CARD_PERCENT,
      fixedPence: gbpToPence(STRIPE_UK_STANDARD_CARD_FIXED_GBP) + gbpToPence(KERSIVO_DEPOSIT_APPLICATION_FEE_GBP),
      vatApplies: STRIPE_FEE_VAT_CHARGED,
    }),
  ];

  const shared = sharedNotices(scenario);
  const assumptions = [...shared.assumptions, assumption('kersivo-additional-barbers-included')];
  if (!SAAS_ADDS_VAT) assumptions.push(assumption('kersivo-no-vat-added'));
  if (scenario.includeDepositProcessing) {
    assumptions.push(assumption('kersivo-stripe-standard-uk-card'), assumption('kersivo-stripe-fee-payer'));
    if (!STRIPE_FEE_VAT_CHARGED) assumptions.push(assumption('stripe-fees-no-vat'));
  }

  return {
    provider: 'kersivo',
    status: 'calculated',
    currency: 'GBP',
    depositProcessingIncluded: scenario.includeDepositProcessing,
    lineItems: lines.map(toLineItem),
    amounts: summarise(lines, scenario.vatRegistered),
    assumptions,
    warnings: shared.warnings,
  };
}

/* --------------------------------- Phorest --------------------------------- */

/**
 * Phorest UK publishes quote-based subscription plans, not a universal GBP price.
 * Never create a false "£0" cost when a quote, VAT treatment or card fee is missing.
 * A confirmed quote is an owner-provided scenario, not an official Phorest rate.
 */
function calculatePhorest(scenario: CostScenarioInput): ProviderMonthlyResult {
  const quote = useUserProvidedPhorestMonthlyQuoteGbp(scenario.phorestMonthlyQuoteGbp);
  const quoteKnown = quote !== null && quote > 0;
  const vatKnown = scenario.phorestQuoteVatPercent !== PHOREST_QUOTE_VAT_UNKNOWN;
  const paymentUnknown = scenario.includeDepositProcessing && scenario.depositBookingsPerMonth > 0;
  const quotePence = quoteKnown ? gbpToPence(quote) : null;
  const lines: PenceLine[] = [
    {
      id: 'phorest-subscription', category: 'subscription',
      status: quoteKnown ? 'calculated' : 'custom-pricing',
      pence: quotePence, unitPence: quotePence, quantity: 1,
      vatApplies: vatKnown && scenario.phorestQuoteVatPercent === UK_STANDARD_VAT_PERCENT,
    },
    {
      id: 'phorest-deposit-processing', category: 'payment-processing',
      status: paymentUnknown ? 'custom-pricing' : 'not-included',
      pence: paymentUnknown ? null : 0, unitPence: null,
      quantity: scenario.includeDepositProcessing ? scenario.depositBookingsPerMonth : 0,
      vatApplies: false,
    },
  ];
  const warnings: EngineNotice<WarningCode>[] = [];
  if (!quoteKnown) warnings.push(warning('phorest-quote-required'));
  if (!vatKnown) warnings.push(warning('phorest-vat-unknown'));
  if (paymentUnknown) warnings.push(warning('phorest-processing-unknown'));
  const assumptions = [
    ...sharedNotices(scenario).assumptions,
    assumption('phorest-shop-quote'),
    assumption('phorest-sms-addons-excluded'),
    ...(paymentUnknown ? [assumption('phorest-payments-unverified')] : []),
  ];
  const base = {
    provider: 'phorest' as const, currency: 'GBP' as const,
    depositProcessingIncluded: scenario.includeDepositProcessing,
    lineItems: lines.map(toLineItem), assumptions, warnings,
  };
  if (!quoteKnown || !vatKnown || paymentUnknown) return { ...base, status: 'custom-pricing', amounts: null };
  return { ...base, status: 'calculated', amounts: summarise(lines, scenario.vatRegistered) };
}

/* ---------------------------------- Entry ---------------------------------- */

export function calculateMonthlyCosts(input: CostScenarioInput): MonthlyCostCalculation {
  const errors = validateCostScenario(input);
  if (errors.length > 0) return { ok: false, errors };

  const scenario: CostScenarioInput = { ...input };
  const effectiveMarketplaceClients = scenario.splitMarketplaceAssumptions
    ? { booksyBoost: scenario.booksyBoostClients, freshaMarketplace: scenario.freshaMarketplaceClients, treatwellMarketplace: scenario.treatwellMarketplaceClients }
    : { booksyBoost: scenario.marketplaceClients, freshaMarketplace: scenario.marketplaceClients, treatwellMarketplace: scenario.marketplaceClients };

  return {
    ok: true,
    scenario,
    effectiveMarketplaceClients,
    assumptions: [
      assumption(scenario.splitMarketplaceAssumptions ? 'split-marketplace-clients' : 'shared-marketplace-clients'),
      ...(scenario.includeDepositProcessing ? DEPOSIT_SCENARIO_ASSUMPTIONS.map(assumption) : []),
    ],
    providers: [
      calculateBooksy(scenario, effectiveMarketplaceClients.booksyBoost),
      calculateFresha(scenario, effectiveMarketplaceClients.freshaMarketplace),
      calculateNearcut(scenario),
      calculateTreatwell(scenario, effectiveMarketplaceClients.treatwellMarketplace),
      calculateSetora(scenario),
      calculateSquare(scenario),
      calculatePhorest(scenario),
      calculateKersivo(scenario),
    ],
  };
}
