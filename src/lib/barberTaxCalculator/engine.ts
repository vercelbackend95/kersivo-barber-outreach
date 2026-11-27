/**
 * Self-Employed Barber Tax Calculator — pure, DOM-free engine.
 * Works out a self-employed barber's Income Tax and Class 4 National Insurance for one tax year,
 * what to put aside each working week, the payment dates and the Making Tax Digital test.
 * Every statutory figure comes from src/data/self-employed-tax-rates.ts (and the VAT threshold from
 * src/data/uk-rates-2026-27.ts); nothing here is hard-coded. Round only for display.
 */
import {
  MAKING_TAX_DIGITAL_PHASES,
  PAYMENTS_ON_ACCOUNT,
  SELF_EMPLOYED_TAX_YEARS,
  TAX_REGIONS,
  TAX_YEARS,
  TRADING_ALLOWANCE,
  type IncomeTaxBand,
  type TaxRegion,
  type TaxYear,
  type TaxYearRates,
} from '@/data/self-employed-tax-rates';
import { VAT, WEEKS_PER_YEAR } from '@/data/uk-rates-2026-27';

export type BarberTaxInputs = {
  taxYear: TaxYear;
  region: TaxRegion;
  /** What clients pay for services in a typical working week, tips excluded. */
  weeklyTakingsGbp: number;
  /** Tips the barber keeps in a typical working week. */
  weeklyTipsGbp: number;
  weeksWorked: number;
  weeklyChairRentGbp: number;
  rentWeeksPerYear: number;
  /** Products, tools, insurance, card fees, booking software, training and other business costs. */
  otherCostsMonthlyGbp: number;
  /** Yearly pay from a job, before tax (tax on it assumed taken through PAYE). */
  employmentIncomeGbp: number;
  /** Payments on account already made towards this tax year's bill. */
  paymentsOnAccountPaidGbp: number;
};

export type NumericInputKey = {
  [K in keyof BarberTaxInputs]: BarberTaxInputs[K] extends number ? K : never;
}[keyof BarberTaxInputs];

/** Example numbers only — not UK averages. The page labels them as such. */
export const DEFAULT_INPUTS: Readonly<BarberTaxInputs> = {
  taxYear: '2026-27',
  region: 'england-wales-ni',
  weeklyTakingsGbp: 700,
  weeklyTipsGbp: 30,
  weeksWorked: 46,
  weeklyChairRentGbp: 150,
  rentWeeksPerYear: 52,
  otherCostsMonthlyGbp: 120,
  employmentIncomeGbp: 0,
  paymentsOnAccountPaidGbp: 0,
};

export type NumericLimit = { min: number; max: number; integer?: boolean };

export const NUMERIC_LIMITS: Readonly<Record<NumericInputKey, NumericLimit>> = {
  weeklyTakingsGbp: { min: 0, max: 20_000 },
  weeklyTipsGbp: { min: 0, max: 5_000 },
  weeksWorked: { min: 0, max: WEEKS_PER_YEAR, integer: true },
  weeklyChairRentGbp: { min: 0, max: 5_000 },
  rentWeeksPerYear: { min: 0, max: WEEKS_PER_YEAR, integer: true },
  otherCostsMonthlyGbp: { min: 0, max: 50_000 },
  employmentIncomeGbp: { min: 0, max: 1_000_000 },
  paymentsOnAccountPaidGbp: { min: 0, max: 1_000_000 },
};

export function clampNumber(value: unknown, limit: NumericLimit, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').replace(/[£,%\s]/g, ''));
  if (!Number.isFinite(parsed)) return fallback;
  const bounded = Math.min(limit.max, Math.max(limit.min, parsed));
  return limit.integer ? Math.round(bounded) : bounded;
}

export function isTaxYear(value: unknown): value is TaxYear {
  return typeof value === 'string' && (TAX_YEARS as readonly string[]).includes(value);
}

export function isTaxRegion(value: unknown): value is TaxRegion {
  return typeof value === 'string' && (TAX_REGIONS as readonly string[]).includes(value);
}

/** Repairs any partial or hostile input into a complete, finite, in-range scenario. */
export function sanitizeInputs(raw: Partial<Record<keyof BarberTaxInputs, unknown>>): BarberTaxInputs {
  const result = { ...DEFAULT_INPUTS } as BarberTaxInputs;
  for (const key of Object.keys(NUMERIC_LIMITS) as NumericInputKey[]) {
    result[key] = clampNumber(raw[key], NUMERIC_LIMITS[key], DEFAULT_INPUTS[key]);
  }
  result.taxYear = isTaxYear(raw.taxYear) ? raw.taxYear : DEFAULT_INPUTS.taxYear;
  result.region = isTaxRegion(raw.region) ? raw.region : DEFAULT_INPUTS.region;
  return result;
}

