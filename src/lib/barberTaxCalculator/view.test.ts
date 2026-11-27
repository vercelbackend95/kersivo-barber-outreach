import { describe, expect, it } from 'vitest';
import { DEFAULT_INPUTS, calculateTax } from './engine';
import { buildResultView, buildSummaryText, formatPencePerPound, formatSetAside, splitOfEveryPound } from './view';

describe('set-aside formatting', () => {
  it('never shows a nil amount as "-£0"', () => {
    expect(formatSetAside(0)).toBe('£0');
    expect(formatPencePerPound(0)).toBe('0p');
  });

  it('rounds up to the next pound so rounding never leaves you short', () => {
    expect(formatSetAside(66.01)).toBe('£67');
    expect(formatSetAside(67)).toBe('£67');
  });

  it('shows £0 a week when there is no tax to pay', () => {
    const view = buildResultView(calculateTax({ ...DEFAULT_INPUTS, weeklyTakingsGbp: 100 }));
    expect(view.text['per-week']).toBe('£0');
  });
});

describe('where every £1 goes', () => {
  it('splits clients’ money into costs, tax, NI and take-home, adding up to 100p', () => {
    const result = calculateTax(DEFAULT_INPUTS);
    const { shares, pence } = splitOfEveryPound(result);
    expect(Object.values(pence).reduce((a, b) => a + b, 0)).toBe(100);
    expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(shares.yours * result.turnover).toBeCloseTo(result.takeHome, 6);
  });

  it('caps costs at what clients paid when there is a loss', () => {
    const { shares, pence } = splitOfEveryPound(calculateTax({ ...DEFAULT_INPUTS, weeklyTakingsGbp: 100 }));
    expect(shares.costs).toBe(1);
    expect(pence.costs).toBe(100);
  });

  it('is empty when nothing is earned', () => {
    const { pence } = splitOfEveryPound(calculateTax({ ...DEFAULT_INPUTS, weeklyTakingsGbp: 0, weeklyTipsGbp: 0 }));
    expect(Object.values(pence).every((value) => value === 0)).toBe(true);
  });

  it('is part of the copied summary', () => {
    expect(buildSummaryText(calculateTax(DEFAULT_INPUTS), 'https://example.test/')).toMatch(/Where every £1 goes: Costs \d+p/);
  });
});
