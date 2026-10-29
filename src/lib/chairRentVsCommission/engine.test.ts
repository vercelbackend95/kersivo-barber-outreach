import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INPUTS,
  annualGrossTakings,
  compareModels,
  computeCommission,
  computeRent,
  employerNiBeforeAllowance,
  employerPension,
  monthlyQualifyingHours,
  sanitizeInputs,
  type ChairRentInputs,
} from './engine';

const scenario = (overrides: Partial<ChairRentInputs>): ChairRentInputs => sanitizeInputs({ ...DEFAULT_INPUTS, ...overrides });

/** /insights/barber-commission-pay-minimum-wage-uk worked example: 21+, 40%, 173 hours, holiday off, no VAT. */
const commissionArticle = (monthlyTakingsGbp: number, monthlyHoursOverride = 173) =>
  computeCommission(
    scenario({
      monthlyTakingsGbp,
      quietMonths: 0,
      wageBand: '21-plus',
      commissionPercent: 40,
      monthlyHoursOverride,
      includeHolidayPay: false,
      shopVatRegistered: false,
    }),
  );

/** /insights/how-much-do-barbershop-owners-make-uk: £45,000 net chair, 26 h/week, holiday in the annual figure. */
const ownerEarningsArticle = (commissionPercent: number) =>
  computeCommission(
    scenario({
      monthlyTakingsGbp: 45_000 / 12,
      quietMonths: 0,
      commissionPercent,
      weeklyHours: 26,
      includeHolidayPay: false,
      shopVatRegistered: false,
      pensionEnrolled: true,
      employmentAllowanceAvailable: false,
    }),
  );

describe('reproduces /insights/barber-commission-pay-minimum-wage-uk', () => {
  it('sets the 173-hour floor at £2,198.83', () => {
    expect(commissionArticle(5000).monthlyFloor).toBeCloseTo(2198.83, 2);
  });

  it('tops up £798.83 on £3,500 of takings', () => {
    const [month] = commissionArticle(3500).months;
    expect(month.commission).toBeCloseTo(1400, 2);
    expect(month.topUp).toBeCloseTo(798.83, 2);
  });

  it('tops up £198.83 on £5,000 of takings', () => {
    expect(commissionArticle(5000).months[0].topUp).toBeCloseTo(198.83, 2);
  });

  it('needs no top-up on £6,500 and pays £15.03 an hour', () => {
    const [month] = commissionArticle(6500).months;
    expect(month.topUp).toBe(0);
    expect(month.effectiveHourly).toBeCloseTo(15.03, 2);
  });

  it('finds commission-only break-even takings of about £5,497.08', () => {
    // £2,198.83 ÷ 0.4 = £5,497.075, which the article rounds to £5,497.08 (and "about £5,497").
    expect(commissionArticle(5000).breakEvenMonthlyTakings).toBeCloseTo(5497.075, 6);
  });

  it('uses a £2,338.64 floor and £5,846.60 break-even in a 184-hour month', () => {
    const result = commissionArticle(5000, 184);
    expect(result.monthlyFloor).toBeCloseTo(2338.64, 2);
    expect(result.breakEvenMonthlyTakings).toBeCloseTo(5846.6, 2);
  });
});

describe('reproduces /insights/how-much-do-barbershop-owners-make-uk', () => {
  it('at 40%: pay £18,000, employer NI £1,950 before allowance, pension £352.80', () => {
    const result = ownerEarningsArticle(40);
    expect(result.topUps).toBe(0);
    expect(result.grossPay).toBeCloseTo(18_000, 2);
    expect(result.employerNiBeforeAllowance).toBeCloseTo(1950, 2);
    expect(result.pension).toBeCloseTo(352.8, 2);
  });

  it('at 50%: pay £22,500, employer NI £2,625 before allowance, pension £487.80', () => {
    const result = ownerEarningsArticle(50);
    expect(result.grossPay).toBeCloseTo(22_500, 2);
    expect(result.employerNiBeforeAllowance).toBeCloseTo(2625, 2);
    expect(result.pension).toBeCloseTo(487.8, 2);
  });
});

