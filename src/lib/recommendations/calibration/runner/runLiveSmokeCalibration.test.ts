import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PROMPT_VERSION, SCHEMA_VERSION, TAXONOMY_VERSION } from '../../constants';
import { computeServiceSemanticHash } from '../../hash';
import { buildServiceProfileEnvelope } from '../../ai/prompts';
import { mapServiceTransportToProfile } from '../../ai/schemas';
import { writeCalibrationCache, type CalibrationCacheKey } from '../cache/calibrationCache';
import { loadCalibrationCatalogue } from '../dataset/loaders';
import {
  CALIBRATION_MODEL_SNAPSHOT,
  LIVE_CONFIRM_PHRASE,
  LIVE_MAX_CALLS_CAP,
  LIVE_MAX_COST_USD_CAP,
} from '../liveGuards';
import { buildStubMockResponses, mockUsageKnown } from '../provider/buildStubMockResponses';
import {
  createMockCalibrationProvider,
  mockUsage,
} from '../provider/mockCalibrationProvider';
import { buildCalibrationStubProfiles } from '../dataset/stubProfiles';
import { createRerankPool } from '../../rerankPool';
import { scoreEligibleCandidatesForService } from '../../scorer';
import { CALIBRATION_SMOKE_EXECUTION_MANIFEST } from '../scope/smokeManifest';
import { buildLiveSmokeCallPlan } from './buildLiveCallPlan';
import { recordProviderUsage, runLiveSmokeCalibration } from './runLiveSmokeCalibration';

const CALIBRATION_SHOP_ID = 'calibration-shop';

const FULL_FIELD_CONFIDENCE = {
  targetAreas: 0.9,
  typicalHairLength: 0.8,
  techniques: 0.85,
  outcomes: 0.7,
  aftercareNeeds: 0.6,
  incompatibilities: 0.5,
  retailNeeds: 0.85,
};

function liveArgs(outputDir: string, cachePolicy: 'reuse' | 'refresh' | 'readonly' = 'reuse') {
  return {
    mode: 'live' as const,
    scope: 'smoke' as const,
    model: CALIBRATION_MODEL_SNAPSHOT,
    confirmSpend: LIVE_CONFIRM_PHRASE,
    maxCalls: LIVE_MAX_CALLS_CAP,
    maxCostUsd: LIVE_MAX_COST_USD_CAP,
    outputDir,
    outputDirExplicit: true,
    cachePolicy,
  };
}

function stubSuccessProvider() {
  const stubs = buildStubMockResponses();
  return createMockCalibrationProvider({
    modelId: CALIBRATION_MODEL_SNAPSHOT,
    serviceResponses: stubs.serviceResponses,
    productResponses: stubs.productResponses,
  });
}

describe('recordProviderUsage', () => {
  it('marks observed cost unknown when usage is absent', () => {
    const tokens = { prompt: 0, completion: 0, total: 0, knownCallCount: 0, unknownCallCount: 0 };
    const costState = { observedUsdKnown: true, observedUsd: 0 };
    recordProviderUsage(undefined, CALIBRATION_MODEL_SNAPSHOT, tokens, costState);
    expect(costState.observedUsdKnown).toBe(false);
    expect(tokens.unknownCallCount).toBe(1);
  });

  it('aggregates known usage into observed cost', () => {
    const tokens = { prompt: 0, completion: 0, total: 0, knownCallCount: 0, unknownCallCount: 0 };
    const costState = { observedUsdKnown: true, observedUsd: 0 };
    recordProviderUsage(
      mockUsageKnown({ operation: 'classify_service', promptTokens: 1000, completionTokens: 100 }),
      CALIBRATION_MODEL_SNAPSHOT,
      tokens,
      costState,
    );
    expect(costState.observedUsdKnown).toBe(true);
    expect(costState.observedUsd).toBeGreaterThan(0);
    expect(tokens.knownCallCount).toBe(1);
  });
});

