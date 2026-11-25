import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INPUTS,
  MAX_SERVICES,
  bookedMinutesPerMonth,
  calculatePrices,
  clientPriceForKeptGbp,
  keptPerServiceGbp,
  roundUpToStep,
  sanitizeInputs,
  type PriceCalcInputs,
} from './engine';
import { buildResultView, buildSummaryText, formatClientPrice, priceRiseText } from './view';

const simple: PriceCalcInputs = {
  ...DEFAULT_INPUTS,
  rentMonthlyGbp: 500,
  otherCostsMonthlyGbp: 100,
  takeHomeMonthlyGbp: 2400,
  weeklyHours: 40,
  weeksPerYear: 48,
  bookedPercent: 50,
  productsPerServiceGbp: 0,
  cardSharePercent: 0,
  cardFeePercent: 0,
  cardFeeFixedPence: 0,
  vatRegistered: false,
  services: [{ name: 'Haircut', minutes: 30 }],
};

describe('barber price calculator engine', () => {
  it('counts booked minutes from hours, weeks and how busy the chair is', () => {
    // 40 h × 60 × 48 weeks ÷ 12 × 50% = 4,800 minutes (80 hours) a month.
    expect(bookedMinutesPerMonth(simple)).toBe(4800);
  });

  it('prices a service from cost per booked minute when there are no fees, products or VAT', () => {
    const result = calculatePrices(simple);
    expect(result.bookedHoursPerMonth).toBe(80);
    expect(result.fixedCostsMonthlyGbp).toBe(600);
    // £3,000 ÷ 80 h = £37.50 an hour; costs only: £600 ÷ 80 h = £7.50 an hour.
    expect(result.targetPerBookedHourGbp).toBeCloseTo(37.5);
    expect(result.floorPerBookedHourGbp).toBeCloseTo(7.5);
    expect(result.services[0].targetPriceGbp).toBeCloseTo(18.75);
    expect(result.services[0].floorPriceGbp).toBeCloseTo(3.75);
  });

  it('adds products, card fees and VAT so the shop keeps exactly what it needs', () => {
    const inputs: PriceCalcInputs = { ...simple, productsPerServiceGbp: 1, cardSharePercent: 80, cardFeePercent: 1.75, cardFeeFixedPence: 10, vatRegistered: true };
    const price = calculatePrices(inputs).services[0].targetPriceGbp!;
    expect(keptPerServiceGbp(inputs, price)).toBeCloseTo(18.75, 6);
    expect(price).toBeGreaterThan(18.75 * 1.2);
  });

  it('clientPriceForKeptGbp is the inverse of keptPerServiceGbp', () => {
    const inputs = sanitizeInputs({ ...DEFAULT_INPUTS, vatRegistered: true });
    for (const needed of [0, 5, 18.2, 40]) {
      expect(keptPerServiceGbp(inputs, clientPriceForKeptGbp(inputs, needed)!)).toBeCloseTo(needed, 6);
    }
  });

  it('shows no price when no time is booked', () => {
    const result = calculatePrices({ ...simple, bookedPercent: 0 });
    expect(result.services[0].targetPriceGbp).toBeNull();
    expect(result.targetPerBookedHourGbp).toBeNull();
    const view = buildResultView(result);
    expect(view.hidden['no-time']).toBe(false);
    expect(formatClientPrice(result.services[0].targetPriceGbp)).toBe('—');
  });

  it('gets cheaper per service the busier the chair is', () => {
    const { sensitivity } = calculatePrices(DEFAULT_INPUTS);
    expect(sensitivity.map((row) => row.bookedPercent)).toEqual([50, 60, 70, 80, 90]);
    for (let i = 1; i < sensitivity.length; i++) {
      expect(sensitivity[i].targetPriceGbp!).toBeLessThan(sensitivity[i - 1].targetPriceGbp!);
    }
    const at70 = sensitivity.find((row) => row.bookedPercent === 70)!;
    expect(at70.targetPriceGbp).toBeCloseTo(calculatePrices(DEFAULT_INPUTS).services[0].targetPriceGbp!, 6);
  });

  describe('price rise check', () => {
    it('works out how many clients a rise can lose before it loses money', () => {
      // No fees: £20 → £25 keeps the same money with 20% fewer clients.
      const check = calculatePrices({ ...simple, currentPriceGbp: 20, newPriceGbp: 25 }).priceRise;
      expect(check.status).toBe('ok');
      if (check.status === 'ok') expect(check.maxClientLossPercent).toBeCloseTo(20);
      expect(priceRiseText(check)).toContain('20.0% of clients');
      expect(priceRiseText(check)).toContain('20 in every 100');
    });

    it('accounts for per-service costs, which make a rise go further', () => {
      const check = calculatePrices({ ...simple, productsPerServiceGbp: 2, currentPriceGbp: 20, newPriceGbp: 25 }).priceRise;
      // Kept £18 → £23: up to 1 − 18/23 ≈ 21.7%.
      expect(check.status === 'ok' && check.maxClientLossPercent).toBeCloseTo(21.74, 1);
    });

    it('asks for a higher new price when it is not a rise', () => {
      expect(calculatePrices({ ...simple, currentPriceGbp: 20, newPriceGbp: 20 }).priceRise.status).toBe('not-a-rise');
    });

    it('flags a current price that does not even cover per-service costs', () => {
      expect(calculatePrices({ ...simple, productsPerServiceGbp: 5, currentPriceGbp: 4, newPriceGbp: 10 }).priceRise.status).toBe('current-below-costs');
    });
  });

  describe('sanitizeInputs', () => {
    it('falls back to defaults for junk and clamps out-of-range numbers', () => {
      const inputs = sanitizeInputs({ rentMonthlyGbp: 'abc', bookedPercent: 140, weeksPerYear: 47.6, cardFeePercent: -3 });
      expect(inputs.rentMonthlyGbp).toBe(DEFAULT_INPUTS.rentMonthlyGbp);
      expect(inputs.bookedPercent).toBe(100);
      expect(inputs.weeksPerYear).toBe(48);
      expect(inputs.cardFeePercent).toBe(0);
    });

    it('keeps at most the maximum number of services and tidies names and minutes', () => {
      const many = Array.from({ length: 12 }, (_, i) => ({ name: `  Cut   ${i} `, minutes: i === 0 ? 1000 : '25' }));
      const inputs = sanitizeInputs({ services: many });
      expect(inputs.services).toHaveLength(MAX_SERVICES);
      expect(inputs.services[0]).toEqual({ name: 'Cut 0', minutes: 240 });
      expect(inputs.services[1]).toEqual({ name: 'Cut 1', minutes: 25 });
    });
  });

  it('rounds client prices up to the next 50p', () => {
    expect(roundUpToStep(18.01)).toBe(18.5);
    expect(roundUpToStep(18.5)).toBe(18.5);
    expect(roundUpToStep(18.500000001)).toBe(18.5);
    expect(formatClientPrice(18.01)).toBe('£18.50');
    expect(formatClientPrice(17.9)).toBe('£18');
  });

  it('builds a copyable summary with every service', () => {
    const text = buildSummaryText(calculatePrices(DEFAULT_INPUTS), 'https://kersivo.co.uk/barber-price-calculator');
    for (const service of DEFAULT_INPUTS.services) expect(text).toContain(service.name);
    expect(text).toContain('before tax');
    expect(text.endsWith('https://kersivo.co.uk/barber-price-calculator')).toBe(true);
  });
});
