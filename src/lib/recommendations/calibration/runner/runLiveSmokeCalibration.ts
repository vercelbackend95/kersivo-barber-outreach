import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from '../../contracts';
import {
  buildProductProfileEnvelope,
  buildServiceProfileEnvelope,
} from '../../ai/prompts';
import { computeProductSemanticHash, computeServiceSemanticHash } from '../../hash';
import { buildCandidateRerankSummary, buildServiceRerankSummary } from '../../rerankPayload';
import { createRerankPool } from '../../rerankPool';
import { PROMPT_VERSION, SCHEMA_VERSION, TAXONOMY_VERSION } from '../../constants';
import {
  readCalibrationCache,
  writeCalibrationCache,
  type CalibrationCacheKey,
} from '../cache/calibrationCache';
import {
  buildRerankCandidateSummaries,
  computeRerankContentHash,
} from '../cache/rerankCacheIdentity';
import {
  validateCachedProductProfile,
  validateCachedRerankDecision,
  validateCachedServiceProfile,
  type InvalidCacheDiagnostic,
} from '../cache/validateCalibrationCachePayload';
import { CalibrationBudgetLedger } from '../budget/CalibrationBudgetLedger';
import { estimateCostFromTokens } from '../costEstimator';
import {
  getCalibrationDatasetVersion,
  loadCalibrationCatalogue,
  validateCalibrationDatasetCounts,
} from '../dataset/loaders';
import { getCalibrationGoldExpectations } from '../expectations/gold';
import { computeClassificationMetrics } from '../metrics/classificationMetrics';
import { computeRecommendationMetrics } from '../metrics/recommendationMetrics';
import {
  evaluateLiveReleaseGateStatus,
  evaluateReleaseGates,
} from '../metrics/releaseGates';
import { buildScenarioDiagnostics } from '../metrics/scenarioDiagnostics';
import type { CalibrationProvider, ProviderUsageCapture } from '../provider/types';
import {
  buildLiveServiceRanking,
  createLiveRankingFactory,
  createLiveRankingResolver,
  type LiveServiceRanking,
} from '../ranking/buildLiveServiceRanking';
import { writeCalibrationReport } from '../reporting/reportBuilder';
import { filterGoldByScope } from '../scope/resolveScope';
import { getSmokeScopedEntities, validateSmokeManifestClosure } from '../scope/smokeManifest';
import type { CalibrationCliArgs, CalibrationReport, MissingProfileDiagnostic } from '../types';
import {
  buildCalibrationStubProfiles,
  calibrationProductEntriesForScope,
  filterStubProfilesByScope,
} from '../dataset/stubProfiles';
import { runHarnessSelfCheck } from './harnessSelfCheck';
import { buildLiveSmokeCallPlan } from './buildLiveCallPlan';
import type { CalibrationRunResult } from './runCalibration';
import {
  OperationAccounting,
  type OperationSkipReason,
} from './operationAccounting';

const CALIBRATION_SHOP_ID = 'calibration-shop';
const DEFAULT_CACHE_DIR = '.calibration-cache';

const STOP_SPENDING_ERRORS = new Set(['OPENAI_AUTH_ERROR', 'OPENAI_BILLING_ERROR']);

export type LiveSmokeCalibrationDeps = {
  provider: CalibrationProvider;
  cacheDir?: string;
};

function tryResolveGitSha(): string | undefined {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return undefined;
  }
}

function buildClassifyCacheKey(
  entityId: string,
  contentHash: string,
  modelId: string,
  operation: 'classify_service' | 'classify_product',
): CalibrationCacheKey {
  return {
    entityId,
    contentHash,
    modelId,
    promptVersion: PROMPT_VERSION,
    taxonomyVersion: TAXONOMY_VERSION,
    schemaVersion: SCHEMA_VERSION,
    operation,
  };
}

function buildRerankCacheKey(
  serviceId: string,
  contentHash: string,
  modelId: string,
): CalibrationCacheKey {
  return {
    entityId: serviceId,
    contentHash,
    modelId,
    promptVersion: PROMPT_VERSION,
    taxonomyVersion: TAXONOMY_VERSION,
    schemaVersion: SCHEMA_VERSION,
    operation: 'rerank',
  };
}

