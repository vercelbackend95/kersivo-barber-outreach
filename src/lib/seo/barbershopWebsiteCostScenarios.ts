/**
 * Section 04 scaling-cost calculation layer for `/barbershop-website-cost-uk`.
 *
 * Pure maths over `barbershopWebsiteCostOffers.ts` — never a second price catalogue.
 * Chart bars, provider cards and the KERSIVO summary must all call these helpers.
 */

import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  WEBSITE_COST_CURRENT_FINDINGS,
  WEBSITE_COST_PRIMARY_IDS,
  getComparableWebsiteCostFigures,
  type CostPricingConfidence,
  type WebsiteCostPrimaryId,
} from '@/lib/seo/barbershopWebsiteCostOffers';

/** Section 04 display amounts — grouped thousands for large period totals. */
function formatScenarioGbp(amount: number): string {
  if (Number.isInteger(amount)) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const COST_SCENARIOS_SECTION_ID = 'cost-scenarios';

export const SCENARIO_BARBER_COUNTS = [2, 3, 4, 5, 6, 7, 8] as const;
export type ScenarioBarberCount = (typeof SCENARIO_BARBER_COUNTS)[number];

export const SCENARIO_PERIODS = ['monthly', '12', '36'] as const;
export type ScenarioPeriod = (typeof SCENARIO_PERIODS)[number];

export const SCENARIO_DEFAULT = {
  barbers: 4 as ScenarioBarberCount,
  period: '36' as ScenarioPeriod,
};

/** Vagaro published calendar formula is verified for 2–7; 8 needs an official quote. */
export const VAGARO_PUBLISHED_MAX_BARBERS = 7;

export type ScenarioPricingStatus =
  | 'published-subtotal'
  | 'indicative'
  | 'quote-required'
  | 'price-conflict'
  | 'combined-stack'
  | 'per-location';

export type ScenarioProviderRow = {
  id: WebsiteCostPrimaryId;
  name: string;
  shortName: string;
  chartLabel: string;
  /** Null = no numeric bar (quote / unverified). Never coerce unknown to 0. */
  amountGbp: number | null;
  displayFigure: string;
  figureSecondary?: string;
  billingQualifier: string;
  vatBasisLabel: string;
  /** Short VAT line shown on the provider card itself. */
  cardVatLabel: string;
  status: ScenarioPricingStatus;
  statusLabel: string;
  confidence: CostPricingConfidence;
  isCompleteSubtotal: boolean;
  emphasized: boolean;
  monthlyRecurringGbp: number | null;
  setupGbpIncluded: number | null;
  periodMonths: number | null;
};

/** Static card scope lines. Not recomputed when the scenario changes. */
export const CARD_CHECKS: Record<WebsiteCostPrimaryId, readonly string[]> = {
  'vagaro-mysite': ['Website builder', 'Online booking', 'Per-calendar pricing', 'Self-build setup'],
  'fresha-team-smart-website': ['Smart Website', 'Online booking', 'Team-based pricing', 'Indicative pricing'],
  'nearcut-subscription': ['Website + booking', 'Quote required', 'Subscription model', 'Custom pricing'],
  'setora-core': ['Platform website', 'Online booking', 'Per-location pricing', 'Price conflict'],
  'uxhm-salon-growth': ['Done-for-you website', 'Booksy booking', '£499 setup', 'Separate booking cost'],
  'full-kersivo': ['Branded website', 'Online booking', '2–8 barbers included', 'SMS reminders', 'Shop tools'],
};

export type ScenarioComparison = {
  barbers: ScenarioBarberCount;
  period: ScenarioPeriod;
  chartTitle: string;
  chartSubheading: string;
  /** Updates with barber count and period for the chart's accessible name. */
  chartDescription: string;
  providers: readonly ScenarioProviderRow[];
  /** Max numeric bar height basis; ignore null amounts. */
  chartMaxGbp: number;
  kersivoSummary: {
    name: string;
    amountGbp: number;
    displayFigure: string;
    caption: string;
    scenarioLabel: string;
    ctaLabel: string;
    ctaSupport: string;
  };
};

const DISPLAY_NAMES: Record<
  WebsiteCostPrimaryId,
  { name: string; shortName: string; chartLabel: string }
> = {
  'vagaro-mysite': {
    name: 'Vagaro Pro + MySite',
    shortName: 'Vagaro',
    chartLabel: 'Vagaro',
  },
  'fresha-team-smart-website': {
    name: 'Fresha Team + Smart Website',
    shortName: 'Fresha',
    chartLabel: 'Fresha',
  },
  'nearcut-subscription': {
    name: 'Nearcut Subscription',
    shortName: 'Nearcut',
    chartLabel: 'Nearcut',
  },
  'setora-core': {
    name: 'Setora',
    shortName: 'Setora',
    chartLabel: 'Setora',
  },
  'uxhm-salon-growth': {
    name: 'UXHM + Booksy',
    shortName: 'UXHM + Booksy',
    chartLabel: 'UXHM',
  },
  'full-kersivo': {
    name: 'Full KERSIVO',
    shortName: 'KERSIVO',
    chartLabel: 'KERSIVO',
  },
};

const STATUS_LABELS: Record<ScenarioPricingStatus, string> = {
  'published-subtotal': 'Published subtotal',
  indicative: 'Indicative',
  'quote-required': 'Quote required',
  'price-conflict': 'Price conflict',
  'combined-stack': 'Combined stack',
  'per-location': 'Per-location pricing',
};

function periodMonths(period: ScenarioPeriod): number | null {
  if (period === 'monthly') return null;
  return period === '12' ? 12 : 36;
}

function chartTitleFor(period: ScenarioPeriod): string {
  if (period === 'monthly') return 'Monthly published / indicative subtotals';
  if (period === '12') return '12-month published / indicative subtotals';
  return '36-month published / indicative subtotals';
}

const CARD_VAT_LABELS: Record<WebsiteCostPrimaryId, string> = {
  'vagaro-mysite': 'VAT unconfirmed',
  'fresha-team-smart-website': 'Indicative, excluding VAT',
  'nearcut-subscription': 'Quote required',
  'setora-core': 'VAT and price conflict',
  'uxhm-salon-growth': 'Booksy includes VAT; website VAT unconfirmed',
  'full-kersivo': 'No VAT currently added',
};

function assertBarberCount(n: number): asserts n is ScenarioBarberCount {
  if (!(SCENARIO_BARBER_COUNTS as readonly number[]).includes(n)) {
    throw new RangeError(`bookableBarbers must be one of ${SCENARIO_BARBER_COUNTS.join(', ')}`);
  }
}

function assertPeriod(period: string): asserts period is ScenarioPeriod {
  if (!(SCENARIO_PERIODS as readonly string[]).includes(period)) {
    throw new RangeError(`period must be one of ${SCENARIO_PERIODS.join(', ')}`);
  }
}

function roundGbp(n: number): number {
  return Math.round(n * 100) / 100;
}

function multiplyPeriod(monthly: number, period: ScenarioPeriod): number {
  const months = periodMonths(period);
  return months === null ? monthly : roundGbp(monthly * months);
}

function buildProviderRow(
  offerId: WebsiteCostPrimaryId,
  barbers: ScenarioBarberCount,
  period: ScenarioPeriod,
): ScenarioProviderRow {
  const figures = getComparableWebsiteCostFigures(offerId, barbers);
  const names = DISPLAY_NAMES[offerId];
  const months = periodMonths(period);

  if (offerId === 'nearcut-subscription') {
    return {
      id: offerId,
      ...names,
      amountGbp: null,
      displayFigure: 'Custom quote',
      billingQualifier: 'Shop-paid Subscription · quote by team size',
      vatBasisLabel: 'Quote required · Free for You £1.50 example is not this package',
      cardVatLabel: CARD_VAT_LABELS['nearcut-subscription'],
      status: 'quote-required',
      statusLabel: STATUS_LABELS['quote-required'],
      confidence: 'custom-quote',
      isCompleteSubtotal: false,
      emphasized: false,
      monthlyRecurringGbp: null,
      setupGbpIncluded: null,
      periodMonths: months,
    };
  }

  if (offerId === 'vagaro-mysite' && barbers > VAGARO_PUBLISHED_MAX_BARBERS) {
    return {
      id: offerId,
      ...names,
      amountGbp: null,
      displayFigure: 'Quote required',
      billingQualifier: 'Eight calendars not verified on the published UK tier',
      vatBasisLabel: 'Published subtotal · VAT unconfirmed',
      cardVatLabel: CARD_VAT_LABELS['vagaro-mysite'],
      status: 'quote-required',
      statusLabel: STATUS_LABELS['quote-required'],
      confidence: 'custom-quote',
      isCompleteSubtotal: false,
      emphasized: false,
      monthlyRecurringGbp: null,
      setupGbpIncluded: null,
      periodMonths: months,
    };
  }

  if (offerId === 'vagaro-mysite') {
    const monthly = figures.recurringGbpPerMonth!;
    const amount = multiplyPeriod(monthly, period);
    return {
      id: offerId,
      ...names,
      amountGbp: amount,
      displayFigure: formatScenarioGbp(amount),
      billingQualifier:
        period === 'monthly'
          ? 'Per month · published calendar + MySite subtotal'
          : `${months}-month published subscription subtotal`,
      vatBasisLabel: 'Published subtotal · VAT unconfirmed',
      cardVatLabel: CARD_VAT_LABELS['vagaro-mysite'],
      status: 'published-subtotal',
      statusLabel: STATUS_LABELS['published-subtotal'],
      confidence: 'published',
      isCompleteSubtotal: false,
      emphasized: false,
      monthlyRecurringGbp: monthly,
      setupGbpIncluded: 0,
      periodMonths: months,
    };
  }

  if (offerId === 'fresha-team-smart-website') {
    const monthly = figures.recurringGbpPerMonth!;
    const monthlyInc = figures.recurringIncludingVatGbp!;
    const amount = multiplyPeriod(monthly, period);
    return {
      id: offerId,
      ...names,
      amountGbp: amount,
      displayFigure: formatScenarioGbp(amount),
      figureSecondary:
        period === 'monthly'
          ? `${formatScenarioGbp(monthlyInc)} inc. VAT (illustrative 20%)`
          : undefined,
      billingQualifier:
        period === 'monthly'
          ? 'Indicative UK pricing / month · excl. VAT'
          : `Indicative ${months}-month subtotal · excl. VAT`,
      vatBasisLabel: 'Indicative · excl. VAT',
      cardVatLabel: CARD_VAT_LABELS['fresha-team-smart-website'],
      status: 'indicative',
      statusLabel: STATUS_LABELS.indicative,
      confidence: 'indicative',
      isCompleteSubtotal: false,
      emphasized: false,
      monthlyRecurringGbp: monthly,
      setupGbpIncluded: 0,
      periodMonths: months,
    };
  }

  if (offerId === 'setora-core') {
    const monthly = figures.recurringGbpPerMonth!;
    const amount = multiplyPeriod(monthly, period);
    const conflict = figures.conflictingPublishedRecurringGbp ?? [39, 59];
    return {
      id: offerId,
      ...names,
      amountGbp: amount,
      displayFigure: formatScenarioGbp(amount),
      figureSecondary: `Conflict also recorded ${formatScenarioGbp(conflict[0]!)}/mo`,
      billingQualifier:
        period === 'monthly'
          ? 'Per month / location · owner-selected headline'
          : `${months}-month subtotal at owner-selected £59 headline`,
      vatBasisLabel: 'Published headline · tax unconfirmed',
      cardVatLabel: CARD_VAT_LABELS['setora-core'],
      status: 'price-conflict',
      statusLabel: STATUS_LABELS['price-conflict'],
      confidence: 'conflict',
      isCompleteSubtotal: false,
      emphasized: false,
      monthlyRecurringGbp: monthly,
      setupGbpIncluded: null,
      periodMonths: months,
    };
  }

  if (offerId === 'uxhm-salon-growth') {
    const setup = figures.setupGbp ?? WEBSITE_COST_CURRENT_FINDINGS.uxhmSalonGrowthSetupGbp;
    const booksyMonthly = figures.externalBooksyMonthlyIncVatGbp!;
    const amount =
      period === 'monthly' ? booksyMonthly : roundGbp(setup + booksyMonthly * months!);
    return {
      id: offerId,
      ...names,
      amountGbp: amount,
      displayFigure: formatScenarioGbp(amount),
      figureSecondary:
        period === 'monthly'
          ? `+ ${formatScenarioGbp(setup)} one-off website build`
          : `Includes ${formatScenarioGbp(setup)} website build once`,
      billingQualifier:
        period === 'monthly'
          ? 'Booksy monthly (inc. VAT) · website build separate'
          : `${months}-month known stack subtotal`,
      vatBasisLabel: 'Includes VAT on Booksy · website VAT unconfirmed',
      cardVatLabel: CARD_VAT_LABELS['uxhm-salon-growth'],
      status: 'combined-stack',
      statusLabel: STATUS_LABELS['combined-stack'],
      confidence: 'published',
      isCompleteSubtotal: false,
      emphasized: false,
      monthlyRecurringGbp: booksyMonthly,
      setupGbpIncluded: period === 'monthly' ? null : setup,
      periodMonths: months,
    };
  }

  // full-kersivo
  const monthly = SAAS_MONTHLY_GBP;
  const amount = multiplyPeriod(monthly, period);
  return {
    id: offerId,
    ...names,
    amountGbp: amount,
    displayFigure: formatScenarioGbp(amount),
    billingQualifier:
      period === 'monthly'
        ? 'Per month / location · no separate standard setup'
        : `${months}-month subscription subtotal · no VAT currently added`,
    vatBasisLabel: 'Subscription subtotal · no VAT currently added',
    cardVatLabel: CARD_VAT_LABELS['full-kersivo'],
    status: 'per-location',
    statusLabel: STATUS_LABELS['per-location'],
    confidence: 'published',
    isCompleteSubtotal: false,
    emphasized: true,
    monthlyRecurringGbp: monthly,
    setupGbpIncluded: 0,
    periodMonths: months,
  };
}

export function getScenarioProviderRow(
  offerId: WebsiteCostPrimaryId,
  bookableBarbers: number,
  period: ScenarioPeriod,
): ScenarioProviderRow {
  assertBarberCount(bookableBarbers);
  assertPeriod(period);
  return buildProviderRow(offerId, bookableBarbers, period);
}

export function getScenarioComparison(
  bookableBarbers: number = SCENARIO_DEFAULT.barbers,
  period: ScenarioPeriod = SCENARIO_DEFAULT.period,
): ScenarioComparison {
  assertBarberCount(bookableBarbers);
  assertPeriod(period);

  const providers = WEBSITE_COST_PRIMARY_IDS.map((id) =>
    buildProviderRow(id, bookableBarbers, period),
  );
  const numeric = providers
    .map((row) => row.amountGbp)
    .filter((n): n is number => n != null && n > 0);
  const chartMaxGbp = numeric.length > 0 ? Math.max(...numeric) : SAAS_MONTHLY_GBP;
  const kersivo = providers.find((row) => row.id === 'full-kersivo')!;

  const periodWord =
    period === 'monthly' ? 'Monthly' : period === '12' ? '12 months' : '36 months';
  const ctaLabel =
    period === 'monthly'
      ? 'Monthly subscription'
      : period === '12'
        ? 'Your 1-year subtotal'
        : 'Your 3-year subtotal';
  const ctaSupport = period === 'monthly' ? 'Per location' : "At today's subscription rate";
  const chartTitle = chartTitleFor(period);
  const chartSubheading = `For ${bookableBarbers} bookable barbers`;
  const chartDescription = [
    `Vertical column chart of published or indicative package subtotals, not guaranteed complete costs.`,
    `${chartTitle}. ${chartSubheading}. Period: ${periodWord}.`,
    ...providers.map((row) => `${row.name}: ${row.displayFigure}. ${row.cardVatLabel}.`),
  ].join(' ');

  return {
    barbers: bookableBarbers,
    period,
    chartTitle,
    chartSubheading,
    chartDescription,
    providers,
    chartMaxGbp,
    kersivoSummary: {
      name: kersivo.name,
      amountGbp: kersivo.amountGbp!,
      displayFigure: kersivo.displayFigure,
      caption: `${formatScenarioGbp(SAAS_MONTHLY_GBP)}/month per location`,
      scenarioLabel: `${bookableBarbers} barbers · ${periodWord.toLowerCase()}`,
      ctaLabel,
      ctaSupport,
    },
  };
}

export function fullKersivoTotalGbp(months: 12 | 36): number {
  return SAAS_MONTHLY_GBP * months;
}

export const COST_SCENARIO_C_12 = fullKersivoTotalGbp(12);
export const COST_SCENARIO_C_36 = fullKersivoTotalGbp(36);

/** Precompute every control combination for progressive enhancement (no client-side price maths). */
export function buildScenarioPayload(): {
  defaults: typeof SCENARIO_DEFAULT;
  barberCounts: readonly ScenarioBarberCount[];
  periods: readonly ScenarioPeriod[];
  states: Record<string, ScenarioComparison>;
} {
  const states: Record<string, ScenarioComparison> = {};
  for (const barbers of SCENARIO_BARBER_COUNTS) {
    for (const period of SCENARIO_PERIODS) {
      states[`${barbers}:${period}`] = getScenarioComparison(barbers, period);
    }
  }
  return {
    defaults: SCENARIO_DEFAULT,
    barberCounts: SCENARIO_BARBER_COUNTS,
    periods: SCENARIO_PERIODS,
    states,
  };
}

export function scenarioStateKey(
  barbers: ScenarioBarberCount,
  period: ScenarioPeriod,
): string {
  return `${barbers}:${period}`;
}

export function barHeightPercent(amountGbp: number | null, chartMaxGbp: number): number {
  if (amountGbp == null || chartMaxGbp <= 0) return 0;
  // Keep small KERSIVO bars visually present (≥8% when non-zero).
  const raw = (amountGbp / chartMaxGbp) * 100;
  return Math.max(8, Math.min(100, raw));
}
