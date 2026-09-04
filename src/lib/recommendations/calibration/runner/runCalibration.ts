import { randomUUID } from 'node:crypto';

import { PROMPT_VERSION, SCHEMA_VERSION, TAXONOMY_VERSION } from '../../constants';
import type { CalibrationCliArgs, CalibrationReport } from '../types';
import { buildDryRunPlan } from '../dryRunPlan';
import {
  getCalibrationDatasetVersion,
  loadCalibrationCatalogue,
  validateCalibrationDatasetCounts,
} from '../dataset/loaders';
import {
  buildCalibrationStubProfiles,
  calibrationProductEntries,
  calibrationProductEntriesForScope,
  filterStubProfilesByScope,
} from '../dataset/stubProfiles';
import { getCalibrationGoldExpectations } from '../expectations/gold';
import { validateLiveActivation } from '../liveGuards';
import { buildScenarioDiagnostics } from '../metrics/scenarioDiagnostics';
import { evaluateReleaseGates } from '../metrics/releaseGates';
import { CALIBRATION_MODEL_ALLOWLIST } from '../pricing/modelPricing';
import { writeCalibrationReport } from '../reporting/reportBuilder';
import { filterGoldByScope, resolveScopedEntities } from '../scope/resolveScope';
import { validateSmokeManifestClosure } from '../scope/smokeManifest';
import {
  buildNullLiveClassificationMetrics,
  buildNullLiveRecommendationMetrics,
  runHarnessSelfCheck,
} from './harnessSelfCheck';
import { runLiveSmokeCalibration, type LiveSmokeCalibrationDeps } from './runLiveSmokeCalibration';

export type CalibrationRunResult = {
  exitCode: number;
  report: CalibrationReport;
  planSummary?: string;
};

export type CalibrationRunOptions = {
  liveDeps?: LiveSmokeCalibrationDeps;
};

const DEFAULT_DRY_RUN_MODEL = CALIBRATION_MODEL_ALLOWLIST[0];

