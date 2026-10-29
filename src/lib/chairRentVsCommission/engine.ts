/**
 * Chair Rent vs Commission Calculator — pure, DOM-free engine.
 * Compares one chair worked by (A) an employed barber on commission with (B) a self-employed renter.
 * Every statutory figure comes from src/data/uk-rates-2026-27.ts; nothing here is hard-coded.
 * Round only for display: the engine returns unrounded pounds.
 */
import {
  AUTO_ENROLMENT_PENSION,
  EMPLOYER_NATIONAL_INSURANCE,
  EMPLOYMENT_ALLOWANCE,
  MINIMUM_WAGE_BANDS,
  NATIONAL_MINIMUM_WAGE,
  STATUTORY_ANNUAL_LEAVE,
  VAT,
  WEEKS_PER_YEAR,
  type MinimumWageBand,
} from '@/data/uk-rates-2026-27';

export type ChairRentInputs = {
  /* The chair (shared) */
  monthlyTakingsGbp: number;
  quietMonths: number;
  quietMonthPercent: number;
  shopVatRegistered: boolean;
  averageServicePriceGbp: number;
  /* A — employed barber on commission */
  commissionPercent: number;
  /** Only applies when the shop is VAT registered; otherwise takings are already net. */
  commissionOnGross: boolean;
  weeklyHours: number;
  /** 0 = work out monthly hours from weekly hours. */
  monthlyHoursOverride: number;
  wageBand: MinimumWageBand;
  /** Apprentice aged under 25: employer NI relief up to the apprentice upper secondary threshold. */
  apprenticeUnder25: boolean;
  includeHolidayPay: boolean;
  pensionEnrolled: boolean;
  employmentAllowanceAvailable: boolean;
  employmentAllowanceGbp: number;
  productsPercent: number;
  cardFeePercent: number;
  cardFeeFixedPence: number;
  cardSharePercent: number;
  softwareMonthlyGbp: number;
  /* B — self-employed chair renter */
  weeklyRentGbp: number;
  rentWeeksPerYear: number;
  extraCostsWeeklyGbp: number;
  /** Only applies when the shop is VAT registered. */
  chargeVatOnRent: boolean;
  renterProductsPercent: number;
  renterCardFeePercent: number;
  renterCardFeeFixedPence: number;
  renterCardSharePercent: number;
  renterSoftwareMonthlyGbp: number;
  renterOtherMonthlyGbp: number;
  showBarberSide: boolean;
};

export type NumericInputKey = {
  [K in keyof ChairRentInputs]: ChairRentInputs[K] extends number ? K : never;
}[keyof ChairRentInputs];
export type BooleanInputKey = {
  [K in keyof ChairRentInputs]: ChairRentInputs[K] extends boolean ? K : never;
}[keyof ChairRentInputs];

/** Example numbers only — not UK averages. The page labels them as such. */
export const DEFAULT_INPUTS: Readonly<ChairRentInputs> = {
  monthlyTakingsGbp: 3750,
  quietMonths: 2,
  quietMonthPercent: 70,
  shopVatRegistered: false,
  averageServicePriceGbp: 25,
  commissionPercent: 40,
  commissionOnGross: false,
  weeklyHours: 30,
  monthlyHoursOverride: 0,
  wageBand: '21-plus',
  apprenticeUnder25: false,
  includeHolidayPay: true,
  pensionEnrolled: true,
  employmentAllowanceAvailable: false,
  employmentAllowanceGbp: EMPLOYMENT_ALLOWANCE.maxAnnualGbp,
  productsPercent: 4,
  cardFeePercent: 1.5,
  cardFeeFixedPence: 20,
  cardSharePercent: 100,
  softwareMonthlyGbp: 0,
  weeklyRentGbp: 150,
  rentWeeksPerYear: 52,
  extraCostsWeeklyGbp: 0,
  chargeVatOnRent: false,
  renterProductsPercent: 4,
  renterCardFeePercent: 1.5,
  renterCardFeeFixedPence: 20,
  renterCardSharePercent: 100,
  renterSoftwareMonthlyGbp: 0,
  renterOtherMonthlyGbp: 0,
  showBarberSide: true,
};

export type NumericLimit = { min: number; max: number; integer?: boolean };