function isStopSpendingError(code: string): boolean {
  return STOP_SPENDING_ERRORS.has(code);
}

function recordError(
  errorCodeCounts: Record<string, number>,
  code: string,
): void {
  errorCodeCounts[code] = (errorCodeCounts[code] ?? 0) + 1;
}

function skipReasonForStop(code: string): OperationSkipReason {
  if (code === 'OPENAI_AUTH_ERROR') return 'SPENDING_STOPPED_AUTH';
  if (code === 'OPENAI_BILLING_ERROR') return 'SPENDING_STOPPED_BILLING';
  return 'SPENDING_STOPPED';
}

export function recordProviderUsage(
  usage: ProviderUsageCapture | undefined,
  modelId: string,
  tokens: { prompt: number; completion: number; total: number; knownCallCount: number; unknownCallCount: number },
  costState: { observedUsdKnown: boolean; observedUsd: number },
): void {
  if (!usage) {
    costState.observedUsdKnown = false;
    tokens.unknownCallCount += 1;
    return;
  }

  if (!usage.usageKnown) {
    costState.observedUsdKnown = false;
    tokens.unknownCallCount += 1;
    return;
  }

  tokens.knownCallCount += 1;
  tokens.prompt += usage.promptTokens;
  tokens.completion += usage.completionTokens;
  tokens.total += usage.totalTokens;
  if (costState.observedUsdKnown) {
    costState.observedUsd += estimateCostFromTokens(
      modelId,
      usage.promptTokens,
      usage.completionTokens,
    );
  }
}

