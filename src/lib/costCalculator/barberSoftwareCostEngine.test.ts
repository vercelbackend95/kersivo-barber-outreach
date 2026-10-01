import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BOOKSY_ADDITIONAL_USER_GBP,
  BOOKSY_BASE_PRICE_GBP,
  BOOKSY_BOOST_COMMISSION_PERCENT,
  BOOKSY_BOOST_MINIMUM_GBP,
} from '@/lib/seo/booksyFacts';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS,
  FRESHA_UK_COMMERCIAL_FACTS,
  FRESHA_UK_VAT_PERCENT,
  isVerifiedCommercialFact,
  requireVerifiedFreshaFact,
} from '@/lib/seo/freshaFacts';
import {
  ASSUMPTION_MESSAGES,
  WARNING_MESSAGES,
  calculateMonthlyCosts,
  type CalculatedProviderResult,
  type CostScenarioInput,
  type LineItemId,
  type ProviderId,
  type ProviderMonthlyResult,
} from './barberSoftwareCostEngine';
import { roundGbp } from './money';
import { UK_STANDARD_VAT_PERCENT } from './vat';

const BASE: CostScenarioInput = {
  bookableBarbers: 1,
  monthlyAppointments: 400,
  averageAppointmentValueGbp: 25,
  marketplaceClients: 0,
  booksyBoostEnabled: false,
  splitMarketplaceAssumptions: false,
  booksyBoostClients: 0,
  freshaMarketplaceClients: 0,
  freshaSmartWebsite: false,
  freshaClientLoyalty: false,
  vatRegistered: false,
  includePayments: false,
};

function run(overrides: Partial<CostScenarioInput> = {}) {
  const result = calculateMonthlyCosts({ ...BASE, ...overrides });
  if (!result.ok) throw new Error(`Unexpected validation failure: ${JSON.stringify(result.errors)}`);
  return result;
}

function provider(overrides: Partial<CostScenarioInput>, id: ProviderId): ProviderMonthlyResult {
  return run(overrides).providers.find((entry) => entry.provider === id)!;
}

function calculated(overrides: Partial<CostScenarioInput>, id: ProviderId): CalculatedProviderResult {
  const result = provider(overrides, id);
  if (result.status !== 'calculated') throw new Error(`${id} was not calculated`);
  return result;
}

const line = (result: ProviderMonthlyResult, id: LineItemId) => result.lineItems.find((item) => item.id === id)!;
const warningCodes = (result: ProviderMonthlyResult) => result.warnings.map((entry) => entry.code);
const assumptionCodes = (result: ProviderMonthlyResult) => result.assumptions.map((entry) => entry.code);

const smartWebsite = requireVerifiedFreshaFact('smartWebsiteAddOn').amountGbp!;
const clientLoyalty = requireVerifiedFreshaFact('clientLoyaltyAddOn').amountGbp!;
const independent = requireVerifiedFreshaFact('independentPlan').amountGbp!;
const teamMember = requireVerifiedFreshaFact('teamPlanPerMember').amountGbp!;
const marketplaceFee = requireVerifiedFreshaFact('marketplaceNewClientFee');

describe('engine inputs mirror the central facts', () => {
  it('uses the verified values this suite expects', () => {
    expect([BOOKSY_BASE_PRICE_GBP, BOOKSY_ADDITIONAL_USER_GBP]).toEqual([40, 5]);
    expect([BOOKSY_BOOST_COMMISSION_PERCENT, BOOKSY_BOOST_MINIMUM_GBP]).toEqual([30, 5]);
    expect([independent, teamMember, smartWebsite, clientLoyalty]).toEqual([14.95, 9.95, 12.95, 49.95]);
    expect([marketplaceFee.percent, marketplaceFee.minimumGbp]).toEqual([20, 4]);
    expect(FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS).toBe(20);
    expect(SAAS_MONTHLY_GBP).toBe(39);
    expect(UK_STANDARD_VAT_PERCENT).toBe(20);
    expect(FRESHA_UK_VAT_PERCENT).toBe(UK_STANDARD_VAT_PERCENT);
  });
});

