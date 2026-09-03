import { describe, expect, it } from 'vitest';

import type { ProductSemanticProfileV2, ScoredCandidate, ServiceSemanticProfileV2 } from './contracts';
import { TAXONOMY_VERSION } from './constants';
import { buildCandidateRerankSummary, buildServiceRerankSummary } from './rerankPayload';

const FORBIDDEN_KEYS = [
  'name',
  'description',
  'category',
  'sourceSnapshot',
  'email',
  'phone',
  'customer',
  'booking',
  'barber',
  'payment',
] as const;

function collectKeys(value: unknown, prefix = ''): string[] {
  if (value == null || typeof value !== 'object') return [];
  const keys: string[] = [];
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    keys.push(path);
    keys.push(...collectKeys(nested, path));
  }
  return keys;
}

function serviceProfile(): ServiceSemanticProfileV2 {
  return {
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'SERVICE',
    entityId: 'svc-1',
    shopId: 'shop-1',
    contentHash: 'hash',
    sourceSnapshot: { name: 'Skin Fade', description: 'Fade cut', category: 'cuts' },
    modelId: 'fixture',
    promptVersion: 'fixture',
    classifiedAt: new Date(0).toISOString(),
    targetAreas: ['HAIR'],
    typicalHairLength: 'SHORT',
    techniques: ['SKIN_FADE'],
    outcomes: ['SHAPE_STRUCTURE'],
    aftercareNeeds: ['DAILY_STYLING'],
    retailNeeds: ['HAIR_STYLING_CONTROL'],
    incompatibilities: [],
    confidence: 0.9,
    fieldConfidence: { targetAreas: 0.9, retailNeeds: 0.9 },
    evidenceCodes: [],
    warnings: [],
  };
}

function productProfile(): ProductSemanticProfileV2 {
  return {
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'PRODUCT',
    entityId: 'prod-1',
    shopId: 'shop-1',
    contentHash: 'hash-prod',
    sourceSnapshot: { name: 'Matte Clay', description: 'Strong hold', category: 'STYLING' },
    modelId: 'fixture',
    promptVersion: 'fixture',
    classifiedAt: new Date(0).toISOString(),
    targetAreas: ['HAIR'],
    retailNeeds: ['HAIR_STYLING_CONTROL'],
    productFamily: 'CLAY',
    benefits: ['HOLD'],
    holdStrength: 'STRONG',
    finish: 'MATTE',
    hairLengthSuitability: 'SHORT',
    incompatibilities: [],
    confidence: 0.9,
    fieldConfidence: { targetAreas: 0.9, retailNeeds: 0.9 },
    evidenceCodes: [],
    warnings: [],
  };
}

function scoredCandidate(): ScoredCandidate {
  return {
    productId: 'prod-1',
    deterministicScore: 0.82,
    confidenceGate: 0.88,
    reasonCodes: ['RETAIL_NEED_STRONG_MATCH'],
    productFamily: 'CLAY',
    matchedAreas: ['HAIR'],
    scoreBreakdown: {
      retailNeedRelevance: 0.9,
      targetAreaRelevance: 1,
      hairLengthSuitability: 1,
      techniqueProductAffinity: 0.5,
      confidenceQuality: 0.88,
    },
  };
}

describe('rerank payload builders', () => {
  it('includes required semantic fields for service and candidate summaries', () => {
    const serviceSummary = buildServiceRerankSummary(serviceProfile());
    expect(serviceSummary).toMatchObject({
      targetAreas: ['HAIR'],
      typicalHairLength: 'SHORT',
      techniques: ['SKIN_FADE'],
      outcomes: ['SHAPE_STRUCTURE'],
      aftercareNeeds: ['DAILY_STYLING'],
      retailNeeds: ['HAIR_STYLING_CONTROL'],
      incompatibilities: [],
    });

    const candidateSummary = buildCandidateRerankSummary(scoredCandidate(), productProfile());
    expect(candidateSummary).toMatchObject({
      matchedAreas: ['HAIR'],
      retailNeeds: ['HAIR_STYLING_CONTROL'],
      productFamily: 'CLAY',
      benefits: ['HOLD'],
      holdStrength: 'STRONG',
      finish: 'MATTE',
      hairLengthSuitability: 'SHORT',
      incompatibilities: [],
      deterministicScore: 0.82,
      confidenceGate: 0.88,
      reasonCodes: ['RETAIL_NEED_STRONG_MATCH'],
    });
  });

  it('omits raw catalogue text and PII-shaped fields from summaries', () => {
    const serviceSummary = buildServiceRerankSummary(serviceProfile());
    const candidateSummary = buildCandidateRerankSummary(scoredCandidate(), productProfile());
    const payload = {
      service: serviceSummary,
      candidates: [{ id: 'prod-1', summary: candidateSummary }],
    };

    const keys = collectKeys(payload).map((key) => key.toLowerCase());
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(keys.some((key) => key.includes(forbidden))).toBe(false);
    }
  });
});
