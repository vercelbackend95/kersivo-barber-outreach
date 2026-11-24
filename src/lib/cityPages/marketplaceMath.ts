/**
 * Pure maths behind the city-page calculator (/barbershop-websites/{city}).
 * Client-safe: imports only the static competitor fact modules, never Prisma, Stripe or server code.
 *
 * Every competitor figure comes from the verified `*Facts.ts` files (each with its own checked date);
 * nothing is hardcoded here. Competitor prices are ex VAT as published. Unresolved facts (Treatwell's
 * quoted subscription, Fresha's fee cap) are left out of totals and labelled on the page.
 */
import {
  estimateBooksyBoostFee,
  estimateBooksyMonthlySubscription,
  requireVerifiedBooksyFact,
} from '@/lib/seo/booksyFacts';
import {
  FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS,
  estimateFreshaMarketplaceNewClientFee,
  estimateFreshaMonthlySubscription,
  formatGbp,
  requireVerifiedFreshaFact,
} from '@/lib/seo/freshaFacts';
import { TREATWELL_UK_COMMERCIAL_FACTS } from '@/lib/seo/treatwellFacts';
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

export const WEEKS_PER_MONTH = 52 / 12;

export type CityPaymentMode = 'deposit' | 'full';

export type CityCalculatorInputs = {
  /** Average price of the cut a new client books, GBP. */
  price: number;
  /** Bookable barbers (calendar columns). */
  barbers: number;
  /** New clients a week who arrive through a marketplace's new-client feature. */
  marketplaceClientsPerWeek: number;
  /** Booked clients a week who do not turn up. */
  noShowsPerWeek: number;
  /** How the shop takes payment on KERSIVO for the slots it protects. */
  paymentMode: CityPaymentMode;
};

export const CITY_CALCULATOR_LIMITS = {
  price: { min: 10, max: 80, step: 0.5 },
  barbers: { min: 1, max: FRESHA_ENTERPRISE_ABOVE_TEAM_MEMBERS, step: 1 },
  marketplaceClientsPerWeek: { min: 0, max: 40, step: 1 },
  noShowsPerWeek: { min: 0, max: 20, step: 1 },
} as const;

export type CompetitorLine = {
  id: 'booksy' | 'fresha' | 'treatwell';
  /** Shown name, e.g. "Booksy with Boost". */
  label: string;
  /** One-time fee on each qualifying new marketplace client, ex VAT. */
  feePerNewClient: number;
  /** Fee rule in words, e.g. "30% of the first visit, min £5". */
  feeRule: string;
  /** Published monthly subscription for this team size, ex VAT; null when quote-based. */
  subscription: number | null;
  newClientFeesPerMonth: number;
  /** subscription + fees, or fees alone when the subscription is quote-based. */
  monthlyTotal: number;
  /** How many of these one-time fees add up to £39 (rounded up). */
  feesToMatchKersivo: number | null;
};

export type CityCalculatorResult = {
  inputs: CityCalculatorInputs;
  kersivoMonthly: number;
  competitors: CompetitorLine[];
  /** Highest competitor monthly total minus £39 (never below 0). */
  largestGap: number;
  noShow: {
    lostPerMonth: number;
    /** Taken from no-shows on KERSIVO before Stripe fees (deposit or full price). */
    keptPerMonth: number;
    keptPerNoShow: number;
    /** No-shows a month whose kept payment adds up to £39 (rounded up). */
    toCoverKersivo: number;
  };
};

function pence(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clampCityInput(key: keyof typeof CITY_CALCULATOR_LIMITS, value: number): number {
  const { min, max, step } = CITY_CALCULATOR_LIMITS[key];
  if (!Number.isFinite(value)) return min;
  const stepped = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, pence(stepped)));
}

export function normaliseCityInputs(raw: CityCalculatorInputs): CityCalculatorInputs {
  return {
    price: clampCityInput('price', raw.price),
    barbers: clampCityInput('barbers', Math.round(raw.barbers)),
    marketplaceClientsPerWeek: clampCityInput('marketplaceClientsPerWeek', Math.round(raw.marketplaceClientsPerWeek)),
    noShowsPerWeek: clampCityInput('noShowsPerWeek', Math.round(raw.noShowsPerWeek)),
    paymentMode: raw.paymentMode === 'full' ? 'full' : 'deposit',
  };
}

function feesToMatch(fee: number): number | null {
  return fee > 0 ? Math.ceil(SAAS_MONTHLY_GBP / fee) : null;
}

