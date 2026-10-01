/**
 * Turns an engine calculation into display strings for the result cards.
 * Pure and DOM-free: shared by the server render and the client renderer.
 * It only formats values the engine returned; it never derives a cost.
 */

import type {
  AssumptionCode,
  CostLineItem,
  MonthlyCostCalculation,
  ProviderId,
  ProviderMonthlyResult,
} from './barberSoftwareCostEngine';
import {
  CUSTOM_PRICING,
  CUSTOM_PRICING_NOTE,
  NET_IF_VAT_RECOVERABLE_LABEL,
  NOT_CALCULATED_SR,
  NOT_ESTIMATED,
  NOT_INCLUDED,
  PLACEHOLDER_TOTAL,
  PLACEHOLDER_VALUE,
  PROVIDER_RESULTS,
  type BreakdownRowId,
  type SummaryRowId,
} from './calculatorUi';
import { formatMoneyGbp } from './money';

export type ProviderViewState = 'calculated' | 'custom-pricing' | 'unavailable';

export type CellView = { value: string; detail: string | null };

export type ProviderView = {
  id: ProviderId;
  state: ProviderViewState;
  total: string;
  totalSr: string | null;
  net: string | null;
  customNote: string | null;
  summary: Record<SummaryRowId, string>;
  breakdown: Partial<Record<BreakdownRowId, CellView>>;
  warnings: readonly string[];
  assumptions: readonly string[];
};

export type ResultsView = {
  ok: boolean;
  providers: readonly ProviderView[];
  sharedAssumptions: readonly string[];
};

/** Assumptions that apply to every provider and are shown once rather than per card. */
const SHARED_ASSUMPTIONS: ReadonlySet<AssumptionCode> = new Set([
  'single-location',
  'shared-marketplace-clients',
  'split-marketplace-clients',
  'vat-recovery-depends-on-circumstances',
]);

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function lineDetail(line: CostLineItem, boostEnabled: boolean): string | null {
  const unit = line.unitExVatGbp === null ? null : formatMoneyGbp(line.unitExVatGbp);
  switch (line.id) {
    case 'booksy-additional-users':
      return line.quantity > 0 && unit ? `${line.quantity} × ${unit}` : null;
    case 'booksy-boost':
      if (!boostEnabled) return 'Off';
      return line.quantity > 0 && unit
        ? `${plural(line.quantity, 'qualifying client', 'qualifying clients')} × ${unit}`
        : null;
    case 'fresha-subscription':
      if (line.plan === 'independent') return 'Independent plan';
      if (line.plan === 'team' && unit) return `Team plan · ${line.quantity} × ${unit}`;
      if (line.plan === 'enterprise') return 'Enterprise';
      return null;
    case 'fresha-marketplace-fees':
      return line.quantity > 0 && unit ? `${plural(line.quantity, 'new client', 'new clients')} × ${unit}` : null;
    case 'kersivo-additional-barbers':
      return line.quantity > 0 ? `${line.quantity} included` : null;
    default:
      return null;
  }
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
    totalSr: NOT_CALCULATED_SR,
    net: null,
    customNote: null,
    summary: { 'before-vat': PLACEHOLDER_VALUE, vat: PLACEHOLDER_VALUE, payments: PLACEHOLDER_VALUE },
    breakdown: Object.fromEntries(
      config.breakdown.map((row) => [row.id, { value: PLACEHOLDER_VALUE, detail: null }]),
    ),
    warnings: [],
    assumptions: [],
  };
}

function providerView(result: ProviderMonthlyResult, boostEnabled: boolean): ProviderView {
  const breakdown: Partial<Record<BreakdownRowId, CellView>> = {};
  for (const line of result.lineItems) {
    breakdown[line.id] = { value: lineValue(line), detail: lineDetail(line, boostEnabled) };
  }

  const shared = {
    id: result.provider,
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
      totalSr: null,
      net: null,
      customNote: CUSTOM_PRICING_NOTE,
      summary: { 'before-vat': NOT_ESTIMATED, vat: NOT_ESTIMATED, payments: NOT_INCLUDED },
      breakdown,
    };
  }

  const { amounts } = result;
  breakdown.vat = { value: formatMoneyGbp(amounts.vatChargedGbp), detail: null };
  return {
    ...shared,
    state: 'calculated',
    total: formatMoneyGbp(amounts.cashTotalGbp),
    totalSr: null,
    net:
      amounts.estimatedNetCostIfVatRecoverableGbp === null
        ? null
        : `${NET_IF_VAT_RECOVERABLE_LABEL} ${formatMoneyGbp(amounts.estimatedNetCostIfVatRecoverableGbp)}`,
    customNote: null,
    summary: {
      'before-vat': formatMoneyGbp(amounts.subtotalExVatGbp),
      vat: formatMoneyGbp(amounts.vatChargedGbp),
      payments: result.paymentsIncluded ? formatMoneyGbp(amounts.paymentProcessingExVatGbp) : NOT_INCLUDED,
    },
    breakdown,
  };
}

export function buildResultsView(calculation: MonthlyCostCalculation): ResultsView {
  if (!calculation.ok) {
    return {
      ok: false,
      providers: PROVIDER_RESULTS.map((entry) => unavailableProvider(entry.id)),
      sharedAssumptions: [],
    };
  }

  const sharedAssumptions = new Map<AssumptionCode, string>();
  for (const entry of [...calculation.assumptions, ...calculation.providers.flatMap((p) => p.assumptions)]) {
    if (SHARED_ASSUMPTIONS.has(entry.code)) sharedAssumptions.set(entry.code, entry.message);
  }

  return {
    ok: true,
    providers: calculation.providers.map((result) =>
      providerView(result, calculation.scenario.booksyBoostEnabled),
    ),
    sharedAssumptions: [...sharedAssumptions.values()],
  };
}
