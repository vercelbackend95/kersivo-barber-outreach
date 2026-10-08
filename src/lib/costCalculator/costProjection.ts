/**
 * Linear period projection of monthly engine results.
 * Multiplies amounts the monthly engine already returned; it never prices a provider.
 * Unit prices and quantities keep their monthly basis.
 */

import type {
  CostLineItem,
  MonthlyAmounts,
  MonthlyCostCalculation,
  ProviderMonthlyResult,
} from './barberSoftwareCostEngine';
import { PERIOD_MONTHS, type CostPeriod } from './costPeriod';
import { multiplyGbp } from './money';

export type ProjectedCostCalculation = MonthlyCostCalculation & {
  period: CostPeriod;
  months: number;
};

function projectAmounts(amounts: MonthlyAmounts, months: number): MonthlyAmounts {
  return {
    subscriptionExVatGbp: multiplyGbp(amounts.subscriptionExVatGbp, months),
    teamOrUserFeesExVatGbp: multiplyGbp(amounts.teamOrUserFeesExVatGbp, months),
    acquisitionFeesExVatGbp: multiplyGbp(amounts.acquisitionFeesExVatGbp, months),
    addOnsExVatGbp: multiplyGbp(amounts.addOnsExVatGbp, months),
    commissionExVatGbp: multiplyGbp(amounts.commissionExVatGbp, months),
    paymentProcessingExVatGbp: multiplyGbp(amounts.paymentProcessingExVatGbp, months),
    subtotalExVatGbp: multiplyGbp(amounts.subtotalExVatGbp, months),
    vatChargedGbp: multiplyGbp(amounts.vatChargedGbp, months),
    cashTotalGbp: multiplyGbp(amounts.cashTotalGbp, months),
    estimatedNetCostIfVatRecoverableGbp:
      amounts.estimatedNetCostIfVatRecoverableGbp === null
        ? null
        : multiplyGbp(amounts.estimatedNetCostIfVatRecoverableGbp, months),
  };
}

function projectLine(line: CostLineItem, months: number): CostLineItem {
  if (line.status !== 'calculated' || line.exVatGbp === null) return line;
  return { ...line, exVatGbp: multiplyGbp(line.exVatGbp, months) };
}

function projectProvider(result: ProviderMonthlyResult, months: number): ProviderMonthlyResult {
  const lineItems = result.lineItems.map((line) => projectLine(line, months));
  if (result.status === 'custom-pricing') return { ...result, lineItems };
  return { ...result, lineItems, amounts: projectAmounts(result.amounts, months) };
}

export function projectCostCalculation(
  monthly: MonthlyCostCalculation,
  period: CostPeriod,
): ProjectedCostCalculation {
  const months = PERIOD_MONTHS[period];
  if (!monthly.ok) return { ...monthly, period, months };

  const [booksy, fresha, nearcut, setora, kersivo, vagaro] = monthly.providers;
  return {
    ...monthly,
    period,
    months,
    providers: [
      projectProvider(booksy, months),
      projectProvider(fresha, months),
      projectProvider(nearcut, months),
      projectProvider(setora, months),
      projectProvider(kersivo, months),
      projectProvider(vagaro, months),
    ],
  };
}
