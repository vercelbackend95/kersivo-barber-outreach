import { TAXONOMY_VERSION } from '../../constants';
import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from '../../contracts';
import { computeClassificationMetrics } from '../metrics/classificationMetrics';
import { computePairAssertionMetrics } from '../metrics/pairAssertionMetrics';
import {
  buildHarnessFixtureMetrics,
  computeRecommendationMetrics,
  verifyDeterministicRepeatability,
} from '../metrics/recommendationMetrics';
import { RELEASE_GATE_THRESHOLDS } from '../metrics/releaseGates';
import type {
  CalibrationGoldExpectations,
  DryRunStubProfiles,
  HarnessFixtureChecks,
  HarnessFixtureMetrics,
  HarnessSelfCheckStatus,
  RecommendationMetrics,
} from '../types';

export type HarnessSelfCheckResult = {
  status: HarnessSelfCheckStatus;
  fixtureChecks: HarnessFixtureChecks;
  fixtureMetrics: HarnessFixtureMetrics;
  recommendationMetrics: RecommendationMetrics;
  rejectionReasonCounts: Record<string, number>;
};

function evaluateFixtureThresholds(
  recommendation: RecommendationMetrics,
  pairPassRate: number,
  repeatabilityRate: number,
): string[] {
  const failures: string[] = [];

  if (recommendation.precisionAt4 != null && recommendation.precisionAt4 < RELEASE_GATE_THRESHOLDS.precisionAt4) {
    failures.push(
      `precision@4 ${(recommendation.precisionAt4 * 100).toFixed(1)}% < ${RELEASE_GATE_THRESHOLDS.precisionAt4 * 100}%`,
    );
  }
  if (
    recommendation.mustIncludeRecall != null &&
    recommendation.mustIncludeRecall < RELEASE_GATE_THRESHOLDS.mustIncludeRecall
  ) {
    failures.push(
      `mustInclude recall ${(recommendation.mustIncludeRecall * 100).toFixed(1)}% < ${RELEASE_GATE_THRESHOLDS.mustIncludeRecall * 100}%`,
    );
  }
  if (
    recommendation.mustExcludePassRate != null &&
    recommendation.mustExcludePassRate < RELEASE_GATE_THRESHOLDS.mustExcludePassRate
  ) {
    failures.push(`mustExclude pass rate ${(recommendation.mustExcludePassRate * 100).toFixed(1)}% < 100%`);
  }
  if (recommendation.criticalUnsafeFalsePositiveCount > RELEASE_GATE_THRESHOLDS.criticalUnsafeFalsePositives) {
    failures.push(`critical unsafe false positives: ${recommendation.criticalUnsafeFalsePositiveCount}`);
  }
  if (pairPassRate < RELEASE_GATE_THRESHOLDS.pairAssertionPassRate) {
    failures.push(`pair assertion pass rate ${(pairPassRate * 100).toFixed(1)}% < 100%`);
  }
  if (repeatabilityRate < RELEASE_GATE_THRESHOLDS.deterministicRepeatability) {
    failures.push(`deterministic repeatability ${(repeatabilityRate * 100).toFixed(1)}% < 100%`);
  }
  if (recommendation.familyCapViolations > RELEASE_GATE_THRESHOLDS.familyCapViolations) {
    failures.push(`family-cap violations: ${recommendation.familyCapViolations}`);
  }
  if (
    recommendation.comboDomainCoverageRate != null &&
    recommendation.comboDomainCoverageRate < 1
  ) {
    failures.push(`combo domain coverage ${(recommendation.comboDomainCoverageRate * 100).toFixed(1)}% < 100%`);
  }

  return failures;
}

