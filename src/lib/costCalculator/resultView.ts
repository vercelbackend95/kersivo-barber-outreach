/**
 * Turns engine results into display strings for the result cards.
 * Pure and DOM-free: shared by the server render and the client renderer.
 * It only formats values the engine and projection returned; it never derives a cost.
 */

import {
  calculateMonthlyCosts,
  type AssumptionCode,
  type CostLineItem,
  type CostScenarioInput,
  type ProviderId,
  type ProviderMonthlyResult,
} from './barberSoftwareCostEngine';
import {
  CUSTOM_PRICING,
  CUSTOM_PRICING_NOTE,
  NEARCUT_CUSTOM_PRICING_NOTE,
  PHOREST_CUSTOM_PRICING_NOTE,
  INSIGHT_INVALID,
  NET_IF_VAT_RECOVERABLE_LABEL,
  NOT_CALCULATED_SR,
  NOT_ESTIMATED,
  NOT_INCLUDED,
  PLACEHOLDER_TOTAL,
  PLACEHOLDER_VALUE,
  PROJECTION_ASSUMPTION,
  PROVIDER_RESULTS,
  periodResultLabel,
  type BreakdownRowId,
  type SummaryRowId,
} from './calculatorUi';
import { describeCostInsight, determineCostInsight } from './costInsight';
import type { CostPeriod } from './costPeriod';
import { projectCostCalculation, type ProjectedCostCalculation } from './costProjection';
import { formatMoneyGbp } from './money';
import { requireIllustrativeNearcutFact } from '@/lib/seo/nearcutFacts';

export type ProviderViewState = 'calculated' | 'custom-pricing' | 'unavailable';

export type CellView = { value: string; detail: string | null };

export type ProviderView = {
  id: ProviderId;
  state: ProviderViewState;
  total: string;
  /** Long totals use a smaller type size so they never overflow the card. */
  totalSize: 'regular' | 'long';
  totalSr: string | null;
  net: string | null;
  customNote: string | null;
  /** Nearcut's client-paid booking charges are intentionally outside barbershop totals. */
  clientFeeNote: string | null;
  summary: Record<SummaryRowId, string>;
  breakdown: Partial<Record<BreakdownRowId, CellView>>;
  warnings: readonly string[];
  assumptions: readonly string[];
};

export type ResultsView = {
  ok: boolean;
  period: CostPeriod;
  periodLabel: string;
  showThreeYearNote: boolean;
  providers: readonly ProviderView[];
  sharedAssumptions: readonly string[];
  insight: string;
};

/** Assumptions that apply to every provider and are shown once rather than per card. */
const SHARED_ASSUMPTIONS: ReadonlySet<AssumptionCode> = new Set([
  'single-location',
  'shared-marketplace-clients',
  'split-marketplace-clients',
  'vat-recovery-depends-on-circumstances',
  'deposit-processing-scope',
  'deposit-benchmark',
  'deposit-fee-rounding',
  'deposit-refunds-not-modelled',
]);

