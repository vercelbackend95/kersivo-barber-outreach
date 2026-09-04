import { describe, expect, it } from 'vitest';

import {
  buildNullLiveClassificationMetrics,
  buildNullLiveRecommendationMetrics,
  runHarnessSelfCheck,
} from '../runner/harnessSelfCheck';
import { buildCalibrationStubProfiles, calibrationProductEntries } from '../dataset/stubProfiles';
import { getCalibrationGoldExpectations } from '../expectations/gold';
import {
  splitSmokeProviderAccounting,
  withEndToEndClassificationDiagnostics,
} from './classificationMetrics';
import {
  allReleaseGatesPassed,
  evaluateLiveReleaseGateStatus,
  evaluateReleaseGates,
  notEvaluatedGateActual,
} from './releaseGates';
import type { ClassificationMetrics, RecommendationMetrics } from '../types';

function baseRecommendation(overrides: Partial<RecommendationMetrics> = {}): RecommendationMetrics {
  return {
    precisionAt4: 1,
    mustIncludeRecall: 1,
    mustExcludePassRate: 1,
    criticalUnsafeFalsePositiveCount: 0,
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
    ...overrides,
  };
}

function completeClassification(overrides: Partial<ClassificationMetrics> = {}): ClassificationMetrics {
  return {
    structuredParseSuccessRate: 1,
    requiredFieldAccuracy: 1,
    forbiddenFieldViolationRate: 0,
    confidenceGateCorrectness: 1,
    ambiguousFailClosedRate: 1,
    evaluatedEntityCount: 1,
    failedEntityIds: [],
    providerAttemptedCount: 1,
    providerSuccessfulCount: 1,
    semanticConsistencyFailureCount: 0,
    semanticConsistencyFailedEntityIds: [],
    missingRequiredProfileCount: 0,
    endToEndClassificationSuccessRate: 1,
    ...overrides,
  };
}

describe('calibration metrics and release gates', () => {
  it('marks live release gates as NOT_EVALUATED in dry-run', () => {
    const classification = buildNullLiveClassificationMetrics(0);
    const recommendation = buildNullLiveRecommendationMetrics();

    const gates = evaluateReleaseGates(classification, recommendation, { liveEvaluation: false });
    expect(gates.every((g) => g.notEvaluated)).toBe(true);
    expect(gates.every((g) => g.actual === 'N/A (no provider calls)')).toBe(true);
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
    const gates = evaluateReleaseGates(
      completeClassification(),
      baseRecommendation({ criticalUnsafeFalsePositiveCount: 1 }),
      { liveEvaluation: true },
    );
    expect(allReleaseGatesPassed(gates, true)).toBe(false);
  });

  it('uses incomplete wording when classify attempts exist but evaluation is skipped', () => {
    expect(notEvaluatedGateActual(19)).toBe('N/A (incomplete provider classifications)');
    expect(notEvaluatedGateActual(0)).toBe('N/A (no provider calls)');

    const classification = completeClassification({
      structuredParseSuccessRate: null,
      requiredFieldAccuracy: null,
      forbiddenFieldViolationRate: null,
      confidenceGateCorrectness: null,
      ambiguousFailClosedRate: null,
      providerAttemptedCount: 19,
      providerSuccessfulCount: 16,
      missingRequiredProfileCount: 3,
      endToEndClassificationSuccessRate: 16 / 19,
      semanticConsistencyFailureCount: 2,
      semanticConsistencyFailedEntityIds: ['cal-prod-matte-clay', 'cal-prod-long-shampoo'],
    });
    const recommendation = buildNullLiveRecommendationMetrics();
    const gates = evaluateReleaseGates(classification, recommendation, { liveEvaluation: false });
    expect(gates.every((g) => g.actual === 'N/A (incomplete provider classifications)')).toBe(true);
    expect(evaluateLiveReleaseGateStatus(classification, recommendation)).toBe('FAILED');
  });

  it('keeps zero-call readonly wording as no provider calls', () => {
    const classification = buildNullLiveClassificationMetrics(0);
    const recommendation = buildNullLiveRecommendationMetrics();
    const gates = evaluateReleaseGates(classification, recommendation, { liveEvaluation: false });
    expect(gates.some((g) => g.actual.includes('no provider calls'))).toBe(true);
    expect(gates.some((g) => g.actual.includes('incomplete'))).toBe(false);
  });

  it('records semantic consistency failures in end-to-end diagnostics', () => {
    const base = computeNullThenAttach();
    expect(base.providerAttemptedCount).toBe(19);
    expect(base.semanticConsistencyFailureCount).toBe(2);
    expect(base.semanticConsistencyFailedEntityIds).toEqual([
      'cal-prod-long-shampoo',
      'cal-prod-matte-clay',
    ]);
    expect(base.missingRequiredProfileCount).toBe(3);
    expect(base.endToEndClassificationSuccessRate).toBeCloseTo(16 / 19);
    expect(base.failedEntityIds).toEqual([]);
  });

  it('excludes rerank from classification provider counts (2+17+1 smoke split)', () => {
    const split = splitSmokeProviderAccounting({
      classifyServiceAttempted: 2,
      classifyProductAttempted: 17,
      classifyServiceSuccessful: 2,
      classifyProductSuccessful: 17,
      rerankAttempted: 1,
    });
    expect(split.overallAttempted).toBe(20);
    expect(split.classifyAttempted).toBe(19);
    expect(split.classifySuccessful).toBe(19);
    expect(split.rerankAttempted).toBe(1);

    const metrics = withEndToEndClassificationDiagnostics(buildNullLiveClassificationMetrics(0), {
      providerAttemptedCount: split.classifyAttempted,
      providerSuccessfulCount: split.classifySuccessful,
      sanitizedFailures: [],
      missingRequiredProfileCount: 0,
      requiredClassificationCount: split.classifyAttempted,
    });
    expect(metrics.providerAttemptedCount).toBe(19);
    expect(metrics.providerSuccessfulCount).toBe(19);
    expect(metrics.endToEndClassificationSuccessRate).toBe(1);
  });
});

function computeNullThenAttach(): ClassificationMetrics {
  return withEndToEndClassificationDiagnostics(buildNullLiveClassificationMetrics(0), {
    providerAttemptedCount: 19,
    providerSuccessfulCount: 16,
    sanitizedFailures: [
      { fixtureId: 'cal-prod-matte-clay', code: 'PRODUCT_SHORT_WITH_LONG_ONLY' },
      { fixtureId: 'cal-prod-long-shampoo', code: 'PRODUCT_LONG_WITH_SHORT_ONLY' },
      { fixtureId: 'cal-svc-hair-beard', code: 'SERVICE_CRITICAL_FIELD_LOW_CONFIDENCE' },
    ],
    missingRequiredProfileCount: 3,
    requiredClassificationCount: 19,
  });
}