export function runHarnessSelfCheck(
  gold: CalibrationGoldExpectations,
  stubs: DryRunStubProfiles,
  productEntries: Array<{ id: string; profile: ProductSemanticProfileV2 }>,
): HarnessSelfCheckResult {
  const allProfiles = new Map<string, ServiceSemanticProfileV2 | ProductSemanticProfileV2>();
  for (const [id, profile] of stubs.services) allProfiles.set(id, profile);
  for (const [id, profile] of stubs.products) allProfiles.set(id, profile);

  const classification = computeClassificationMetrics(allProfiles, gold.classification);
  const recommendation = computeRecommendationMetrics(
    gold.recommendations,
    stubs.services,
    productEntries,
    stubs.products,
  );
  const pairMetrics = computePairAssertionMetrics(gold.recommendations, stubs.services, stubs.products);

  let repeatabilityPasses = 0;
  let repeatabilityTotal = 0;
  for (const scenario of gold.recommendations) {
    const service = stubs.services.get(scenario.serviceId);
    if (!service) continue;
    repeatabilityTotal += 1;
    if (verifyDeterministicRepeatability(service, productEntries)) {
      repeatabilityPasses += 1;
    }
  }

  const classificationPassed =
    classification.failedEntityIds.length === 0 && classification.evaluatedEntityCount > 0;
  const recommendationFailed = new Set([...recommendation.mismatchedScenarioIds]);
  const pairFailed = pairMetrics.failedKeys.length > 0;
  const repeatabilityRate = repeatabilityTotal === 0 ? 1 : repeatabilityPasses / repeatabilityTotal;
  const pairPassRate = pairMetrics.total === 0 ? 1 : pairMetrics.passRate;

  const fixtureThresholdFailures = evaluateFixtureThresholds(recommendation, pairPassRate, repeatabilityRate);

  const fixtureChecks: HarnessFixtureChecks = {
    classificationExpectationsPassed:
      classification.evaluatedEntityCount - classification.failedEntityIds.length,
    classificationExpectationsTotal: classification.evaluatedEntityCount,
    recommendationScenariosPassed: gold.recommendations.length - recommendationFailed.size,
    recommendationScenariosTotal: gold.recommendations.length,
    pairAssertionsPassed: pairMetrics.passed,
    pairAssertionsTotal: pairMetrics.total,
    deterministicRepeatabilityRate: repeatabilityRate,
    failedClassificationEntityIds: classification.failedEntityIds,
    failedScenarioIds: [...recommendationFailed],
    failedPairAssertionKeys: pairMetrics.failedKeys,
    fixtureThresholdFailures,
  };

  const fixtureMetrics = buildHarnessFixtureMetrics(recommendation, pairPassRate, repeatabilityRate);

  const status: HarnessSelfCheckStatus =
    classificationPassed &&
    recommendationFailed.size === 0 &&
    !pairFailed &&
    repeatabilityRate === 1 &&
    fixtureThresholdFailures.length === 0
      ? 'PASSED'
      : 'FAILED';

  return {
    status,
    fixtureChecks,
    fixtureMetrics,
    recommendationMetrics: recommendation,
    rejectionReasonCounts: pairMetrics.rejectionReasonCounts,
  };
}

export function buildNullLiveClassificationMetrics(
  evaluatedEntityCount: number,
): import('../types').ClassificationMetrics {
  return {
    structuredParseSuccessRate: null,
    requiredFieldAccuracy: null,
    forbiddenFieldViolationRate: null,
    confidenceGateCorrectness: null,
    ambiguousFailClosedRate: null,
    evaluatedEntityCount,
    failedEntityIds: [],
    providerAttemptedCount: 0,
    providerSuccessfulCount: 0,
    semanticConsistencyFailureCount: 0,
    semanticConsistencyFailedEntityIds: [],
    missingRequiredProfileCount: 0,
    endToEndClassificationSuccessRate: null,
  };
}

export function buildNullLiveRecommendationMetrics(): import('../types').RecommendationMetrics {
  return {
    precisionAt4: null,
    mustIncludeRecall: null,
    mustExcludePassRate: null,
    criticalUnsafeFalsePositiveCount: 0,
    familyCapViolations: 0,
    comboDomainCoverageRate: null,
    deterministicRepeatability: null,
    rerankFallbackRate: null,
    classificationErrorCounts: {},
    rerankFallbackReasonCounts: {},
    mismatchedScenarioIds: [],
    pairAssertionPassRate: null,
    pairAssertionFailures: 0,
    expectedEmptyScenarioCount: 0,
    expectedEmptyScenariosPassed: 0,
    expectedEmptyPassRate: null,
    unexpectedEmptyScenarioSelections: [],
  };
}

export const HARNESS_VERSIONS = {
  taxonomyVersion: TAXONOMY_VERSION,
} as const;
