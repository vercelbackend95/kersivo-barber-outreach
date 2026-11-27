import { describe, expect, it } from 'vitest';
import { SELF_EMPLOYED_TAX_YEARS } from '@/data/self-employed-tax-rates';
import {
  DEFAULT_INPUTS,
  calculateTax,
  class4NationalInsurance,
  incomeTax,
  personalAllowance,
  sanitizeInputs,
  type BarberTaxInputs,
} from './engine';

const y2627 = SELF_EMPLOYED_TAX_YEARS['2026-27'];
const y2526 = SELF_EMPLOYED_TAX_YEARS['2025-26'];

/**
 * A scenario with an exact profit: 10 weeks of takings less £1,200 of yearly costs
 * (above the £1,000 trading allowance, so actual costs are used).
 */
const withProfit = (profit: number, overrides: Partial<BarberTaxInputs> = {}) =>
  calculateTax({
    ...DEFAULT_INPUTS,
    weeklyTakingsGbp: (profit + 1_200) / 10,
    weeklyTipsGbp: 0,
    weeksWorked: 10,
    weeklyChairRentGbp: 0,
    otherCostsMonthlyGbp: 100,
    ...overrides,
  });

describe('Income Tax (England, Wales and Northern Ireland)', () => {
  it('charges nothing up to the £12,570 Personal Allowance', () => {
    expect(incomeTax(12_570, y2627, 'england-wales-ni')).toBe(0);
  });

  it('charges 20% in the basic band and 40% above £50,270', () => {
    expect(incomeTax(24_340, y2627, 'england-wales-ni')).toBeCloseTo(2_354, 6);
    expect(incomeTax(50_270, y2627, 'england-wales-ni')).toBeCloseTo(7_540, 6);
    expect(incomeTax(60_000, y2627, 'england-wales-ni')).toBeCloseTo(11_432, 6);
  });

  it('tapers the Personal Allowance by £1 for every £2 above £100,000', () => {
    expect(personalAllowance(110_000, y2627)).toBe(7_570);
    expect(personalAllowance(125_140, y2627)).toBe(0);
    expect(incomeTax(110_000, y2627, 'england-wales-ni')).toBeCloseTo(33_432, 6);
  });

  it('charges 45% above £125,140', () => {
    expect(incomeTax(130_000, y2627, 'england-wales-ni')).toBeCloseTo(44_703, 6);
  });

  it('uses the same bands in 2025/26 and 2026/27', () => {
    expect(incomeTax(60_000, y2526, 'england-wales-ni')).toBeCloseTo(incomeTax(60_000, y2627, 'england-wales-ni'), 6);
  });
});

describe('Income Tax (Scotland)', () => {
  it('matches the published 2026/27 bands (taxable band + £12,570 = GOV.UK boundary)', () => {
    const limits = y2627.incomeTaxBands.scotland.map((band) => band.upToTaxableGbp);
    expect(limits.slice(0, 4).map((limit) => (limit ?? 0) + y2627.personalAllowanceGbp)).toEqual([16_537, 29_526, 43_662, 75_000]);
  });

  it('works out 2026/27 tax on £24,340 as £2,314.33', () => {
    // 3,967 × 19% + 7,803 × 20%
    expect(incomeTax(24_340, y2627, 'scotland')).toBeCloseTo(2_314.33, 2);
  });

  it('works out 2025/26 tax on £24,340 as £2,325.73', () => {
    // 2,827 × 19% + 8,943 × 20%
    expect(incomeTax(24_340, y2526, 'scotland')).toBeCloseTo(2_325.73, 2);
  });
});

describe('Class 4 National Insurance', () => {
  it('charges 6% between £12,570 and £50,270 and 2% above', () => {
    expect(class4NationalInsurance(12_570, y2627)).toBe(0);
    expect(class4NationalInsurance(24_340, y2627)).toBeCloseTo(706.2, 6);
    expect(class4NationalInsurance(60_000, y2627)).toBeCloseTo(2_456.6, 6);
  });
});

