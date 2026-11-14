import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENARIO } from './calculatorUi';
import { buildCostScenarioInput, buildTeamGrowthSeries, COST_SCENARIO_TABLES } from './costScenarios';
import { barShare, buildCostVerdict, VERDICT_BAR_ROWS } from './costVerdict';
import { buildCalculatorView } from './resultView';
import { decodeScenarioQuery } from './calculatorUrlState';

describe('cost verdict', () => {
  it('orders only fully calculated providers, highest first, and lists quote-based ones separately', () => {
    const view = buildCalculatorView(DEFAULT_SCENARIO, 'monthly');
    const verdict = buildCostVerdict(view);
    expect(verdict.ok).toBe(true);
    const amounts = verdict.bars.map((bar) => bar.amountGbp);
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts);
    for (const bar of verdict.bars) {
      expect(view.providers.find((provider) => provider.id === bar.id)!.cashTotalGbp).toBe(bar.amountGbp);
    }
    expect(verdict.quoteNeeded).toEqual(expect.arrayContaining(['Timely', 'Treatwell', 'Phorest']));
    expect(verdict.bars.map((bar) => bar.id)).not.toContain('timely');
  });

  it('describes KERSIVO differences only from engine totals, never a pick', () => {
    const verdict = buildCostVerdict(buildCalculatorView(buildCostScenarioInput(5), 'monthly'));
    const kersivo = verdict.bars.find((bar) => bar.isKersivo)!;
    const booksy = verdict.bars.find((bar) => bar.id === 'booksy')!;
    expect(verdict.kersivoGbp).toBe(kersivo.amountGbp);
    expect(verdict.lines[0]).toContain('less than Booksy a month');
    expect(verdict.lines[0]).toContain(`£${(booksy.amountGbp - kersivo.amountGbp).toFixed(2)}`);
    // Providers with a lower calculated total are named honestly.
    expect(verdict.lines.join(' ')).toMatch(/cost less on software alone/);
    expect(JSON.stringify(verdict)).not.toMatch(/winner|cheapest|best value|recommended|saving/i);
  });

  it('follows the selected period', () => {
    const monthly = buildCostVerdict(buildCalculatorView(DEFAULT_SCENARIO, 'monthly'));
    const annual = buildCostVerdict(buildCalculatorView(DEFAULT_SCENARIO, 'annual'));
    expect(annual.kersivoGbp).toBe(monthly.kersivoGbp! * 12);
    expect(annual.lines[0]).toContain('over 12 months');
  });

  it('returns an invalid verdict when inputs fail validation', () => {
    const verdict = buildCostVerdict(buildCalculatorView({ ...DEFAULT_SCENARIO, bookableBarbers: 0 }, 'monthly'));
    expect(verdict.ok).toBe(false);
    expect(verdict.bars).toHaveLength(0);
    expect(verdict.kersivoGbp).toBeNull();
  });

  it('keeps a visible minimum bar and one bar row per provider', () => {
    expect(barShare(0, 60)).toBeGreaterThan(0);
    expect(barShare(60, 60)).toBe(1);
    expect(VERDICT_BAR_ROWS).toHaveLength(10);
    expect(VERDICT_BAR_ROWS.find((row) => row.id === 'kersivo')!.name).toBe('Full KERSIVO');
  });
});

describe('worked examples and team growth', () => {
  it('gives every example a load link that decodes to the same scenario', () => {
    for (const table of COST_SCENARIO_TABLES) {
      const state = decodeScenarioQuery(table.loadQuery);
      expect(state.hasScenarioParams).toBe(true);
      expect(state.scenario).toEqual(buildCostScenarioInput(table.barbers));
    }
  });

  it('builds team growth from the engine: KERSIVO flat, per-barber plans rising', () => {
    const series = buildTeamGrowthSeries();
    const points = (id: string) => series.find((entry) => entry.providerId === id)!.points;
    expect(points('kersivo')).toHaveLength(10);
    expect(new Set(points('kersivo')).size).toBe(1);
    expect(points('booksy')[9]).toBeGreaterThan(points('booksy')[0]);
    expect(points('fresha')[9]).toBeGreaterThan(points('fresha')[0]);
    expect(points('booksy')[2]).toBe(
      buildCalculatorView(buildCostScenarioInput(3), 'monthly').providers.find((p) => p.id === 'booksy')!.cashTotalGbp,
    );
  });

  it('keeps hand-written prices out of the new client modules', () => {
    for (const file of ['costVerdict.ts', 'renderVerdict.ts', 'teamGrowthChart.ts']) {
      const source = readFileSync(join(process.cwd(), 'src/lib/costCalculator', file), 'utf8');
      expect(source, file).not.toMatch(/£\s?\d/);
      expect(source, file).not.toMatch(/winner|cheapest|best value|recommended|saving|you save/i);
    }
  });
});
