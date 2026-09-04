import { PROFILE_CONFIDENCE_MIN } from '../../constants';
import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from '../../contracts';
import { CATALOGUE_HAIR_LENGTH_RESTRICTION_CONFLICT } from '../../explicitHairLengthRestriction';
import { SEMANTIC_CONTRADICTION_CODES } from '../../semanticConsistency';
import type {
  ClassificationFieldExpectation,
  ClassificationGoldExpectation,
  ClassificationMetrics,
} from '../types';

type EntityProfile = ServiceSemanticProfileV2 | ProductSemanticProfileV2;

function checkFieldExpectation(
  values: string[],
  expectation: ClassificationFieldExpectation | undefined,
): boolean {
  if (!expectation) return true;
  if (expectation.required) {
    for (const required of expectation.required) {
      if (!values.includes(required)) return false;
    }
  }
  if (expectation.allowed) {
    for (const value of values) {
      if (!expectation.allowed.includes(value)) return false;
    }
  }
  if (expectation.forbidden) {
    for (const forbidden of expectation.forbidden) {
      if (values.includes(forbidden)) return false;
    }
  }
  return true;
}

function getProfileFieldValues(
  profile: EntityProfile,
  field: keyof ClassificationGoldExpectation,
): string[] {
  if (field === 'targetAreas') return profile.targetAreas;
  if (field === 'retailNeeds') return profile.retailNeeds;
  if (profile.entityType === 'PRODUCT') {
    if (field === 'productFamily') return [profile.productFamily];
    if (field === 'hairLengthSuitability') return [profile.hairLengthSuitability];
    if (field === 'incompatibilities') return profile.incompatibilities;
  }
  return [];
}

export function evaluateClassificationExpectation(
  profile: EntityProfile,
  expectation: ClassificationGoldExpectation,
): { passed: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (expectation.minConfidence != null && profile.confidence < expectation.minConfidence) {
    reasons.push('CONFIDENCE_BELOW_MIN');
  }
  if (expectation.maxConfidence != null && profile.confidence > expectation.maxConfidence) {
    reasons.push('CONFIDENCE_ABOVE_MAX');
  }

  const failClosed = profile.confidence < PROFILE_CONFIDENCE_MIN;
  if (expectation.expectFailClosed === true && !failClosed) {
    reasons.push('EXPECTED_FAIL_CLOSED');
  }
  if (expectation.expectFailClosed === false && failClosed) {
    reasons.push('UNEXPECTED_FAIL_CLOSED');
  }

  for (const field of [
    'targetAreas',
    'retailNeeds',
    'productFamily',
    'hairLengthSuitability',
    'incompatibilities',
  ] as const) {
    const fieldExpectation = expectation[field];
    if (!fieldExpectation) continue;
    const values = getProfileFieldValues(profile, field);
    if (!checkFieldExpectation(values, fieldExpectation)) {
      reasons.push(`FIELD_MISMATCH:${field}`);
    }
  }

  return { passed: reasons.length === 0, reasons };
}

