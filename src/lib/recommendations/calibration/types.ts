import type { PairRejectionCode } from '../pairEvaluation';
import type { ProductFamily } from '../taxonomy';
import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from '../contracts';
export type ScenarioPairAssertionDiagnostic = {
  scenarioId: string;
  productId: string;
  productName: string;
  expected: 'ELIGIBLE' | 'REJECTED';
  passed: boolean;
  actualEligible: boolean;
  actualRejectionCode?: PairRejectionCode;
};

export type CalibrationMode = 'dry-run' | 'live';
export type CalibrationScope = 'smoke' | 'full';
export type CalibrationCachePolicy = 'reuse' | 'refresh' | 'readonly';
export type ProviderRunKind =
  | 'FRESH_PROVIDER_RUN'
  | 'MIXED_CACHE_PROVIDER_RUN'
  | 'CACHE_ONLY_REPLAY';
export type HarnessSelfCheckStatus = 'PASSED' | 'FAILED';
export type LiveEvaluationStatus = 'NOT_RUN' | 'PASSED' | 'FAILED';
export type ReleaseGateStatus = 'NOT_RUN' | 'PASSED' | 'FAILED';

export type CalibrationRawService = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
};

export type CalibrationRawProduct = {
  id: string;
  name: string;
  description: string | null;
  category: string;
};

export type CalibrationCatalogue = {
  shopName: string;
  services: CalibrationRawService[];
  products: CalibrationRawProduct[];
};

export type ClassificationFieldExpectation = {
  required?: string[];
  allowed?: string[];
  forbidden?: string[];
};

export type ClassificationGoldExpectation = {
  entityId: string;
  entityType: 'SERVICE' | 'PRODUCT';
  minConfidence?: number;
  maxConfidence?: number;
  expectFailClosed?: boolean;
  targetAreas?: ClassificationFieldExpectation;
  retailNeeds?: ClassificationFieldExpectation;
  productFamily?: ClassificationFieldExpectation;
  hairLengthSuitability?: ClassificationFieldExpectation;
  incompatibilities?: ClassificationFieldExpectation;
};

export type PairAssertionExpectation = {
  productId: string;
  expected: 'ELIGIBLE' | 'REJECTED';
  allowedRejectionCodes?: PairRejectionCode[];
};

export type RecommendationGoldScenario = {
  id: string;
  serviceId: string;
  relevantProductIds?: string[];
  mustInclude?: string[];
  mustExclude?: string[];
  criticalMustExclude?: string[];
  pairAssertions?: PairAssertionExpectation[];
  requiredFamilies?: ProductFamily[];
  allowedFamilies?: ProductFamily[];
  requireHairAndBeardCoverage?: boolean;
  expectEmpty?: boolean;
};

export type CalibrationGoldExpectations = {
  classification: ClassificationGoldExpectation[];
  recommendations: RecommendationGoldScenario[];
};

export type CalibrationFinalOutcome = 'PASS' | 'FAIL' | 'INCOMPLETE';

export type MissingProfileDiagnostic = {
  entityId: string;
  entityType: 'SERVICE' | 'PRODUCT';
  errorCode: string;
};

export type CalibrationCliArgs = {
  mode: CalibrationMode;
  scope: CalibrationScope;
  model?: string;
  confirmSpend?: string;
  maxCalls?: number;
  maxCostUsd?: number;
  outputDir: string;
  outputDirExplicit?: boolean;
  cachePolicy: CalibrationCachePolicy;
};

export type CalibrationCallPlan = {
  scope: CalibrationScope;
  serviceClassifications: number;
  productClassifications: number;
  rerankAttempts: number;
  totalMaxCalls: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedMaxCostUsd: number;
};

export type HarnessFixtureChecks = {
  classificationExpectationsPassed: number;
  classificationExpectationsTotal: number;
  recommendationScenariosPassed: number;
  recommendationScenariosTotal: number;
  pairAssertionsPassed: number;
  pairAssertionsTotal: number;
  deterministicRepeatabilityRate: number;
  failedClassificationEntityIds: string[];
  failedScenarioIds: string[];
  failedPairAssertionKeys: string[];
  fixtureThresholdFailures: string[];
};

export type HarnessFixtureMetrics = {
  precisionAt4: number;
  mustIncludeRecall: number;
  mustExcludePassRate: number;
  criticalUnsafeFalsePositiveCount: number;
  comboDomainCoverageRate: number | null;
  familyCapViolations: number;
  pairAssertionPassRate: number;
  deterministicRepeatability: number;
};

export type ClassificationMetrics = {
  /** Gold-scoped field/expectation metrics (smoke gold subset when live). */
  structuredParseSuccessRate: number | null;
  requiredFieldAccuracy: number | null;
  forbiddenFieldViolationRate: number | null;
  confidenceGateCorrectness: number | null;
  ambiguousFailClosedRate: number | null;
  evaluatedEntityCount: number;
  /** Gold-scoped expectation failures / missing gold entities only. */
  failedEntityIds: string[];
  /** End-to-end provider accounting (all classify attempts in the run). */
  providerAttemptedCount: number;
  providerSuccessfulCount: number;
  semanticConsistencyFailureCount: number;
  semanticConsistencyFailedEntityIds: string[];
  missingRequiredProfileCount: number;
  endToEndClassificationSuccessRate: number | null;
};