describe('the example scenario', () => {
  const result = calculateTax(DEFAULT_INPUTS);

  it('adds takings and tips over the weeks worked and takes off rent and costs', () => {
    expect(result.turnover).toBe(33_580);
    expect(result.expenses).toBe(9_240);
    expect(result.profit).toBe(24_340);
    expect(result.usesTradingAllowance).toBe(false);
  });

  it('works out the bill, the share to put aside and take-home pay', () => {
    expect(result.incomeTax).toBeCloseTo(2_354, 6);
    expect(result.class4).toBeCloseTo(706.2, 6);
    expect(result.bill).toBeCloseTo(3_060.2, 6);
    expect(result.perWorkingWeek).toBeCloseTo(3_060.2 / 46, 6);
    expect(result.shareOfTurnover).toBeCloseTo(3_060.2 / 33_580, 6);
    expect(result.takeHome).toBeCloseTo(21_279.8, 6);
  });

  it('adds half the bill as the first payment on account in January', () => {
    expect(result.paymentsOnAccount).toBe('required');
    expect(result.paymentOnAccountEach).toBeCloseTo(1_530.1, 6);
    expect(result.januaryDue).toBeCloseTo(4_590.3, 6);
    expect(result.julyDue).toBeCloseTo(1_530.1, 6);
  });

  it('flags Making Tax Digital from April 2028, and April 2027 if 2025/26 was similar', () => {
    expect(result.makingTaxDigital).toBe('from-april-2028');
    expect(result.makingTaxDigitalMayStart2027).toBe(true);
  });

  it('returns three takings scenarios with the entered one in the middle', () => {
    expect(result.scenarios.map((row) => row.weeklyTakingsGbp)).toEqual([560, 700, 840]);
    expect(result.scenarios[1].bill).toBeCloseTo(result.bill, 6);
    expect(result.scenarios[0].bill).toBeLessThan(result.bill);
    expect(result.scenarios[2].bill).toBeGreaterThan(result.bill);
  });
});

describe('payments on account', () => {
  it('takes payments already made off the January balancing payment', () => {
    const result = calculateTax({ ...DEFAULT_INPUTS, paymentsOnAccountPaidGbp: 1_000 });
    expect(result.balancingPayment).toBeCloseTo(2_060.2, 6);
    expect(result.januaryDue).toBeCloseTo(3_590.3, 6);
  });

  it('reports an overpayment when payments on account were more than the bill', () => {
    const result = calculateTax({ ...DEFAULT_INPUTS, paymentsOnAccountPaidGbp: 4_000 });
    expect(result.overpaid).toBeCloseTo(939.8, 6);
    expect(result.januaryDue).toBeCloseTo(1_530.1, 6);
  });

  it('only charges the extra tax when the barber also has a job', () => {
    const result = withProfit(10_000, { employmentIncomeGbp: 20_000 });
    expect(result.taxPaidAtSource).toBeCloseTo(1_486, 6);
    expect(result.incomeTax).toBeCloseTo(2_000, 6);
    expect(result.class4).toBe(0);
    expect(result.paymentsOnAccount).toBe('required');
  });

  it('skips payments on account when the bill is under £1,000', () => {
    const result = withProfit(2_000, { employmentIncomeGbp: 40_000 });
    expect(result.bill).toBeCloseTo(400, 6);
    expect(result.paymentsOnAccount).toBe('bill-under-minimum');
    expect(result.januaryDue).toBeCloseTo(400, 6);
    expect(result.julyDue).toBe(0);
  });

  it('skips payments on account when more than 80% of the tax was paid through PAYE', () => {
    const result = withProfit(6_000, { employmentIncomeGbp: 45_000 });
    expect(result.bill).toBeCloseTo(1_346, 6);
    expect(result.paymentsOnAccount).toBe('mostly-paid-at-source');
  });
});

