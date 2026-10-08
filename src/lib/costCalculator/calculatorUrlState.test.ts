import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateCostScenario, type CostScenarioInput } from './barberSoftwareCostEngine';
import { DEFAULT_PERIOD, DEFAULT_SCENARIO } from './calculatorUi';
import {
  PERIOD_PARAM_VALUES,
  SCENARIO_PARAMS,
  buildScenarioUrl,
  decodeScenarioQuery,
  encodeScenarioQuery,
  repairScenario,
} from './calculatorUrlState';
import type { CostPeriod } from './costPeriod';

const PAGE = 'https://kersivo.co.uk/barber-software-cost-calculator';

const FULL: CostScenarioInput = {
  bookableBarbers: 6,
  monthlyAppointments: 900,
  averageAppointmentValueGbp: 27.5,
  marketplaceClients: 12,
  booksyBoostEnabled: true,
  splitMarketplaceAssumptions: true,
  booksyBoostClients: 8,
  freshaMarketplaceClients: 15,
  treatwellMarketplaceClients: 6,
  vagaroMarketplaceClients: 7,
  vagaroDisplayedOffer: true,
  vagaroMySite: true,
  vagaroAssumeVat: false,
  freshaSmartWebsite: true,
  freshaClientLoyalty: true,
  nearcutSubscription: true,
  nearcutMonthlyQuoteGbp: 73.5,
  timelyMonthlyInvoiceGbp: 85,
  treatwellMonthlyQuoteGbp: 89.5,
  treatwellQuoteVatPercent: 20,
  phorestMonthlyQuoteGbp: 145.75,
  phorestQuoteVatPercent: 20,
  squarePlan: 'premium',
  vatRegistered: true,
  includeDepositProcessing: true,
  depositBookingsPerMonth: 300,
};

const decode = (query: string) => decodeScenarioQuery(query);
const expectValid = (scenario: CostScenarioInput) => expect(validateCostScenario(scenario)).toEqual([]);

describe('scenario query parameters', () => {
  it('documents one stable short parameter per scenario field', () => {
    expect(SCENARIO_PARAMS).toEqual({
      bookableBarbers: 'b',
      monthlyAppointments: 'a',
      averageAppointmentValueGbp: 'v',
      marketplaceClients: 'm',
      booksyBoostEnabled: 'boost',
      splitMarketplaceAssumptions: 'split',
      booksyBoostClients: 'bc',
      freshaMarketplaceClients: 'fc',
      treatwellMarketplaceClients: 'tc',
      vagaroMarketplaceClients: 'vc',
      vagaroDisplayedOffer: 'vo',
      vagaroMySite: 'vm',
      vagaroAssumeVat: 'vv',
      freshaSmartWebsite: 'sw',
      freshaClientLoyalty: 'loyalty',
      nearcutSubscription: 'nc',
      nearcutMonthlyQuoteGbp: 'nq',
      timelyMonthlyInvoiceGbp: 'ti',
      treatwellMonthlyQuoteGbp: 'tq',
      treatwellQuoteVatPercent: 'tv',
      phorestMonthlyQuoteGbp: 'pq',
      phorestQuoteVatPercent: 'pv',
      squarePlan: 'sq',
      vatRegistered: 'vat',
      includeDepositProcessing: 'dp',
      depositBookingsPerMonth: 'db',
    });
    expect(Object.keys(SCENARIO_PARAMS).sort()).toEqual(Object.keys(DEFAULT_SCENARIO).sort());
    expect(PERIOD_PARAM_VALUES).toEqual({ monthly: 'm', annual: '12', threeYear: '36' });
  });
});

