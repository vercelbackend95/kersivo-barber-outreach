import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  calculateMonthlyCosts,
  type CostScenarioInput,
  type MonthlyAmounts,
  type ProviderMonthlyResult,
} from './barberSoftwareCostEngine';
import { DEFAULT_SCENARIO } from './calculatorUi';
import { COST_PERIODS, PERIOD_MONTHS, isCostPeriod } from './costPeriod';
import { projectCostCalculation } from './costProjection';
import { gbpToPence } from './money';

const scenario = (overrides: Partial<CostScenarioInput> = {}): CostScenarioInput => ({
  ...DEFAULT_SCENARIO,
  ...overrides,
});

function providers(overrides: Partial<CostScenarioInput>, period: (typeof COST_PERIODS)[number]) {
  const projected = projectCostCalculation(calculateMonthlyCosts(scenario(overrides)), period);
  if (!projected.ok) throw new Error('invalid scenario');
  return projected.providers;
}

function amounts(result: ProviderMonthlyResult): MonthlyAmounts {
  if (result.status !== 'calculated') throw new Error('not calculated');
  return result.amounts;
}

const AMOUNT_KEYS = [
  'subscriptionExVatGbp',
  'teamOrUserFeesExVatGbp',
  'acquisitionFeesExVatGbp',
  'addOnsExVatGbp',
  'commissionExVatGbp',
  'paymentProcessingExVatGbp',
  'subtotalExVatGbp',
  'vatChargedGbp',
  'cashTotalGbp',
] as const;

const RICH_SCENARIO: Partial<CostScenarioInput> = {
  bookableBarbers: 6,
  marketplaceClients: 7,
  booksyBoostEnabled: true,
  averageAppointmentValueGbp: 33.33,
  freshaSmartWebsite: true,
  freshaClientLoyalty: true,
  vatRegistered: true,
};

const RICH_WITH_DEPOSITS: Partial<CostScenarioInput> = {
  ...RICH_SCENARIO,
  includeDepositProcessing: true,
  depositBookingsPerMonth: 73,
};

describe('period model', () => {
  it('centralises the three periods and their month counts', () => {
    expect(COST_PERIODS).toEqual(['monthly', 'annual', 'threeYear']);
    expect(PERIOD_MONTHS).toEqual({ monthly: 1, annual: 12, threeYear: 36 });
    expect(isCostPeriod('annual')).toBe(true);
    expect(isCostPeriod('weekly')).toBe(false);
    expect(isCostPeriod(undefined)).toBe(false);
  });
});