describe('Booksy monthly model', () => {
  it('charges only the base subscription for one barber', () => {
    const booksy = calculated({ bookableBarbers: 1 }, 'booksy');
    expect(booksy.amounts.subscriptionExVatGbp).toBe(40);
    expect(booksy.amounts.teamOrUserFeesExVatGbp).toBe(0);
    expect(line(booksy, 'booksy-additional-users').quantity).toBe(0);
    expect(booksy.amounts.subtotalExVatGbp).toBe(40);
  });

  it('treats each extra bookable barber as an additional user and says so', () => {
    const booksy = calculated({ bookableBarbers: 3 }, 'booksy');
    expect(line(booksy, 'booksy-additional-users')).toMatchObject({ quantity: 2, unitExVatGbp: 5, exVatGbp: 10 });
    expect(booksy.amounts.subtotalExVatGbp).toBe(50);
    expect(assumptionCodes(booksy)).toContain('booksy-users-equal-bookable-barbers');
  });

  it('charges nothing for Boost when it is off, whatever the client count', () => {
    const booksy = calculated({ marketplaceClients: 25, booksyBoostEnabled: false }, 'booksy');
    expect(booksy.amounts.acquisitionFeesExVatGbp).toBe(0);
    expect(line(booksy, 'booksy-boost')).toMatchObject({ quantity: 0, exVatGbp: 0, unitExVatGbp: null });
    expect(assumptionCodes(booksy)).not.toContain('booksy-boost-first-visit-equals-average-appointment-value');
  });

  it('applies the Boost percentage when it exceeds the minimum', () => {
    const booksy = calculated({ booksyBoostEnabled: true, marketplaceClients: 1, averageAppointmentValueGbp: 25 }, 'booksy');
    expect(line(booksy, 'booksy-boost')).toMatchObject({ quantity: 1, unitExVatGbp: 7.5, exVatGbp: 7.5 });
    expect(assumptionCodes(booksy)).toContain('booksy-boost-first-visit-equals-average-appointment-value');
  });

  it('applies the Boost minimum for low first-visit values', () => {
    const booksy = calculated({ booksyBoostEnabled: true, marketplaceClients: 1, averageAppointmentValueGbp: 10 }, 'booksy');
    expect(line(booksy, 'booksy-boost').unitExVatGbp).toBe(5);
    expect(calculated({ booksyBoostEnabled: true, marketplaceClients: 1, averageAppointmentValueGbp: 0 }, 'booksy').amounts
      .acquisitionFeesExVatGbp).toBe(5);
  });

  it('multiplies the Boost fee by qualifying clients', () => {
    const booksy = calculated({ booksyBoostEnabled: true, marketplaceClients: 4, averageAppointmentValueGbp: 25 }, 'booksy');
    expect(booksy.amounts.acquisitionFeesExVatGbp).toBe(30);
  });

  it('charges no Boost fees with zero marketplace clients', () => {
    const booksy = calculated({ booksyBoostEnabled: true, marketplaceClients: 0 }, 'booksy');
    expect(booksy.amounts.acquisitionFeesExVatGbp).toBe(0);
  });

  it('adds UK VAT to subscription, users and Boost', () => {
    const booksy = calculated(
      { bookableBarbers: 3, booksyBoostEnabled: true, marketplaceClients: 4, averageAppointmentValueGbp: 25 },
      'booksy',
    );
    expect(booksy.amounts).toMatchObject({ subtotalExVatGbp: 80, vatChargedGbp: 16, cashTotalGbp: 96 });
    expect(booksy.lineItems.filter((item) => item.category !== 'payment-processing').every((item) => item.vatApplies)).toBe(
      true,
    );
  });
});

