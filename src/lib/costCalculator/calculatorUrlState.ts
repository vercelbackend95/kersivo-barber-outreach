/**
 * Shareable calculator scenario URLs: input state only, never prices or totals.
 * Pure and DOM-free. The engine's validateCostScenario() stays the only business-rule check;
 * this module only parses primitive formats and repairs rejected fields back to their defaults.
 *
 * Query parameters (stable, documented):
 *   b       bookable barbers                 integer
 *   a       monthly appointments             integer
 *   v       average appointment value (GBP)  plain decimal, e.g. 25.5
 *   m       shared marketplace clients       integer
 *   boost   Booksy Boost                     1 | 0
 *   split   separate marketplace counts      1 | 0
 *   bc      Booksy Boost clients             integer
 *   fc      Fresha Marketplace clients       integer
 *   vc      Vagaro Marketplace new clients   integer
 *   vo      Vagaro displayed offer           1 | 0
 *   vm      Vagaro MySite                    1 | 0
 *   vv      Add assumed Vagaro VAT           1 | 0
 *   sw      Fresha Smart Website             1 | 0
 *   loyalty Fresha Client Loyalty            1 | 0
 *   nc      Nearcut Subscription             1 | 0
 *   nq      Nearcut monthly quote (ex VAT)    decimal, 0 if unknown
 *   vat     VAT registered                   1 | 0
 *   dp      booking deposit processing       1 | 0
 *   db      deposit bookings per month       integer
 *   period  m | 12 | 36                      monthly | 12 months | 3 years
 */

import { validateCostScenario, type CostScenarioInput } from './barberSoftwareCostEngine';
import { DEFAULT_PERIOD, DEFAULT_SCENARIO, NUMBER_FIELDS } from './calculatorUi';
import type { CostPeriod } from './costPeriod';

type ScenarioKey = keyof CostScenarioInput;
type NumberKey = { [K in ScenarioKey]: CostScenarioInput[K] extends number ? K : never }[ScenarioKey];
type BooleanKey = Exclude<ScenarioKey, NumberKey>;

export const SCENARIO_PARAMS = {
  bookableBarbers: 'b',
  monthlyAppointments: 'a',
  averageAppointmentValueGbp: 'v',
  marketplaceClients: 'm',
  booksyBoostEnabled: 'boost',
  splitMarketplaceAssumptions: 'split',
  booksyBoostClients: 'bc',
  freshaMarketplaceClients: 'fc',
  vagaroMarketplaceClients: 'vc',
  vagaroDisplayedOffer: 'vo',
  vagaroMySite: 'vm',
  vagaroAssumeVat: 'vv',
  freshaSmartWebsite: 'sw',
  freshaClientLoyalty: 'loyalty',
  nearcutSubscription: 'nc',
  nearcutMonthlyQuoteGbp: 'nq',
  vatRegistered: 'vat',
  includeDepositProcessing: 'dp',
  depositBookingsPerMonth: 'db',
} as const satisfies Record<ScenarioKey, string>;

export const PERIOD_PARAM = 'period';

export const PERIOD_PARAM_VALUES = {
  monthly: 'm',
  annual: '12',
  threeYear: '36',
} as const satisfies Record<CostPeriod, string>;

/** Inputs inside the collapsed Advanced costs section; a non-default value opens it. */
export const ADVANCED_SCENARIO_KEYS = [
  'vatRegistered',
  'freshaSmartWebsite',
  'freshaClientLoyalty',
  'vagaroDisplayedOffer',
  'vagaroMySite',
  'vagaroAssumeVat',
  'nearcutSubscription',
  'includeDepositProcessing',
] as const satisfies readonly BooleanKey[];

const SCENARIO_KEYS = Object.keys(SCENARIO_PARAMS) as ScenarioKey[];

const isNumberKey = (key: ScenarioKey): key is NumberKey => typeof DEFAULT_SCENARIO[key] === 'number';

/** Plain non-negative decimals only: no signs, exponents, separators, currency or NaN/Infinity. */
const PLAIN_NUMBER = /^\d{1,7}(\.\d{1,2})?$/;

function parseNumber(raw: string): number | null {
  if (!PLAIN_NUMBER.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseBoolean(raw: string): boolean | null {
  if (raw === '1') return true;
  if (raw === '0') return false;
  return null;
}

/** Keeps URL values inside the same bounds the form inputs already enforce. */
function withinFieldBounds(key: NumberKey, value: number): boolean {
  const field = NUMBER_FIELDS.find((entry) => entry.name === key);
  return !field || (value >= field.min && value <= field.max);
}

export type DecodedUrlState = {
  scenario: CostScenarioInput;
  period: CostPeriod;
  /** True when at least one supported parameter was present. */
  hasScenarioParams: boolean;
};

/**
 * Resets every field the engine rejects back to its default, repeating until the scenario
 * is valid. Falls back to the full default scenario if repair is impossible.
 */
export function repairScenario(candidate: CostScenarioInput): CostScenarioInput {
  let scenario: CostScenarioInput = { ...candidate };
  for (let attempt = 0; attempt <= SCENARIO_KEYS.length; attempt += 1) {
    const issues = validateCostScenario(scenario);
    if (issues.length === 0) return scenario;
    const repaired: CostScenarioInput = { ...scenario };
    for (const issue of issues) Object.assign(repaired, { [issue.field]: DEFAULT_SCENARIO[issue.field] });
    scenario = repaired;
  }
  return { ...DEFAULT_SCENARIO };
}

export function decodeScenarioQuery(search: string | URLSearchParams): DecodedUrlState {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const candidate: CostScenarioInput = { ...DEFAULT_SCENARIO };
  let hasScenarioParams = false;

  for (const key of SCENARIO_KEYS) {
    const raw = params.get(SCENARIO_PARAMS[key]);
    if (raw === null) continue;
    hasScenarioParams = true;
    if (isNumberKey(key)) {
      const value = parseNumber(raw.trim());
      if (value !== null && withinFieldBounds(key, value)) candidate[key] = value;
    } else {
      const value = parseBoolean(raw.trim());
      if (value !== null) candidate[key as BooleanKey] = value;
    }
  }

  const rawPeriod = params.get(PERIOD_PARAM);
  if (rawPeriod !== null) hasScenarioParams = true;
  const period =
    (Object.keys(PERIOD_PARAM_VALUES) as CostPeriod[]).find((entry) => PERIOD_PARAM_VALUES[entry] === rawPeriod) ??
    DEFAULT_PERIOD;

  return { scenario: repairScenario(candidate), period, hasScenarioParams };
}

/** Deterministic query string in a fixed parameter order. Non-finite numbers are omitted. */
export function encodeScenarioQuery(scenario: CostScenarioInput, period: CostPeriod): string {
  const params = new URLSearchParams();
  for (const key of SCENARIO_KEYS) {
    const value = scenario[key];
    if (typeof value === 'boolean') params.set(SCENARIO_PARAMS[key], value ? '1' : '0');
    else if (Number.isFinite(value)) params.set(SCENARIO_PARAMS[key], String(value));
  }
  params.set(PERIOD_PARAM, PERIOD_PARAM_VALUES[period]);
  return params.toString();
}

/** Replaces the whole query string and drops any hash, so tracking parameters are never carried over. */
export function buildScenarioUrl(pageHref: string, scenario: CostScenarioInput, period: CostPeriod): string {
  const url = new URL(pageHref);
  url.search = encodeScenarioQuery(scenario, period);
  url.hash = '';
  return url.toString();
}