export async function runLiveSmokeCalibration(
  args: CalibrationCliArgs,
  deps: LiveSmokeCalibrationDeps,
): Promise<CalibrationRunResult> {
  const catalogue = loadCalibrationCatalogue();
  validateCalibrationDatasetCounts(catalogue);
  const fullGold = getCalibrationGoldExpectations();
  const scopeEntities = getSmokeScopedEntities();
  const gold = filterGoldByScope(fullGold, scopeEntities);
  validateSmokeManifestClosure(fullGold, catalogue);

  const modelId = deps.provider.modelId;
  const plan = buildLiveSmokeCallPlan(catalogue, modelId);
  const ledger = new CalibrationBudgetLedger(args.maxCalls!, args.maxCostUsd!, modelId);
  const cacheDir = deps.cacheDir ?? DEFAULT_CACHE_DIR;
  const accounting = new OperationAccounting(plan.operations);

  const services = new Map<string, ServiceSemanticProfileV2>();
  const products = new Map<string, ProductSemanticProfileV2>();
  const liveRankings = new Map<string, LiveServiceRanking>();
  const rerankDecisions = new Map<string, import('../../boundedRerank').RerankDecision>();
  const sanitizedFailures: Array<{ fixtureId: string; code: string }> = [];
  const missingProfileDiagnostics: MissingProfileDiagnostic[] = [];
  const invalidCacheDiagnostics: InvalidCacheDiagnostic[] = [];
  const errorCodeCounts: Record<string, number> = {};
  const rerankFallbackReasonCounts: Record<string, number> = {};
  let stopSpending = false;
  let stopReason: OperationSkipReason | undefined;

  const calls = {
    plannedMax: plan.totalMaxCalls,
    attempted: 0,
    successful: 0,
    failed: 0,
    cacheHits: 0,
    skipped: 0,
    rerankAttempted: 0,
    rerankApplied: 0,
    rerankFallback: 0,
  };

  const tokens = { prompt: 0, completion: 0, total: 0, knownCallCount: 0, unknownCallCount: 0 };
  const costState = { observedUsdKnown: true, observedUsd: 0 };

  const serviceById = new Map(catalogue.services.map((s) => [s.id, s]));
  const productById = new Map(catalogue.products.map((p) => [p.id, p]));

  function markRemainingSkipped(fromIndex: number, reason: OperationSkipReason): void {
    for (let i = fromIndex; i < plan.operations.length; i += 1) {
      const op = plan.operations[i]!;
      if (accounting.getState(op)) continue;
      accounting.setState(op, { status: 'skipped', reason });
      if (op.kind === 'classify_service' && !services.has(op.entityId)) {
        missingProfileDiagnostics.push({ entityId: op.entityId, entityType: 'SERVICE', errorCode: reason });
      }
      if (op.kind === 'classify_product' && !products.has(op.entityId)) {
        missingProfileDiagnostics.push({ entityId: op.entityId, entityType: 'PRODUCT', errorCode: reason });
      }
      calls.skipped += 1;
    }
  }

  async function classifyService(entityId: string, opIndex: number): Promise<void> {
    if (accounting.getState(plan.operations[opIndex]!)) return;
    if (services.has(entityId)) return;

    const raw = serviceById.get(entityId);
    if (!raw) {
      recordError(errorCodeCounts, 'CATALOGUE_SERVICE_MISSING');
      missingProfileDiagnostics.push({ entityId, entityType: 'SERVICE', errorCode: 'CATALOGUE_SERVICE_MISSING' });
      accounting.setState(plan.operations[opIndex]!, { status: 'skipped', reason: 'CATALOGUE_SERVICE_MISSING' });
      calls.skipped += 1;
      return;
    }

    const contentHash = computeServiceSemanticHash({
      name: raw.name,
      description: raw.description,
      category: raw.category,
    });
    const cacheKey = buildClassifyCacheKey(entityId, contentHash, modelId, 'classify_service');
    const cachedRaw = await readCalibrationCache(cacheDir, cacheKey);
    if (cachedRaw != null) {
      const validated = validateCachedServiceProfile(cachedRaw, cacheKey);
      if (validated.ok) {
        services.set(entityId, validated.profile);
        calls.cacheHits += 1;
        accounting.setState(plan.operations[opIndex]!, { status: 'cache_hit' });
        return;
      }
      invalidCacheDiagnostics.push({ entityId, operation: 'classify_service', reason: validated.reason });
    }

    if (stopSpending) {
      accounting.setState(plan.operations[opIndex]!, { status: 'skipped', reason: stopReason ?? 'SPENDING_STOPPED' });
      missingProfileDiagnostics.push({ entityId, entityType: 'SERVICE', errorCode: stopReason ?? 'SPENDING_STOPPED' });
      calls.skipped += 1;
      return;
    }

    const reservation = ledger.reserve('classify_service');
    if (!reservation) {
      stopSpending = true;
      stopReason = 'BUDGET_EXCEEDED';
      recordError(errorCodeCounts, 'BUDGET_EXCEEDED');
      markRemainingSkipped(opIndex, 'BUDGET_EXCEEDED');
      return;
    }

    calls.attempted += 1;
    const result = await deps.provider.classifyService(
      { id: raw.id, name: raw.name, description: raw.description, category: raw.category ?? '' },
      { fixtureId: entityId },
    );

    recordProviderUsage(result.usage, modelId, tokens, costState);

    if (!result.ok) {
      calls.failed += 1;
      recordError(errorCodeCounts, result.error);
      sanitizedFailures.push({ fixtureId: entityId, code: result.error });
      missingProfileDiagnostics.push({ entityId, entityType: 'SERVICE', errorCode: result.error });
      accounting.setState(plan.operations[opIndex]!, {
        status: 'provider_attempted',
        success: false,
        errorCode: result.error,
      });
      if (isStopSpendingError(result.error)) {
        stopSpending = true;
        stopReason = skipReasonForStop(result.error);
        markRemainingSkipped(opIndex + 1, stopReason);
      }
      return;
    }

    const envelope = buildServiceProfileEnvelope(
      { entityId: raw.id, shopId: CALIBRATION_SHOP_ID, name: raw.name, description: raw.description, category: raw.category },
      result.data,
      modelId,
    );
    services.set(entityId, envelope);
    calls.successful += 1;
    accounting.setState(plan.operations[opIndex]!, { status: 'provider_attempted', success: true });
    await writeCalibrationCache(cacheDir, cacheKey, envelope);
  }

  async function classifyProduct(entityId: string, opIndex: number): Promise<void> {
    if (accounting.getState(plan.operations[opIndex]!)) return;
    if (products.has(entityId)) return;

    const raw = productById.get(entityId);
    if (!raw) {
      recordError(errorCodeCounts, 'CATALOGUE_PRODUCT_MISSING');
      missingProfileDiagnostics.push({ entityId, entityType: 'PRODUCT', errorCode: 'CATALOGUE_PRODUCT_MISSING' });
      accounting.setState(plan.operations[opIndex]!, { status: 'skipped', reason: 'CATALOGUE_PRODUCT_MISSING' });
      calls.skipped += 1;
      return;
    }

    const contentHash = computeProductSemanticHash({
      name: raw.name,
      description: raw.description,
      category: raw.category,
    });
    const cacheKey = buildClassifyCacheKey(entityId, contentHash, modelId, 'classify_product');
    const cachedRaw = await readCalibrationCache(cacheDir, cacheKey);
    if (cachedRaw != null) {
      const validated = validateCachedProductProfile(cachedRaw, cacheKey);
      if (validated.ok) {
        products.set(entityId, validated.profile);
        calls.cacheHits += 1;
        accounting.setState(plan.operations[opIndex]!, { status: 'cache_hit' });
        return;
      }
      invalidCacheDiagnostics.push({ entityId, operation: 'classify_product', reason: validated.reason });
    }

    if (stopSpending) {
      accounting.setState(plan.operations[opIndex]!, { status: 'skipped', reason: stopReason ?? 'SPENDING_STOPPED' });
      missingProfileDiagnostics.push({ entityId, entityType: 'PRODUCT', errorCode: stopReason ?? 'SPENDING_STOPPED' });
      calls.skipped += 1;
      return;
    }

    const reservation = ledger.reserve('classify_product');
    if (!reservation) {
      stopSpending = true;
      stopReason = 'BUDGET_EXCEEDED';
      recordError(errorCodeCounts, 'BUDGET_EXCEEDED');
      markRemainingSkipped(opIndex, 'BUDGET_EXCEEDED');
      return;
    }

    calls.attempted += 1;
    const result = await deps.provider.classifyProduct(
      { id: raw.id, name: raw.name, description: raw.description, category: raw.category },
      { fixtureId: entityId },
    );

    recordProviderUsage(result.usage, modelId, tokens, costState);

    if (!result.ok) {
      calls.failed += 1;
      recordError(errorCodeCounts, result.error);
      sanitizedFailures.push({ fixtureId: entityId, code: result.error });
      missingProfileDiagnostics.push({ entityId, entityType: 'PRODUCT', errorCode: result.error });
      accounting.setState(plan.operations[opIndex]!, {
        status: 'provider_attempted',
        success: false,
        errorCode: result.error,
      });
      if (isStopSpendingError(result.error)) {
        stopSpending = true;
        stopReason = skipReasonForStop(result.error);
        markRemainingSkipped(opIndex + 1, stopReason);
      }
      return;
    }

    const envelope = buildProductProfileEnvelope(
      { entityId: raw.id, shopId: CALIBRATION_SHOP_ID, name: raw.name, description: raw.description, category: raw.category },
      result.data,
      modelId,
    );
    products.set(entityId, envelope);
    calls.successful += 1;
    accounting.setState(plan.operations[opIndex]!, { status: 'provider_attempted', success: true });
    await writeCalibrationCache(cacheDir, cacheKey, envelope);
  }

  async function executeRerank(serviceId: string, opIndex: number): Promise<void> {
    if (accounting.getState(plan.operations[opIndex]!)) return;

    const serviceProfile = services.get(serviceId);
    if (!serviceProfile) {
      calls.skipped += 1;
      recordError(errorCodeCounts, 'RERANK_SERVICE_PROFILE_MISSING');
      rerankFallbackReasonCounts.RERANK_SERVICE_PROFILE_MISSING =
        (rerankFallbackReasonCounts.RERANK_SERVICE_PROFILE_MISSING ?? 0) + 1;
      accounting.setState(plan.operations[opIndex]!, {
        status: 'skipped',
        reason: 'RERANK_SERVICE_PROFILE_MISSING',
      });
      return;
    }

    const productEntries = [...products.entries()].map(([id, profile]) => ({ id, profile }));
    const eligible = productEntries.length > 0
      ? buildLiveServiceRanking(serviceProfile, productEntries).eligible
      : [];

    if (eligible.length < 2) {
      calls.skipped += 1;
      recordError(errorCodeCounts, 'RERANK_POOL_INSUFFICIENT');
      rerankFallbackReasonCounts.RERANK_POOL_INSUFFICIENT =
        (rerankFallbackReasonCounts.RERANK_POOL_INSUFFICIENT ?? 0) + 1;
      const ranking = buildLiveServiceRanking(serviceProfile, productEntries);
      liveRankings.set(serviceId, ranking);
      accounting.setState(plan.operations[opIndex]!, { status: 'skipped', reason: 'RERANK_POOL_INSUFFICIENT' });
      return;
    }

    const rerankPool = createRerankPool(eligible);
    const rerankPoolIds = rerankPool.map((c) => c.productId);
    const candidateSummaries = buildRerankCandidateSummaries(
      rerankPool,
      products,
      buildCandidateRerankSummary,
    );
    const contentHash = computeRerankContentHash({ serviceProfile, rerankPoolIds, candidateSummaries });
    const cacheKey = buildRerankCacheKey(serviceId, contentHash, modelId);
    const cachedRaw = await readCalibrationCache(cacheDir, cacheKey);

    let rerankDecision: import('../../boundedRerank').RerankDecision | undefined;

    if (cachedRaw != null) {
      const validated = validateCachedRerankDecision(cachedRaw, rerankPoolIds);
      if (validated.ok) {
        rerankDecision = validated.decision;
        calls.cacheHits += 1;
        accounting.setState(plan.operations[opIndex]!, { status: 'cache_hit' });
      } else {
        invalidCacheDiagnostics.push({ entityId: serviceId, operation: 'rerank', reason: validated.reason });
      }
    }

    if (!rerankDecision) {
      if (stopSpending) {
        calls.skipped += 1;
        accounting.setState(plan.operations[opIndex]!, { status: 'skipped', reason: stopReason ?? 'SPENDING_STOPPED' });
        return;
      }

      const reservation = ledger.reserve('rerank');
      if (!reservation) {
        stopSpending = true;
        stopReason = 'BUDGET_EXCEEDED';
        recordError(errorCodeCounts, 'BUDGET_EXCEEDED');
        accounting.setState(plan.operations[opIndex]!, { status: 'skipped', reason: 'BUDGET_EXCEEDED' });
        calls.skipped += 1;
        markRemainingSkipped(opIndex + 1, 'BUDGET_EXCEEDED');
        return;
      }

      calls.attempted += 1;
      calls.rerankAttempted += 1;
      const serviceSummary = buildServiceRerankSummary(serviceProfile);
      const result = await deps.provider.rerank(
        serviceId,
        serviceSummary,
        candidateSummaries,
        { fixtureId: serviceId },
      );

      recordProviderUsage(result.usage, modelId, tokens, costState);

      if (!result.ok) {
        calls.failed += 1;
        calls.rerankFallback += 1;
        recordError(errorCodeCounts, result.error);
        sanitizedFailures.push({ fixtureId: serviceId, code: result.error });
        rerankFallbackReasonCounts[result.error] = (rerankFallbackReasonCounts[result.error] ?? 0) + 1;
        accounting.setState(plan.operations[opIndex]!, {
          status: 'provider_attempted',
          success: false,
          errorCode: result.error,
        });
        const ranking = buildLiveServiceRanking(serviceProfile, productEntries);
        liveRankings.set(serviceId, ranking);
        if (isStopSpendingError(result.error)) {
          stopSpending = true;
          stopReason = skipReasonForStop(result.error);
          markRemainingSkipped(opIndex + 1, stopReason);
        }
        return;
      }

      calls.successful += 1;
      rerankDecision = result.data;
      accounting.setState(plan.operations[opIndex]!, { status: 'provider_attempted', success: true });
      await writeCalibrationCache(cacheDir, cacheKey, result.data);
    }

    rerankDecisions.set(serviceId, rerankDecision!);
    const ranking = buildLiveServiceRanking(serviceProfile, productEntries, rerankDecision);
    liveRankings.set(serviceId, ranking);
    if (ranking.rerankApplied) calls.rerankApplied += 1;
    else {
      calls.rerankFallback += 1;
      if (ranking.rerankFallbackReason) {
        recordError(errorCodeCounts, ranking.rerankFallbackReason);
        rerankFallbackReasonCounts[ranking.rerankFallbackReason] =
          (rerankFallbackReasonCounts[ranking.rerankFallbackReason] ?? 0) + 1;
      }
    }
  }

  for (let i = 0; i < plan.operations.length; i += 1) {
    const operation = plan.operations[i]!;
    if (operation.kind === 'classify_service') {
      await classifyService(operation.entityId, i);
    } else if (operation.kind === 'classify_product') {
      await classifyProduct(operation.entityId, i);
    } else {
      await executeRerank(operation.serviceId, i);
    }
  }

  const productEntries = [...products.entries()].map(([id, profile]) => ({ id, profile }));

  for (const scenario of gold.recommendations) {
    if (!liveRankings.has(scenario.serviceId)) {
      const service = services.get(scenario.serviceId);
      if (service) {
        liveRankings.set(scenario.serviceId, buildLiveServiceRanking(service, productEntries));
      }
    }
  }

  const rankingResolver = createLiveRankingResolver(liveRankings);
  const rankingFactory = createLiveRankingFactory(services, productEntries, rerankDecisions);

  const smokeClassificationExpectations = gold.classification.filter((e) =>
    scopeEntities.classificationEntityIds.has(e.entityId),
  );

  const allProfiles = new Map<string, ServiceSemanticProfileV2 | ProductSemanticProfileV2>();
  for (const [id, profile] of services) allProfiles.set(id, profile);
  for (const [id, profile] of products) allProfiles.set(id, profile);

  const classificationMetrics = computeClassificationMetrics(allProfiles, smokeClassificationExpectations);

  const requiredClassificationsComplete =
    smokeClassificationExpectations.every((e) => allProfiles.has(e.entityId)) &&
    missingProfileDiagnostics.length === 0;

  const rerankStats = {
    attempted: calls.rerankAttempted,
    fallback: calls.rerankFallback,
    fallbackReasons: rerankFallbackReasonCounts,
  };

  const recommendationMetrics = computeRecommendationMetrics(
    gold.recommendations,
    services,
    productEntries,
    products,
    rerankStats,
    { rankingResolver, rankingFactory, liveEvaluation: requiredClassificationsComplete },
  );

  const operationAccountingReconciliation = accounting.reconcile({
    plannedMax: calls.plannedMax,
    attempted: calls.attempted,
    successful: calls.successful,
    failed: calls.failed,
    cacheHits: calls.cacheHits,
    skipped: calls.skipped,
    rerankAttempted: calls.rerankAttempted,
  });

  const liveEvaluationStatus = requiredClassificationsComplete
    ? evaluateLiveReleaseGateStatus(classificationMetrics, recommendationMetrics) === 'PASSED'
      ? 'PASSED'
      : 'FAILED'
    : 'FAILED';

  const releaseGates = evaluateReleaseGates(classificationMetrics, recommendationMetrics, {
    liveEvaluation: requiredClassificationsComplete,
  });
  const releaseGateStatus = requiredClassificationsComplete
    ? evaluateLiveReleaseGateStatus(classificationMetrics, recommendationMetrics)
    : 'FAILED';

  let finalOutcome: CalibrationReport['finalOutcome'] = 'INCOMPLETE';
  if (!requiredClassificationsComplete || stopSpending) {
    finalOutcome = 'INCOMPLETE';
  } else if (!operationAccountingReconciliation.ok) {
    recordError(errorCodeCounts, 'OPERATION_ACCOUNTING_MISMATCH');
    finalOutcome = 'INCOMPLETE';
  } else if (releaseGateStatus === 'PASSED') {
    finalOutcome = 'PASS';
  } else {
    finalOutcome = 'FAIL';
  }

  const fullStubs = buildCalibrationStubProfiles();
  const stubs = filterStubProfilesByScope(fullStubs, scopeEntities);
  const stubProducts = calibrationProductEntriesForScope(fullStubs, scopeEntities);
  const harness = runHarnessSelfCheck(gold, stubs, stubProducts);

  const scenarioDiagnostics = buildScenarioDiagnostics(
    gold.recommendations,
    services,
    productEntries,
    products,
    catalogue,
    rankingResolver,
  );

  const ledgerSnapshot = ledger.snapshot();
  const runId = randomUUID();
  const timestampUtc = new Date().toISOString();

  const observedUsdKnown = calls.attempted === 0 ? true : costState.observedUsdKnown;
  const observedUsd = observedUsdKnown ? (calls.attempted === 0 ? 0 : costState.observedUsd) : null;

  const operationBreakdown = accounting.getBreakdown().map((entry) => ({
    kind: entry.operation.kind,
    entityId: entry.operation.kind !== 'rerank' ? entry.operation.entityId : undefined,
    serviceId: entry.operation.kind === 'rerank' ? entry.operation.serviceId : undefined,
    status: entry.state.status,
    reason: entry.state.status === 'skipped' ? entry.state.reason : undefined,
    errorCode: entry.state.status === 'provider_attempted' && !entry.state.success ? entry.state.errorCode : undefined,
  }));

  const report: CalibrationReport = {
    runId,
    timestampUtc,
    mode: 'live',
    scope: 'smoke',
    modelId,
    taxonomyVersion: TAXONOMY_VERSION,
    schemaVersion: SCHEMA_VERSION,
    promptVersion: PROMPT_VERSION,
    datasetVersion: getCalibrationDatasetVersion(),
    harnessSelfCheckStatus: harness.status,
    liveEvaluationStatus,
    releaseGateStatus,
    datasetCounts: {
      services: scopeEntities.serviceIds.size,
      products: scopeEntities.productIds.size,
      scenarios: gold.recommendations.length,
    },
    calls,
    tokens,
    cost: {
      estimatedMaxUsd: plan.estimatedMaxCostUsd,
      reservedMaxUsd: ledgerSnapshot.reservedUsd,
      observedUsd,
      observedUsdKnown,
    },
    harnessFixtureChecks: harness.fixtureChecks,
    harnessFixtureMetrics: harness.fixtureMetrics,
    classificationMetrics,
    recommendationMetrics,
    releaseGates,
    scenarioDiagnostics,
    releaseGatePassed: releaseGateStatus === 'PASSED',
    sanitizedFailures,
    rejectionReasonCounts: harness.rejectionReasonCounts,
    rerankFallbackReasonCounts,
    gitSha: tryResolveGitSha(),
    finalOutcome,
    missingProfileDiagnostics,
    errorCodeCounts,
    skipReasonCounts: accounting.getSkipReasonCounts(),
    invalidCacheDiagnostics,
    operationBreakdown,
    operationAccountingReconciliation,
  };

  await writeCalibrationReport(args.outputDir, report);

  const precisionPct = (recommendationMetrics.precisionAt4 != null
    ? recommendationMetrics.precisionAt4 * 100
    : 0
  ).toFixed(1);

  return {
    exitCode: finalOutcome === 'PASS' ? 0 : 1,
    report,
    planSummary: [
      'Live smoke calibration (fictional dataset):',
      `  services: ${plan.serviceClassifications}`,
      `  products: ${plan.productClassifications}`,
      `  rerank: ${plan.rerankAttempts}`,
      `  planned max calls: ${plan.totalMaxCalls}`,
      `  attempted calls: ${calls.attempted}`,
      `  cache hits: ${calls.cacheHits}`,
      `  skipped: ${calls.skipped}`,
      `  estimated max cost: $${plan.estimatedMaxCostUsd.toFixed(4)}`,
      `  reserved max cost: $${ledgerSnapshot.reservedUsd.toFixed(4)}`,
      `  observed cost: ${report.cost.observedUsdKnown ? `$${report.cost.observedUsd?.toFixed(4)}` : 'unknown'}`,
      `  live evaluation: ${liveEvaluationStatus}`,
      `  release gates: ${releaseGateStatus}`,
      `  final outcome: ${finalOutcome}`,
      `  live precision@4: ${precisionPct}%`,
      `  harness self-check: ${harness.status}`,
    ].join('\n'),
  };
}

export function getDefaultLiveCacheDir(): string {
  return join(process.cwd(), DEFAULT_CACHE_DIR);
}