describe('Fresha monthly model', () => {
  it('uses the Independent plan for one bookable team member', () => {
    const fresha = calculated({ bookableBarbers: 1 }, 'fresha');
    expect(line(fresha, 'fresha-subscription')).toMatchObject({ plan: 'independent', quantity: 1, exVatGbp: 14.95 });
    expect(fresha.amounts).toMatchObject({ subtotalExVatGbp: 14.95, vatChargedGbp: 2.99, cashTotalGbp: 17.94 });
  });

  it.each([
    [2, 19.9],
    [5, 49.75],
    [20, 199],
  ])('uses the Team plan per member for %i barbers', (barbers, expected) => {
    const fresha = calculated({ bookableBarbers: barbers }, 'fresha');
    expect(line(fresha, 'fresha-subscription')).toMatchObject({ plan: 'team', quantity: barbers, unitExVatGbp: 9.95 });
    expect(fresha.amounts.subscriptionExVatGbp).toBe(expected);
  });

  it('returns custom pricing above 20 bookable team members without inventing a number', () => {
    const fresha = provider({ bookableBarbers: 21, marketplaceClients: 2, freshaSmartWebsite: true }, 'fresha');
    expect(fresha.status).toBe('custom-pricing');
    expect(fresha.amounts).toBeNull();
    expect(line(fresha, 'fresha-subscription')).toMatchObject({
      status: 'custom-pricing',
      plan: 'enterprise',
      exVatGbp: null,
      unitExVatGbp: null,
    });
    expect(warningCodes(fresha)).toContain('fresha-custom-pricing-above-team-limit');
    expect(warningCodes(fresha)).toContain('fresha-marketplace-cap-unresolved');
  });

  it('describes the Independent, Team and custom Enterprise plan boundaries accurately', () => {
    const message = ASSUMPTION_MESSAGES['fresha-plan-from-bookable-team-members'];
    expect(message).toBe(
      'One bookable team member uses the Fresha Independent plan. From two up to 20 bookable team members use the Team plan per bookable team member. Above 20, Fresha lists custom Enterprise pricing, so no Fresha subscription estimate is given.',
    );
    expect(message).not.toMatch(/two or more/i);
    for (const barbers of [1, 2, 20, 21]) {
      const fresha = provider({ bookableBarbers: barbers }, 'fresha');
      expect(fresha.assumptions.find((entry) => entry.code === 'fresha-plan-from-bookable-team-members')?.message).toBe(
        message,
      );
    }
    expect(line(provider({ bookableBarbers: 1 }, 'fresha'), 'fresha-subscription').plan).toBe('independent');
    expect(line(provider({ bookableBarbers: 2 }, 'fresha'), 'fresha-subscription').plan).toBe('team');
    expect(line(provider({ bookableBarbers: 20 }, 'fresha'), 'fresha-subscription').plan).toBe('team');
    expect(line(provider({ bookableBarbers: 21 }, 'fresha'), 'fresha-subscription').plan).toBe('enterprise');
  });

  it('applies the Marketplace percentage when it exceeds the minimum', () => {
    const fresha = calculated({ marketplaceClients: 3, averageAppointmentValueGbp: 25 }, 'fresha');
    expect(line(fresha, 'fresha-marketplace-fees')).toMatchObject({ quantity: 3, unitExVatGbp: 5, exVatGbp: 15 });
  });

  it('applies the Marketplace minimum for low first appointment values', () => {
    const fresha = calculated({ marketplaceClients: 2, averageAppointmentValueGbp: 10 }, 'fresha');
    expect(line(fresha, 'fresha-marketplace-fees')).toMatchObject({ unitExVatGbp: 4, exVatGbp: 8 });
  });

  it('charges no Marketplace fees and raises no cap warning with zero clients', () => {
    const fresha = calculated({ marketplaceClients: 0 }, 'fresha');
    expect(fresha.amounts.acquisitionFeesExVatGbp).toBe(0);
    expect(warningCodes(fresha)).not.toContain('fresha-marketplace-cap-unresolved');
  });

  it('flags the unresolved Marketplace cap whenever Marketplace clients are modelled', () => {
    for (const overrides of [
      { marketplaceClients: 1 },
      { splitMarketplaceAssumptions: true, freshaMarketplaceClients: 1 },
      { marketplaceClients: 1, averageAppointmentValueGbp: 400 },
    ]) {
      const fresha = provider(overrides, 'fresha');
      const capWarning = fresha.warnings.find((entry) => entry.code === 'fresha-marketplace-cap-unresolved');
      expect(capWarning?.message).toBe(WARNING_MESSAGES['fresha-marketplace-cap-unresolved']);
      expect(capWarning?.message).toContain('may overstate Marketplace fees');
    }
    expect(
      warningCodes(provider({ splitMarketplaceAssumptions: true, marketplaceClients: 5, freshaMarketplaceClients: 0 }, 'fresha')),
    ).not.toContain('fresha-marketplace-cap-unresolved');
  });

  it('applies the published percentage before any cap for high-value first visits', () => {
    const fresha = calculated({ marketplaceClients: 1, averageAppointmentValueGbp: 400 }, 'fresha');
    expect(line(fresha, 'fresha-marketplace-fees').exVatGbp).toBe(80);
  });

  it.each([
    [false, false, 0],
    [true, false, 12.95],
    [false, true, 49.95],
    [true, true, 62.9],
  ])('prices add-ons (Smart Website %s, Client Loyalty %s)', (website, loyalty, expected) => {
    const fresha = calculated({ freshaSmartWebsite: website, freshaClientLoyalty: loyalty }, 'fresha');
    expect(fresha.amounts.addOnsExVatGbp).toBe(expected);
    expect(line(fresha, 'fresha-smart-website').quantity).toBe(website ? 1 : 0);
    expect(line(fresha, 'fresha-client-loyalty').quantity).toBe(loyalty ? 1 : 0);
  });

  it('adds UK VAT to subscription, Marketplace fees and add-ons', () => {
    const fresha = calculated(
      {
        bookableBarbers: 3,
        marketplaceClients: 2,
        averageAppointmentValueGbp: 25,
        freshaSmartWebsite: true,
        freshaClientLoyalty: true,
      },
      'fresha',
    );
    expect(fresha.amounts).toMatchObject({ subtotalExVatGbp: 102.75, vatChargedGbp: 20.55, cashTotalGbp: 123.3 });
  });
});

