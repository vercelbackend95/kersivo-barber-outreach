import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecommendationSetStatus } from '@prisma/client';

const classifyServiceEntity = vi.fn();
const classifyProductEntity = vi.fn();
const createRecommendationOpenAiClient = vi.fn();
const rerankEligibleCandidates = vi.fn();

vi.mock('./ai/classify', () => ({
  classifyServiceEntity: (...args: unknown[]) => classifyServiceEntity(...args),
  classifyProductEntity: (...args: unknown[]) => classifyProductEntity(...args),
  createRecommendationOpenAiClient: (...args: unknown[]) => createRecommendationOpenAiClient(...args),
  rerankEligibleCandidates: (...args: unknown[]) => rerankEligibleCandidates(...args),
  resolveRecommendationModel: () => 'gpt-4o-mini',
}));

vi.mock('./workerOwnership', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./workerOwnership')>();
  return {
    ...actual,
    acquireShopLock: vi.fn().mockResolvedValue('lock-1'),
    releaseOwnedLock: vi.fn().mockResolvedValue(true),
    markSetTerminal: vi.fn().mockResolvedValue(undefined),
    claimOwnedFailure: vi.fn(),
  };
});

const serviceFindMany = vi.fn();
const productFindMany = vi.fn();
const setCreate = vi.fn();
const itemCreateMany = vi.fn();
const stateUpdateMany = vi.fn();
const setUpdate = vi.fn();
const setUpdateMany = vi.fn();
const transaction = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    service: { findMany: (...args: unknown[]) => serviceFindMany(...args) },
    product: { findMany: (...args: unknown[]) => productFindMany(...args) },
    serviceSemanticProfile: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(undefined),
    },
    productSemanticProfile: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(undefined),
    },
    recommendationSet: {
      create: (...args: unknown[]) => setCreate(...args),
      update: (...args: unknown[]) => setUpdate(...args),
      updateMany: (...args: unknown[]) => setUpdateMany(...args),
    },
    recommendationSetItem: { createMany: (...args: unknown[]) => itemCreateMany(...args) },
    shopRecommendationState: { updateMany: (...args: unknown[]) => stateUpdateMany(...args) },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

import { processShop } from './processor';

const SERVICE_FIELD_CONFIDENCE = {
  targetAreas: 0.9,
  typicalHairLength: 0.8,
  techniques: 0.85,
  outcomes: 0.7,
  aftercareNeeds: 0.6,
  incompatibilities: 0.5,
  retailNeeds: 0.85,
};

const PRODUCT_FIELD_CONFIDENCE = {
  targetAreas: 0.9,
  hairLengthSuitability: 0.8,
  productFamily: 0.85,
  benefits: 0.7,
  holdStrength: 0.9,
  finish: 0.8,
  incompatibilities: 0.5,
  retailNeeds: 0.85,
};

function validServiceProfile() {
  return {
    targetAreas: ['HAIR'],
    typicalHairLength: 'SHORT',
    techniques: ['SKIN_FADE'],
    outcomes: ['SHAPE_STRUCTURE'],
    aftercareNeeds: ['DAILY_STYLING'],
    incompatibilities: [],
    retailNeeds: ['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION'],
    confidence: 0.9,
    fieldConfidence: SERVICE_FIELD_CONFIDENCE,
    evidenceCodes: ['NAME'],
    warnings: [],
  };
}

function validProductProfile(id: string, family: string) {
  return {
    targetAreas: ['HAIR'],
    hairLengthSuitability: 'SHORT',
    productFamily: family,
    benefits: ['HOLD'],
    holdStrength: 'STRONG',
    finish: 'MATTE',
    incompatibilities: [],
    retailNeeds: ['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION'],
    confidence: 0.85,
    fieldConfidence: PRODUCT_FIELD_CONFIDENCE,
    evidenceCodes: ['NAME'],
    warnings: [],
  };
}

