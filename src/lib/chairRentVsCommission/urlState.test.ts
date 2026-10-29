import { describe, expect, it } from 'vitest';
import { DEFAULT_INPUTS, compareModels } from './engine';
import { hashToInputs, inputsToHash } from './urlState';
import { RESULTS_DISCLAIMER, buildResultView, buildSummaryText, formatGbp, verdictText } from './view';

describe('URL hash state', () => {
  it('writes nothing for the defaults', () => {
    expect(inputsToHash(DEFAULT_INPUTS)).toBe('');
    expect(hashToInputs('')).toEqual(DEFAULT_INPUTS);
  });

  it('round-trips a changed scenario', () => {
    const inputs = { ...DEFAULT_INPUTS, monthlyTakingsGbp: 5200.5, shopVatRegistered: true, wageBand: '18-20' as const, showBarberSide: false };
    const hash = inputsToHash(inputs);
    expect(hash).toBe('#t=5200.5&vat=1&age=18-20&bs=0');
    expect(hashToInputs(hash)).toEqual(inputs);
  });

  it('ignores unknown keys and repairs bad values', () => {
    const inputs = hashToInputs('#t=abc&c=500&age=nope&vat=maybe&zzz=1&r=%E0%A4%A');
    expect(inputs.monthlyTakingsGbp).toBe(DEFAULT_INPUTS.monthlyTakingsGbp);
    expect(inputs.commissionPercent).toBe(100);
    expect(inputs.wageBand).toBe('21-plus');
    expect(inputs.shopVatRegistered).toBe(false);
    expect(inputs.weeklyRentGbp).toBe(DEFAULT_INPUTS.weeklyRentGbp);
  });
});

describe('result view', () => {
  it('formats whole pounds with a true minus sign', () => {
    expect(formatGbp(1234.4)).toBe('£1,234');
    expect(formatGbp(-1234.6)).toBe('−£1,235');
    expect(formatGbp(-0.2)).toBe('£0');
  });

  it('uses the neutral verdict wording', () => {
    const result = compareModels(DEFAULT_INPUTS);
    expect(verdictText(result)).toMatch(/^On these numbers, (commission|chair rent) leaves the shop about £[\d,]+ a year more than (chair rent|commission)\.$/);
    expect(verdictText({ ...result, verdict: 'same' })).toBe('On these numbers, commission and chair rent leave the shop about the same.');
  });

  it('shows the minimum wage warning only when a top-up is needed', () => {
    expect(buildResultView(compareModels({ ...DEFAULT_INPUTS, monthlyTakingsGbp: 2000 })).hidden['mw-warning']).toBe(false);
    expect(buildResultView(compareModels({ ...DEFAULT_INPUTS, monthlyTakingsGbp: 9000, quietMonths: 0 })).hidden['mw-warning']).toBe(true);
  });

  it('builds a copyable summary with the disclaimer', () => {
    const summary = buildSummaryText(compareModels(DEFAULT_INPUTS), 'https://kersivo.co.uk/chair-rent-vs-commission-calculator');
    expect(summary).toContain('Chair Rent vs Commission');
    expect(summary).toContain(RESULTS_DISCLAIMER);
    expect(summary).not.toMatch(/NaN|Infinity|undefined/);
  });
});

describe('minimum wage warning wording', () => {
  it('says "in quiet months" only when typical months are covered', () => {
    const quietOnly = buildResultView(compareModels(DEFAULT_INPUTS)).text['mw-warning-text'];
    expect(quietOnly).toBe('Commission alone falls below the minimum wage in quiet months. The shop must top it up.');
    const allYear = buildResultView(compareModels({ ...DEFAULT_INPUTS, monthlyTakingsGbp: 1500 })).text['mw-warning-text'];
    expect(allYear).toBe('Commission alone falls below the minimum wage in 12 months of the year. The shop must top it up.');
  });
});