describe('KERSIVO monthly model', () => {
  it.each([1, 3, 20])('charges one flat subscription for %i barbers', (barbers) => {
    const kersivo = calculated({ bookableBarbers: barbers }, 'kersivo');
    expect(kersivo.amounts).toMatchObject({
      subscriptionExVatGbp: 39,
      teamOrUserFeesExVatGbp: 0,
      commissionExVatGbp: 0,
      acquisitionFeesExVatGbp: 0,
      addOnsExVatGbp: 0,
      subtotalExVatGbp: 39,
      vatChargedGbp: 0,
      cashTotalGbp: 39,
    });
    expect(line(kersivo, 'kersivo-additional-barbers')).toMatchObject({ quantity: barbers - 1, exVatGbp: 0 });
    expect(line(kersivo, 'kersivo-commission').exVatGbp).toBe(0);
    expect(assumptionCodes(kersivo)).toEqual(
      expect.arrayContaining(['single-location', 'kersivo-additional-barbers-included', 'kersivo-no-vat-added']),
    );
  });

  it('ignores marketplace inputs', () => {
    const kersivo = calculated({ marketplaceClients: 50, booksyBoostEnabled: true }, 'kersivo');
    expect(kersivo.amounts.cashTotalGbp).toBe(39);
  });
});