describe('takings and VAT', () => {
  it('annualises typical and quiet months', () => {
    expect(annualGrossTakings(scenario({ monthlyTakingsGbp: 1000, quietMonths: 2, quietMonthPercent: 50 }))).toBe(11_000);
  });

  it('strips VAT from shop takings when VAT registered', () => {
    const off = computeCommission(scenario({ monthlyTakingsGbp: 6000, quietMonths: 0, shopVatRegistered: false }));
    const on = computeCommission(scenario({ monthlyTakingsGbp: 6000, quietMonths: 0, shopVatRegistered: true }));
    expect(off.annualNetTakings).toBe(72_000);
    expect(on.annualNetTakings).toBeCloseTo(60_000, 6);
    expect(on.months[0].commission).toBeCloseTo(2000, 6);
  });

  it('pays commission on gross takings only when chosen and VAT registered', () => {
    const gross = computeCommission(scenario({ monthlyTakingsGbp: 6000, quietMonths: 0, shopVatRegistered: true, commissionOnGross: true }));
    expect(gross.months[0].commission).toBeCloseTo(2400, 6);
    const ignored = computeCommission(scenario({ monthlyTakingsGbp: 6000, quietMonths: 0, shopVatRegistered: false, commissionOnGross: true }));
    expect(ignored.months[0].commission).toBeCloseTo(2400, 6);
    expect(ignored.annualNetTakings).toBe(72_000);
  });

  it('reports break-even takings as paid by clients when commission is on net takings', () => {
    const result = computeCommission(
      scenario({ shopVatRegistered: true, commissionOnGross: false, monthlyHoursOverride: 173, includeHolidayPay: false }),
    );
    expect(result.breakEvenMonthlyCommissionBase).toBeCloseTo(5497.075, 3);
    expect(result.breakEvenMonthlyTakings).toBeCloseTo(5497.075 * 1.2, 3);
  });
});

describe('minimum wage month by month', () => {
  it('tops up only the quiet months', () => {
    const result = computeCommission(
      scenario({
        monthlyTakingsGbp: 6000,
        quietMonths: 3,
        quietMonthPercent: 50,
        monthlyHoursOverride: 173,
        includeHolidayPay: false,
      }),
    );
    expect(result.monthsNeedingTopUp).toBe(3);
    expect(result.topUps).toBeCloseTo((2198.83 - 1200) * 3, 2);
    expect(result.payBeforeHoliday).toBeCloseTo(2400 * 9 + 2198.83 * 3, 2);
  });

  it('uses the right hourly rate for each age band', () => {
    const under18 = computeCommission(scenario({ wageBand: 'under-18', monthlyHoursOverride: 100 }));
    const young = computeCommission(scenario({ wageBand: '18-20', monthlyHoursOverride: 100 }));
    expect(under18.monthlyFloor).toBeCloseTo(800, 6);
    expect(young.monthlyFloor).toBeCloseTo(1085, 6);
  });

  it('counts worked weeks only for the floor when holiday pay is on', () => {
    expect(monthlyQualifyingHours(scenario({ weeklyHours: 30, includeHolidayPay: false }))).toBeCloseTo(130, 6);
    expect(monthlyQualifyingHours(scenario({ weeklyHours: 30, includeHolidayPay: true }))).toBeCloseTo(116, 6);
    expect(monthlyQualifyingHours(scenario({ weeklyHours: 30, monthlyHoursOverride: 150 }))).toBe(150);
  });
});

