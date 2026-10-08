import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { calculateMonthlyCosts, type CostScenarioInput } from './barberSoftwareCostEngine';
import { DEFAULT_SCENARIO, INSIGHT_INVALID } from './calculatorUi';
import { describeCostInsight, determineCostInsight, type CostInsight } from './costInsight';
import { COST_PERIODS } from './costPeriod';
import { buildCalculatorView } from './resultView';

const scenario = (overrides: Partial<CostScenarioInput> = {}): CostScenarioInput => ({
  ...DEFAULT_SCENARIO,
  ...overrides,
});
const insightFor = (overrides: Partial<CostScenarioInput> = {}) => determineCostInsight(calculateMonthlyCosts(scenario(overrides)));
const textFor = (overrides: Partial<CostScenarioInput> = {}) => describeCostInsight(insightFor(overrides)!);

describe('determineCostInsight', () => {
  it('classifies the default three-barber scenario as team-size driven', () => {
    expect(insightFor()).toEqual({ kind: 'team', booksyUserFeesGbp: 10, freshaTeamPlan: true, kersivoFlat: true });
  });

  it('falls back to base subscription pricing when no variable cost applies', () => {
    expect(insightFor({ bookableBarbers: 1 })).toEqual({ kind: 'base' });
  });

  it('puts Fresha custom pricing first, whatever else is large', () => {
    expect(insightFor({ bookableBarbers: 21, marketplaceClients: 50, freshaClientLoyalty: true })).toEqual({
      kind: 'custom-pricing',
      provider: 'fresha',
    });
  });

  it('detects marketplace acquisition from Fresha alone while Boost is off', () => {
    expect(insightFor({ marketplaceClients: 4 })).toEqual({
      kind: 'acquisition',
      booksyBoostGbp: 0,
      freshaMarketplaceGbp: 20,
    });
  });

  it('reports both acquisition costs when Boost is on', () => {
    expect(insightFor({ marketplaceClients: 3, booksyBoostEnabled: true })).toEqual({
      kind: 'acquisition',
      booksyBoostGbp: 22.5,
      freshaMarketplaceGbp: 15,
    });
  });

  it('prefers acquisition over team size on a tie', () => {
    expect(insightFor({ marketplaceClients: 2 })?.kind).toBe('acquisition');
  });

  it('keeps team size when it outweighs acquisition', () => {
    expect(insightFor({ bookableBarbers: 6, marketplaceClients: 1 })).toMatchObject({
      kind: 'team',
      booksyUserFeesGbp: 25,
    });
  });

  it('detects selected add-ons as the largest optional cost', () => {
    expect(insightFor({ freshaSmartWebsite: true })).toEqual({ kind: 'add-ons', freshaAddOnsGbp: 12.95 });
    expect(insightFor({ bookableBarbers: 1, freshaSmartWebsite: true, freshaClientLoyalty: true })).toEqual({
      kind: 'add-ons',
      freshaAddOnsGbp: 62.9,
    });
  });

  it('ignores VAT and payments when classifying', () => {
    expect(insightFor({ vatRegistered: true })).toEqual(insightFor({ vatRegistered: false }));
    expect(insightFor({ bookableBarbers: 1, vatRegistered: true })).toEqual({ kind: 'base' });
  });

  it('excludes deposit processing while the toggle is off, even with a stale count', () => {
    expect(insightFor({ depositBookingsPerMonth: 500 })).toEqual(insightFor());
  });

  it('detects booking deposit processing only when it is the largest driver', () => {
    expect(insightFor({ includeDepositProcessing: true, depositBookingsPerMonth: 100 })).toEqual({
      kind: 'deposit-processing',
      booksyGbp: 26,
      freshaGbp: 32,
      setoraGbp: 28,
      kersivoGbp: 28,
    });
    expect(insightFor({ includeDepositProcessing: true, depositBookingsPerMonth: 10 })?.kind).toBe('team');
    expect(insightFor({ includeDepositProcessing: true, depositBookingsPerMonth: 0 })?.kind).toBe('team');
    expect(
      insightFor({ includeDepositProcessing: true, depositBookingsPerMonth: 100, marketplaceClients: 10 })?.kind,
    ).toBe('acquisition');
    expect(
      insightFor({ includeDepositProcessing: true, depositBookingsPerMonth: 100, bookableBarbers: 21 })?.kind,
    ).toBe('custom-pricing');
  });

  it('returns no insight for invalid input', () => {
    expect(insightFor({ bookableBarbers: Number.NaN })).toBeNull();
    expect(insightFor({ monthlyAppointments: 1, marketplaceClients: 5 })).toBeNull();
  });
});

