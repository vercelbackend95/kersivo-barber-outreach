/**
 * Barber Price Calculator — pure, DOM-free engine shared by the server render and the browser.
 *
 * Method (the same one as the Insights guide "How to price a haircut in the UK"):
 * 1. Monthly money the chair has to bring in = this chair's rent + other fixed costs (+ take-home pay for the target price).
 * 2. Booked minutes per month = weekly hours × weeks worked ÷ 12 × share of hours with a client in the chair.
 * 3. Money per booked minute × service minutes + per-service costs = what the shop must keep from one service.
 * 4. Gross up for card fees (charged on the amount the client pays) and VAT (if registered) to get the client price.
 *
 * VAT comes from src/data/uk-rates-2026-27.ts. Defaults are example numbers only, never UK averages.
 * The engine returns unrounded pounds; rounding is a display concern (roundUpToStep).
 */
import { VAT } from '@/data/uk-rates-2026-27';

export type PriceCalcService = { name: string; minutes: number };

export type PriceCalcInputs = {
  /** This chair's share of rent, or the chair rent a self-employed barber pays, per month. */
  rentMonthlyGbp: number;
  /** Other fixed monthly costs for this chair: utilities, insurance, software, accountant. */
  otherCostsMonthlyGbp: number;
  /** What the barber wants to earn per month, before Income Tax and National Insurance. */
  takeHomeMonthlyGbp: number;
  weeklyHours: number;
  weeksPerYear: number;
  /** Share of working hours with a client in the chair. */
  bookedPercent: number;
  /** Products and consumables used per service. */
  productsPerServiceGbp: number;
  cardSharePercent: number;
  cardFeePercent: number;
  cardFeeFixedPence: number;
  vatRegistered: boolean;
  services: PriceCalcService[];
  /** Price rise check. */
  currentPriceGbp: number;
  newPriceGbp: number;
};

export type NumericInputKey = {
  [K in keyof PriceCalcInputs]: PriceCalcInputs[K] extends number ? K : never;
}[keyof PriceCalcInputs];

export const MAX_SERVICES = 8;
export const SERVICE_NAME_MAX = 40;
export const SERVICE_MINUTES = { min: 5, max: 240 } as const;
/** Client prices are shown rounded up to the next 50p. */
export const PRICE_ROUNDING_STEP_GBP = 0.5;
/** Rows of the "how busy you are" table. */
export const BOOKED_SENSITIVITY_PERCENTS = [50, 60, 70, 80, 90] as const;

/** Example numbers only — not UK averages. The page labels them as such. */
export const DEFAULT_INPUTS: Readonly<PriceCalcInputs> = {
  rentMonthlyGbp: 600,
  otherCostsMonthlyGbp: 200,
  takeHomeMonthlyGbp: 3000,
  weeklyHours: 40,
  weeksPerYear: 48,
  bookedPercent: 70,
  productsPerServiceGbp: 1,
  cardSharePercent: 100,
  cardFeePercent: 1.5,
  cardFeeFixedPence: 20,
  vatRegistered: false,
  services: [
    { name: 'Haircut', minutes: 30 },
    { name: 'Skin fade', minutes: 45 },
    { name: 'Beard trim', minutes: 20 },
    { name: 'Haircut and beard', minutes: 45 },
    { name: 'Kids cut (under 12)', minutes: 20 },
  ],
  currentPriceGbp: 20,
  newPriceGbp: 22,
};

export type NumericLimit = { min: number; max: number; integer?: boolean };

