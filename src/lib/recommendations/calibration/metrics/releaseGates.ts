import type {
  ClassificationMetrics,
  RecommendationMetrics,
  ReleaseGateResult,
} from '../types';

export const RELEASE_GATE_THRESHOLDS = {
  structuredParseSuccess: 1,
  criticalUnsafeFalsePositives: 0,
  mustExcludePassRate: 1,
  precisionAt4: 0.95,
  mustIncludeRecall: 0.9,
  ambiguousFailClosedRate: 1,
  deterministicRepeatability: 1,
  familyCapViolations: 0,
  pairAssertionPassRate: 1,
  expectedEmptyPassRate: 1,
} as const;

const NOT_EVALUATED_NO_PROVIDER_CALLS = 'N/A (no provider calls)';
const NOT_EVALUATED_INCOMPLETE_CLASSIFICATIONS = 'N/A (incomplete provider classifications)';
const NOT_APPLICABLE_ACTUAL = 'N/A (not applicable)';

export function notEvaluatedGateActual(providerAttemptedCount: number): string {
  return providerAttemptedCount > 0
    ? NOT_EVALUATED_INCOMPLETE_CLASSIFICATIONS
    : NOT_EVALUATED_NO_PROVIDER_CALLS;
}

function formatRate(value: number | null, providerAttemptedCount: number): string {
  if (value == null) return notEvaluatedGateActual(providerAttemptedCount);
  return `${(value * 100).toFixed(1)}%`;
}

export function evaluateReleaseGates(
  classification: ClassificationMetrics,
  recommendation: RecommendationMetrics,
  options?: { liveEvaluation?: boolean },
): ReleaseGateResult[] {
  const live = options?.liveEvaluation === true;
  const notEvaluatedActual = notEvaluatedGateActual(classification.providerAttemptedCount ?? 0);

  const gate = (
    id: string,
    label: string,
    threshold: string,
    actualValue: string,
    passed: boolean,
  ): ReleaseGateResult => ({
    id,
    label,
    threshold,
    actual: live ? actualValue : notEvaluatedActual,
    passed: live ? passed : true,
    skipped: !live,
    notEvaluated: !live,
  });

  return [
    gate(
      'structured-parse-success',
      'Structured parse success',
      '100%',
      formatRate(classification.structuredParseSuccessRate, classification.providerAttemptedCount),
      classification.structuredParseSuccessRate != null &&
        classification.structuredParseSuccessRate >= RELEASE_GATE_THRESHOLDS.structuredParseSuccess,
    ),
    gate(
      'critical-unsafe-fp',
      'Critical unsafe false positives',
      '0',
      String(recommendation.criticalUnsafeFalsePositiveCount),
      recommendation.criticalUnsafeFalsePositiveCount <= RELEASE_GATE_THRESHOLDS.criticalUnsafeFalsePositives,
    ),
    gate(
      'must-exclude-pass',
      'Must-exclude pass rate',
      '100%',
      formatRate(recommendation.mustExcludePassRate, classification.providerAttemptedCount),
      recommendation.mustExcludePassRate != null &&
        recommendation.mustExcludePassRate >= RELEASE_GATE_THRESHOLDS.mustExcludePassRate,
    ),
    gate(
      'precision-at-4',
      'precision@4',
      '≥ 95%',
      formatRate(recommendation.precisionAt4, classification.providerAttemptedCount),
      recommendation.precisionAt4 != null &&
        recommendation.precisionAt4 >= RELEASE_GATE_THRESHOLDS.precisionAt4,
    ),
    gate(
      'must-include-recall',
      'Must-include recall',
      '≥ 90%',
      formatRate(recommendation.mustIncludeRecall, classification.providerAttemptedCount),
      recommendation.mustIncludeRecall != null &&
        recommendation.mustIncludeRecall >= RELEASE_GATE_THRESHOLDS.mustIncludeRecall,
    ),
    gate(
      'ambiguous-fail-closed',
      'Ambiguous fail-closed rate',
      '100%',
      formatRate(classification.ambiguousFailClosedRate, classification.providerAttemptedCount),
      classification.ambiguousFailClosedRate != null &&
        classification.ambiguousFailClosedRate >= RELEASE_GATE_THRESHOLDS.ambiguousFailClosedRate,
    ),
    gate(
      'deterministic-repeatability',
      'Deterministic repeatability',
      '100%',
      formatRate(recommendation.deterministicRepeatability, classification.providerAttemptedCount),
      recommendation.deterministicRepeatability != null &&
        recommendation.deterministicRepeatability >= RELEASE_GATE_THRESHOLDS.deterministicRepeatability,
    ),
    gate(
      'family-cap-violations',
      'Family-cap violations',
      '0',
      String(recommendation.familyCapViolations),
      recommendation.familyCapViolations <= RELEASE_GATE_THRESHOLDS.familyCapViolations,
    ),
    gate(
      'pair-assertion-pass',
      'Pair assertion pass rate',
      '100%',
      formatRate(recommendation.pairAssertionPassRate, classification.providerAttemptedCount),
      recommendation.pairAssertionPassRate != null &&
        recommendation.pairAssertionPassRate >= RELEASE_GATE_THRESHOLDS.pairAssertionPassRate,
    ),
    gate(
      'expected-empty-pass-rate',
      'Expected-empty pass rate',
      recommendation.expectedEmptyScenarioCount > 0 ? '100%' : NOT_APPLICABLE_ACTUAL,
      recommendation.expectedEmptyScenarioCount === 0
        ? NOT_APPLICABLE_ACTUAL
        : formatRate(recommendation.expectedEmptyPassRate, classification.providerAttemptedCount),
      recommendation.expectedEmptyScenarioCount === 0
        ? true
        : recommendation.expectedEmptyPassRate != null &&
          recommendation.expectedEmptyPassRate >= RELEASE_GATE_THRESHOLDS.expectedEmptyPassRate,
    ),
  ];
}

export function allReleaseGatesPassed(gates: ReleaseGateResult[], liveEvaluation = false): boolean {
  if (!liveEvaluation) return true;
  return gates.every((gate) => gate.passed && !gate.notEvaluated);
}

export function evaluateLiveReleaseGateStatus(
  classification: ClassificationMetrics,
  recommendation: RecommendationMetrics,
): 'PASSED' | 'FAILED' {
  const gates = evaluateReleaseGates(classification, recommendation, { liveEvaluation: true });
  return allReleaseGatesPassed(gates, true) ? 'PASSED' : 'FAILED';
}
