import { describe, expect, it } from 'vitest';

import {
  buildNullLiveClassificationMetrics,
  buildNullLiveRecommendationMetrics,
  runHarnessSelfCheck,
} from '../runner/harnessSelfCheck';
import { buildCalibrationStubProfiles, calibrationProductEntries } from '../dataset/stubProfiles';
import { getCalibrationGoldExpectations } from '../expectations/gold';
import { allReleaseGatesPassed, evaluateReleaseGates } from './releaseGates';

describe('calibration metrics and release gates', () => {
  it('marks live release gates as NOT_EVALUATED in dry-run', () => {
    const classification = buildNullLiveClassificationMetrics(0);
    const recommendation = buildNullLiveRecommendationMetrics();

    const gates = evaluateReleaseGates(classification, recommendation, { liveEvaluation: false });
    expect(gates.every((g) => g.notEvaluated)).toBe(true);
    expect(allReleaseGatesPassed(gates, false)).toBe(true);
  });

  it('passes harness self-check after reviewed semantic and gold corrections', () => {
    const stubs = buildCalibrationStubProfiles();
    const gold = getCalibrationGoldExpectations();
    const products = calibrationProductEntries(stubs);
    const harness = runHarnessSelfCheck(gold, stubs, products);
    expect(harness.fixtureMetrics.precisionAt4).toBeGreaterThanOrEqual(0.95);
    expect(harness.status).toBe('PASSED');
    expect(harness.fixtureChecks.fixtureThresholdFailures).toHaveLength(0);
  });

  it('fails live gates when critical unsafe exclusions are violated', () => {
    const classification = {
      structuredParseSuccessRate: 1,
      requiredFieldAccuracy: 1,
      forbiddenFieldViolationRate: 0,
      confidenceGateCorrectness: 1,
      ambiguousFailClosedRate: 1,
      evaluatedEntityCount: 1,
      failedEntityIds: [],
    };
    const recommendation = {
      precisionAt4: 1,
      mustIncludeRecall: 1,
      mustExcludePassRate: 1,
      criticalUnsafeFalsePositiveCount: 1,
      familyCapViolations: 0,
      comboDomainCoverageRate: 1,
      deterministicRepeatability: 1,
      rerankFallbackRate: 0,
      classificationErrorCounts: {},
      rerankFallbackReasonCounts: {},
      mismatchedScenarioIds: [],
      pairAssertionPassRate: 1,
      pairAssertionFailures: 0,
      expectedEmptyScenarioCount: 0,
      expectedEmptyScenariosPassed: 0,
      expectedEmptyPassRate: null,
      unexpectedEmptyScenarioSelections: [],
    };

    const gates = evaluateReleaseGates(classification, recommendation, { liveEvaluation: true });
    expect(allReleaseGatesPassed(gates, true)).toBe(false);
  });
});