const BOOKSY_BOOST = requireVerifiedBooksyFact('boostNewClientFee');
const FRESHA_NEW_CLIENT = requireVerifiedFreshaFact('marketplaceNewClientFee');

/** Fee rules in words, built from the verified facts: "30% of the first visit, min £5". */
export const NEW_CLIENT_FEE_RULES = {
  booksy: `${BOOKSY_BOOST.percent}% of the first visit, min ${formatGbp(BOOKSY_BOOST.minimumGbp!)}`,
  fresha: `${FRESHA_NEW_CLIENT.percent}% of the first visit, min ${formatGbp(FRESHA_NEW_CLIENT.minimumGbp!)}`,
} as const;

/** Short form for prose: "Booksy Boost 30% (min £5), Fresha Marketplace 20% (min £4), Treatwell 35%". */
export function describeNewClientFees(): string {
  return `Booksy Boost ${BOOKSY_BOOST.percent}% (min ${formatGbp(BOOKSY_BOOST.minimumGbp!)}), Fresha Marketplace ${FRESHA_NEW_CLIENT.percent}% (min ${formatGbp(FRESHA_NEW_CLIENT.minimumGbp!)}), Treatwell ${TREATWELL_NEW_CLIENT_PERCENT}%`;
}

const TREATWELL_NEW_CLIENT_PERCENT = (() => {
  const fact = TREATWELL_UK_COMMERCIAL_FACTS.newMarketplaceClientCommission;
  if (fact.status !== 'verified' || typeof fact.percent !== 'number') {
    throw new Error('Treatwell new-client commission must be verified before it is rendered');
  }
  return fact.percent;
})();

export function calculateCityScenario(raw: CityCalculatorInputs): CityCalculatorResult {
  const inputs = normaliseCityInputs(raw);
  const { price, barbers, marketplaceClientsPerWeek, noShowsPerWeek, paymentMode } = inputs;
  const newClientsPerMonth = marketplaceClientsPerWeek * WEEKS_PER_MONTH;

  const booksyFee = estimateBooksyBoostFee(price);
  const booksySub = estimateBooksyMonthlySubscription(barbers).exVatGbp;
  const freshaFee = estimateFreshaMarketplaceNewClientFee(price);
  const freshaSub = estimateFreshaMonthlySubscription(barbers).exVatGbp;
  const treatwellFee = pence((price * TREATWELL_NEW_CLIENT_PERCENT) / 100);

  const line = (
    id: CompetitorLine['id'],
    label: string,
    fee: number,
    feeRule: string,
    subscription: number | null,
  ): CompetitorLine => {
    const fees = pence(fee * newClientsPerMonth);
    return {
      id,
      label,
      feePerNewClient: fee,
      feeRule,
      subscription,
      newClientFeesPerMonth: fees,
      monthlyTotal: pence((subscription ?? 0) + fees),
      feesToMatchKersivo: feesToMatch(fee),
    };
  };

  const competitors: CompetitorLine[] = [
    line('booksy', 'Booksy with Boost', booksyFee, NEW_CLIENT_FEE_RULES.booksy, booksySub),
    line('fresha', 'Fresha Marketplace', freshaFee, NEW_CLIENT_FEE_RULES.fresha, freshaSub),
    line('treatwell', 'Treatwell', treatwellFee, `${TREATWELL_NEW_CLIENT_PERCENT}% of the first booking`, null),
  ];

  const keptPerNoShow = paymentMode === 'full' ? price : Math.min(KERSIVO_BOOKING_DEPOSIT_GBP, price);
  const noShowsPerMonth = noShowsPerWeek * WEEKS_PER_MONTH;

  return {
    inputs,
    kersivoMonthly: SAAS_MONTHLY_GBP,
    competitors,
    largestGap: pence(Math.max(0, ...competitors.map((c) => c.monthlyTotal - SAAS_MONTHLY_GBP))),
    noShow: {
      lostPerMonth: pence(noShowsPerMonth * price),
      keptPerMonth: pence(noShowsPerMonth * keptPerNoShow),
      keptPerNoShow: pence(keptPerNoShow),
      toCoverKersivo: Math.ceil(SAAS_MONTHLY_GBP / keptPerNoShow),
    },
  };
}

/** £7.95, £39, £1,240 — whole pounds without pence, otherwise two decimals. */
export function formatCityGbp(value: number): string {
  const rounded = pence(value);
  const whole = Number.isInteger(rounded);
  return `£${rounded.toLocaleString('en-GB', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`;
}

/** Monthly totals read better rounded to the pound. */
export function formatCityGbpRounded(value: number): string {
  return `£${Math.round(value).toLocaleString('en-GB')}`;
}