export const NUMERIC_LIMITS: Readonly<Record<NumericInputKey, NumericLimit>> = {
  monthlyTakingsGbp: { min: 0, max: 100_000 },
  quietMonths: { min: 0, max: 12, integer: true },
  quietMonthPercent: { min: 0, max: 100 },
  averageServicePriceGbp: { min: 1, max: 1_000 },
  commissionPercent: { min: 0, max: 100 },
  weeklyHours: { min: 0, max: 80 },
  monthlyHoursOverride: { min: 0, max: 350 },
  employmentAllowanceGbp: { min: 0, max: EMPLOYMENT_ALLOWANCE.maxAnnualGbp },
  productsPercent: { min: 0, max: 100 },
  cardFeePercent: { min: 0, max: 10 },
  cardFeeFixedPence: { min: 0, max: 100 },
  cardSharePercent: { min: 0, max: 100 },
  softwareMonthlyGbp: { min: 0, max: 1_000 },
  weeklyRentGbp: { min: 0, max: 2_000 },
  rentWeeksPerYear: { min: 0, max: WEEKS_PER_YEAR, integer: true },
  extraCostsWeeklyGbp: { min: 0, max: 1_000 },
  renterProductsPercent: { min: 0, max: 100 },
  renterCardFeePercent: { min: 0, max: 10 },
  renterCardFeeFixedPence: { min: 0, max: 100 },
  renterCardSharePercent: { min: 0, max: 100 },
  renterSoftwareMonthlyGbp: { min: 0, max: 1_000 },
  renterOtherMonthlyGbp: { min: 0, max: 5_000 },
};

export function clampNumber(value: unknown, limit: NumericLimit, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').replace(/[£,%\s]/g, ''));
  if (!Number.isFinite(parsed)) return fallback;
  const bounded = Math.min(limit.max, Math.max(limit.min, parsed));
  return limit.integer ? Math.round(bounded) : bounded;
}

export function isMinimumWageBand(value: unknown): value is MinimumWageBand {
  return typeof value === 'string' && (MINIMUM_WAGE_BANDS as readonly string[]).includes(value);
}

/** Repairs any partial or hostile input into a complete, finite, in-range scenario. */
export function sanitizeInputs(raw: Partial<Record<keyof ChairRentInputs, unknown>>): ChairRentInputs {
  const result = { ...DEFAULT_INPUTS } as ChairRentInputs;
  for (const key of Object.keys(NUMERIC_LIMITS) as NumericInputKey[]) {
    result[key] = clampNumber(raw[key], NUMERIC_LIMITS[key], DEFAULT_INPUTS[key]);
  }
  for (const key of Object.keys(DEFAULT_INPUTS) as (keyof ChairRentInputs)[]) {
    if (typeof DEFAULT_INPUTS[key] === 'boolean' && typeof raw[key] === 'boolean') {
      (result as Record<string, unknown>)[key] = raw[key];
    }
  }
  result.wageBand = isMinimumWageBand(raw.wageBand) ? raw.wageBand : DEFAULT_INPUTS.wageBand;
  return result;
}

/* --------------------------------- Helpers --------------------------------- */

const vatFactor = 1 + VAT.standardRate;
const leaveWeeks = STATUTORY_ANNUAL_LEAVE.weeks;
const workedWeeks = WEEKS_PER_YEAR - leaveWeeks;

export function annualGrossTakings(inputs: ChairRentInputs): number {
  const typicalMonths = 12 - inputs.quietMonths;
  return (
    inputs.monthlyTakingsGbp * typicalMonths +
    inputs.monthlyTakingsGbp * (inputs.quietMonthPercent / 100) * inputs.quietMonths
  );
}

/**
 * Monthly hours that count for the minimum wage check.
 * With holiday pay on, the barber is only at work in the weeks they are not on leave.
 */
export function monthlyQualifyingHours(inputs: ChairRentInputs): number {
  if (inputs.monthlyHoursOverride > 0) return inputs.monthlyHoursOverride;
  const weeks = inputs.includeHolidayPay ? workedWeeks : WEEKS_PER_YEAR;
  return (inputs.weeklyHours * weeks) / 12;
}

export function minimumWageHourly(band: MinimumWageBand): number {
  return NATIONAL_MINIMUM_WAGE.hourlyGbp[band];
}