function setupCatalogue() {
  serviceFindMany.mockResolvedValue([
    { id: 'svc-1', name: 'Skin Fade', description: 'Fade', category: 'cuts' },
  ]);
  productFindMany.mockResolvedValue([
    { id: 'p-clay', name: 'Clay', description: null, category: 'STYLING' },
    { id: 'p-pomade', name: 'Pomade', description: null, category: 'STYLING' },
  ]);
  createRecommendationOpenAiClient.mockReturnValue({ chat: {} });
  classifyServiceEntity.mockResolvedValue({ ok: true, data: validServiceProfile() });
  classifyProductEntity.mockImplementation(async (_client, entity: { id: string }) => {
    const family = entity.id === 'p-clay' ? 'CLAY' : 'POMADE';
    return { ok: true, data: validProductProfile(entity.id, family) };
  });
}

describe('processShop rerank fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCreate.mockResolvedValue({ id: 'set-1' });
    stateUpdateMany.mockResolvedValue({ count: 1 });
    transaction.mockImplementation(async (fn: (tx: {
      shopRecommendationState: { updateMany: typeof stateUpdateMany };
      recommendationSet: { update: typeof setUpdate; updateMany: typeof setUpdateMany };
    }) => Promise<void>) =>
      fn({
        shopRecommendationState: { updateMany: stateUpdateMany },
        recommendationSet: { update: setUpdate, updateMany: setUpdateMany },
      }),
    );
    setupCatalogue();
  });

  it.each([
    ['MODEL_REFUSAL', { ok: false, error: 'MODEL_REFUSAL' }],
    ['OPENAI_TIMEOUT', { ok: false, error: 'OPENAI_TIMEOUT' }],
    ['OPENAI_RATE_LIMIT', { ok: false, error: 'OPENAI_RATE_LIMIT' }],
    ['RERANK_SERVICE_ID_MISMATCH', { ok: false, error: 'RERANK_SERVICE_ID_MISMATCH' }],
    ['RERANK_INCOMPLETE_PERMUTATION', { ok: false, error: 'RERANK_INCOMPLETE_PERMUTATION' }],
    [
      'RERANK_LOW_CONFIDENCE',
      { ok: true, data: { orderedProductIds: ['p-pomade', 'p-clay'], confidence: 0.5 } },
    ],
  ])('does not fail the build when rerank returns %s', async (_label, rerankResult) => {
    rerankEligibleCandidates.mockResolvedValue(rerankResult);

    const ok = await processShop('shop-1', 2);
    expect(ok).toBe(true);
    expect(setUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'set-1' },
        data: expect.objectContaining({ status: RecommendationSetStatus.READY }),
      }),
    );
  });

  it('records stable rerank fallback reason codes without provider messages', async () => {
    rerankEligibleCandidates.mockResolvedValue({ ok: false, error: 'OPENAI_RATE_LIMIT' });

    const ok = await processShop('shop-1', 2);
    expect(ok).toBe(true);

    const publishCall = setUpdate.mock.calls.find(
      (call) => call[0]?.data?.status === RecommendationSetStatus.READY,
    );
    const stats = publishCall?.[0]?.data?.stats as Record<string, unknown>;
    expect(stats.rerankAttemptedServiceCount).toBe(1);
    expect(stats.rerankFallbackServiceCount).toBe(1);
    expect(stats.rerankFallbackReasonCounts).toEqual({ OPENAI_RATE_LIMIT: 1 });
    for (const [key, count] of Object.entries(stats.rerankFallbackReasonCounts as Record<string, number>)) {
      expect(key).toMatch(/^[A-Z0-9_]+$/);
      expect(key.length).toBeLessThanOrEqual(40);
      expect(typeof count).toBe('number');
    }
    expect(publishCall?.[0]?.data?.rerankModelId).toBe('gpt-4o-mini');
  });

  it('applies bounded rerank when model returns a valid high-confidence decision', async () => {
    rerankEligibleCandidates.mockResolvedValue({
      ok: true,
      data: {
        orderedProductIds: ['p-pomade', 'p-clay'],
        confidence: 0.95,
      },
    });

    const ok = await processShop('shop-1', 2);
    expect(ok).toBe(true);

    const publishCall = setUpdate.mock.calls.find(
      (call) => call[0]?.data?.status === RecommendationSetStatus.READY,
    );
    const stats = publishCall?.[0]?.data?.stats as Record<string, unknown>;
    expect(stats.rerankAppliedServiceCount).toBe(1);
    expect(stats.rerankFallbackServiceCount).toBe(0);
  });
});