describe('projectCostCalculation', () => {
  it('returns monthly results unchanged for the monthly period', () => {
    const monthly = calculateMonthlyCosts(scenario(RICH_SCENARIO));
    const projected = projectCostCalculation(monthly, 'monthly');
    expect(projected.months).toBe(1);
    if (!projected.ok || !monthly.ok) throw new Error('invalid');
    expect(projected.providers).toEqual(monthly.providers);
  });

  it('multiplies every monetary amount by the period month count', () => {
    const monthly = providers(RICH_WITH_DEPOSITS, 'monthly');
    for (const period of ['annual', 'threeYear'] as const) {
      const projected = providers(RICH_WITH_DEPOSITS, period);
      projected.forEach((result, index) => {
        if (result.status !== 'calculated' || monthly[index].status !== 'calculated') return;
        const base = amounts(monthly[index]);
        const scaled = amounts(result);
        for (const key of AMOUNT_KEYS) {
          expect(gbpToPence(scaled[key])).toBe(gbpToPence(base[key]) * PERIOD_MONTHS[period]);
        }
      });
    }
  });

  it('projects the default scenario to the expected totals', () => {
    const cash = (period: 'monthly' | 'annual' | 'threeYear') =>
      providers({}, period).map((result) => amounts(result).cashTotalGbp);
    expect(cash('monthly')).toEqual([60, 35.82, 0, 59, 0, 39]);
    expect(cash('annual')).toEqual([720, 429.84, 0, 708, 0, 468]);
    expect(cash('threeYear')).toEqual([2160, 1289.52, 0, 2124, 0, 1404]);
  });

  it('keeps projected totals reconciled with their components', () => {
    for (const period of COST_PERIODS) {
      for (const result of providers(RICH_WITH_DEPOSITS, period)) {
        if (result.status !== 'calculated') continue;
        const a = amounts(result);
        const parts = [
          a.subscriptionExVatGbp,
          a.teamOrUserFeesExVatGbp,
          a.acquisitionFeesExVatGbp,
          a.addOnsExVatGbp,
          a.commissionExVatGbp,
          a.paymentProcessingExVatGbp,
        ].reduce((sum, value) => sum + gbpToPence(value), 0);
        expect(gbpToPence(a.subtotalExVatGbp)).toBe(parts);
        expect(gbpToPence(a.cashTotalGbp)).toBe(gbpToPence(a.subtotalExVatGbp) + gbpToPence(a.vatChargedGbp));
        const lines = result.lineItems.reduce((sum, line) => sum + (line.exVatGbp === null ? 0 : gbpToPence(line.exVatGbp)), 0);
        expect(lines).toBe(gbpToPence(a.subtotalExVatGbp));
      }
    }
  });

  it('projects a pence-level amount exactly (£20.01 × 12 = £240.12)', () => {
    const monthly = calculateMonthlyCosts(scenario());
    if (!monthly.ok) throw new Error('invalid');
    const [booksy, fresha, nearcut, setora, square, kersivo] = monthly.providers;
    if (booksy.status !== 'calculated') throw new Error('not calculated');
    const withPennies = { ...booksy, amounts: { ...booksy.amounts, cashTotalGbp: 20.01, subtotalExVatGbp: 20.01 } };
    const projected = projectCostCalculation({ ...monthly, providers: [withPennies, fresha, nearcut, setora, square, kersivo] }, 'annual');
    if (!projected.ok) throw new Error('invalid');
    expect(amounts(projected.providers[0]).cashTotalGbp).toBe(240.12);
    expect(amounts(projected.providers[0]).subtotalExVatGbp).toBe(240.12);
  });

  it('projects VAT and the net estimate, keeping null net when not VAT registered', () => {
    const [booksyNoVat] = providers({}, 'annual');
    expect(amounts(booksyNoVat).vatChargedGbp).toBe(120);
    expect(amounts(booksyNoVat).estimatedNetCostIfVatRecoverableGbp).toBeNull();

    const [booksy, fresha, , , , kersivo] = providers({ vatRegistered: true }, 'threeYear');
    expect(amounts(booksy).estimatedNetCostIfVatRecoverableGbp).toBe(1800);
    expect(amounts(fresha).estimatedNetCostIfVatRecoverableGbp).toBe(1074.6);
    expect(amounts(kersivo).estimatedNetCostIfVatRecoverableGbp).toBe(1404);
  });

  it('projects line totals but keeps unit prices and quantities monthly', () => {
    const monthly = providers(RICH_WITH_DEPOSITS, 'monthly');
    const projected = providers(RICH_WITH_DEPOSITS, 'threeYear');
    projected.forEach((result, providerIndex) => {
      result.lineItems.forEach((line, lineIndex) => {
        const base = monthly[providerIndex].lineItems[lineIndex];
        expect(line.id).toBe(base.id);
        expect(line.quantity).toBe(base.quantity);
        expect(line.unitExVatGbp).toBe(base.unitExVatGbp);
        expect(line.status).toBe(base.status);
        if (base.exVatGbp === null) expect(line.exVatGbp).toBeNull();
        else expect(gbpToPence(line.exVatGbp!)).toBe(gbpToPence(base.exVatGbp) * 36);
      });
    });
  });

  it('keeps deposit processing not included in every period when the toggle is off', () => {
    for (const period of COST_PERIODS) {
      for (const result of providers({ ...RICH_SCENARIO, depositBookingsPerMonth: 100 }, period)) {
        expect(result.depositProcessingIncluded).toBe(false);
        expect(amounts(result).paymentProcessingExVatGbp).toBe(0);
        const payment = result.lineItems.find((line) => line.category === 'payment-processing')!;
        expect(payment.status).toBe('not-included');
        expect(payment.exVatGbp).toBe(0);
      }
    }
  });

  it('projects 100 monthly deposits to 12-month and 3-year totals, keeping unit and quantity monthly', () => {
    const deposits = { includeDepositProcessing: true, depositBookingsPerMonth: 100 };
    const processing = (period: (typeof COST_PERIODS)[number]) =>
      providers(deposits, period).map((result) => result.lineItems.find((line) => line.category === 'payment-processing')!);
    expect(processing('monthly').map((line) => line.exVatGbp)).toEqual([26, 32, 0, 28, null, 28]);
    expect(processing('annual').map((line) => line.exVatGbp)).toEqual([312, 384, 0, 336, null, 336]);
    expect(processing('threeYear').map((line) => line.exVatGbp)).toEqual([936, 1152, 0, 1008, null, 1008]);
    for (const period of COST_PERIODS) {
      expect(processing(period).map((line) => line.unitExVatGbp)).toEqual([0.26, 0.32, 0, 0.28, null, 0.28]);
      expect(processing(period).map((line) => line.quantity)).toEqual([100, 100, 100, 100, 100, 100]);
      expect(providers(deposits, period).map((result) => result.status === 'calculated' ? amounts(result).paymentProcessingExVatGbp : null)).toEqual(
        processing(period).map((line) => line.exVatGbp),
      );
    }
  });

  it('keeps Fresha custom pricing without a total, projecting only known lines', () => {
    for (const period of COST_PERIODS) {
      const [, fresha] = providers({ bookableBarbers: 21, marketplaceClients: 2, freshaSmartWebsite: true }, period);
      expect(fresha.status).toBe('custom-pricing');
      if (fresha.status !== 'custom-pricing') continue;
      expect(fresha.amounts).toBeNull();
      const line = (id: string) => fresha.lineItems.find((entry) => entry.id === id)!;
      expect(line('fresha-subscription').exVatGbp).toBeNull();
      expect(line('fresha-subscription').status).toBe('custom-pricing');
      expect(gbpToPence(line('fresha-marketplace-fees').exVatGbp!)).toBe(1000 * PERIOD_MONTHS[period]);
    }
  });

  it('passes invalid scenarios through without projecting anything', () => {
    const projected = projectCostCalculation(calculateMonthlyCosts(scenario({ bookableBarbers: Number.NaN })), 'threeYear');
    expect(projected.ok).toBe(false);
    expect(projected.period).toBe('threeYear');
    if (projected.ok) return;
    expect(projected.errors[0].field).toBe('bookableBarbers');
    expect('providers' in projected).toBe(false);
  });

  it('does not mutate the monthly result', () => {
    const monthly = calculateMonthlyCosts(scenario(RICH_SCENARIO));
    const snapshot = JSON.stringify(monthly);
    projectCostCalculation(monthly, 'threeYear');
    expect(JSON.stringify(monthly)).toBe(snapshot);
  });
});