export async function runCalibration(
  args: CalibrationCliArgs,
  options?: CalibrationRunOptions,
): Promise<CalibrationRunResult> {
  if (args.mode === 'live') {
    const activation = validateLiveActivation(args);
    if (!activation.ok) {
      throw new Error(`${activation.code}: ${activation.message}`);
    }
    if (args.cachePolicy === 'readonly') {
      return runLiveSmokeCalibration(args, { ...options?.liveDeps, provider: undefined });
    }
    if (!options?.liveDeps?.provider) {
      throw new Error('LIVE_PROVIDER_MISSING');
    }
    return runLiveSmokeCalibration(args, options.liveDeps);
  }

  const catalogue = loadCalibrationCatalogue();
  validateCalibrationDatasetCounts(catalogue);
  const fullGold = getCalibrationGoldExpectations();
  const scopeEntities = resolveScopedEntities(args.scope, fullGold);
  const gold = filterGoldByScope(fullGold, scopeEntities);

  if (args.scope === 'smoke') {
    validateSmokeManifestClosure(fullGold, catalogue);
  }

  const datasetVersion = getCalibrationDatasetVersion();
  const modelId = args.model ?? DEFAULT_DRY_RUN_MODEL;
  const runId = randomUUID();
  const timestampUtc = new Date().toISOString();

  const dryRun = buildDryRunPlan(catalogue, modelId, args.maxCostUsd, args.scope);
  const fullStubs = buildCalibrationStubProfiles();
  const stubs =
    args.scope === 'smoke' ? filterStubProfilesByScope(fullStubs, scopeEntities) : fullStubs;
  const productEntries =
    args.scope === 'smoke'
      ? calibrationProductEntriesForScope(fullStubs, scopeEntities)
      : calibrationProductEntries(fullStubs);

  const harness = runHarnessSelfCheck(gold, stubs, productEntries);
  const scenarioDiagnostics = buildScenarioDiagnostics(
    gold.recommendations,
    stubs.services,
    productEntries,
    stubs.products,
    catalogue,
  );

  const classificationMetrics = buildNullLiveClassificationMetrics(0);
  const recommendationMetrics = buildNullLiveRecommendationMetrics();
  const releaseGates = evaluateReleaseGates(classificationMetrics, recommendationMetrics, {
    liveEvaluation: false,
  });

  const report: CalibrationReport = {
    runId,
    timestampUtc,
    mode: args.mode,
    scope: args.scope,
    modelId,
    taxonomyVersion: TAXONOMY_VERSION,
    schemaVersion: SCHEMA_VERSION,
    promptVersion: PROMPT_VERSION,
    datasetVersion,
    cachePolicy: args.cachePolicy ?? 'reuse',
    providerRunKind: 'CACHE_ONLY_REPLAY',
    providerConnectivityVerified: false,
    harnessSelfCheckStatus: harness.status,
    liveEvaluationStatus: 'NOT_RUN',
    releaseGateStatus: 'NOT_RUN',
    datasetCounts: {
      services: args.scope === 'smoke' ? scopeEntities.serviceIds.size : catalogue.services.length,
      products: args.scope === 'smoke' ? scopeEntities.productIds.size : catalogue.products.length,
      scenarios: gold.recommendations.length,
    },
    calls: {
      plannedMax: dryRun.plan.totalMaxCalls,
      attempted: 0,
      successful: 0,
      failed: 0,
      cacheHits: 0,
      skipped: 0,
      rerankAttempted: 0,
      rerankApplied: 0,
      rerankFallback: 0,
    },
    tokens: { prompt: 0, completion: 0, total: 0, knownCallCount: 0, unknownCallCount: 0 },
    cost: {
      estimatedMaxUsd: dryRun.plan.estimatedMaxCostUsd,
      reservedMaxUsd: 0,
      observedUsd: 0,
      observedUsdKnown: true,
    },
    harnessFixtureChecks: harness.fixtureChecks,
    harnessFixtureMetrics: harness.fixtureMetrics,
    classificationMetrics,
    recommendationMetrics,
    releaseGates,
    scenarioDiagnostics,
    releaseGatePassed: false,
    sanitizedFailures: [
      ...harness.fixtureChecks.failedClassificationEntityIds.map((fixtureId) => ({
        fixtureId,
        code: 'HARNESS_CLASSIFICATION_FIXTURE_FAILED',
      })),
      ...harness.fixtureChecks.failedScenarioIds.map((fixtureId) => ({
        fixtureId,
        code: 'HARNESS_RECOMMENDATION_FIXTURE_FAILED',
      })),
      ...harness.fixtureChecks.failedPairAssertionKeys.map((fixtureId) => ({
        fixtureId,
        code: 'HARNESS_PAIR_ASSERTION_FAILED',
      })),
      ...harness.fixtureChecks.fixtureThresholdFailures.map((reason) => ({
        fixtureId: 'harness-fixture-threshold',
        code: reason,
      })),
    ],
    rejectionReasonCounts: harness.rejectionReasonCounts,
    rerankFallbackReasonCounts: {},
    finalOutcome: harness.status === 'PASSED' ? 'PASS' : 'FAIL',
  };

  await writeCalibrationReport(args.outputDir, report);

  const precisionPct = (harness.fixtureMetrics.precisionAt4 * 100).toFixed(1);

  return {
    exitCode: harness.status === 'PASSED' ? 0 : 1,
    report,
    planSummary: [
      `Dry-run harness self-check (scope: ${args.scope}, no OpenAI calls):`,
      `  services: ${dryRun.plan.serviceClassifications}`,
      `  products: ${dryRun.plan.productClassifications}`,
      `  rerank: ${dryRun.plan.rerankAttempts}`,
      `  total planned calls: ${dryRun.plan.totalMaxCalls}`,
      `  estimated max cost: $${dryRun.plan.estimatedMaxCostUsd.toFixed(4)}`,
      `  harness self-check: ${harness.status}`,
      `  fixture precision@4: ${precisionPct}%`,
      `  live evaluation: NOT_RUN`,
      `  release gates: NOT_RUN`,
      ...(harness.fixtureChecks.fixtureThresholdFailures.length > 0
        ? [`  threshold failures: ${harness.fixtureChecks.fixtureThresholdFailures.join('; ')}`]
        : []),
    ].join('\n'),
  };
}