export type RecommendationMetrics = {
  precisionAt4: number | null;
  mustIncludeRecall: number | null;
  mustExcludePassRate: number | null;
  criticalUnsafeFalsePositiveCount: number;
  familyCapViolations: number;
  comboDomainCoverageRate: number | null;
  deterministicRepeatability: number | null;
  rerankFallbackRate: number | null;
  classificationErrorCounts: Record<string, number>;
  rerankFallbackReasonCounts: Record<string, number>;
  mismatchedScenarioIds: string[];
  pairAssertionPassRate: number | null;
  pairAssertionFailures: number;
  expectedEmptyScenarioCount: number;
  expectedEmptyScenariosPassed: number;
  expectedEmptyPassRate: number | null;
  unexpectedEmptyScenarioSelections: Array<{ scenarioId: string; productIds: string[] }>;
};

export type ReleaseGateResult = {
  id: string;
  label: string;
  threshold: string;
  actual: string;
  passed: boolean;
  skipped?: boolean;
  notEvaluated?: boolean;
};

export type ScenarioProductDiagnostic = {
  rank: number;
  productId: string;
  productName: string;
  deterministicScore: number;
  selectionScore?: number;
  deterministicPosition?: number;
  rerankPosition?: number;
  finalPosition?: number;
  rankDelta?: number;
  rerankApplied?: boolean;
  rerankFallbackReason?: string;
  matchedAreas: string[];
  overlapRetailNeeds: string[];
  positiveReasonCodes: string[];
  productFamily: ProductFamily;
  inRelevantProductIds: boolean;
  isMustInclude: boolean;
  violatesMustExclude: boolean;
  violatesCriticalMustExclude: boolean;
};

export type ScenarioDiagnostic = {
  scenarioId: string;
  serviceId: string;
  serviceName: string;
  serviceDescription: string | null;
  selectedProducts: ScenarioProductDiagnostic[];
  pairAssertionResults: ScenarioPairAssertionDiagnostic[];
  precisionAt4: number;
  pass: boolean;
  failureReasons: string[];
  expectEmpty?: boolean;
  emptyRailMessage?: string;
};

export type CalibrationReport = {
  runId: string;
  timestampUtc: string;
  mode: CalibrationMode;
  scope: CalibrationScope;
  modelId: string;
  taxonomyVersion: string;
  schemaVersion: string;
  promptVersion: string;
  datasetVersion: string;
  cachePolicy: CalibrationCachePolicy;
  providerRunKind: ProviderRunKind;
  providerConnectivityVerified: boolean;
  harnessSelfCheckStatus: HarnessSelfCheckStatus;
  liveEvaluationStatus: LiveEvaluationStatus;
  releaseGateStatus: ReleaseGateStatus;
  datasetCounts: { services: number; products: number; scenarios: number };
  calls: {
    plannedMax: number;
    attempted: number;
    successful: number;
    failed: number;
    cacheHits: number;
    skipped: number;
    rerankAttempted: number;
    rerankApplied: number;
    rerankFallback: number;
  };
  tokens: {
    prompt: number;
    completion: number;
    total: number;
    knownCallCount: number;
    unknownCallCount: number;
  };
  cost: {
    estimatedMaxUsd: number;
    reservedMaxUsd: number;
    observedUsd: number | null;
    observedUsdKnown: boolean;
  };
  harnessFixtureChecks: HarnessFixtureChecks;
  harnessFixtureMetrics: HarnessFixtureMetrics;
  classificationMetrics: ClassificationMetrics;
  recommendationMetrics: RecommendationMetrics;
  releaseGates: ReleaseGateResult[];
  scenarioDiagnostics: ScenarioDiagnostic[];
  /** @deprecated Use releaseGateStatus; kept for backward-compatible report readers */
  releaseGatePassed: boolean;
  sanitizedFailures: Array<{ fixtureId: string; code: string }>;
  rejectionReasonCounts: Record<string, number>;
  rerankFallbackReasonCounts: Record<string, number>;
  gitSha?: string;
  finalOutcome?: CalibrationFinalOutcome;
  missingProfileDiagnostics?: MissingProfileDiagnostic[];
  errorCodeCounts?: Record<string, number>;
  skipReasonCounts?: Record<string, number>;
  invalidCacheDiagnostics?: Array<{ entityId: string; operation: string; reason: string }>;
  operationBreakdown?: Array<{
    kind: string;
    entityId?: string;
    serviceId?: string;
    status: string;
    reason?: string;
    errorCode?: string;
  }>;
  operationAccountingReconciliation?: { ok: boolean; errors: string[] };
};

export type DryRunStubProfiles = {
  services: Map<string, ServiceSemanticProfileV2>;
  products: Map<string, ProductSemanticProfileV2>;
};

export type ScopedCalibrationEntities = {
  serviceIds: Set<string>;
  productIds: Set<string>;
  scenarioIds: Set<string>;
  classificationEntityIds: Set<string>;
};