describe('projection architecture guards', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const strip = (source: string) =>
    source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, '""');
  const sources = readdirSync(here)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .map((file) => {
      const raw = readFileSync(join(here, file), 'utf8');
      return { file, raw, code: strip(raw) };
    });

  it('defines the 12 and 36 month multipliers only in costPeriod.ts', () => {
    for (const { file, code } of sources) {
      if (file === 'costPeriod.ts') continue;
      // toPrecision(12) is float stabilisation in money.ts, not a period multiplier.
      expect(code.replace('toPrecision(12)', ''), file).not.toMatch(/\b(12|36)\b/);
    }
  });

  it('applies period multipliers only in the projection layer', () => {
    const users = sources.filter(({ code }) => /\bPERIOD_MONTHS\b/.test(code)).map(({ file }) => file);
    expect(users.sort()).toEqual(['costPeriod.ts', 'costProjection.ts']);
  });

  it('keeps provider formulas in the engine only', () => {
    for (const file of ['costProjection.ts', 'costInsight.ts', 'resultView.ts']) {
      const { raw } = sources.find((entry) => entry.file === file)!;
      expect(raw, file).not.toMatch(
        /booksyFacts|stripeFacts|seo\/defaults|'\.\/vat'|percentOfPence|transactionFeePence|requireVerifiedFreshaFact|SAAS_MONTHLY|DEPOSIT_BENCHMARK/,
      );
      expect(raw, file).not.toMatch(/\b(document|window|HTMLElement|querySelector)\b/);
    }
  });

  it('keeps payment rates and the deposit benchmark in the facts modules only', () => {
    for (const { file, raw } of sources) {
      if (file === 'barberSoftwareCostEngine.ts') continue;
      expect(raw, file).not.toMatch(/stripeFacts|BOOKSY_MOBILE_PAYMENTS|STRIPE_UK_STANDARD|onlinePayments|KERSIVO_BOOKING_DEPOSIT/);
    }
    const engine = sources.find((entry) => entry.file === 'barberSoftwareCostEngine.ts')!.raw;
    expect(engine).toMatch(/DEPOSIT_BENCHMARK_GBP = KERSIVO_BOOKING_DEPOSIT_GBP;/);
  });

  it('keeps Stripe SDKs, secrets, Prisma and server modules out of the browser calculator', () => {
    for (const { file, raw } of sources) {
      expect(raw, file).not.toMatch(/from\s+['"](stripe|@stripe\/[\w-]+|@prisma\/client)['"]/);
      expect(raw, file).not.toMatch(/@\/lib\/(db|booking|shop|stripe|server)\b|\.\.\/(db|booking|shop)\//);
      expect(raw, file).not.toMatch(/STRIPE_SECRET|sk_(live|test)_|process\.env|import\.meta\.env/);
    }
    const facts = readFileSync(join(here, '..', 'seo', 'stripeFacts.ts'), 'utf8');
    expect(facts).not.toMatch(/^import\s/m);
  });

  it('adds no winner, cheapest or savings logic anywhere in the calculator', () => {
    for (const { file, raw } of sources) {
      expect(raw, file).not.toMatch(/winner|cheapest|best value|recommended|saving|you save/i);
    }
  });
});