/* ------------------------------- Tax rules ------------------------------- */

/** Personal Allowance after the taper: £1 less for every £2 of income above the limit, down to zero. */
export function personalAllowance(adjustedNetIncome: number, rates: TaxYearRates): number {
  const excess = Math.max(0, adjustedNetIncome - rates.personalAllowanceIncomeLimitGbp);
  return Math.max(0, rates.personalAllowanceGbp - Math.floor(excess / 2));
}

/** Tax on taxable income (after the Personal Allowance) through the given bands. */
export function taxThroughBands(taxableIncome: number, bands: readonly IncomeTaxBand[]): number {
  let tax = 0;
  let lower = 0;
  for (const band of bands) {
    const upper = band.upToTaxableGbp ?? Number.POSITIVE_INFINITY;
    if (taxableIncome <= lower) break;
    tax += (Math.min(taxableIncome, upper) - lower) * band.rate;
    lower = upper;
  }
  return tax;
}

/** Income Tax on total non-savings income for the year and region. */
export function incomeTax(totalIncome: number, rates: TaxYearRates, region: TaxRegion): number {
  const income = Math.max(0, totalIncome);
  const taxable = Math.max(0, income - personalAllowance(income, rates));
  return taxThroughBands(taxable, rates.incomeTaxBands[region]);
}

/** Class 4 National Insurance on self-employed profit. */
export function class4NationalInsurance(profit: number, rates: TaxYearRates): number {
  const { lowerProfitsLimitGbp: lower, upperProfitsLimitGbp: upper, mainRate, additionalRate } = rates.class4;
  const main = Math.max(0, Math.min(profit, upper) - lower) * mainRate;
  const additional = Math.max(0, profit - upper) * additionalRate;
  return main + additional;
}

/* -------------------------------- Results -------------------------------- */

export type PaymentsOnAccountReason = 'required' | 'bill-under-minimum' | 'mostly-paid-at-source';

export type MakingTaxDigitalStatus =
  /** 2025/26 turnover over £30,000: in from 6 April 2027. */
  | 'from-april-2027'
  /** 2026/27 turnover over £20,000: in from 6 April 2028 at the latest. */
  | 'from-april-2028'
  /** Below the threshold that this year's return decides. */
  | 'below';

export type ScenarioRow = { label: string; weeklyTakingsGbp: number; bill: number; perWorkingWeek: number | null };

export type BarberTaxResult = {
  inputs: BarberTaxInputs;
  rates: TaxYearRates;
  takings: number;
  tips: number;
  turnover: number;
  chairRent: number;
  otherCosts: number;
  expenses: number;
  /** True when the £1,000 trading allowance is deducted instead of lower actual expenses. */
  usesTradingAllowance: boolean;
  deduction: number;
  profit: number;
  /** Expenses above turnover (a loss); tax is then nil on the self-employment. */
  loss: number;
  incomeTax: number;
  /** Income Tax on the job's pay alone, assumed already taken through PAYE. */
  taxPaidAtSource: number;
  class4: number;
  bill: number;
  class2Status: 'treated-as-paid' | 'voluntary';
  class2VoluntaryYearly: number;
  shareOfProfit: number;
  /** Bill ÷ everything clients paid (takings and tips). */
  shareOfTurnover: number;
  perWorkingWeek: number | null;
  perMonth: number;
  takeHome: number;
  paymentsOnAccount: PaymentsOnAccountReason;
  paymentOnAccountEach: number;
  balancingPayment: number;
  overpaid: number;
  januaryDue: number;
  julyDue: number;
  makingTaxDigital: MakingTaxDigitalStatus;
  /** Turnover above £30,000 in a 2026/27 scenario: April 2027 applies if 2025/26 was similar. */
  makingTaxDigitalMayStart2027: boolean;
  vatThresholdExceeded: boolean;
  scenarios: ScenarioRow[];
};

type CoreResult = Omit<BarberTaxResult, 'scenarios'>;

