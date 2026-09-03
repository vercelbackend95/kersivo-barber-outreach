import { describe, expect, it } from 'vitest';

import { loadCalibrationCatalogue } from '../dataset/loaders';
import { getCalibrationGoldExpectations } from '../expectations/gold';
import {
  CALIBRATION_SMOKE_EXECUTION_MANIFEST,
  getSmokeCallCounts,
  SMOKE_MAX_PROVIDER_REQUESTS,
  validateSmokeManifestClosure,
} from '../scope/smokeManifest';

describe('smoke manifest', () => {
  it('has at most 20 provider requests', () => {
    const counts = getSmokeCallCounts();
    expect(counts.totalMaxCalls).toBeLessThanOrEqual(SMOKE_MAX_PROVIDER_REQUESTS);
  });

  it('derives counts from authoritative manifest', () => {
    const counts = getSmokeCallCounts();
    expect(counts.serviceClassifications).toBe(
      CALIBRATION_SMOKE_EXECUTION_MANIFEST.classifyServiceIds.length,
    );
    expect(counts.productClassifications).toBe(
      CALIBRATION_SMOKE_EXECUTION_MANIFEST.classifyProductIds.length,
    );
    expect(counts.rerankAttempts).toBe(CALIBRATION_SMOKE_EXECUTION_MANIFEST.rerankServiceIds.length);
    expect(counts.totalMaxCalls).toBe(
      counts.serviceClassifications + counts.productClassifications + counts.rerankAttempts,
    );
  });

  it('is dependency-closed against gold expectations', () => {
    const gold = getCalibrationGoldExpectations();
    const catalogue = loadCalibrationCatalogue();
    expect(() => validateSmokeManifestClosure(gold, catalogue)).not.toThrow();
  });
});
