/**
 * Worked examples for /barber-software-cost-calculator.
 * Every figure comes from the calculation engine via buildCalculatorView; nothing is typed by hand.
 */
import { DEFAULT_SCENARIO, PROVIDER_RESULTS } from '@/lib/costCalculator/calculatorUi';
import type { CostScenarioInput, ProviderId } from '@/lib/costCalculator/barberSoftwareCostEngine';
import { buildCalculatorView, type ProviderViewState } from '@/lib/costCalculator/resultView';

export const COST_SCENARIO_TEAM_SIZES = [1, 3, 5, 8] as const;

/** Monthly appointments per bookable barber used by every worked example. */
export const COST_SCENARIO_APPOINTMENTS_PER_BARBER = 130;

export type CostScenarioRow = {
  providerId: ProviderId;
  name: string;
  state: ProviderViewState;
  monthlyTotal: string;
};

export type CostScenarioTable = {
  barbers: number;
  label: string;
  inputs: string;
  rows: readonly CostScenarioRow[];
};

/** Direct bookings only: no marketplace clients, Boost, add-ons, VAT registration or deposit processing. */
export function buildCostScenarioInput(barbers: number): CostScenarioInput {
  return {
    ...DEFAULT_SCENARIO,
    bookableBarbers: barbers,
    monthlyAppointments: barbers * COST_SCENARIO_APPOINTMENTS_PER_BARBER,
    marketplaceClients: 0,
    booksyBoostEnabled: false,
    splitMarketplaceAssumptions: false,
    freshaSmartWebsite: false,
    freshaClientLoyalty: false,
    vatRegistered: false,
    includeDepositProcessing: false,
  };
}

export function buildCostScenarioTable(barbers: number): CostScenarioTable {
  const input = buildCostScenarioInput(barbers);
  const view = buildCalculatorView(input, 'monthly');
  if (!view.ok) throw new Error(`Cost scenario for ${barbers} barbers failed validation`);

  return {
    barbers,
    label: barbers === 1 ? 'Solo barber' : `${barbers}-barber shop`,
    inputs: `${barbers} bookable ${barbers === 1 ? 'barber' : 'barbers'} · ${input.monthlyAppointments} appointments a month · £${input.averageAppointmentValueGbp} average`,
    rows: PROVIDER_RESULTS.map((provider) => {
      const result = view.providers.find((entry) => entry.id === provider.id)!;
      return { providerId: provider.id, name: provider.name, state: result.state, monthlyTotal: result.total };
    }),
  };
}

export const COST_SCENARIO_TABLES: readonly CostScenarioTable[] = COST_SCENARIO_TEAM_SIZES.map(buildCostScenarioTable);