const LONG_TOTAL_LENGTH = 10;
const NEARCUT_BOOKING_ILLUSTRATION = requireIllustrativeNearcutFact('freeForYouCustomerBookingFeeExample');

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Quantity context always keeps the monthly pricing basis, whatever period is shown. */
function lineDetail(line: CostLineItem, boostEnabled: boolean): string | null {
  const unit = line.unitExVatGbp === null ? null : formatMoneyGbp(line.unitExVatGbp);
  switch (line.id) {
    case 'booksy-additional-users':
      return line.quantity > 0 && unit
        ? `${plural(line.quantity, 'additional user', 'additional users')} · ${unit} each/month`
        : null;
    case 'booksy-boost':
      if (!boostEnabled) return 'Off';
      return line.quantity > 0 && unit
        ? `${plural(line.quantity, 'qualifying client', 'qualifying clients')}/month · ${unit} each`
        : null;
    case 'fresha-subscription':
      if (line.plan === 'independent' && unit) return `Independent plan · ${unit}/month`;
      if (line.plan === 'team' && unit) {
        return `Team plan · ${plural(line.quantity, 'bookable team member', 'bookable team members')} · ${unit} each/month`;
      }
      if (line.plan === 'enterprise') return 'Enterprise';
      return null;
    case 'fresha-marketplace-fees':
      return line.quantity > 0 && unit
        ? `${plural(line.quantity, 'new client', 'new clients')}/month · ${unit} each`
        : null;
    case 'phorest-subscription':
      return unit ? `${unit}/month from your Phorest quote` : 'Own quote required';
    case 'nearcut-subscription':
      return unit ? `${unit}/month ${line.vatApplies ? 'before VAT' : 'for the shop'}` : 'Shop-specific quote required';
    case 'setora-additional-staff':
      return line.quantity > 0 ? `${line.quantity} included without an extra fee` : null;
    case 'kersivo-additional-barbers':
      return line.quantity > 0 ? `${line.quantity} included` : null;
    case 'booksy-deposit-processing':
    case 'fresha-deposit-processing':
    case 'phorest-deposit-processing':
    case 'nearcut-deposit-processing':
    case 'setora-deposit-processing':
    case 'kersivo-deposit-processing':
      return depositDetail(line, unit);
    default:
      return null;
  }
}

const PAYMENT_METHOD_NOTE: Partial<Record<NonNullable<CostLineItem['paymentMethod']>, string>> = {
  'stripe-checkout-standard-uk-card': 'standard UK card',
  'stripe-setora-standard-uk-card': 'standard UK card · illustrative Stripe rate, no Setora markup',
};

function depositDetail(line: CostLineItem, unit: string | null): string | null {
  if (line.status !== 'calculated' || !unit) return null;
  const parts = [
    `${plural(line.quantity, 'deposit', 'deposits')}/month`,
    `estimated ${unit} each${line.vatApplies ? ' before VAT' : ''}`,
  ];
  const note = line.paymentMethod ? PAYMENT_METHOD_NOTE[line.paymentMethod] : undefined;
  if (note) parts.push(note);
  return parts.join(' · ');
}

/** The summary row mirrors the provider's single deposit processing line, including under custom pricing. */
function paymentsSummary(result: ProviderMonthlyResult): string {
  const line = result.lineItems.find((entry) => entry.category === 'payment-processing');
  return line ? lineValue(line) : NOT_INCLUDED;
}

function lineValue(line: CostLineItem): string {
  if (line.status === 'not-included') return NOT_INCLUDED;
  if (line.status === 'custom-pricing' || line.exVatGbp === null) return CUSTOM_PRICING;
  return formatMoneyGbp(line.exVatGbp);
}

function unavailableProvider(id: ProviderId): ProviderView {
  const config = PROVIDER_RESULTS.find((entry) => entry.id === id)!;
  return {
    id,
    state: 'unavailable',
    total: PLACEHOLDER_TOTAL,
    totalSize: 'regular',
    totalSr: NOT_CALCULATED_SR,
    net: null,
    customNote: null,
    clientFeeNote: null,
    summary: { 'before-vat': PLACEHOLDER_VALUE, vat: PLACEHOLDER_VALUE, payments: PLACEHOLDER_VALUE },
    breakdown: Object.fromEntries(
      config.breakdown.map((row) => [row.id, { value: PLACEHOLDER_VALUE, detail: null }]),
    ),
    warnings: [],
    assumptions: [],
  };
}

