import { describe, expect, it } from 'vitest';

import { loadCalibrationCatalogue } from '../dataset/loaders';
import { CALIBRATION_MODEL_SNAPSHOT } from '../liveGuards';
import { SMOKE_MAX_PROVIDER_REQUESTS } from '../scope/smokeManifest';
import { buildLiveSmokeCallPlan } from './buildLiveCallPlan';

describe('buildLiveSmokeCallPlan', () => {
  const catalogue = loadCalibrationCatalogue();

  it('derives exactly 20 operations from smoke manifest', () => {
    const plan = buildLiveSmokeCallPlan(catalogue, CALIBRATION_MODEL_SNAPSHOT);
    expect(plan.totalMaxCalls).toBe(SMOKE_MAX_PROVIDER_REQUESTS);
    expect(plan.operations).toHaveLength(SMOKE_MAX_PROVIDER_REQUESTS);
    expect(plan.serviceClassifications).toBe(2);
    expect(plan.productClassifications).toBe(17);
    expect(plan.rerankAttempts).toBe(1);
  });
});