function computeCore(inputs: BarberTaxInputs): CoreResult {
  const rates = SELF_EMPLOYED_TAX_YEARS[inputs.taxYear];

  const takings = inputs.weeklyTakingsGbp * inputs.weeksWorked;
  const tips = inputs.weeklyTipsGbp * inputs.weeksWorked;
  const turnover = takings + tips;
  const chairRent = inputs.weeklyChairRentGbp * inputs.rentWeeksPerYear;
  const otherCosts = inputs.otherCostsMonthlyGbp * 12;
  const expenses = chairRent + otherCosts;

  // The trading allowance replaces actual expenses when it is bigger (capped at turnover).
  const allowance = Math.min(TRADING_ALLOWANCE.amountGbp, turnover);
  const usesTradingAllowance = turnover > 0 && allowance > expenses;
  const deduction = usesTradingAllowance ? allowance : expenses;
  const profit = Math.max(0, turnover - deduction);
  const loss = Math.max(0, expenses - turnover);

  const job = inputs.employmentIncomeGbp;
  const taxPaidAtSource = incomeTax(job, rates, inputs.region);
  const tax = Math.max(0, incomeTax(job + profit, rates, inputs.region) - taxPaidAtSource);
  const class4 = class4NationalInsurance(profit, rates);
  const bill = tax + class4;

  const class2Status = profit >= rates.class2.smallProfitsThresholdGbp ? 'treated-as-paid' : 'voluntary';

  const totalTax = bill + taxPaidAtSource;
  const paymentsOnAccount: PaymentsOnAccountReason =
    bill < PAYMENTS_ON_ACCOUNT.minimumBillGbp
      ? 'bill-under-minimum'
      : taxPaidAtSource > PAYMENTS_ON_ACCOUNT.atSourceShare * totalTax
        ? 'mostly-paid-at-source'
        : 'required';
  const paymentOnAccountEach = paymentsOnAccount === 'required' ? bill / 2 : 0;
  const balancingPayment = bill - inputs.paymentsOnAccountPaidGbp;

  const mtdPhase = MAKING_TAX_DIGITAL_PHASES.find((phase) => phase.basedOn === inputs.taxYear);
  const overMtd = mtdPhase ? turnover > mtdPhase.overGbp : false;
  const makingTaxDigital: MakingTaxDigitalStatus = !overMtd
    ? 'below'
    : inputs.taxYear === '2025-26'
      ? 'from-april-2027'
      : 'from-april-2028';
  const april2027 = MAKING_TAX_DIGITAL_PHASES.find((phase) => phase.basedOn === '2025-26');

  return {
    inputs,
    rates,
    takings,
    tips,
    turnover,
    chairRent,
    otherCosts,
    expenses,
    usesTradingAllowance,
    deduction,
    profit,
    loss,
    incomeTax: tax,
    taxPaidAtSource,
    class4,
    bill,
    class2Status,
    class2VoluntaryYearly: rates.class2.voluntaryWeeklyGbp * WEEKS_PER_YEAR,
    shareOfProfit: profit > 0 ? bill / profit : 0,
    shareOfTurnover: turnover > 0 ? bill / turnover : 0,
    perWorkingWeek: inputs.weeksWorked > 0 ? bill / inputs.weeksWorked : null,
    perMonth: bill / 12,
    takeHome: profit - bill,
    paymentsOnAccount,
    paymentOnAccountEach,
    balancingPayment,
    overpaid: Math.max(0, -balancingPayment),
    januaryDue: Math.max(0, balancingPayment) + paymentOnAccountEach,
    julyDue: paymentOnAccountEach,
    makingTaxDigital,
    makingTaxDigitalMayStart2027: inputs.taxYear === '2026-27' && april2027 !== undefined && turnover > april2027.overGbp,
    vatThresholdExceeded: takings > VAT.registrationThresholdGbp,
  };
}

/** The same scenario with weekly takings 20% lower, as entered and 20% higher. */
export const SCENARIO_STEPS = [
  { label: '20% less', factor: 0.8 },
  { label: 'As entered', factor: 1 },
  { label: '20% more', factor: 1.2 },
] as const;

export function calculateTax(raw: Partial<Record<keyof BarberTaxInputs, unknown>>): BarberTaxResult {
  const inputs = sanitizeInputs(raw);
  const core = computeCore(inputs);
  const scenarios = SCENARIO_STEPS.map((step) => {
    const scenario = step.factor === 1 ? core : computeCore({ ...inputs, weeklyTakingsGbp: inputs.weeklyTakingsGbp * step.factor });
    return {
      label: step.label,
      weeklyTakingsGbp: scenario.inputs.weeklyTakingsGbp,
      bill: scenario.bill,
      perWorkingWeek: scenario.perWorkingWeek,
    };
  });
  return { ...core, scenarios };
}
