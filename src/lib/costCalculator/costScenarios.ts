/**
 * Worked examples for /barber-software-cost-calculator.
 * Every figure comes from the calculation engine via buildCalculatorView; nothing is typed by hand.
 */
import { DEFAULT_SCENARIO, PROVIDER_RESULTS } from '@/lib/costCalculator/calculatorUi';
import type { CostScenarioInput, ProviderId } from '@/lib/costCalculator/barberSoftwareCostEngine';
import { buildCalculatorView, type ProviderViewState } from '@/lib/costCalculator/resultView';
import { encodeScenarioQuery } from '@/lib/costCalculator/calculatorUrlState';

export const COST_SCENARIO_TEAM_SIZES = [1, 3, 5, 8] as const;

/** Monthly appointments per bookable barber used by every worked example. */
export const COST_SCENARIO_APPOINTMENTS_PER_BARBER = 130;

export type CostScenarioRow = {
  providerId: ProviderId;
  name: string;
  state: ProviderViewState;
  monthlyTotal: string;
  /** Engine cash total per month; null when the provider needs a quote. */
  monthlyGbp: number | null;
};

export type CostScenarioTable = {
  barbers: number;
  label: string;
  inputs: string;
  /** Query string that loads this example into the calculator (shared-link contract). */
  loadQuery: string;
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
    loadQuery: encodeScenarioQuery(input, 'monthly'),
    inputs: `${barbers} bookable ${barbers === 1 ? 'barber' : 'barbers'} · ${input.monthlyAppointments} appointments a month · £${input.averageAppointmentValueGbp} average`,
    rows: PROVIDER_RESULTS.map((provider) => {
      const result = view.providers.find((entry) => entry.id === provider.id)!;
      return {
        providerId: provider.id,
        name: provider.name,
        state: result.state,
        monthlyTotal: result.total,
        monthlyGbp: result.cashTotalGbp,
      };
    }),
  };
}

export const COST_SCENARIO_TABLES: readonly CostScenarioTable[] = COST_SCENARIO_TEAM_SIZES.map(buildCostScenarioTable);

/* ------------------------- Team growth (pricing models) ------------------------- */

export const TEAM_GROWTH_MAX_BARBERS = 10;

/** Providers whose published model can be priced at every team size from 1 to 10, direct bookings only. */
export const TEAM_GROWTH_PROVIDERS = ['booksy', 'fresha', 'vagaro', 'setora', 'kersivo'] as const satisfies readonly ProviderId[];

export type TeamGrowthSeries = {
  providerId: ProviderId;
  name: string;
  /** Monthly cash cost for 1..TEAM_GROWTH_MAX_BARBERS bookable barbers. */
  points: readonly number[];
};

export function buildTeamGrowthSeries(): readonly TeamGrowthSeries[] {
  const views = Array.from({ length: TEAM_GROWTH_MAX_BARBERS }, (_, index) =>
    buildCalculatorView(buildCostScenarioInput(index + 1), 'monthly'),
  );
  return TEAM_GROWTH_PROVIDERS.map((id) => ({
    providerId: id,
    name: PROVIDER_RESULTS.find((provider) => provider.id === id)!.name,
    points: views.map((view) => {
      const total = view.providers.find((provider) => provider.id === id)?.cashTotalGbp;
      if (total === null || total === undefined) throw new Error(`Team growth for ${id} needs a calculated total`);
      return total;
    }),
  }));
}

export const TEAM_GROWTH_SERIES = buildTeamGrowthSeries();