export function computeClassificationMetrics(
  profiles: Map<string, EntityProfile>,
  expectations: ClassificationGoldExpectation[],
): ClassificationMetrics {
  let parseSuccess = 0;
  let fieldMatches = 0;
  let fieldChecks = 0;
  let forbiddenViolations = 0;
  let confidenceGateCorrect = 0;
  let ambiguousTotal = 0;
  let ambiguousFailClosed = 0;
  const failedEntityIds: string[] = [];

  for (const expectation of expectations) {
    const profile = profiles.get(expectation.entityId);
    if (!profile) {
      failedEntityIds.push(expectation.entityId);
      continue;
    }

    parseSuccess += 1;
    const result = evaluateClassificationExpectation(profile, expectation);
    if (!result.passed) {
      failedEntityIds.push(expectation.entityId);
    }

    for (const field of ['targetAreas', 'retailNeeds', 'productFamily', 'hairLengthSuitability'] as const) {
      const fieldExpectation = expectation[field];
      if (!fieldExpectation) continue;
      fieldChecks += 1;
      const values = getProfileFieldValues(profile, field);
      if (checkFieldExpectation(values, fieldExpectation)) {
        fieldMatches += 1;
      }
      if (fieldExpectation.forbidden?.some((f) => values.includes(f))) {
        forbiddenViolations += 1;
      }
    }

    const failClosed = profile.confidence < PROFILE_CONFIDENCE_MIN;
    if (expectation.expectFailClosed != null) {
      confidenceGateCorrect += expectation.expectFailClosed === failClosed ? 1 : 0;
    } else {
      confidenceGateCorrect += 1;
    }

    if (expectation.expectFailClosed === true) {
      ambiguousTotal += 1;
      if (failClosed) ambiguousFailClosed += 1;
    }
  }

  const evaluatedEntityCount = expectations.length;

  return {
    structuredParseSuccessRate: evaluatedEntityCount === 0 ? 1 : parseSuccess / evaluatedEntityCount,
    requiredFieldAccuracy: fieldChecks === 0 ? 1 : fieldMatches / fieldChecks,
    forbiddenFieldViolationRate: fieldChecks === 0 ? 0 : forbiddenViolations / fieldChecks,
    confidenceGateCorrectness:
      evaluatedEntityCount === 0 ? 1 : confidenceGateCorrect / evaluatedEntityCount,
    ambiguousFailClosedRate: ambiguousTotal === 0 ? 1 : ambiguousFailClosed / ambiguousTotal,
    evaluatedEntityCount,
    failedEntityIds,
    providerAttemptedCount: 0,
    providerSuccessfulCount: 0,
    semanticConsistencyFailureCount: 0,
    semanticConsistencyFailedEntityIds: [],
    missingRequiredProfileCount: 0,
    endToEndClassificationSuccessRate: null,
  };
}

const SEMANTIC_FAILURE_CODES = new Set<string>([
  ...SEMANTIC_CONTRADICTION_CODES,
  CATALOGUE_HAIR_LENGTH_RESTRICTION_CONFLICT,
]);

export function isSemanticConsistencyFailureCode(code: string): boolean {
  return SEMANTIC_FAILURE_CODES.has(code);
}

/**
 * Derive overall vs classification-only provider counts for smoke accounting.
 * Rerank is included in overall attempted but excluded from classification metrics.
 */
export function splitSmokeProviderAccounting(input: {
  classifyServiceAttempted: number;
  classifyProductAttempted: number;
  classifyServiceSuccessful: number;
  classifyProductSuccessful: number;
  rerankAttempted: number;
}): {
  overallAttempted: number;
  classifyAttempted: number;
  classifySuccessful: number;
  rerankAttempted: number;
} {
  const classifyAttempted = input.classifyServiceAttempted + input.classifyProductAttempted;
  const classifySuccessful =
    input.classifyServiceSuccessful + input.classifyProductSuccessful;
  return {
    overallAttempted: classifyAttempted + input.rerankAttempted,
    classifyAttempted,
    classifySuccessful,
    rerankAttempted: input.rerankAttempted,
  };
}

export type EndToEndClassificationDiagnosticsInput = {
  providerAttemptedCount: number;
  providerSuccessfulCount: number;
  sanitizedFailures: Array<{ fixtureId: string; code: string }>;
  missingRequiredProfileCount: number;
  requiredClassificationCount: number;
};

/** Attach provider/end-to-end diagnostics without altering gold-scoped rates. */
export function withEndToEndClassificationDiagnostics(
  metrics: ClassificationMetrics,
  input: EndToEndClassificationDiagnosticsInput,
): ClassificationMetrics {
  const semanticConsistencyFailedEntityIds = [
    ...new Set(
      input.sanitizedFailures
        .filter((failure) => isSemanticConsistencyFailureCode(failure.code))
        .map((failure) => failure.fixtureId),
    ),
  ].sort();

  const endToEndClassificationSuccessRate =
    input.requiredClassificationCount === 0
      ? 1
      : (input.requiredClassificationCount - input.missingRequiredProfileCount) /
        input.requiredClassificationCount;

  return {
    ...metrics,
    providerAttemptedCount: input.providerAttemptedCount,
    providerSuccessfulCount: input.providerSuccessfulCount,
    semanticConsistencyFailureCount: semanticConsistencyFailedEntityIds.length,
    semanticConsistencyFailedEntityIds,
    missingRequiredProfileCount: input.missingRequiredProfileCount,
    endToEndClassificationSuccessRate,
  };
}