export function cardFees(grossTakings: number, percent: number, fixedPence: number, sharePercent: number, averagePrice: number): number {
  const cardTakings = grossTakings * (sharePercent / 100);
  const transactions = averagePrice > 0 ? cardTakings / averagePrice : 0;
  return transactions * (fixedPence / 100) + cardTakings * (percent / 100);
}

export type EmployerNiThreshold = 'standard' | 'under-21' | 'apprentice-under-25';

export function employerNiThresholdKind(inputs: Pick<ChairRentInputs, 'wageBand' | 'apprenticeUnder25'>): EmployerNiThreshold {
  if (inputs.wageBand === 'under-18' || inputs.wageBand === '18-20') return 'under-21';
  if (inputs.apprenticeUnder25) return 'apprentice-under-25';
  return 'standard';
}

/** Employer's Class 1 NI on annual gross pay, before Employment Allowance. */
export function employerNiBeforeAllowance(grossPay: number, kind: EmployerNiThreshold = 'standard'): number {
  const threshold =
    kind === 'under-21'
      ? EMPLOYER_NATIONAL_INSURANCE.underTwentyOneUpperThresholdAnnualGbp
      : kind === 'apprentice-under-25'
        ? EMPLOYER_NATIONAL_INSURANCE.apprenticeUnderTwentyFiveUpperThresholdAnnualGbp
        : EMPLOYER_NATIONAL_INSURANCE.secondaryThresholdAnnualGbp;
  return Math.max(0, grossPay - threshold) * EMPLOYER_NATIONAL_INSURANCE.rate;
}

export function employerPension(grossPay: number): number {
  const banded =
    Math.min(grossPay, AUTO_ENROLMENT_PENSION.qualifyingEarningsUpperAnnualGbp) -
    AUTO_ENROLMENT_PENSION.qualifyingEarningsLowerAnnualGbp;
  return Math.max(0, banded) * AUTO_ENROLMENT_PENSION.employerMinimumRate;
}

/* ------------------------------ Model A: commission ------------------------------ */

export type MonthResult = {
  kind: 'typical' | 'quiet';
  count: number;
  grossTakings: number;
  commissionBase: number;
  commission: number;
  floor: number;
  topUp: number;
  pay: number;
  effectiveHourly: number | null;
};

export type CommissionResult = {
  annualGrossTakings: number;
  annualNetTakings: number;
  monthlyHours: number;
  hourlyMinimum: number;
  monthlyFloor: number;
  months: MonthResult[];
  commission: number;
  topUps: number;
  monthsNeedingTopUp: number;
  payBeforeHoliday: number;
  holidayPay: number;
  grossPay: number;
  niThreshold: EmployerNiThreshold;
  employerNiBeforeAllowance: number;
  employmentAllowanceUsed: number;
  employerNi: number;
  pension: number;
  products: number;
  cardFees: number;
  software: number;
  shopResult: number;
  /** Monthly takings as paid by clients at which commission alone meets the floor; null at 0% commission. */
  breakEvenMonthlyTakings: number | null;
  /** Same threshold on the commission base (net or gross, as chosen). */
  breakEvenMonthlyCommissionBase: number | null;
};

export function commissionIsOnGross(inputs: ChairRentInputs): boolean {
  return inputs.shopVatRegistered && inputs.commissionOnGross;
}

