import { describe, expect, it, vi } from 'vitest';

import type { CalibrationReport } from '../types';
import {
  CALIBRATION_MODEL_SNAPSHOT,
  LIVE_CONFIRM_PHRASE,
  LIVE_MAX_CALLS_CAP,
  LIVE_MAX_COST_USD_CAP,
} from '../liveGuards';
import { runCalibration } from '../runner/runCalibration';
import {
  runCalibrationCli,
  type CalibrationCliDeps,
} from './runCalibrationCli';

function minimalCalibrationReport(): CalibrationReport {
  return {
    runId: 'test-run',
    timestampUtc: '2026-09-03T00:00:00.000Z',
    mode: 'dry-run',
    scope: 'smoke',
    modelId: CALIBRATION_MODEL_SNAPSHOT,
    taxonomyVersion: '1',
    schemaVersion: '2',
    promptVersion: '1',
    datasetVersion: '1',
    cachePolicy: 'reuse',
    providerRunKind: 'CACHE_ONLY_REPLAY',
    providerConnectivityVerified: false,
    harnessSelfCheckStatus: 'PASSED',
    liveEvaluationStatus: 'NOT_RUN',
    releaseGateStatus: 'NOT_RUN',
    datasetCounts: { services: 1, products: 1, scenarios: 1 },
    calls: {
      plannedMax: 0,
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
    cost: { estimatedMaxUsd: 0, reservedMaxUsd: 0, observedUsd: 0, observedUsdKnown: true },
    harnessFixtureChecks: {
      classificationExpectationsPassed: 1,
      classificationExpectationsTotal: 1,
      recommendationScenariosPassed: 1,
      recommendationScenariosTotal: 1,
      pairAssertionsPassed: 1,
      pairAssertionsTotal: 1,
      deterministicRepeatabilityRate: 1,
      failedClassificationEntityIds: [],
      failedScenarioIds: [],
      failedPairAssertionKeys: [],
      fixtureThresholdFailures: [],
    },
    harnessFixtureMetrics: {
      precisionAt4: 1,
      mustIncludeRecall: 1,
      mustExcludePassRate: 1,
      criticalUnsafeFalsePositiveCount: 0,
      comboDomainCoverageRate: 1,
      familyCapViolations: 0,
      pairAssertionPassRate: 1,
      deterministicRepeatability: 1,
    },
    classificationMetrics: {
      structuredParseSuccessRate: null,
      requiredFieldAccuracy: null,
      forbiddenFieldViolationRate: null,
      confidenceGateCorrectness: null,
      ambiguousFailClosedRate: null,
      evaluatedEntityCount: 0,
      failedEntityIds: [],
      providerAttemptedCount: 0,
      providerSuccessfulCount: 0,
      semanticConsistencyFailureCount: 0,
      semanticConsistencyFailedEntityIds: [],
      missingRequiredProfileCount: 0,
      endToEndClassificationSuccessRate: null,
    },
    recommendationMetrics: {
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
    },
    releaseGates: [],
    scenarioDiagnostics: [],
    releaseGatePassed: false,
    sanitizedFailures: [],
    rejectionReasonCounts: {},
    rerankFallbackReasonCounts: {},
  };
}

function liveArgv(overrides: string[] = []): string[] {
  return [
    '--live',
    '--scope',
    'smoke',
    '--confirm-spend',
    LIVE_CONFIRM_PHRASE,
    '--model',
    CALIBRATION_MODEL_SNAPSHOT,
    '--max-calls',
    String(LIVE_MAX_CALLS_CAP),
    '--max-cost-usd',
    String(LIVE_MAX_COST_USD_CAP),
    '--output-dir',
    'calibration-output/live-smoke',
    ...overrides,
  ];
}

function makeDeps(): CalibrationCliDeps & {
  callOrder: string[];
  runCalibration: ReturnType<typeof vi.fn<typeof runCalibration>>;
} {
  const callOrder: string[] = [];
  const runCalibrationMock = vi.fn<typeof runCalibration>(async () => {
    callOrder.push('runCalibration');
    return { exitCode: 0, planSummary: 'ok', report: minimalCalibrationReport() };
  });

  return {
    callOrder,
    loadEnv: vi.fn(() => {
      callOrder.push('loadEnv');
      return { apiKey: 'test-key' };
    }),
    createClient: vi.fn(() => {
      callOrder.push('createClient');
      return {} as never;
    }),
    createProvider: vi.fn(() => {
      callOrder.push('createProvider');
      return { modelId: CALIBRATION_MODEL_SNAPSHOT } as never;
    }),
    runCalibration: runCalibrationMock,
    exit: (code) => {
      throw new Error(`exit unexpectedly called with ${code}`);
    },
    log: vi.fn(),
    logError: vi.fn(),
  };
}

describe('runCalibrationCli live guard order', () => {
  const guardCases: Array<{ name: string; argv: string[] }> = [
    { name: 'bad confirm', argv: liveArgv(['--confirm-spend', 'WRONG']) },
    { name: 'full scope', argv: liveArgv().map((a, i, arr) => (arr[i - 1] === '--scope' ? 'full' : a)) },
    { name: 'wrong model', argv: liveArgv().map((a, i, arr) => (arr[i - 1] === '--model' ? 'gpt-4o' : a)) },
    { name: 'model alias', argv: liveArgv().map((a, i, arr) => (arr[i - 1] === '--model' ? 'gpt-4o-mini' : a)) },
    { name: 'missing output dir', argv: liveArgv().filter((a, i, arr) => !(a === '--output-dir' || arr[i - 1] === '--output-dir')) },
    { name: 'duplicate flag', argv: [...liveArgv(), '--live'] },
    { name: 'unknown flag', argv: [...liveArgv(), '--unknown-flag'] },
    { name: 'invalid max calls', argv: liveArgv().map((a, i, arr) => (arr[i - 1] === '--max-calls' ? 'abc' : a)) },
    { name: 'max calls above 20', argv: liveArgv().map((a, i, arr) => (arr[i - 1] === '--max-calls' ? '21' : a)) },
    { name: 'invalid cost', argv: liveArgv().map((a, i, arr) => (arr[i - 1] === '--max-cost-usd' ? 'abc' : a)) },
    { name: 'cost above cap', argv: liveArgv().map((a, i, arr) => (arr[i - 1] === '--max-cost-usd' ? '0.06' : a)) },
    { name: 'call cap below plan', argv: liveArgv().map((a, i, arr) => (arr[i - 1] === '--max-calls' ? '1' : a)) },
    { name: 'cost cap below preflight', argv: liveArgv().map((a, i, arr) => (arr[i - 1] === '--max-cost-usd' ? '0.0001' : a)) },
  ];

  for (const { name, argv } of guardCases) {
    it(`blocks ${name} before env/client/provider`, async () => {
      const deps = makeDeps();
      const code = await runCalibrationCli(argv, deps);
      expect(code).toBe(1);
      expect(deps.loadEnv).not.toHaveBeenCalled();
      expect(deps.createClient).not.toHaveBeenCalled();
      expect(deps.createProvider).not.toHaveBeenCalled();
      expect(deps.runCalibration).not.toHaveBeenCalled();
    });
  }

  it('missing --live runs dry path without env/client/provider', async () => {
    const deps = makeDeps();
    const code = await runCalibrationCli(liveArgv().filter((a) => a !== '--live'), deps);
    expect(code).toBe(0);
    expect(deps.loadEnv).not.toHaveBeenCalled();
    expect(deps.createClient).not.toHaveBeenCalled();
    expect(deps.createProvider).not.toHaveBeenCalled();
    expect(deps.runCalibration).toHaveBeenCalled();
  });

  it('invokes guards then env, client, provider, runner in order', async () => {
    const deps = makeDeps();
    const code = await runCalibrationCli(liveArgv(), deps);
    expect(code).toBe(0);
    expect(deps.callOrder).toEqual(['loadEnv', 'createClient', 'createProvider', 'runCalibration']);
    expect(deps.runCalibration).toHaveBeenCalledWith(
      expect.objectContaining({ cachePolicy: 'reuse' }),
      expect.objectContaining({
        liveDeps: expect.objectContaining({ cacheProducerKind: 'OPENAI_LIVE' }),
      }),
    );
  });

  it('readonly live skips env/client/provider and does not need API key', async () => {
    const deps = makeDeps();
    const code = await runCalibrationCli([...liveArgv(), '--cache-policy=readonly'], deps);
    expect(code).toBe(0);
    expect(deps.loadEnv).not.toHaveBeenCalled();
    expect(deps.createClient).not.toHaveBeenCalled();
    expect(deps.createProvider).not.toHaveBeenCalled();
    expect(deps.runCalibration).toHaveBeenCalledWith(
      expect.objectContaining({ cachePolicy: 'readonly' }),
      expect.anything(),
    );
  });

  it('rejects invalid cache policy before env/client/provider', async () => {
    const deps = makeDeps();
    const code = await runCalibrationCli([...liveArgv(), '--cache-policy=bogus'], deps);
    expect(code).toBe(1);
    expect(deps.loadEnv).not.toHaveBeenCalled();
    expect(deps.createClient).not.toHaveBeenCalled();
    expect(deps.createProvider).not.toHaveBeenCalled();
    expect(deps.runCalibration).not.toHaveBeenCalled();
  });

  it('dry-run does not load env', async () => {
    const deps = makeDeps();
    const code = await runCalibrationCli(
      ['--scope', 'smoke', '--output-dir', 'calibration-output/smoke'],
      deps,
    );
    expect(code).toBe(0);
    expect(deps.loadEnv).not.toHaveBeenCalled();
    expect(deps.createProvider).not.toHaveBeenCalled();
    expect(deps.runCalibration).toHaveBeenCalled();
  });
});
