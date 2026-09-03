import { describe, expect, it } from 'vitest';

import { buildDryRunPlan } from './dryRunPlan';
import { loadCalibrationCatalogue } from './dataset/loaders';
import { CALIBRATION_MODEL_ALLOWLIST } from './pricing/modelPricing';

describe('dryRunPlan', () => {
  it('produces a call plan without constructing OpenAI client', () => {
    const catalogue = loadCalibrationCatalogue();
    const plan = buildDryRunPlan(catalogue, CALIBRATION_MODEL_ALLOWLIST[0]);
    expect(plan.openAiClientConstructed).toBe(false);
    expect(plan.plan.totalMaxCalls).toBeGreaterThan(0);
    expect(plan.plan.estimatedMaxCostUsd).toBeGreaterThan(0);
    expect(plan.withinBudget).toBe(true);
  });
});