export function computeCommission(inputs: ChairRentInputs): CommissionResult {
  const T = annualGrossTakings(inputs);
  const toNet = (gross: number) => (inputs.shopVatRegistered ? gross / vatFactor : gross);
  const Tnet = toNet(T);
  const rate = inputs.commissionPercent / 100;
  const onGross = commissionIsOnGross(inputs);
  const monthlyHours = monthlyQualifyingHours(inputs);
  const hourlyMinimum = minimumWageHourly(inputs.wageBand);
  const monthlyFloor = monthlyHours * hourlyMinimum;

  const buildMonth = (kind: MonthResult['kind'], count: number, grossTakings: number): MonthResult => {
    const commissionBase = onGross ? grossTakings : toNet(grossTakings);
    const commission = commissionBase * rate;
    const topUp = Math.max(0, monthlyFloor - commission);
    const pay = commission + topUp;
    return {
      kind,
      count,
      grossTakings,
      commissionBase,
      commission,
      floor: monthlyFloor,
      topUp,
      pay,
      effectiveHourly: monthlyHours > 0 ? commission / monthlyHours : null,
    };
  };

  const months = [
    buildMonth('typical', 12 - inputs.quietMonths, inputs.monthlyTakingsGbp),
    buildMonth('quiet', inputs.quietMonths, inputs.monthlyTakingsGbp * (inputs.quietMonthPercent / 100)),
  ];

  const sum = (pick: (month: MonthResult) => number) => months.reduce((total, month) => total + pick(month) * month.count, 0);
  const commission = sum((month) => month.commission);
  const topUps = sum((month) => month.topUp);
  const monthsNeedingTopUp = months.reduce((total, month) => total + (month.topUp > 0 ? month.count : 0), 0);
  const payBeforeHoliday = commission + topUps;
  const holidayPay = inputs.includeHolidayPay ? (payBeforeHoliday / workedWeeks) * leaveWeeks : 0;
  const grossPay = payBeforeHoliday + holidayPay;

  const niThreshold = employerNiThresholdKind(inputs);
  const niBefore = employerNiBeforeAllowance(grossPay, niThreshold);
  const allowance = inputs.employmentAllowanceAvailable ? inputs.employmentAllowanceGbp : 0;
  const employmentAllowanceUsed = Math.min(allowance, niBefore);
  const employerNi = niBefore - employmentAllowanceUsed;
  const pension = inputs.pensionEnrolled ? employerPension(grossPay) : 0;

  const products = Tnet * (inputs.productsPercent / 100);
  const fees = cardFees(T, inputs.cardFeePercent, inputs.cardFeeFixedPence, inputs.cardSharePercent, inputs.averageServicePriceGbp);
  const software = inputs.softwareMonthlyGbp * 12;

  const shopResult = Tnet - grossPay - employerNi - pension - products - fees - software;

  const breakEvenMonthlyCommissionBase = rate > 0 ? monthlyFloor / rate : null;
  const breakEvenMonthlyTakings =
    breakEvenMonthlyCommissionBase === null
      ? null
      : inputs.shopVatRegistered && !onGross
        ? breakEvenMonthlyCommissionBase * vatFactor
        : breakEvenMonthlyCommissionBase;

  return {
    annualGrossTakings: T,
    annualNetTakings: Tnet,
    monthlyHours,
    hourlyMinimum,
    monthlyFloor,
    months,
    commission,
    topUps,
    monthsNeedingTopUp,
    payBeforeHoliday,
    holidayPay,
    grossPay,
    niThreshold,
    employerNiBeforeAllowance: niBefore,
    employmentAllowanceUsed,
    employerNi,
    pension,
    products,
    cardFees: fees,
    software,
    shopResult,
    breakEvenMonthlyTakings,
    breakEvenMonthlyCommissionBase,
  };
}

/* ------------------------------ Model B: chair rent ------------------------------ */

export type RentResult = {
  /** Rent the shop keeps, excluding any VAT it passes to HMRC. */
  rentIncome: number;
  extraCosts: number;
  shopResult: number;
  /** What the renter actually pays, including VAT when charged. */
  rentPaidByRenter: number;
  renterProducts: number;
  renterCardFees: number;
  renterSoftware: number;
  renterOther: number;
  renterProfitBeforeTax: number;
};

export function rentChargesVat(inputs: ChairRentInputs): boolean {
  return inputs.shopVatRegistered && inputs.chargeVatOnRent;
}

export function computeRent(inputs: ChairRentInputs): RentResult {
  const T = annualGrossTakings(inputs);
  const rentIncome = inputs.weeklyRentGbp * inputs.rentWeeksPerYear;
  const extraCosts = inputs.extraCostsWeeklyGbp * WEEKS_PER_YEAR;
  const rentPaidByRenter = rentIncome * (rentChargesVat(inputs) ? vatFactor : 1);
  const renterProducts = T * (inputs.renterProductsPercent / 100);
  const renterCardFees = cardFees(
    T,
    inputs.renterCardFeePercent,
    inputs.renterCardFeeFixedPence,
    inputs.renterCardSharePercent,
    inputs.averageServicePriceGbp,
  );
  const renterSoftware = inputs.renterSoftwareMonthlyGbp * 12;
  const renterOther = inputs.renterOtherMonthlyGbp * 12;

  return {
    rentIncome,
    extraCosts,
    shopResult: rentIncome - extraCosts,
    rentPaidByRenter,
    renterProducts,
    renterCardFees,
    renterSoftware,
    renterOther,
    renterProfitBeforeTax: T - rentPaidByRenter - renterProducts - renterCardFees - renterSoftware - renterOther,
  };
}

