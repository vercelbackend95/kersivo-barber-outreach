import { describe, expect, it } from 'vitest';
import { calculateMonthlyCosts } from './barberSoftwareCostEngine';
import { PROVIDER_RESULTS } from './calculatorUi';
import { formatMoneyGbp } from './money';
import {
  COST_SCENARIO_APPOINTMENTS_PER_BARBER,
  COST_SCENARIO_TABLES,
  COST_SCENARIO_TEAM_SIZES,
  buildCostScenarioInput,
} from './costScenarios';

describe('calculator worked examples', () => {
  it('publishes the four team sizes in order', () => {
    expect(COST_SCENARIO_TABLES.map((table) => table.barbers)).toEqual([...COST_SCENARIO_TEAM_SIZES]);
    expect(COST_SCENARIO_TABLES.map((table) => table.label)).toEqual([
      'Solo barber',
      '3-barber shop',
      '5-barber shop',
      '8-barber shop',
    ]);
  });

  it('lists every provider in the same order as the interactive results', () => {
    for (const table of COST_SCENARIO_TABLES) {
      expect(table.rows.map((row) => row.providerId)).toEqual(PROVIDER_RESULTS.map((provider) => provider.id));
    }
  });

  it('equals the calculation engine output for every provider', () => {
    for (const table of COST_SCENARIO_TABLES) {
      const input = buildCostScenarioInput(table.barbers);
      expect(input.monthlyAppointments).toBe(table.barbers * COST_SCENARIO_APPOINTMENTS_PER_BARBER);
      const engine = calculateMonthlyCosts(input);
      expect(engine.ok).toBe(true);
      if (!engine.ok) continue;

      for (const row of table.rows) {
        const result = engine.providers.find((provider) => provider.provider === row.providerId)!;
        if (result.status === 'calculated') {
          expect(row.state).toBe('calculated');
          expect(row.monthlyTotal).toBe(formatMoneyGbp(result.amounts.cashTotalGbp));
        } else {
          expect(row.state).toBe('custom-pricing');
          expect(row.monthlyTotal).not.toMatch(/\d/);
        }
      }
    }
  });

  it('models direct bookings only', () => {
    for (const barbers of COST_SCENARIO_TEAM_SIZES) {
      const input = buildCostScenarioInput(barbers);
      expect(input).toMatchObject({
        marketplaceClients: 0,
        booksyBoostEnabled: false,
        splitMarketplaceAssumptions: false,
        vatRegistered: false,
        includeDepositProcessing: false,
      });
    }
  });
});
