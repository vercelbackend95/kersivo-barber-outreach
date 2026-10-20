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
  formatWebsiteCostGbp,
  getComparableWebsiteCostFigures,
  requireWebsiteCostOfferById,
  type CostPricingConfidence,
  type WebsiteCostPrimaryId,
  type WebsiteDeliveryKind,
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

export type ScenarioBreakdownLine = {
  id: string;
  label: string;
  amountLabel: string;
  note?: string;
};

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
  status: ScenarioPricingStatus;
  statusLabel: string;
  explanation: string;
  deliveryKind: WebsiteDeliveryKind;
  deliveryLabel: string;
  confidence: CostPricingConfidence;
  isCompleteSubtotal: boolean;
  missingFees: readonly string[];
  breakdown: readonly ScenarioBreakdownLine[];
  sourceHref?: string;
  sourceLabel?: string;
  emphasized: boolean;
  monthlyRecurringGbp: number | null;
  setupGbpIncluded: number | null;
  periodMonths: number | null;
};

export type ScenarioComparison = {
  barbers: ScenarioBarberCount;
  period: ScenarioPeriod;
  chartTitle: string;
  chartSubheading: string;
  providers: readonly ScenarioProviderRow[];
  /** Max numeric bar height basis; ignore null amounts. */
  chartMaxGbp: number;
  kersivoSummary: {
    name: string;
    amountGbp: number;
    displayFigure: string;
    caption: string;
    scenarioLabel: string;
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
  if (period === 'monthly') return 'Monthly cost comparison';
  if (period === '12') return 'Total cost over 12 months';
  return 'Total cost over 36 months';
}

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

function sharedMissingFees(extra: readonly string[] = []): string[] {
  return [
    ...extra,
    'Payment-processing fees (usage-dependent)',
    'Domain registration or renewal where not confirmed',
  ];
}

function buildProviderRow(
  offerId: WebsiteCostPrimaryId,
  barbers: ScenarioBarberCount,
  period: ScenarioPeriod,
): ScenarioProviderRow {
  const offer = requireWebsiteCostOfferById(offerId);
  const figures = getComparableWebsiteCostFigures(offerId, barbers);
  const names = DISPLAY_NAMES[offerId];
  const delivery = offer.websiteDelivery;
  const deliveryKind = delivery?.kind ?? 'not-confirmed';
  const deliveryLabel = delivery?.label ?? 'Website setup not confirmed';
  const sourceHref = offer.sources[0];
  const months = periodMonths(period);

  if (offerId === 'nearcut-subscription') {
    return {
      id: offerId,
      ...names,
      amountGbp: null,
      displayFigure: 'Custom quote',
      billingQualifier: 'Shop-paid Subscription · quote by team size',
      vatBasisLabel: 'Quote required · Free for You £1.50 example is not this package',
      status: 'quote-required',
      statusLabel: STATUS_LABELS['quote-required'],
      explanation:
        'Nearcut Subscription is quoted for shop needs and team size. No verified public fixed price for this configuration.',
      deliveryKind,
      deliveryLabel,
      confidence: 'custom-quote',
      isCompleteSubtotal: false,
      missingFees: sharedMissingFees([
        'UK Business Booster for product sales/stock (£7.50/month advertised) may apply',
        'Retail pickup not publicly confirmed',
      ]),
      breakdown: [
        {
          id: 'subscription',
          label: 'Subscription monthly',
          amountLabel: 'Quote required',
          note: 'Do not use Free for You customer booking-fee examples as the shop invoice',
        },
        {
          id: 'booster',
          label: 'Product sales Business Booster',
          amountLabel: 'Additional quote',
          note: `UK advertised ${formatWebsiteCostGbp(WEBSITE_COST_CURRENT_FINDINGS.nearcutProductBoosterUkAdvertisedMonthlyGbp)}/month where applicable`,
        },
      ],
      sourceHref,
      sourceLabel: 'Nearcut pricing',
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
      status: 'quote-required',
      statusLabel: STATUS_LABELS['quote-required'],
      explanation:
        'Published UK calendar + MySite maths is confirmed for up to seven calendars. Confirm the eight-calendar rate with Vagaro before budgeting.',
      deliveryKind,
      deliveryLabel,
      confidence: 'custom-quote',
      isCompleteSubtotal: false,
      missingFees: sharedMissingFees([
        'Optional professional MySite design (promotional / list price varies)',
        'Marketplace / new-client connection fees where applicable',
      ]),
      breakdown: [
        {
          id: 'calendars-mysite',
          label: 'Calendars + MySite',
          amountLabel: 'Quote required',
          note: 'Do not invent an eight-calendar total from the seven-calendar cap',
        },
      ],
      sourceHref,
      sourceLabel: 'Vagaro UK pricing',
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
      status: 'published-subtotal',
      statusLabel: STATUS_LABELS['published-subtotal'],
      explanation:
        'Self-build MySite plus bookable calendars. Optional professional design and marketplace fees are separate.',
      deliveryKind,
      deliveryLabel,
      confidence: 'published',
      isCompleteSubtotal: false,
      missingFees: sharedMissingFees([
        'Optional professional MySite design (promotional / list price varies)',
        'Marketplace / new-client connection fees where applicable',
      ]),
      breakdown: [
        {
          id: 'subscription',
          label: 'Calendars + MySite',
          amountLabel: `${formatScenarioGbp(monthly)}/month`,
          note: 'First calendar promotional UK rate + additional calendars + MySite £15',
        },
        {
          id: 'setup',
          label: 'Website build / professional design',
          amountLabel: 'Not included',
          note: 'Self-build MySite; optional design is separate',
        },
        {
          id: 'vat',
          label: 'VAT',
          amountLabel: 'Not confirmed',
        },
      ],
      sourceHref,
      sourceLabel: 'Vagaro UK pricing',
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
      status: 'indicative',
      statusLabel: STATUS_LABELS.indicative,
      explanation:
        'Self-configured Smart Website plus Team seats. Confirm official GBP checkout before treating as contracted rates.',
      deliveryKind,
      deliveryLabel,
      confidence: 'indicative',
      isCompleteSubtotal: false,
      missingFees: sharedMissingFees([
        'Marketplace new-client fees where applicable',
        'SMS overages above allowance',
      ]),
      breakdown: [
        {
          id: 'team-smart',
          label: 'Team seats + Smart Website',
          amountLabel: `${formatScenarioGbp(monthly)}/month excl. VAT`,
          note: `Illustrative with 20% VAT: ${formatScenarioGbp(monthlyInc)}/month`,
        },
        {
          id: 'setup',
          label: 'Website build',
          amountLabel: 'Not a separate agency build',
          note: 'Configurable Smart Website inside Fresha',
        },
      ],
      sourceHref,
      sourceLabel: 'Fresha UK pricing',
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
      status: 'price-conflict',
      statusLabel: STATUS_LABELS['price-conflict'],
      explanation:
        'Per-location platform plan. Official sources also recorded a conflicting £39 figure — confirm the live charged rate.',
      deliveryKind,
      deliveryLabel,
      confidence: 'conflict',
      isCompleteSubtotal: false,
      missingFees: sharedMissingFees([
        'SMS credits billed separately',
        'VAT status unresolved across Setora pages',
      ]),
      breakdown: [
        {
          id: 'location',
          label: 'Platform per location',
          amountLabel: `${formatScenarioGbp(monthly)}/month`,
          note: `Owner-approved headline; conflicting official reading ${formatScenarioGbp(WEBSITE_COST_CURRENT_FINDINGS.setoraOfficialSourceConflictGbp)}`,
        },
        {
          id: 'staff',
          label: 'Additional barber seats',
          amountLabel: '£0 in plan',
          note: 'Unlimited staff seats advertised on the compared plan',
        },
        {
          id: 'sms',
          label: 'SMS reminders',
          amountLabel: 'Usage-dependent',
        },
      ],
      sourceHref,
      sourceLabel: 'Setora pricing',
      emphasized: false,
      monthlyRecurringGbp: monthly,
      setupGbpIncluded: null,
      periodMonths: months,
    };
  }

  if (offerId === 'uxhm-salon-growth') {
    const setup = figures.setupGbp ?? WEBSITE_COST_CURRENT_FINDINGS.uxhmSalonGrowthSetupGbp;
    const booksyMonthly = figures.externalBooksyMonthlyIncVatGbp!;
    const booksyEx = figures.externalBooksyMonthlyExVatGbp!;
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
      status: 'combined-stack',
      statusLabel: STATUS_LABELS['combined-stack'],
      explanation:
        'Done-for-you UXHM website plus separate Booksy Biz. Optional UXHM Essential Care is not included as mandatory.',
      deliveryKind,
      deliveryLabel,
      confidence: 'published',
      isCompleteSubtotal: false,
      missingFees: sharedMissingFees([
        'Optional UXHM Essential Care £20/month',
        'Website VAT treatment and domain costs',
        'Retail integration between UXHM and Booksy not confirmed',
      ]),
      breakdown: [
        {
          id: 'uxhm-build',
          label: 'UXHM Salon Growth website',
          amountLabel: `${formatScenarioGbp(setup)} one-off`,
        },
        {
          id: 'booksy',
          label: `Booksy Biz (${barbers} users)`,
          amountLabel: `${formatScenarioGbp(booksyMonthly)}/month inc. VAT`,
          note: `${formatScenarioGbp(booksyEx)}/month excl. VAT`,
        },
        {
          id: 'care',
          label: 'UXHM Essential Care',
          amountLabel: 'Optional · £20/month',
          note: 'Not included in the compared subtotal',
        },
      ],
      sourceHref,
      sourceLabel: 'UXHM / Booksy pricing',
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
    status: 'per-location',
    statusLabel: STATUS_LABELS['per-location'],
    explanation:
      'Done-for-you branded website with integrated booking and shop tools. Flat per location for 2–8 barbers subject to fair use.',
    deliveryKind,
    deliveryLabel,
    confidence: 'published',
    isCompleteSubtotal: false,
    missingFees: [
      'Standard Stripe payment-processing fees',
      'SMS reminders subject to monthly allowance',
      'Premium domains and out-of-scope work may cost extra',
    ],
    breakdown: [
      {
        id: 'subscription',
        label: 'Full KERSIVO location subscription',
        amountLabel: `${formatScenarioGbp(monthly)}/month`,
      },
      {
        id: 'setup',
        label: 'Standard website setup',
        amountLabel: '£0',
        note: 'No separate standard setup fee',
      },
      {
        id: 'seats',
        label: 'Additional barber seats (2–8)',
        amountLabel: '£0',
        note: 'Same location · fair-use terms apply',
      },
      {
        id: 'vat',
        label: 'VAT',
        amountLabel: 'No VAT currently added',
      },
    ],
    sourceHref: sourceHref?.startsWith('http') ? sourceHref : '/pricing',
    sourceLabel: 'KERSIVO pricing',
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

  return {
    barbers: bookableBarbers,
    period,
    chartTitle: chartTitleFor(period),
    chartSubheading: `For ${bookableBarbers} bookable barbers`,
    providers,
    chartMaxGbp,
    kersivoSummary: {
      name: kersivo.name,
      amountGbp: kersivo.amountGbp!,
      displayFigure: kersivo.displayFigure,
      caption: `${formatScenarioGbp(SAAS_MONTHLY_GBP)}/month per location`,
      scenarioLabel: `${bookableBarbers} barbers · ${periodWord.toLowerCase()}`,
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