/* ------------------------------ Comparison ------------------------------ */

/** Differences smaller than this are reported as "about the same". */
export const VERDICT_SAME_WITHIN_GBP = 250;

export type Verdict = 'commission' | 'rent' | 'same';

export type SensitivityRow = { label: string; factor: number; commissionShop: number; rentShop: number };

export const SENSITIVITY_FACTORS = [
  { label: 'Takings −20%', factor: 0.8 },
  { label: 'As entered', factor: 1 },
  { label: 'Takings +20%', factor: 1.2 },
] as const;

export type ComparisonResult = {
  inputs: ChairRentInputs;
  commission: CommissionResult;
  rent: RentResult;
  difference: number;
  verdict: Verdict;
  /** Weekly rent (ex VAT) at which chair rent matches commission; null if no rent weeks. */
  breakEvenWeeklyRent: number | null;
  /** Commission % at which commission matches the entered rent; null if no rate 0–100% does. */
  breakEvenCommissionPercent: number | null;
  breakEvenCommissionOutOfRange: 'below-zero' | 'above-hundred' | null;
  sensitivity: SensitivityRow[];
  /** Shop VAT registered, or the chair's takings alone are at least a third of the VAT threshold. */
  showVatNote: boolean;
};

function shopResultAtRate(inputs: ChairRentInputs, percent: number): number {
  return computeCommission({ ...inputs, commissionPercent: percent }).shopResult;
}

/**
 * Bisection on the commission rate. The shop's commission result never rises as the rate rises
 * (minimum-wage top-ups make it flat at low rates), so the crossing point is well defined.
 */
export function solveBreakEvenCommission(
  inputs: ChairRentInputs,
  target: number,
): { percent: number | null; outOfRange: ComparisonResult['breakEvenCommissionOutOfRange'] } {
  const atZero = shopResultAtRate(inputs, 0);
  const atHundred = shopResultAtRate(inputs, 100);
  if (atZero < target) return { percent: null, outOfRange: 'below-zero' };
  if (atHundred > target) return { percent: null, outOfRange: 'above-hundred' };
  let low = 0;
  let high = 100;
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (shopResultAtRate(inputs, mid) >= target) low = mid;
    else high = mid;
  }
  return { percent: (low + high) / 2, outOfRange: null };
}

function compareCore(inputs: ChairRentInputs) {
  const commission = computeCommission(inputs);
  const rent = computeRent(inputs);
  return { commission, rent, difference: commission.shopResult - rent.shopResult };
}

export function compareModels(rawInputs: Partial<Record<keyof ChairRentInputs, unknown>>): ComparisonResult {
  const inputs = sanitizeInputs(rawInputs);
  const { commission, rent, difference } = compareCore(inputs);

  const verdict: Verdict =
    Math.abs(difference) < VERDICT_SAME_WITHIN_GBP ? 'same' : difference > 0 ? 'commission' : 'rent';

  const breakEvenWeeklyRent =
    inputs.rentWeeksPerYear > 0 ? (commission.shopResult + rent.extraCosts) / inputs.rentWeeksPerYear : null;

  const solved = solveBreakEvenCommission(inputs, rent.shopResult);

  const sensitivity = SENSITIVITY_FACTORS.map(({ label, factor }) => {
    const scaled = compareCore({ ...inputs, monthlyTakingsGbp: inputs.monthlyTakingsGbp * factor });
    return { label, factor, commissionShop: scaled.commission.shopResult, rentShop: scaled.rent.shopResult };
  });

  return {
    inputs,
    commission,
    rent,
    difference,
    verdict,
    breakEvenWeeklyRent,
    breakEvenCommissionPercent: solved.percent,
    breakEvenCommissionOutOfRange: solved.outOfRange,
    sensitivity,
    showVatNote: inputs.shopVatRegistered || commission.annualGrossTakings * 3 >= VAT.registrationThresholdGbp,
  };
}
