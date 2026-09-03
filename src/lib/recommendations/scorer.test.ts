import { describe, expect, it } from 'vitest';

import { TAXONOMY_VERSION } from './constants';
import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from './contracts';
import { evaluateServiceProductPair } from './pairEvaluation';
import {
  buildRankedRecommendationsForService,
  scoreServiceProductPair,
  shouldRenderRecommendations,
} from './scorer';

const CRITICAL_FIELD_CONFIDENCE = { targetAreas: 0.85, retailNeeds: 0.85 };

function serviceProfile(
  overrides: Partial<ServiceSemanticProfileV2> = {},
): ServiceSemanticProfileV2 {
  return {
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'SERVICE',
    entityId: 'svc-1',
    shopId: 'shop-1',
    contentHash: 'hash-svc',
    sourceSnapshot: { name: 'Skin Fade', description: null, category: 'cuts' },
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

function productProfile(
  id: string,
  overrides: Partial<ProductSemanticProfileV2> = {},
): ProductSemanticProfileV2 {
  return {
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'PRODUCT',
    entityId: id,
    shopId: 'shop-1',
    contentHash: `hash-${id}`,
    sourceSnapshot: { name: id, description: null, category: 'STYLING' },
    modelId: 'test',
    promptVersion: 'test',
    classifiedAt: new Date(0).toISOString(),
    targetAreas: ['HAIR'],
    hairLengthSuitability: 'SHORT',
    productFamily: 'CLAY',
    benefits: ['HOLD', 'MATTE_FINISH', 'TEXTURE'],
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

describe('recommendations/scorer', () => {
  it('ranks matte clay first for skin fade', () => {
    const service = serviceProfile();
    const clay = productProfile('p-clay', { productFamily: 'CLAY' });
    const shampoo = productProfile('p-shampoo', {
      productFamily: 'WASH_SHAMPOO',
      hairLengthSuitability: 'LONG',
      incompatibilities: ['FOR_LONG_HAIR_ONLY'],
      benefits: ['CLEANSING'],
      retailNeeds: ['HAIR_CLEANSING'],
    });

    const ranked = buildRankedRecommendationsForService(service, [
      { id: 'p-shampoo', profile: shampoo },
      { id: 'p-clay', profile: clay },
    ]);

    expect(ranked[0]?.productId).toBe('p-clay');
    expect(ranked).toHaveLength(1);
  });

  it('excludes beard-only products from hair-only services', () => {
    const service = serviceProfile();
    const beardOil = productProfile('p-beard-oil', {
      targetAreas: ['BEARD'],
      productFamily: 'OIL',
      hairLengthSuitability: 'NOT_APPLICABLE',
      incompatibilities: ['BEARD_ONLY'],
      benefits: ['BEARD_SOFTENING'],
      holdStrength: 'NONE',
      finish: 'NATURAL',
      retailNeeds: ['BEARD_SOFTENING'],
    });

    expect(scoreServiceProductPair({ service, product: beardOil, productId: 'p-beard-oil' })).toBeNull();
  });

  it('prefers beard oil for beard trim services', () => {
    const service = serviceProfile({
      targetAreas: ['BEARD'],
      typicalHairLength: 'NOT_APPLICABLE',
      techniques: ['BEARD_TRIM'],
      outcomes: ['BEARD_DEFINITION'],
      aftercareNeeds: ['BEARD_DAILY'],
      retailNeeds: ['BEARD_SOFTENING', 'BEARD_SHAPING'],
    });
    const beardOil = productProfile('p-beard-oil', {
      targetAreas: ['BEARD'],
      productFamily: 'OIL',
      hairLengthSuitability: 'NOT_APPLICABLE',
      benefits: ['BEARD_SOFTENING', 'BEARD_SHAPE'],
      holdStrength: 'NONE',
      finish: 'NATURAL',
      retailNeeds: ['BEARD_SOFTENING'],
    });
    const conditioner = productProfile('p-conditioner', {
      productFamily: 'CONDITIONER',
      incompatibilities: ['NOT_FOR_BEARD'],
      benefits: ['DETANGLING'],
      holdStrength: 'NONE',
      finish: 'NATURAL',
      retailNeeds: ['HAIR_CONDITIONING'],
    });

    const ranked = buildRankedRecommendationsForService(service, [
      { id: 'p-conditioner', profile: conditioner },
      { id: 'p-beard-oil', profile: beardOil },
    ]);

    expect(ranked[0]?.productId).toBe('p-beard-oil');
    expect(ranked).toHaveLength(1);
  });

  it('shouldRenderRecommendations respects minimum threshold', () => {
    expect(shouldRenderRecommendations(0)).toBe(false);
    expect(shouldRenderRecommendations(1)).toBe(false);
    expect(shouldRenderRecommendations(2)).toBe(true);
  });

  it('rejects long-hair shampoo for skin fade with NO_RETAIL_NEED_OVERLAP', () => {
    const service = serviceProfile();
    const shampoo = productProfile('p-shampoo', {
      productFamily: 'WASH_SHAMPOO',
      hairLengthSuitability: 'LONG',
      incompatibilities: ['FOR_LONG_HAIR_ONLY'],
      benefits: ['CLEANSING'],
      retailNeeds: ['HAIR_CLEANSING'],
    });

    const evaluation = evaluateServiceProductPair({ service, product: shampoo, productId: 'p-shampoo' });
    expect(evaluation.eligible).toBe(false);
    if (!evaluation.eligible) {
      expect(evaluation.reasonCode).toBe('NO_RETAIL_NEED_OVERLAP');
    }
  });

  it('allows hair conditioner on hair+beard combo despite NOT_FOR_BEARD', () => {
    const service = serviceProfile({
      targetAreas: ['HAIR', 'BEARD'],
      techniques: ['SKIN_FADE', 'BEARD_TRIM'],
      retailNeeds: ['HAIR_CONDITIONING', 'BEARD_SOFTENING'],
    });
    const conditioner = productProfile('p-conditioner', {
      productFamily: 'CONDITIONER',
      incompatibilities: ['NOT_FOR_BEARD'],
      benefits: ['DETANGLING'],
      holdStrength: 'NONE',
      finish: 'NATURAL',
      retailNeeds: ['HAIR_CONDITIONING'],
    });

    expect(scoreServiceProductPair({ service, product: conditioner, productId: 'p-conditioner' })).not.toBeNull();
  });

  it('produces stable ordering when product input is shuffled', () => {
    const service = serviceProfile();
    const clay = productProfile('p-clay', { productFamily: 'CLAY' });
    const pomade = productProfile('p-pomade', { productFamily: 'POMADE', retailNeeds: ['HAIR_STYLING_CONTROL'] });
    const powder = productProfile('p-powder', {
      productFamily: 'POWDER',
      retailNeeds: ['HAIR_TEXTURE_DEFINITION', 'HAIR_VOLUME'],
      benefits: ['TEXTURE', 'VOLUME'],
      holdStrength: 'LIGHT',
    });

    const ordered = [
      { id: 'p-clay', profile: clay },
      { id: 'p-pomade', profile: pomade },
      { id: 'p-powder', profile: powder },
    ];
    const shuffled = [ordered[2], ordered[0], ordered[1]] as typeof ordered;

    const rankedA = buildRankedRecommendationsForService(service, ordered);
    const rankedB = buildRankedRecommendationsForService(service, shuffled);
    expect(rankedA.map((row) => row.productId)).toEqual(rankedB.map((row) => row.productId));
  });
});
