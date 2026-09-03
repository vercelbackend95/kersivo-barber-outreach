import { describe, expect, it } from 'vitest';

import type { ScoredCandidate } from './contracts';
import { createRerankPool } from './rerankPool';
import { RERANK_CANDIDATE_LIMIT } from './constants';
import { scoreEligibleCandidatesForService } from './scorer';
import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from './contracts';
import { TAXONOMY_VERSION } from './constants';

function candidate(productId: string, score: number): ScoredCandidate {
  return {
    productId,
    deterministicScore: score,
    confidenceGate: 0.9,
    reasonCodes: [],
    productFamily: 'CLAY',
    matchedAreas: ['HAIR'],
  };
}

function minimalService(): ServiceSemanticProfileV2 {
  return {
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'SERVICE',
    entityId: 'svc-1',
    shopId: 'shop-1',
    contentHash: 'hash',
    sourceSnapshot: { name: 'Cut', description: null, category: 'cuts' },
    modelId: 'fixture',
    promptVersion: 'fixture',
    classifiedAt: new Date(0).toISOString(),
    targetAreas: ['HAIR'],
    typicalHairLength: 'SHORT',
    techniques: ['SCISSOR_CUT'],
    outcomes: ['NEAT_FINISH'],
    aftercareNeeds: ['DAILY_STYLING'],
    retailNeeds: ['HAIR_STYLING_CONTROL'],
    incompatibilities: [],
    confidence: 0.9,
    fieldConfidence: { targetAreas: 0.9, retailNeeds: 0.9 },
    evidenceCodes: [],
    warnings: [],
  };
}

function minimalProduct(id: string): { id: string; profile: ProductSemanticProfileV2 } {
  return {
    id,
    profile: {
      schemaVersion: '2',
      taxonomyVersion: TAXONOMY_VERSION,
      entityType: 'PRODUCT',
      entityId: id,
      shopId: 'shop-1',
      contentHash: `hash-${id}`,
      sourceSnapshot: { name: `Product ${id}`, description: null, category: 'STYLING' },
      modelId: 'fixture',
      promptVersion: 'fixture',
      classifiedAt: new Date(0).toISOString(),
      targetAreas: ['HAIR'],
      retailNeeds: ['HAIR_STYLING_CONTROL'],
      productFamily: 'CLAY',
      benefits: ['HOLD'],
      holdStrength: 'MEDIUM',
      finish: 'MATTE',
      hairLengthSuitability: 'SHORT',
      incompatibilities: [],
      confidence: 0.9,
      fieldConfidence: { targetAreas: 0.9, retailNeeds: 0.9 },
      evidenceCodes: [],
      warnings: [],
    },
  };
}

describe('createRerankPool', () => {
  it('returns exactly 12 candidates when more than 12 are eligible', () => {
    const eligible = Array.from({ length: 15 }, (_, index) =>
      candidate(`prod-${String(index).padStart(2, '0')}`, 0.9 - index * 0.01),
    );

    const pool = createRerankPool(eligible);
    expect(pool).toHaveLength(RERANK_CANDIDATE_LIMIT);
    expect(pool.map((row) => row.productId)).toEqual(
      eligible
        .slice()
        .sort((a, b) => b.deterministicScore - a.deterministicScore || a.productId.localeCompare(b.productId))
        .slice(0, 12)
        .map((row) => row.productId),
    );
  });

  it('is deterministic regardless of input order', () => {
    const ordered = Array.from({ length: 14 }, (_, index) =>
      candidate(`prod-${String(index).padStart(2, '0')}`, 0.85 - index * 0.01),
    );
    const shuffled = [...ordered].reverse();

    expect(createRerankPool(ordered).map((row) => row.productId)).toEqual(
      createRerankPool(shuffled).map((row) => row.productId),
    );
  });

  it('does not truncate to the final carousel size of four', () => {
    const service = minimalService();
    const products = Array.from({ length: 8 }, (_, index) => minimalProduct(`p-${index}`));

    const eligible = scoreEligibleCandidatesForService(service, products);
    expect(eligible.length).toBeGreaterThan(4);

    const pool = createRerankPool(eligible);
    expect(pool.length).toBeGreaterThan(4);
    expect(pool.length).toBe(Math.min(eligible.length, RERANK_CANDIDATE_LIMIT));
  });
});