export const NUMERIC_LIMITS: Readonly<Record<NumericInputKey, NumericLimit>> = {
  rentMonthlyGbp: { min: 0, max: 50_000 },
  otherCostsMonthlyGbp: { min: 0, max: 50_000 },
  takeHomeMonthlyGbp: { min: 0, max: 50_000 },
  weeklyHours: { min: 0, max: 80 },
  weeksPerYear: { min: 0, max: 52, integer: true },
  bookedPercent: { min: 0, max: 100 },
  productsPerServiceGbp: { min: 0, max: 100 },
  cardSharePercent: { min: 0, max: 100 },
  cardFeePercent: { min: 0, max: 10 },
  cardFeeFixedPence: { min: 0, max: 100 },
  currentPriceGbp: { min: 0, max: 1_000 },
  newPriceGbp: { min: 0, max: 1_000 },
};

function clampNumber(raw: unknown, limit: NumericLimit, fallback: number): number {
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value)) return fallback;
  const clamped = Math.min(limit.max, Math.max(limit.min, value));
  return limit.integer ? Math.round(clamped) : clamped;
}

function sanitizeServices(raw: unknown): PriceCalcService[] {
  if (!Array.isArray(raw)) return DEFAULT_INPUTS.services.map((service) => ({ ...service }));
  const services: PriceCalcService[] = [];
  for (const entry of raw.slice(0, MAX_SERVICES)) {
    if (!entry || typeof entry !== 'object') continue;
    const { name, minutes } = entry as { name?: unknown; minutes?: unknown };
    const cleanName = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, SERVICE_NAME_MAX) : '';
    const cleanMinutes = clampNumber(minutes, { ...SERVICE_MINUTES, integer: true }, 30);
    services.push({ name: cleanName, minutes: cleanMinutes });
  }
  return services;
}

/** Repairs anything typed or decoded into a valid input set; unknown or invalid values fall back to the defaults. */
export function sanitizeInputs(raw: Partial<Record<keyof PriceCalcInputs, unknown>>): PriceCalcInputs {
  const numbers = {} as Record<NumericInputKey, number>;
  for (const key of Object.keys(NUMERIC_LIMITS) as NumericInputKey[]) {
    numbers[key] = clampNumber(raw[key], NUMERIC_LIMITS[key], DEFAULT_INPUTS[key]);
  }
  return {
    ...numbers,
    vatRegistered: typeof raw.vatRegistered === 'boolean' ? raw.vatRegistered : DEFAULT_INPUTS.vatRegistered,
    services: sanitizeServices(raw.services),
  };
}

export type ServicePrice = {
  name: string;
  minutes: number;
  /** Client price that covers this service's share of costs only (nothing left for the barber). */
  floorPriceGbp: number | null;
  /** Client price that also pays the take-home target. */
  targetPriceGbp: number | null;
};

export type PriceRiseCheck =
  | { status: 'ok'; currentKeptGbp: number; newKeptGbp: number; maxClientLossPercent: number }
  | { status: 'not-a-rise' }
  | { status: 'current-below-costs' };

export type PriceCalcResult = {
  inputs: PriceCalcInputs;
  bookedHoursPerMonth: number;
  fixedCostsMonthlyGbp: number;
  /** What each booked hour must earn (after card fees and VAT) to cover costs only. */
  floorPerBookedHourGbp: number | null;
  /** What each booked hour must earn to cover costs and the take-home target. */
  targetPerBookedHourGbp: number | null;
  services: ServicePrice[];
  /** Target price of the first service at different booked percentages. */
  sensitivity: { bookedPercent: number; targetPriceGbp: number | null }[];
  priceRise: PriceRiseCheck;
};

const vatRate = (inputs: PriceCalcInputs) => (inputs.vatRegistered ? VAT.standardRate : 0);

export function bookedMinutesPerMonth(inputs: Pick<PriceCalcInputs, 'weeklyHours' | 'weeksPerYear' | 'bookedPercent'>): number {
  return (inputs.weeklyHours * 60 * inputs.weeksPerYear * (inputs.bookedPercent / 100)) / 12;
}