describe('holiday pay, NI, allowance and pension', () => {
  it('adds 5.6 weeks at average weekly pay', () => {
    const result = computeCommission(
      scenario({ monthlyTakingsGbp: 45_000 / 12, quietMonths: 0, weeklyHours: 26, includeHolidayPay: true }),
    );
    expect(result.payBeforeHoliday).toBeCloseTo(18_000, 6);
    expect(result.holidayPay).toBeCloseTo((18_000 / 46.4) * 5.6, 6);
    expect(result.grossPay).toBeCloseTo(18_000 + (18_000 / 46.4) * 5.6, 6);
  });

  it('uses part of the Employment Allowance', () => {
    const result = computeCommission(
      scenario({
        monthlyTakingsGbp: 45_000 / 12,
        quietMonths: 0,
        weeklyHours: 26,
        includeHolidayPay: false,
        employmentAllowanceAvailable: true,
        employmentAllowanceGbp: 1000,
      }),
    );
    expect(result.employmentAllowanceUsed).toBe(1000);
    expect(result.employerNi).toBeCloseTo(950, 6);
  });

  it('never uses more allowance than the NI bill', () => {
    const result = computeCommission(
      scenario({ monthlyTakingsGbp: 45_000 / 12, quietMonths: 0, weeklyHours: 26, includeHolidayPay: false, employmentAllowanceAvailable: true }),
    );
    expect(result.employmentAllowanceUsed).toBeCloseTo(1950, 6);
    expect(result.employerNi).toBeCloseTo(0, 6);
  });

  it('applies the under-21 and apprentice-under-25 upper thresholds', () => {
    expect(employerNiBeforeAllowance(30_000, 'under-21')).toBe(0);
    expect(employerNiBeforeAllowance(60_270, 'under-21')).toBeCloseTo(1500, 6);
    expect(employerNiBeforeAllowance(30_000, 'apprentice-under-25')).toBe(0);
    expect(employerNiBeforeAllowance(30_000)).toBeCloseTo(3750, 6);
    expect(computeCommission(scenario({ wageBand: '18-20' })).niThreshold).toBe('under-21');
    expect(computeCommission(scenario({ wageBand: 'apprentice', apprenticeUnder25: true })).employerNi).toBe(0);
    expect(computeCommission(scenario({ wageBand: 'apprentice', apprenticeUnder25: false })).niThreshold).toBe('standard');
  });

  it('caps pension at the qualifying earnings band', () => {
    expect(employerPension(5000)).toBe(0);
    expect(employerPension(80_000)).toBeCloseTo((50_270 - 6240) * 0.03, 6);
    expect(computeCommission(scenario({ pensionEnrolled: false })).pension).toBe(0);
  });
});

describe('shop costs and chair rent', () => {
  it('counts card transactions from the average service price', () => {
    const result = computeCommission(
      scenario({ monthlyTakingsGbp: 2500, quietMonths: 0, cardFeePercent: 1.5, cardFeeFixedPence: 20, cardSharePercent: 100, averageServicePriceGbp: 25 }),
    );
    expect(result.cardFees).toBeCloseTo(1200 * 0.2 + 30_000 * 0.015, 6);
  });

  it('keeps rent ex VAT for the shop and charges the renter VAT when chosen', () => {
    const rent = computeRent(scenario({ shopVatRegistered: true, chargeVatOnRent: true, weeklyRentGbp: 150, rentWeeksPerYear: 52, extraCostsWeeklyGbp: 10 }));
    expect(rent.rentIncome).toBe(7800);
    expect(rent.rentPaidByRenter).toBeCloseTo(9360, 6);
    expect(rent.shopResult).toBe(7800 - 520);
    const notRegistered = computeRent(scenario({ shopVatRegistered: false, chargeVatOnRent: true }));
    expect(notRegistered.rentPaidByRenter).toBe(notRegistered.rentIncome);
  });

  it("works out the renter's profit before tax", () => {
    const rent = computeRent(
      scenario({
        monthlyTakingsGbp: 3000,
        quietMonths: 0,
        weeklyRentGbp: 100,
        renterProductsPercent: 5,
        renterCardSharePercent: 0,
        renterSoftwareMonthlyGbp: 20,
        renterOtherMonthlyGbp: 30,
      }),
    );
    expect(rent.renterProfitBeforeTax).toBeCloseTo(36_000 - 5200 - 1800 - 240 - 360, 6);
  });
});