describe('describeCostInsight', () => {
  it('describes deposit processing with each relevant provider estimate', () => {
    expect(textFor({ includeDepositProcessing: true, depositBookingsPerMonth: 100 })).toBe(
      'Booking deposit processing is the largest modelled variable cost in this scenario. Under the entered deposit volume, the processing estimates are £26.00/month for Booksy, £32.00/month for Fresha, £28.00/month for Setora/Stripe and £28.00/month for KERSIVO/Stripe before provider VAT where applicable.',
    );
  });

  it('writes neutral, monthly, ex-VAT example copy', () => {
    expect(textFor()).toBe(
      'Team size is the largest modelled variable cost in this scenario. Booksy adds £10.00/month before VAT in additional-user fees, and Fresha prices its Team plan per bookable team member. KERSIVO stays flat per location in this single-location model.',
    );
    expect(textFor({ marketplaceClients: 3, booksyBoostEnabled: true })).toBe(
      'Marketplace acquisition is the largest modelled variable cost in this scenario. Booksy Boost is estimated at £22.50/month before VAT and Fresha Marketplace fees at £15.00/month before VAT, under the assumptions entered.',
    );
    expect(textFor({ marketplaceClients: 4 })).toBe(
      'Marketplace acquisition is the largest modelled variable cost in this scenario. Fresha Marketplace fees are estimated at £20.00/month before VAT, under the assumptions entered.',
    );
    expect(textFor({ freshaSmartWebsite: true })).toBe(
      'Selected Fresha add-ons are the largest optional cost in this scenario at £12.95/month before VAT.',
    );
    expect(textFor({ bookableBarbers: 1 })).toBe('Base subscription pricing is the main modelled cost in this scenario.');
    expect(textFor({ bookableBarbers: 21 })).toBe(
      'Fresha moves to custom Enterprise pricing above 20 bookable team members, so a complete cost comparison is not available.',
    );
  });

  it('describes Booksy Boost alone when only Boost applies', () => {
    const boostOnly: CostInsight = { kind: 'acquisition', booksyBoostGbp: 15, freshaMarketplaceGbp: 0 };
    expect(describeCostInsight(boostOnly)).toBe(
      'Booksy Boost is the largest modelled variable cost in this scenario at £15.00/month before VAT, under the assumptions entered.',
    );
  });

  it('never uses winner, cheapest or savings language', () => {
    const scenarios: Partial<CostScenarioInput>[] = [
      {},
      { bookableBarbers: 1 },
      { bookableBarbers: 21 },
      { marketplaceClients: 3, booksyBoostEnabled: true },
      { freshaClientLoyalty: true },
    ];
    for (const overrides of scenarios) {
      expect(textFor(overrides)).not.toMatch(/winner|cheapest|cheaper|best|recommend|sav(e|ing)|lowest/i);
    }
  });
});

describe('period invariance', () => {
  const cases: Partial<CostScenarioInput>[] = [
    {},
    { bookableBarbers: 1 },
    { marketplaceClients: 3, booksyBoostEnabled: true },
    { bookableBarbers: 21 },
    { freshaSmartWebsite: true, vatRegistered: true },
  ];

  it('shows the same monthly insight for every display period', () => {
    for (const overrides of cases) {
      const texts = COST_PERIODS.map((period) => buildCalculatorView(scenario(overrides), period).insight);
      expect(new Set(texts).size).toBe(1);
      expect(texts[0]).toBe(textFor(overrides));
    }
  });

  it('shows the invalid-state copy instead of an insight for invalid input', () => {
    for (const period of COST_PERIODS) {
      expect(buildCalculatorView(scenario({ bookableBarbers: Number.NaN }), period).insight).toBe(INSIGHT_INVALID);
    }
  });
});

describe('insight architecture guards', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, 'costInsight.ts'), 'utf8');

  it('reads structured monthly results only, never the DOM or projections', () => {
    expect(source).not.toMatch(/\b(document|window|HTMLElement|querySelector|textContent|innerHTML)\b/);
    expect(source).not.toMatch(/costProjection|PERIOD_MONTHS|costPeriod/);
    expect(source).toContain("from './barberSoftwareCostEngine'");
  });

  it('does not price providers itself', () => {
    expect(source).not.toMatch(/booksyFacts|requireVerifiedFreshaFact|SAAS_MONTHLY|percentOfPence|gbpToPence/);
  });
});