function providerView(result: ProviderMonthlyResult, boostEnabled: boolean, nearcutSubscription: boolean): ProviderView {
  const breakdown: Partial<Record<BreakdownRowId, CellView>> = {};
  for (const line of result.lineItems) {
    breakdown[line.id] = { value: lineValue(line), detail: lineDetail(line, boostEnabled) };
  }

  const shared = {
    id: result.provider,
    clientFeeNote: result.provider !== 'nearcut' ? null : nearcutSubscription
      ? 'Nearcut Subscription removes the client booking charge. Any extras or online processing depend on your quote.'
      : `Nearcut Free for You: clients pay an additional booking charge. Nearcut shows ${formatMoneyGbp(NEARCUT_BOOKING_ILLUSTRATION.amountGbp)} on a ${formatMoneyGbp(NEARCUT_BOOKING_ILLUSTRATION.exampleServicePriceGbp)} haircut as an example, NOT a universal rate. This client cost is excluded from shop totals.`,
    warnings: result.warnings.map((entry) => entry.message),
    assumptions: result.assumptions
      .filter((entry) => !SHARED_ASSUMPTIONS.has(entry.code))
      .map((entry) => entry.message),
  };

  if (result.status === 'custom-pricing') {
    breakdown.vat = { value: NOT_ESTIMATED, detail: null };
    return {
      ...shared,
      state: 'custom-pricing',
      total: CUSTOM_PRICING,
      totalSize: 'regular',
      totalSr: null,
      net: null,
      customNote: result.provider === 'nearcut' ? NEARCUT_CUSTOM_PRICING_NOTE : result.provider === 'phorest' ? PHOREST_CUSTOM_PRICING_NOTE : CUSTOM_PRICING_NOTE,
      summary: { 'before-vat': NOT_ESTIMATED, vat: NOT_ESTIMATED, payments: paymentsSummary(result) },
      breakdown,
    };
  }

  const { amounts } = result;
  const total = formatMoneyGbp(amounts.cashTotalGbp);
  breakdown.vat = { value: formatMoneyGbp(amounts.vatChargedGbp), detail: null };
  return {
    ...shared,
    state: 'calculated',
    total,
    totalSize: total.length >= LONG_TOTAL_LENGTH ? 'long' : 'regular',
    totalSr: null,
    net:
      amounts.estimatedNetCostIfVatRecoverableGbp === null
        ? null
        : `${NET_IF_VAT_RECOVERABLE_LABEL} ${formatMoneyGbp(amounts.estimatedNetCostIfVatRecoverableGbp)}`,
    customNote: result.provider === 'phorest'
      ? 'Subscription and confirmed VAT only — not the full Phorest bill. SMS, optional tools, setup and PhorestPay charges are excluded.'
      : null,
    summary: {
      'before-vat': formatMoneyGbp(amounts.subtotalExVatGbp),
      vat: formatMoneyGbp(amounts.vatChargedGbp),
      payments: paymentsSummary(result),
    },
    breakdown,
  };
}

export function buildResultsView(projected: ProjectedCostCalculation, insight: string): ResultsView {
  const period = {
    period: projected.period,
    periodLabel: periodResultLabel(projected.period),
    showThreeYearNote: projected.period === 'threeYear',
    insight,
  };

  if (!projected.ok) {
    return {
      ...period,
      ok: false,
      providers: PROVIDER_RESULTS.map((entry) => unavailableProvider(entry.id)),
      sharedAssumptions: [],
    };
  }

  const sharedAssumptions = new Map<string, string>();
  for (const entry of [...projected.assumptions, ...projected.providers.flatMap((p) => p.assumptions)]) {
    if (SHARED_ASSUMPTIONS.has(entry.code)) sharedAssumptions.set(entry.code, entry.message);
  }
  if (projected.months > 1) sharedAssumptions.set('projection', PROJECTION_ASSUMPTION);

  return {
    ...period,
    ok: true,
    providers: projected.providers.map((result) => providerView(result, projected.scenario.booksyBoostEnabled, projected.scenario.nearcutSubscription)),
    sharedAssumptions: [...sharedAssumptions.values()],
  };
}

/** The full pure pipeline: scenario → monthly engine → projection + monthly insight → view. */
export function buildCalculatorView(scenario: CostScenarioInput, period: CostPeriod): ResultsView {
  const monthly = calculateMonthlyCosts(scenario);
  const insight = determineCostInsight(monthly);
  return buildResultsView(
    projectCostCalculation(monthly, period),
    insight ? describeCostInsight(insight) : INSIGHT_INVALID,
  );
}