describe('allowances, thresholds and edge cases', () => {
  it('uses the £1,000 trading allowance when actual costs are lower', () => {
    const result = calculateTax({ ...DEFAULT_INPUTS, weeklyTakingsGbp: 50, weeklyTipsGbp: 0, weeksWorked: 40, weeklyChairRentGbp: 0, otherCostsMonthlyGbp: 25 });
    expect(result.usesTradingAllowance).toBe(true);
    expect(result.deduction).toBe(1_000);
    expect(result.profit).toBe(1_000);
  });

  it('leaves turnover under £1,000 tax-free', () => {
    const result = calculateTax({ ...DEFAULT_INPUTS, weeklyTakingsGbp: 20, weeklyTipsGbp: 0, weeksWorked: 40, weeklyChairRentGbp: 0, otherCostsMonthlyGbp: 0 });
    expect(result.profit).toBe(0);
    expect(result.bill).toBe(0);
  });

  it('reports a loss with no tax when costs are higher than takings', () => {
    const result = calculateTax({ ...DEFAULT_INPUTS, weeklyTakingsGbp: 100, weeklyTipsGbp: 0, weeksWorked: 46 });
    expect(result.profit).toBe(0);
    expect(result.loss).toBe(9_240 - 4_600);
    expect(result.bill).toBe(0);
    expect(result.paymentsOnAccount).toBe('bill-under-minimum');
  });

  it('treats Class 2 as paid from the small profits threshold of each year', () => {
    expect(withProfit(7_000).class2Status).toBe('voluntary');
    expect(withProfit(7_000, { taxYear: '2025-26' }).class2Status).toBe('treated-as-paid');
    expect(withProfit(7_105).class2Status).toBe('treated-as-paid');
  });

  it('applies the Making Tax Digital threshold to turnover (before costs), for the year it decides', () => {
    // withProfit adds £1,200 of costs, so turnover = profit + £1,200.
    expect(withProfit(28_900, { taxYear: '2025-26' }).makingTaxDigital).toBe('from-april-2027');
    expect(withProfit(28_800, { taxYear: '2025-26' }).makingTaxDigital).toBe('below');
    expect(withProfit(25_000).makingTaxDigital).toBe('from-april-2028');
    expect(withProfit(25_000).makingTaxDigitalMayStart2027).toBe(false);
    expect(withProfit(18_800).makingTaxDigital).toBe('below');
  });

  it('flags takings above the £90,000 VAT registration threshold', () => {
    expect(calculateTax({ ...DEFAULT_INPUTS, weeklyTakingsGbp: 2_000 }).vatThresholdExceeded).toBe(true);
    expect(calculateTax(DEFAULT_INPUTS).vatThresholdExceeded).toBe(false);
  });

  it('has no weekly figure when no weeks are worked', () => {
    expect(calculateTax({ ...DEFAULT_INPUTS, weeksWorked: 0 }).perWorkingWeek).toBeNull();
  });
});

describe('sanitizeInputs', () => {
  it('repairs hostile or missing values', () => {
    const repaired = sanitizeInputs({
      taxYear: '1999-00',
      region: 'mars',
      weeklyTakingsGbp: '£1,250',
      weeklyTipsGbp: -40,
      weeksWorked: 60.4,
      weeklyChairRentGbp: 'abc',
      employmentIncomeGbp: Number.POSITIVE_INFINITY,
    });
    expect(repaired.taxYear).toBe('2026-27');
    expect(repaired.region).toBe('england-wales-ni');
    expect(repaired.weeklyTakingsGbp).toBe(1_250);
    expect(repaired.weeklyTipsGbp).toBe(0);
    expect(repaired.weeksWorked).toBe(52);
    expect(repaired.weeklyChairRentGbp).toBe(DEFAULT_INPUTS.weeklyChairRentGbp);
    expect(repaired.employmentIncomeGbp).toBe(DEFAULT_INPUTS.employmentIncomeGbp);
  });
});
