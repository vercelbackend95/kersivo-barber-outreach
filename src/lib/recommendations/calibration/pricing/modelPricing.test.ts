import { describe, expect, it } from 'vitest';

import { getModelPricing, isAllowedCalibrationModel } from './modelPricing';

describe('modelPricing', () => {
  it('allowlists gpt-4o-mini-2024-07-18 only', () => {
    expect(isAllowedCalibrationModel('gpt-4o-mini-2024-07-18')).toBe(true);
    expect(isAllowedCalibrationModel('gpt-4o')).toBe(false);
  });

  it('returns pricing for allowlisted model', () => {
    const pricing = getModelPricing('gpt-4o-mini-2024-07-18');
    expect(pricing).not.toBeNull();
    expect(pricing!.inputPer1M).toBeGreaterThan(0);
    expect(pricing!.outputPer1M).toBeGreaterThan(0);
  });

  it('returns null for unknown model', () => {
    expect(getModelPricing('unknown')).toBeNull();
  });
});