/** What the shop keeps from one service at client price `priceGbp`, after VAT, card fees and products. */
export function keptPerServiceGbp(inputs: PriceCalcInputs, priceGbp: number): number {
  const cardShare = inputs.cardSharePercent / 100;
  const cardFees = cardShare * (priceGbp * (inputs.cardFeePercent / 100) + inputs.cardFeeFixedPence / 100);
  return priceGbp / (1 + vatRate(inputs)) - cardFees - inputs.productsPerServiceGbp;
}

/** Client price at which the shop keeps `neededGbp` from one service (inverse of keptPerServiceGbp). */
export function clientPriceForKeptGbp(inputs: PriceCalcInputs, neededGbp: number): number | null {
  const cardShare = inputs.cardSharePercent / 100;
  const denominator = 1 / (1 + vatRate(inputs)) - cardShare * (inputs.cardFeePercent / 100);
  if (denominator <= 0) return null;
  return (neededGbp + inputs.productsPerServiceGbp + (cardShare * inputs.cardFeeFixedPence) / 100) / denominator;
}

function servicePrice(inputs: PriceCalcInputs, perMinuteGbp: number | null, minutes: number): number | null {
  if (perMinuteGbp === null) return null;
  return clientPriceForKeptGbp(inputs, perMinuteGbp * minutes);
}

function priceRiseCheck(inputs: PriceCalcInputs): PriceRiseCheck {
  if (inputs.newPriceGbp <= inputs.currentPriceGbp) return { status: 'not-a-rise' };
  const currentKeptGbp = keptPerServiceGbp(inputs, inputs.currentPriceGbp);
  if (currentKeptGbp <= 0) return { status: 'current-below-costs' };
  const newKeptGbp = keptPerServiceGbp(inputs, inputs.newPriceGbp);
  // Same money kept with fewer clients: currentKept × N = newKept × N × (1 − loss).
  const maxClientLossPercent = (1 - currentKeptGbp / newKeptGbp) * 100;
  return { status: 'ok', currentKeptGbp, newKeptGbp, maxClientLossPercent };
}

export function calculatePrices(raw: Partial<Record<keyof PriceCalcInputs, unknown>>): PriceCalcResult {
  const inputs = sanitizeInputs(raw);
  const minutes = bookedMinutesPerMonth(inputs);
  const fixedCostsMonthlyGbp = inputs.rentMonthlyGbp + inputs.otherCostsMonthlyGbp;
  const targetMonthlyGbp = fixedCostsMonthlyGbp + inputs.takeHomeMonthlyGbp;

  const floorPerMinute = minutes > 0 ? fixedCostsMonthlyGbp / minutes : null;
  const targetPerMinute = minutes > 0 ? targetMonthlyGbp / minutes : null;

  const services = inputs.services.map((service) => ({
    name: service.name,
    minutes: service.minutes,
    floorPriceGbp: servicePrice(inputs, floorPerMinute, service.minutes),
    targetPriceGbp: servicePrice(inputs, targetPerMinute, service.minutes),
  }));

  const first = inputs.services[0];
  const sensitivity = BOOKED_SENSITIVITY_PERCENTS.map((bookedPercent) => {
    const scenarioMinutes = bookedMinutesPerMonth({ ...inputs, bookedPercent });
    const perMinute = scenarioMinutes > 0 ? targetMonthlyGbp / scenarioMinutes : null;
    return { bookedPercent, targetPriceGbp: first ? servicePrice(inputs, perMinute, first.minutes) : null };
  });

  return {
    inputs,
    bookedHoursPerMonth: minutes / 60,
    fixedCostsMonthlyGbp,
    floorPerBookedHourGbp: floorPerMinute === null ? null : floorPerMinute * 60,
    targetPerBookedHourGbp: targetPerMinute === null ? null : targetPerMinute * 60,
    services,
    sensitivity,
    priceRise: priceRiseCheck(inputs),
  };
}

/** Rounds a price up to the next step (50p by default), ignoring floating-point dust. */
export function roundUpToStep(value: number, step = PRICE_ROUNDING_STEP_GBP): number {
  return Math.ceil(value / step - 1e-6) * step;
}
