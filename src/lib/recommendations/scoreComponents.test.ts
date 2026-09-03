import { describe, expect, it } from 'vitest';

import { MATCH_SCORE_MIN } from './constants';
import {
  SCORE_WEIGHTS,
  computeDeterministicScore,
  computeRetailNeedF1ForTest,
} from './scoreComponents';
import { evaluateHardEligibility } from './hardEligibility';
import { TAXONOMY_VERSION } from './constants';
import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from './contracts';

const CRITICAL_FIELD_CONFIDENCE = { targetAreas: 0.85, retailNeeds: 0.85 };

function service(overrides: Partial<ServiceSemanticProfileV2> = {}): ServiceSemanticProfileV2 {
  return {
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'SERVICE',
    entityId: 'svc',
    shopId: 'shop',
    contentHash: 'hash',
    sourceSnapshot: { name: 'Test', description: null, category: null },
    modelId: 'test',
    promptVersion: 'test',
    classifiedAt: new Date(0).toISOString(),
    targetAreas: ['HAIR'],
    typicalHairLength: 'SHORT',
    techniques: ['SKIN_FADE'],
    outcomes: ['SHAPE_STRUCTURE', 'TEXTURE_DEFINITION'],
    aftercareNeeds: ['DAILY_STYLING'],
    incompatibilities: [],
    retailNeeds: ['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION'],
    confidence: 0.9,
    fieldConfidence: CRITICAL_FIELD_CONFIDENCE,
    evidenceCodes: [],
    warnings: [],
    ...overrides,
  };
}

function product(overrides: Partial<ProductSemanticProfileV2> = {}): ProductSemanticProfileV2 {
  return {
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'PRODUCT',
    entityId: 'prod',
    shopId: 'shop',
    contentHash: 'hash',
    sourceSnapshot: { name: 'Test', description: null, category: 'STYLING' },
    modelId: 'test',
    promptVersion: 'test',
    classifiedAt: new Date(0).toISOString(),
    targetAreas: ['HAIR'],
    hairLengthSuitability: 'SHORT',
    productFamily: 'CLAY',
    benefits: ['HOLD', 'TEXTURE'],
    holdStrength: 'STRONG',
    finish: 'MATTE',
    incompatibilities: [],
    retailNeeds: ['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION'],
    confidence: 0.9,
    fieldConfidence: CRITICAL_FIELD_CONFIDENCE,
    evidenceCodes: [],
    warnings: [],
    ...overrides,
  };
}

describe('scoreComponents', () => {
  it('weights sum to 1', () => {
    const sum = Object.values(SCORE_WEIGHTS).reduce((total, weight) => total + weight, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('computes retail need F1 correctly', () => {
    const f1 = computeRetailNeedF1ForTest(['A', 'B'], ['B', 'C']);
    expect(f1).toBeCloseTo(0.5, 5);
  });

  it('strong match scores above threshold', () => {
    const svc = service();
    const prod = product();
    const hard = evaluateHardEligibility(svc, prod);
    expect(hard.ok).toBe(true);
    if (!hard.ok) return;

    const scored = computeDeterministicScore(svc, prod, hard.context);
    expect(scored.score).toBeGreaterThanOrEqual(MATCH_SCORE_MIN);
    expect(scored.reasonCodes).toContain('RETAIL_NEED_STRONG_MATCH');
  });

  it('partial overlap scores below strong threshold', () => {
    const svc = service({ retailNeeds: ['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION'] });
    const prod = product({ retailNeeds: ['HAIR_STYLING_CONTROL'] });
    const hard = evaluateHardEligibility(svc, prod);
    expect(hard.ok).toBe(true);
    if (!hard.ok) return;

    const scored = computeDeterministicScore(svc, prod, hard.context);
    expect(scored.breakdown.retailNeedRelevance).toBeLessThan(0.75);
    expect(scored.reasonCodes).toContain('RETAIL_NEED_PARTIAL_MATCH');
  });

  it('emits HAIR_LENGTH_NOT_APPLICABLE for non-hair matches even with contradictory lengths', () => {
    const svc = service({
      targetAreas: ['BEARD'],
      typicalHairLength: 'SHORT',
      techniques: ['BEARD_TRIM'],
      retailNeeds: ['BEARD_SOFTENING'],
    });
    const prod = product({
      targetAreas: ['BEARD'],
      hairLengthSuitability: 'LONG',
      incompatibilities: ['BEARD_ONLY'],
      retailNeeds: ['BEARD_SOFTENING'],
      productFamily: 'OIL',
    });
    const hard = evaluateHardEligibility(svc, prod);
    expect(hard.ok).toBe(true);
    if (!hard.ok) return;

    const scored = computeDeterministicScore(svc, prod, hard.context);
    expect(scored.breakdown.hairLengthSuitability).toBe(1);
    expect(scored.reasonCodes).toContain('HAIR_LENGTH_NOT_APPLICABLE');
    expect(scored.reasonCodes).not.toContain('HAIR_LENGTH_ANY');
  });
});