describe('encodeScenarioQuery', () => {
  it('encodes the default scenario deterministically and round-trips it', () => {
    const query = encodeScenarioQuery(DEFAULT_SCENARIO, 'monthly');
    expect(query).toBe('b=3&a=400&v=25&m=0&boost=0&split=0&bc=0&fc=0&tc=0&vc=0&vo=1&vm=0&vv=0&sw=0&loyalty=0&nc=0&nq=0&ti=0&tq=0&tv=99&pq=0&pv=99&sq=free&vat=0&dp=0&db=0&period=m');
    expect(decode(query)).toEqual({ scenario: DEFAULT_SCENARIO, period: 'monthly', hasScenarioParams: true });
  });

  it('round-trips a full scenario in every period', () => {
    for (const period of ['monthly', 'annual', 'threeYear'] as CostPeriod[]) {
      const decoded = decode(encodeScenarioQuery(FULL, period));
      expect(decoded.scenario).toEqual(FULL);
      expect(decoded.period).toBe(period);
    }
    expect(encodeScenarioQuery(FULL, 'annual')).toContain('period=12');
    expect(encodeScenarioQuery(FULL, 'annual')).toContain('sq=premium');
    expect(encodeScenarioQuery(FULL, 'threeYear')).toContain('period=36');
  });

  it('encodes decimals as plain numbers and booleans as 1/0, never currency', () => {
    const query = encodeScenarioQuery({ ...DEFAULT_SCENARIO, averageAppointmentValueGbp: 25.5, vatRegistered: true }, 'monthly');
    expect(query).toContain('v=25.5');
    expect(query).toContain('vat=1');
    expect(query).not.toMatch(/%C2%A3|£|true|false/);
  });

  it('contains only input state: no prices, totals or provider names', () => {
    const query = encodeScenarioQuery(FULL, 'threeYear');
    const keys = [...new URLSearchParams(query).keys()];
    expect(keys).toEqual([...Object.values(SCENARIO_PARAMS), 'period']);
    expect(query).not.toMatch(/total|price|booksy|fresha|kersivo|cost|utm|email|name|phone/i);
  });

  it('builds a clean share URL on the page path, dropping existing params and hashes', () => {
    const url = buildScenarioUrl(`${PAGE}?utm_source=x&b=9#calculator`, FULL, 'annual');
    expect(url.startsWith(`${PAGE}?b=6&`)).toBe(true);
    expect(url).not.toMatch(/utm_|#/);
  });
});

describe('decodeScenarioQuery', () => {
  it('returns defaults with no scenario params for a bare or unrelated query', () => {
    expect(decode('')).toEqual({ scenario: DEFAULT_SCENARIO, period: DEFAULT_PERIOD, hasScenarioParams: false });
    expect(decode('?utm_source=newsletter&foo=1')).toEqual({
      scenario: DEFAULT_SCENARIO,
      period: DEFAULT_PERIOD,
      hasScenarioParams: false,
    });
  });

  it('fills a partial URL from defaults and ignores unknown params', () => {
    const { scenario, period } = decode('?b=5&period=36&ref=abc');
    expect(scenario).toEqual({ ...DEFAULT_SCENARIO, bookableBarbers: 5 });
    expect(period).toBe('threeYear');
  });

  it('reads boolean fields only from 1 and 0', () => {
    expect(decode('boost=1&sw=1&loyalty=0&vat=1').scenario).toMatchObject({
      booksyBoostEnabled: true,
      freshaSmartWebsite: true,
      freshaClientLoyalty: false,
      vatRegistered: true,
    });
    for (const raw of ['true', 'yes', 'on', '2', '']) {
      expect(decode(`boost=${raw}`).scenario.booksyBoostEnabled).toBe(DEFAULT_SCENARIO.booksyBoostEnabled);
    }
  });

  it('restores split marketplace and deposit processing state', () => {
    expect(decode('split=1&bc=4&fc=9&dp=1&db=120').scenario).toMatchObject({
      splitMarketplaceAssumptions: true,
      booksyBoostClients: 4,
      freshaMarketplaceClients: 9,
      includeDepositProcessing: true,
      depositBookingsPerMonth: 120,
    });
  });

  it('falls back per field for malformed, non-finite, negative or currency numbers', () => {
    for (const raw of ['abc', 'NaN', 'Infinity', '-Infinity', '1e3', '-2', '£25', '25,5', '0x10', ' ', '3.']) {
      const { scenario } = decode(`b=${encodeURIComponent(raw)}&v=${encodeURIComponent(raw)}`);
      expect(scenario.bookableBarbers).toBe(DEFAULT_SCENARIO.bookableBarbers);
      expect(scenario.averageAppointmentValueGbp).toBe(DEFAULT_SCENARIO.averageAppointmentValueGbp);
      expectValid(scenario);
    }
    expect(decode('v=25.5').scenario.averageAppointmentValueGbp).toBe(25.5);
  });

  it('lets the engine reject non-integers and resets only the offending field', () => {
    const { scenario } = decode('b=2.5&a=300');
    expect(scenario.bookableBarbers).toBe(DEFAULT_SCENARIO.bookableBarbers);
    expect(scenario.monthlyAppointments).toBe(300);
  });

  it('resets values outside the form input bounds', () => {
    expect(decode('b=0').scenario.bookableBarbers).toBe(DEFAULT_SCENARIO.bookableBarbers);
    expect(decode('b=999').scenario.bookableBarbers).toBe(DEFAULT_SCENARIO.bookableBarbers);
    expect(decode('a=999999').scenario.monthlyAppointments).toBe(DEFAULT_SCENARIO.monthlyAppointments);
  });

  it('falls back to the default period for unsupported values', () => {
    for (const raw of ['annual', '24', 'M', '', 'threeYear']) {
      expect(decode(`period=${raw}`).period).toBe(DEFAULT_PERIOD);
    }
    expect(decode('period=12').period).toBe('annual');
  });

  it('resets deposit bookings that exceed monthly appointments', () => {
    const { scenario } = decode('a=50&dp=1&db=80');
    expect(scenario.monthlyAppointments).toBe(50);
    expect(scenario.includeDepositProcessing).toBe(true);
    expect(scenario.depositBookingsPerMonth).toBe(DEFAULT_SCENARIO.depositBookingsPerMonth);
    expectValid(scenario);
  });

  it('resets marketplace clients that exceed monthly appointments', () => {
    expect(decode('a=10&m=50').scenario).toMatchObject({ monthlyAppointments: 10, marketplaceClients: 0 });
    expect(decode('a=10&split=1&boost=1&bc=40&fc=5').scenario).toMatchObject({
      booksyBoostClients: 0,
      freshaMarketplaceClients: 5,
    });
  });

  it('always returns a scenario that passes engine validation', () => {
    const queries = [
      'b=-1&a=-5&v=-3&m=-1&dp=1&db=-4',
      'a=0&m=1&split=1&bc=2&fc=3&dp=1&db=1',
      'b=30&a=20000&v=500&m=1000&boost=1&dp=1&db=20000',
      'b=1&a=1&m=1&dp=1&db=1&split=1&bc=1&fc=1',
      'a=abc&m=5&db=5&dp=1',
    ];
    for (const query of queries) expectValid(decode(query).scenario);
  });
});

describe('repairScenario', () => {
  it('returns valid scenarios unchanged and repairs only rejected fields', () => {
    expect(repairScenario(FULL)).toEqual(FULL);
    expect(repairScenario({ ...FULL, bookableBarbers: Number.NaN })).toEqual({
      ...FULL,
      bookableBarbers: DEFAULT_SCENARIO.bookableBarbers,
    });
  });
});

describe('URL-state architecture guards', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, 'calculatorUrlState.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('contains no pricing, projection, DOM or facts dependencies', () => {
    expect(source).not.toMatch(/calculateMonthlyCosts|projectCostCalculation|percentOfPence|transactionFeePence/);
    expect(source).not.toMatch(/@\/lib\/seo|Facts|SAAS_MONTHLY|PERIOD_MONTHS/);
    expect(source).not.toMatch(/\b(document|window|localStorage|navigator|history)\b/);
  });

  it('delegates business rules to the engine validator', () => {
    expect(source).toContain('validateCostScenario(scenario)');
  });
});