describe('shared behaviour', () => {
  it('uses the shared marketplace count when split assumptions are off', () => {
    const result = run({
      marketplaceClients: 3,
      booksyBoostEnabled: true,
      booksyBoostClients: 10,
      freshaMarketplaceClients: 20,
    });
    expect(result.effectiveMarketplaceClients).toEqual({ booksyBoost: 3, freshaMarketplace: 3 });
    expect(result.assumptions.map((entry) => entry.code)).toEqual(['shared-marketplace-clients']);
    expect(line(result.providers[0], 'booksy-boost').quantity).toBe(3);
    expect(line(result.providers[1], 'fresha-marketplace-fees').quantity).toBe(3);
  });

  it('uses provider-specific counts when split assumptions are on', () => {
    const result = run({
      splitMarketplaceAssumptions: true,
      marketplaceClients: 3,
      booksyBoostEnabled: true,
      booksyBoostClients: 2,
      freshaMarketplaceClients: 5,
    });
    expect(result.effectiveMarketplaceClients).toEqual({ booksyBoost: 2, freshaMarketplace: 5 });
    expect(result.assumptions.map((entry) => entry.code)).toEqual(['split-marketplace-clients']);
    expect(line(result.providers[0], 'booksy-boost').exVatGbp).toBe(15);
    expect(line(result.providers[1], 'fresha-marketplace-fees').exVatGbp).toBe(25);
  });

  it('returns providers in Booksy, Fresha, KERSIVO order', () => {
    expect(run().providers.map((entry) => entry.provider)).toEqual(['booksy', 'fresha', 'kersivo']);
  });

  it.each<[Partial<CostScenarioInput>, keyof CostScenarioInput, string]>([
    [{ bookableBarbers: 0 }, 'bookableBarbers', 'below-minimum'],
    [{ bookableBarbers: -2 }, 'bookableBarbers', 'below-minimum'],
    [{ bookableBarbers: 2.5 }, 'bookableBarbers', 'not-integer'],
    [{ monthlyAppointments: -1 }, 'monthlyAppointments', 'below-minimum'],
    [{ averageAppointmentValueGbp: -0.01 }, 'averageAppointmentValueGbp', 'below-minimum'],
    [{ averageAppointmentValueGbp: Number.NaN }, 'averageAppointmentValueGbp', 'not-a-number'],
    [{ averageAppointmentValueGbp: Number.POSITIVE_INFINITY }, 'averageAppointmentValueGbp', 'not-finite'],
    [{ marketplaceClients: 1.5 }, 'marketplaceClients', 'not-integer'],
    [{ marketplaceClients: -1 }, 'marketplaceClients', 'below-minimum'],
    [{ booksyBoostClients: 0.2 }, 'booksyBoostClients', 'not-integer'],
    [{ freshaMarketplaceClients: -3 }, 'freshaMarketplaceClients', 'below-minimum'],
    [{ vatRegistered: 'yes' as unknown as boolean }, 'vatRegistered', 'not-boolean'],
  ])('rejects invalid input %o', (overrides, field, code) => {
    const result = calculateMonthlyCosts({ ...BASE, ...overrides });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual({ field, code });
  });

  it('reports every invalid field rather than producing totals', () => {
    const result = calculateMonthlyCosts({ ...BASE, bookableBarbers: Number.NaN, marketplaceClients: -1 });
    expect(result).toEqual({
      ok: false,
      errors: [
        { field: 'bookableBarbers', code: 'not-a-number' },
        { field: 'marketplaceClients', code: 'below-minimum' },
      ],
    });
  });

  describe('marketplace clients versus monthly appointments', () => {
    const errorsFor = (overrides: Partial<CostScenarioInput>) => {
      const result = calculateMonthlyCosts({ ...BASE, monthlyAppointments: 10, ...overrides });
      return result.ok ? [] : result.errors;
    };
    const exceeds = (field: keyof CostScenarioInput) => ({ field, code: 'exceeds-monthly-appointments' });

    it('accepts shared marketplace clients equal to monthly appointments', () => {
      expect(errorsFor({ marketplaceClients: 10 })).toEqual([]);
    });

    it('rejects shared marketplace clients above monthly appointments', () => {
      expect(errorsFor({ marketplaceClients: 11 })).toEqual([exceeds('marketplaceClients')]);
    });

    it('rejects split Fresha Marketplace clients above monthly appointments', () => {
      expect(errorsFor({ splitMarketplaceAssumptions: true, freshaMarketplaceClients: 11 })).toEqual([
        exceeds('freshaMarketplaceClients'),
      ]);
    });

    it('rejects split Booksy Boost clients above monthly appointments when Boost is on', () => {
      expect(
        errorsFor({ splitMarketplaceAssumptions: true, booksyBoostEnabled: true, booksyBoostClients: 11 }),
      ).toEqual([exceeds('booksyBoostClients')]);
    });

    it('ignores a stale Booksy Boost count while Boost is off', () => {
      expect(
        errorsFor({ splitMarketplaceAssumptions: true, booksyBoostEnabled: false, booksyBoostClients: 50 }),
      ).toEqual([]);
    });

    it('ignores the inactive shared count while split assumptions are on', () => {
      expect(
        errorsFor({
          splitMarketplaceAssumptions: true,
          booksyBoostEnabled: true,
          marketplaceClients: 50,
          booksyBoostClients: 2,
          freshaMarketplaceClients: 3,
        }),
      ).toEqual([]);
    });

    it('returns cross-field and basic errors together', () => {
      expect(
        errorsFor({
          bookableBarbers: 0,
          splitMarketplaceAssumptions: true,
          booksyBoostEnabled: true,
          booksyBoostClients: 12,
          freshaMarketplaceClients: 15,
          averageAppointmentValueGbp: -1,
        }),
      ).toEqual([
        { field: 'bookableBarbers', code: 'below-minimum' },
        { field: 'averageAppointmentValueGbp', code: 'below-minimum' },
        exceeds('booksyBoostClients'),
        exceeds('freshaMarketplaceClients'),
      ]);
    });
  });

  it('rounds percentage fees to whole pence deterministically', () => {
    const result = run({ marketplaceClients: 3, booksyBoostEnabled: true, averageAppointmentValueGbp: 33.33 });
    const [booksy, fresha] = result.providers;
    expect(line(booksy, 'booksy-boost')).toMatchObject({ unitExVatGbp: 10, exVatGbp: 30 });
    expect(line(fresha, 'fresha-marketplace-fees')).toMatchObject({ unitExVatGbp: 6.67, exVatGbp: 20.01 });
    expect(calculated({ marketplaceClients: 3, averageAppointmentValueGbp: 33.33 }, 'fresha').amounts).toMatchObject({
      subtotalExVatGbp: 34.96,
      vatChargedGbp: 6.99,
      cashTotalGbp: 41.95,
    });
  });

  it('never includes payment processing, even when requested', () => {
    const without = run({ bookableBarbers: 4, marketplaceClients: 2, booksyBoostEnabled: true });
    const withPayments = run({ bookableBarbers: 4, marketplaceClients: 2, booksyBoostEnabled: true, includePayments: true });
    withPayments.providers.forEach((entry, index) => {
      expect(entry.paymentsIncluded).toBe(false);
      expect(entry.amounts).toEqual(without.providers[index].amounts);
      expect(line(entry, 'payment-processing')).toMatchObject({ status: 'not-included', exVatGbp: 0 });
      expect(warningCodes(entry)).toContain('payments-not-included');
      expect(warningCodes(without.providers[index])).not.toContain('payments-not-included');
      if (entry.amounts) expect(entry.amounts.paymentProcessingExVatGbp).toBe(0);
    });
  });

  it('keeps VAT separate and exposes the recoverable estimate only when VAT registered', () => {
    const notRegistered = run({ bookableBarbers: 3 });
    const registered = run({ bookableBarbers: 3, vatRegistered: true });
    registered.providers.forEach((entry, index) => {
      const amounts = (entry as CalculatedProviderResult).amounts;
      const baseline = (notRegistered.providers[index] as CalculatedProviderResult).amounts;
      expect(amounts.cashTotalGbp).toBe(baseline.cashTotalGbp);
      expect(amounts.vatChargedGbp).toBe(baseline.vatChargedGbp);
      expect(amounts.estimatedNetCostIfVatRecoverableGbp).toBe(amounts.subtotalExVatGbp);
      expect(baseline.estimatedNetCostIfVatRecoverableGbp).toBeNull();
      expect(assumptionCodes(entry)).toContain('vat-recovery-depends-on-circumstances');
    });
  });

  it('reconciles every total with its line items across many scenarios', () => {
    let checked = 0;
    for (const bookableBarbers of [1, 2, 3, 8, 20, 21]) {
      for (const averageAppointmentValueGbp of [0, 9.99, 16.67, 25, 33.33, 87.5]) {
        for (const marketplaceClients of [0, 1, 7]) {
          for (const flag of [false, true]) {
            const result = run({
              bookableBarbers,
              averageAppointmentValueGbp,
              marketplaceClients,
              booksyBoostEnabled: flag,
              freshaSmartWebsite: flag,
              freshaClientLoyalty: !flag,
              vatRegistered: flag,
            });
            for (const entry of result.providers) {
              if (entry.status !== 'calculated') continue;
              const { amounts } = entry;
              const lineTotal = roundGbp(entry.lineItems.reduce((sum, item) => sum + (item.exVatGbp ?? 0), 0));
              const categoryTotal = roundGbp(
                amounts.subscriptionExVatGbp +
                  amounts.teamOrUserFeesExVatGbp +
                  amounts.acquisitionFeesExVatGbp +
                  amounts.addOnsExVatGbp +
                  amounts.commissionExVatGbp +
                  amounts.paymentProcessingExVatGbp,
              );
              expect(lineTotal).toBe(amounts.subtotalExVatGbp);
              expect(categoryTotal).toBe(amounts.subtotalExVatGbp);
              expect(roundGbp(amounts.subtotalExVatGbp + amounts.vatChargedGbp)).toBe(amounts.cashTotalGbp);
              for (const value of Object.values(amounts)) {
                if (value === null) continue;
                expect(value).toBeGreaterThanOrEqual(0);
                expect(roundGbp(value)).toBe(value);
              }
              checked += 1;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });
});

describe('engine source guards', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, 'barberSoftwareCostEngine.ts'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('hardcodes no prices, rates or period multipliers', () => {
    const numbers = code.match(/(?<![\w.'-])\d+(\.\d+)?(?![\w'-])/g) ?? [];
    expect(new Set(numbers)).toEqual(new Set(['0', '1']));
    expect(code).not.toContain('£');
  });

  it('stays free of DOM, browser and Astro dependencies', () => {
    expect(code).not.toMatch(/\b(document|window|localStorage|sessionStorage|navigator)\b/);
    expect(code).not.toMatch(/from\s+['"](astro|@astrojs)/);
  });

  it('never consumes unresolved Fresha facts', () => {
    const unresolved = Object.entries(FRESHA_UK_COMMERCIAL_FACTS)
      .filter(([, fact]) => !isVerifiedCommercialFact(fact))
      .map(([key]) => key);
    expect(unresolved).toEqual(expect.arrayContaining(['marketplaceFeeMaximumCap', 'cardCaptureFee']));
    for (const key of unresolved) expect(code).not.toContain(key);
    expect(code).not.toContain('FRESHA_UK_COMMERCIAL_FACTS');
  });

  it('keeps the Marketplace cap warning tied to the cap still being unresolved', () => {
    expect(FRESHA_UK_COMMERCIAL_FACTS.marketplaceFeeMaximumCap.status).toBe('unresolved');
  });

  it('does not project annual or multi-year totals', () => {
    expect(code).not.toMatch(/annual|threeYear|yearly/i);
  });
});