describe('comparison and solvers', () => {
  it('break-even weekly rent makes rent match commission', () => {
    const result = compareModels({ ...DEFAULT_INPUTS, extraCostsWeeklyGbp: 15 });
    expect(result.breakEvenWeeklyRent).not.toBeNull();
    const matched = compareModels({ ...DEFAULT_INPUTS, extraCostsWeeklyGbp: 15, weeklyRentGbp: result.breakEvenWeeklyRent! });
    expect(matched.difference).toBeCloseTo(0, 6);
  });

  it('break-even commission makes commission match rent', () => {
    const inputs = { ...DEFAULT_INPUTS, monthlyTakingsGbp: 7000, weeklyRentGbp: 200 };
    const result = compareModels(inputs);
    expect(result.breakEvenCommissionPercent).not.toBeNull();
    const matched = compareModels({ ...inputs, commissionPercent: result.breakEvenCommissionPercent! });
    expect(Math.abs(matched.difference)).toBeLessThan(0.01);
  });

  it('reports when no commission rate can match the rent', () => {
    const result = compareModels({ ...DEFAULT_INPUTS, monthlyTakingsGbp: 500, weeklyRentGbp: 300 });
    expect(result.breakEvenCommissionPercent).toBeNull();
    expect(result.breakEvenCommissionOutOfRange).toBe('below-zero');
  });

  it('gives a neutral verdict within £250', () => {
    const base = compareModels(DEFAULT_INPUTS);
    const close = compareModels({ ...DEFAULT_INPUTS, weeklyRentGbp: base.breakEvenWeeklyRent! + 1 });
    expect(close.verdict).toBe('same');
    expect(compareModels({ ...DEFAULT_INPUTS, weeklyRentGbp: 0 }).verdict).toBe('commission');
    expect(compareModels({ ...DEFAULT_INPUTS, weeklyRentGbp: 2000 }).verdict).toBe('rent');
  });

  it('runs sensitivity at −20%, as entered and +20%', () => {
    const result = compareModels(DEFAULT_INPUTS);
    expect(result.sensitivity.map((row) => row.factor)).toEqual([0.8, 1, 1.2]);
    expect(result.sensitivity[1].commissionShop).toBeCloseTo(result.commission.shopResult, 6);
    expect(new Set(result.sensitivity.map((row) => row.rentShop)).size).toBe(1);
  });
});

describe('edge inputs', () => {
  const allFinite = (value: unknown): boolean => {
    if (typeof value === 'number') return Number.isFinite(value);
    if (value === null || typeof value !== 'object') return true;
    return Object.values(value).every(allFinite);
  };

  it('never returns NaN or Infinity for zero inputs', () => {
    const zeros = Object.fromEntries(
      Object.entries(DEFAULT_INPUTS).map(([key, value]) => [key, typeof value === 'number' ? 0 : value]),
    );
    const result = compareModels(zeros);
    expect(allFinite(result)).toBe(true);
    expect(result.commission.breakEvenMonthlyTakings).toBeNull();
    expect(result.breakEvenWeeklyRent).toBeNull();
  });

  it('repairs garbage and out-of-range input', () => {
    const inputs = sanitizeInputs({
      monthlyTakingsGbp: 'abc',
      quietMonths: 40,
      commissionPercent: -5,
      averageServicePriceGbp: 0,
      wageBand: 'retired',
      shopVatRegistered: 'yes',
      weeklyRentGbp: '£1,200',
    });
    expect(inputs.monthlyTakingsGbp).toBe(DEFAULT_INPUTS.monthlyTakingsGbp);
    expect(inputs.quietMonths).toBe(12);
    expect(inputs.commissionPercent).toBe(0);
    expect(inputs.averageServicePriceGbp).toBe(1);
    expect(inputs.wageBand).toBe('21-plus');
    expect(inputs.shopVatRegistered).toBe(false);
    expect(inputs.weeklyRentGbp).toBe(1200);
    expect(allFinite(compareModels(inputs))).toBe(true);
  });
});