describe('runLiveSmokeCalibration', () => {
  it('completes all-success live smoke run with PASS and release gates', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'live-cal-'));
    const cacheDir = await mkdtemp(join(tmpdir(), 'live-cache-'));
    const provider = stubSuccessProvider();
    try {
      const result = await runLiveSmokeCalibration(liveArgs(outputDir), { provider, cacheDir });
      expect(result.report.finalOutcome).toBe('PASS');
      expect(result.report.liveEvaluationStatus).toBe('PASSED');
      expect(result.report.releaseGateStatus).toBe('PASSED');
      expect(result.report.recommendationMetrics.deterministicRepeatability).toBe(1);
      expect(result.report.operationAccountingReconciliation?.ok).toBe(true);
      expect(result.report.releaseGates.every((g) => g.passed || g.skipped)).toBe(true);
      expect(provider.calls.length).toBeLessThanOrEqual(20);
      expect(result.report.calls.attempted).toBeGreaterThan(0);
      expect(result.report.cost.observedUsdKnown).toBe(true);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it('reconciles all 20 manifest operations', async () => {
    const catalogue = loadCalibrationCatalogue();
    const plan = buildLiveSmokeCallPlan(catalogue, CALIBRATION_MODEL_SNAPSHOT);
    expect(plan.operations).toHaveLength(20);

    const outputDir = await mkdtemp(join(tmpdir(), 'live-cal-'));
    const cacheDir = await mkdtemp(join(tmpdir(), 'live-cache-'));
    const provider = stubSuccessProvider();
    try {
      const result = await runLiveSmokeCalibration(liveArgs(outputDir), { provider, cacheDir });
      const breakdown = result.report.operationBreakdown ?? [];
      expect(breakdown).toHaveLength(20);

      const attempted = breakdown.filter((e) => e.status === 'provider_attempted').length;
      const cacheHits = breakdown.filter((e) => e.status === 'cache_hit').length;
      const skipped = breakdown.filter((e) => e.status === 'skipped').length;

      expect(attempted).toBe(result.report.calls.attempted);
      expect(cacheHits).toBe(result.report.calls.cacheHits);
      expect(skipped).toBe(result.report.calls.skipped);
      expect(attempted + cacheHits + skipped).toBe(20);
      expect(result.report.operationAccountingReconciliation?.ok).toBe(true);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it('fully cached rerun performs zero provider calls with known zero cost', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'live-cal-'));
    const cacheDir = await mkdtemp(join(tmpdir(), 'live-cache-'));
    const provider = stubSuccessProvider();
    try {
      await runLiveSmokeCalibration(liveArgs(outputDir), { provider, cacheDir });
      provider.calls.length = 0;
      const second = await runLiveSmokeCalibration(liveArgs(outputDir), { provider, cacheDir });
      expect(provider.calls.length).toBe(0);
      expect(second.report.calls.attempted).toBe(0);
      expect(second.report.cost.observedUsdKnown).toBe(true);
      expect(second.report.cost.observedUsd).toBe(0);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it('stops spending after auth and marks remaining ops skipped', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'live-cal-'));
    const cacheDir = await mkdtemp(join(tmpdir(), 'live-cache-'));
    let callCount = 0;
    const stubs = buildStubMockResponses();
    const matteClay = stubs.productResponses.get('cal-prod-matte-clay');
    if (!matteClay?.ok) throw new Error('missing matte clay stub');
    const provider = createMockCalibrationProvider({
      modelId: CALIBRATION_MODEL_SNAPSHOT,
      onCall: () => { callCount += 1; },
      defaultServiceResponse: { ok: false, error: 'OPENAI_AUTH_ERROR', usage: mockUsage({ operation: 'classify_service' }) },
      defaultProductResponse: {
        ok: true,
        data: matteClay.data,
        usage: mockUsage({ operation: 'classify_product' }),
      },
    });
    try {
      const result = await runLiveSmokeCalibration(liveArgs(outputDir), { provider, cacheDir });
      expect(result.report.finalOutcome).toBe('INCOMPLETE');
      expect(callCount).toBe(1);
      expect(result.report.calls.skipped).toBeGreaterThan(0);
      expect(result.report.skipReasonCounts?.SPENDING_STOPPED_AUTH).toBeGreaterThan(0);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it('reports unknown observed cost when usage is missing', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'live-cal-'));
    const cacheDir = await mkdtemp(join(tmpdir(), 'live-cache-'));
    const stubs = buildStubMockResponses();
    const unknownUsage = {
      usageKnown: false as const,
      operation: 'classify_service' as const,
      modelId: CALIBRATION_MODEL_SNAPSHOT,
    };
    const serviceResponses = new Map(stubs.serviceResponses);
    for (const [id, response] of serviceResponses) {
      if (response.ok) serviceResponses.set(id, { ...response, usage: unknownUsage });
    }
    const productResponses = new Map(stubs.productResponses);
    for (const [id, response] of productResponses) {
      if (response.ok) productResponses.set(id, { ...response, usage: { ...unknownUsage, operation: 'classify_product' } });
    }
    const provider = createMockCalibrationProvider({
      modelId: CALIBRATION_MODEL_SNAPSHOT,
      serviceResponses,
      productResponses,
    });
    try {
      const result = await runLiveSmokeCalibration(liveArgs(outputDir), { provider, cacheDir });
      expect(result.report.cost.observedUsdKnown).toBe(false);
      expect(result.report.cost.observedUsd).toBeNull();
      expect(result.report.tokens.unknownCallCount).toBeGreaterThan(0);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it('valid rerank changes evaluated order in reports', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'live-cal-'));
    const cacheDir = await mkdtemp(join(tmpdir(), 'live-cache-'));
    const stubs = buildStubMockResponses();
    const stubProfiles = buildCalibrationStubProfiles();
    const productEntries = CALIBRATION_SMOKE_EXECUTION_MANIFEST.classifyProductIds
      .map((id) => ({ id, profile: stubProfiles.products.get(id)! }))
      .filter((entry) => entry.profile != null);
    const serviceProfile = stubProfiles.services.get('cal-svc-skin-fade')!;
    const eligible = scoreEligibleCandidatesForService(serviceProfile, productEntries);
    const poolIds = createRerankPool(eligible).map((c) => c.productId);
    expect(poolIds.length).toBeGreaterThanOrEqual(2);

    const baselineProvider = createMockCalibrationProvider({
      modelId: CALIBRATION_MODEL_SNAPSHOT,
      serviceResponses: stubs.serviceResponses,
      productResponses: stubs.productResponses,
    });
    const probeDir = await mkdtemp(join(tmpdir(), 'probe-'));
    const probeCache = await mkdtemp(join(tmpdir(), 'probe-cache-'));
    const probe = await runLiveSmokeCalibration(liveArgs(probeDir), {
      provider: baselineProvider,
      cacheDir: probeCache,
    });
    await rm(probeDir, { recursive: true, force: true });
    await rm(probeCache, { recursive: true, force: true });

    const detSkinFade = probe.report.scenarioDiagnostics.find((s) => s.scenarioId === 'skin-fade-safety');
    const swappedIds = [...poolIds].reverse();

    const provider = createMockCalibrationProvider({
      modelId: CALIBRATION_MODEL_SNAPSHOT,
      serviceResponses: stubs.serviceResponses,
      productResponses: stubs.productResponses,
      rerankResponses: new Map([
        [
          'cal-svc-skin-fade',
          {
            ok: true,
            data: { orderedProductIds: swappedIds, confidence: 0.95 },
            usage: mockUsageKnown({ operation: 'rerank', fixtureId: 'cal-svc-skin-fade' }),
          },
        ],
      ]),
    });

    try {
      const result = await runLiveSmokeCalibration(liveArgs(outputDir), { provider, cacheDir });
      const skinFade = result.report.scenarioDiagnostics.find((s) => s.scenarioId === 'skin-fade-safety');
      expect(result.report.calls.rerankApplied).toBeGreaterThan(0);
      const detIds = detSkinFade?.selectedProducts.map((p) => p.productId) ?? [];
      const rerankIds = skinFade?.selectedProducts.map((p) => p.productId) ?? [];
      expect(rerankIds).not.toEqual(detIds);
      const raw = await readFile(join(outputDir, 'calibration-report.json'), 'utf8');
      expect(raw).toContain('rerankPosition');
    } finally {
      await rm(outputDir, { recursive: true, force: true });
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it('invalid rerank preserves deterministic order', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'live-cal-'));
    const cacheDir = await mkdtemp(join(tmpdir(), 'live-cache-'));
    const stubs = buildStubMockResponses();
    const provider = createMockCalibrationProvider({
      modelId: CALIBRATION_MODEL_SNAPSHOT,
      serviceResponses: stubs.serviceResponses,
      productResponses: stubs.productResponses,
      rerankResponses: new Map([
        [
          'cal-svc-skin-fade',
          {
            ok: true,
            data: { orderedProductIds: ['invalid-id'], confidence: 0.95 },
            usage: mockUsageKnown({ operation: 'rerank' }),
          },
        ],
      ]),
    });

    const baseline = createMockCalibrationProvider({
      modelId: CALIBRATION_MODEL_SNAPSHOT,
      serviceResponses: stubs.serviceResponses,
      productResponses: stubs.productResponses,
    });
    const baseDir = await mkdtemp(join(tmpdir(), 'base-'));
    const baseCache = await mkdtemp(join(tmpdir(), 'base-cache-'));
    const base = await runLiveSmokeCalibration(liveArgs(baseDir), { provider: baseline, cacheDir: baseCache });

    try {
      const result = await runLiveSmokeCalibration(liveArgs(outputDir), { provider, cacheDir });
      const skinFade = result.report.scenarioDiagnostics.find((s) => s.scenarioId === 'skin-fade-safety');
      const baseSkinFade = base.report.scenarioDiagnostics.find((s) => s.scenarioId === 'skin-fade-safety');
      expect(skinFade?.selectedProducts.map((p) => p.productId)).toEqual(
        baseSkinFade?.selectedProducts.map((p) => p.productId),
      );
      expect(result.report.calls.rerankFallback).toBeGreaterThan(0);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
      await rm(cacheDir, { recursive: true, force: true });
      await rm(baseDir, { recursive: true, force: true });
      await rm(baseCache, { recursive: true, force: true });
    }
  });

  it('prompt v3 cache cannot satisfy prompt v4 reads', async () => {
    const catalogue = loadCalibrationCatalogue();
    const raw = catalogue.services.find((s) => s.id === 'cal-svc-skin-fade')!;
    const contentHash = computeServiceSemanticHash({
      name: raw.name,
      description: raw.description,
      category: raw.category,
    });
    const cacheDir = await mkdtemp(join(tmpdir(), 'live-cache-'));
    const v3Key: CalibrationCacheKey = {
      entityId: raw.id,
      contentHash,
      modelId: CALIBRATION_MODEL_SNAPSHOT,
      promptVersion: '2026-09-v3',
      taxonomyVersion: TAXONOMY_VERSION,
      schemaVersion: SCHEMA_VERSION,
      operation: 'classify_service',
    };
    const envelope = buildServiceProfileEnvelope(
      { entityId: raw.id, shopId: CALIBRATION_SHOP_ID, name: raw.name, description: raw.description, category: raw.category },
      mapServiceTransportToProfile({
        targetAreas: ['HAIR'],
        typicalHairLength: 'SHORT',
        techniques: ['SKIN_FADE'],
        outcomes: ['SHAPE_STRUCTURE'],
        aftercareNeeds: ['DAILY_STYLING'],
        incompatibilities: [],
        retailNeeds: ['HAIR_STYLING_CONTROL'],
        confidence: 0.9,
        fieldConfidence: FULL_FIELD_CONFIDENCE,
        evidenceCodes: [],
        warnings: [],
      }),
      CALIBRATION_MODEL_SNAPSHOT,
    );
    await writeCalibrationCache(cacheDir, v3Key, envelope, {
      producerKind: 'TEST_MOCK',
      producingRunId: 'legacy-test',
    });

    const outputDir = await mkdtemp(join(tmpdir(), 'live-cal-'));
    const provider = stubSuccessProvider();
    try {
      await runLiveSmokeCalibration(liveArgs(outputDir), { provider, cacheDir });
      expect(provider.calls.some((call) => call.entityId === raw.id)).toBe(true);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it('does not leak sentinel fake API key into report JSON', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'live-cal-'));
    const cacheDir = await mkdtemp(join(tmpdir(), 'live-cache-'));
    const provider = stubSuccessProvider();
    try {
      await runLiveSmokeCalibration(liveArgs(outputDir), { provider, cacheDir });
      const raw = await readFile(join(outputDir, 'calibration-report.json'), 'utf8');
      expect(raw).not.toMatch(/sk-proj-fake/);
      const html = await readFile(join(outputDir, 'calibration-review.html'), 'utf8');
      expect(html).toContain('LIVE MODEL OUTPUT');
      expect(html).not.toMatch(/sk-proj-fake/);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it('refresh performs zero cache reads, calls provider, and reports FRESH_PROVIDER_RUN', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'live-cal-'));
    const cacheDir = await mkdtemp(join(tmpdir(), 'live-cache-'));
    const seedProvider = stubSuccessProvider();
    const provider = stubSuccessProvider();
    let cacheReads = 0;
    try {
      await runLiveSmokeCalibration(liveArgs(outputDir), { provider: seedProvider, cacheDir });
      const result = await runLiveSmokeCalibration(liveArgs(outputDir, 'refresh'), {
        provider,
        cacheDir,
        onCacheReadAttempt: () => {
          cacheReads += 1;
        },
      });
      expect(cacheReads).toBe(0);
      expect(provider.calls.length).toBeGreaterThan(0);
      expect(result.report.calls.cacheHits).toBe(0);
      expect(result.report.calls.attempted).toBeGreaterThan(0);
      expect(result.report.cachePolicy).toBe('refresh');
      expect(result.report.providerRunKind).toBe('FRESH_PROVIDER_RUN');
      expect(result.report.providerConnectivityVerified).toBe(true);
      expect(result.report.operationAccountingReconciliation?.ok).toBe(true);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it('refresh provider failure does not fall back to old cached payload', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'live-cal-'));
    const cacheDir = await mkdtemp(join(tmpdir(), 'live-cache-'));
    const seedProvider = stubSuccessProvider();
    try {
      await runLiveSmokeCalibration(liveArgs(outputDir), { provider: seedProvider, cacheDir });
      const failProvider = createMockCalibrationProvider({
        modelId: CALIBRATION_MODEL_SNAPSHOT,
        defaultServiceResponse: {
          ok: false,
          error: 'OPENAI_AUTH_ERROR',
          usage: mockUsage({ operation: 'classify_service' }),
        },
        defaultProductResponse: {
          ok: false,
          error: 'OPENAI_AUTH_ERROR',
          usage: mockUsage({ operation: 'classify_product' }),
        },
      });
      const result = await runLiveSmokeCalibration(liveArgs(outputDir, 'refresh'), {
        provider: failProvider,
        cacheDir,
      });
      expect(result.report.calls.cacheHits).toBe(0);
      expect(result.report.missingProfileDiagnostics?.length).toBeGreaterThan(0);
      expect(result.report.finalOutcome).toBe('INCOMPLETE');
    } finally {
      await rm(outputDir, { recursive: true, force: true });
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it('reuse warm cache reports CACHE_ONLY_REPLAY with connectivity false', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'live-cal-'));
    const cacheDir = await mkdtemp(join(tmpdir(), 'live-cache-'));
    const provider = stubSuccessProvider();
    try {
      await runLiveSmokeCalibration(liveArgs(outputDir), { provider, cacheDir });
      provider.calls.length = 0;
      const second = await runLiveSmokeCalibration(liveArgs(outputDir, 'reuse'), { provider, cacheDir });
      expect(provider.calls.length).toBe(0);
      expect(second.report.providerRunKind).toBe('CACHE_ONLY_REPLAY');
      expect(second.report.providerConnectivityVerified).toBe(false);
      expect(second.report.cachePolicy).toBe('reuse');
    } finally {
      await rm(outputDir, { recursive: true, force: true });
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it('readonly performs zero provider calls and fails clearly on cache miss', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'live-cal-'));
    const cacheDir = await mkdtemp(join(tmpdir(), 'live-cache-'));
    try {
      const result = await runLiveSmokeCalibration(liveArgs(outputDir, 'readonly'), { cacheDir });
      expect(result.report.calls.attempted).toBe(0);
      expect(result.report.providerRunKind).toBe('CACHE_ONLY_REPLAY');
      expect(result.report.providerConnectivityVerified).toBe(false);
      expect(result.report.errorCodeCounts?.CACHE_MISS_READONLY).toBeGreaterThan(0);
      expect(result.report.finalOutcome).toBe('INCOMPLETE');
      expect(result.report.operationAccountingReconciliation?.ok).toBe(true);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it('readonly replays warm cache without provider', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'live-cal-'));
    const cacheDir = await mkdtemp(join(tmpdir(), 'live-cache-'));
    const provider = stubSuccessProvider();
    try {
      await runLiveSmokeCalibration(liveArgs(outputDir), { provider, cacheDir });
      const result = await runLiveSmokeCalibration(liveArgs(outputDir, 'readonly'), { cacheDir });
      expect(result.report.calls.attempted).toBe(0);
      expect(result.report.calls.cacheHits).toBeGreaterThan(0);
      expect(result.report.providerRunKind).toBe('CACHE_ONLY_REPLAY');
      expect(result.report.providerConnectivityVerified).toBe(false);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it('writes TEST_MOCK provenance from mock provider runs', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'live-cal-'));
    const cacheDir = await mkdtemp(join(tmpdir(), 'live-cache-'));
    const provider = stubSuccessProvider();
    try {
      await runLiveSmokeCalibration(liveArgs(outputDir), {
        provider,
        cacheDir,
        cacheProducerKind: 'TEST_MOCK',
      });
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(cacheDir);
      expect(files.length).toBeGreaterThan(0);
      const raw = await readFile(join(cacheDir, files[0]!), 'utf8');
      expect(raw).toContain('"producerKind": "TEST_MOCK"');
      expect(raw).not.toContain('OPENAI_LIVE');
    } finally {
      await rm(outputDir, { recursive: true, force: true });
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it('buildLiveSmokeCallPlan asserts 20 uncached ceiling', () => {
    const catalogue = loadCalibrationCatalogue();
    const plan = buildLiveSmokeCallPlan(catalogue, CALIBRATION_MODEL_SNAPSHOT);
    expect(plan.totalMaxCalls).toBe(20);
    expect(CALIBRATION_SMOKE_EXECUTION_MANIFEST.classifyServiceIds.length).toBe(2);
    expect(CALIBRATION_SMOKE_EXECUTION_MANIFEST.classifyProductIds.length).toBe(17);
    expect(CALIBRATION_SMOKE_EXECUTION_MANIFEST.rerankServiceIds.length).toBe(1);
  });
});
