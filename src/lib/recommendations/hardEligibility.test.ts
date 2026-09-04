import { describe, expect, it } from 'vitest';

import { TAXONOMY_VERSION } from './constants';
import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from './contracts';
import { evaluateHardEligibility } from './hardEligibility';

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
    outcomes: ['SHAPE_STRUCTURE'],
    aftercareNeeds: ['DAILY_STYLING'],
    incompatibilities: [],
    retailNeeds: ['HAIR_STYLING_CONTROL'],
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
    benefits: ['HOLD'],
    holdStrength: 'STRONG',
    finish: 'MATTE',
    incompatibilities: [],
    retailNeeds: ['HAIR_STYLING_CONTROL'],
    confidence: 0.9,
    fieldConfidence: CRITICAL_FIELD_CONFIDENCE,
    evidenceCodes: [],
    warnings: [],
    ...overrides,
  };
}

describe('hardEligibility', () => {
  it('rejects when retail needs do not overlap', () => {
    const result = evaluateHardEligibility(
      service({ retailNeeds: ['HAIR_STYLING_CONTROL'] }),
      product({ retailNeeds: ['HAIR_CLEANSING'] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe('NO_RETAIL_NEED_OVERLAP');
  });

  it('rejects beard-only products when semantic match is not beard', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['HAIR', 'BEARD'],
        retailNeeds: ['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING'],
      }),
      product({
        targetAreas: ['HAIR', 'BEARD'],
        incompatibilities: ['BEARD_ONLY'],
        retailNeeds: ['HAIR_STYLING_CONTROL'],
        hairLengthSuitability: 'SHORT',
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe('BEARD_ONLY_PRODUCT');
  });

  it('derives beard-only semantic match for beard-softening overlap on dual-area product', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['HAIR', 'BEARD'],
        retailNeeds: ['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING'],
      }),
      product({
        targetAreas: ['HAIR', 'BEARD'],
        retailNeeds: ['BEARD_SOFTENING'],
        productFamily: 'OIL',
        hairLengthSuitability: 'NOT_APPLICABLE',
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.matchedAreas).toEqual(['BEARD']);
  });

  it('derives hair-only semantic match for styling overlap on dual-area product', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['HAIR', 'BEARD'],
        retailNeeds: ['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING'],
      }),
      product({
        targetAreas: ['HAIR', 'BEARD'],
        retailNeeds: ['HAIR_STYLING_CONTROL'],
        productFamily: 'CLAY',
        hairLengthSuitability: 'SHORT',
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.matchedAreas).toEqual(['HAIR']);
  });

  it('rejects NOT_FOR_BEARD when semantic overlap is beard-only', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['HAIR', 'BEARD'],
        retailNeeds: ['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING'],
      }),
      product({
        targetAreas: ['HAIR', 'BEARD'],
        incompatibilities: ['NOT_FOR_BEARD'],
        retailNeeds: ['BEARD_SOFTENING'],
        productFamily: 'CONDITIONER',
        hairLengthSuitability: 'ANY',
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe('NOT_FOR_BEARD');
  });

  it('allows BEARD_ONLY dual-area product when semantic overlap is beard', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['HAIR', 'BEARD'],
        retailNeeds: ['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING'],
      }),
      product({
        targetAreas: ['HAIR', 'BEARD'],
        incompatibilities: ['BEARD_ONLY'],
        retailNeeds: ['BEARD_SOFTENING'],
        productFamily: 'OIL',
        hairLengthSuitability: 'NOT_APPLICABLE',
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.matchedAreas).toEqual(['BEARD']);
  });

  it('strips HAIR but keeps beard match when hair length conflicts on dual semantic match', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['HAIR', 'BEARD'],
        typicalHairLength: 'SHORT',
        retailNeeds: ['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING'],
      }),
      product({
        targetAreas: ['HAIR', 'BEARD'],
        hairLengthSuitability: 'LONG',
        incompatibilities: ['FOR_LONG_HAIR_ONLY'],
        retailNeeds: ['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING'],
        productFamily: 'CREAM',
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.matchedAreas).toEqual(['BEARD']);
  });

  it('allows beard-only product on beard component of hair+beard combo', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['HAIR', 'BEARD'],
        retailNeeds: ['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING'],
      }),
      product({
        targetAreas: ['BEARD'],
        incompatibilities: ['BEARD_ONLY'],
        retailNeeds: ['BEARD_SOFTENING'],
        hairLengthSuitability: 'NOT_APPLICABLE',
        productFamily: 'OIL',
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.matchedAreas).toEqual(['BEARD']);
  });

  it('allows hair-only product on hair component of hair+beard combo', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['HAIR', 'BEARD'],
        retailNeeds: ['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING'],
      }),
      product({
        targetAreas: ['HAIR'],
        incompatibilities: ['HAIR_ONLY'],
        retailNeeds: ['HAIR_STYLING_CONTROL'],
        productFamily: 'CLAY',
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.matchedAreas).toEqual(['HAIR']);
  });

  it('rejects hair-only product when semantic overlap is beard-only', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['HAIR', 'BEARD'],
        retailNeeds: ['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING'],
      }),
      product({
        targetAreas: ['HAIR', 'BEARD'],
        incompatibilities: ['HAIR_ONLY'],
        retailNeeds: ['BEARD_SOFTENING'],
        productFamily: 'OIL',
        hairLengthSuitability: 'NOT_APPLICABLE',
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe('HAIR_ONLY_PRODUCT');
  });

  it('allows hair product with NOT_FOR_BEARD on hair+beard combo via hair component', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['HAIR', 'BEARD'],
        retailNeeds: ['HAIR_CONDITIONING', 'BEARD_SOFTENING'],
      }),
      product({
        targetAreas: ['HAIR'],
        incompatibilities: ['NOT_FOR_BEARD'],
        retailNeeds: ['HAIR_CONDITIONING'],
        productFamily: 'CONDITIONER',
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects NOT_FOR_BEARD when semantic overlap is beard-only on beard-target product', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['BEARD'],
        typicalHairLength: 'NOT_APPLICABLE',
        techniques: ['BEARD_TRIM'],
        retailNeeds: ['BEARD_SOFTENING'],
      }),
      product({
        targetAreas: ['BEARD'],
        incompatibilities: ['NOT_FOR_BEARD'],
        retailNeeds: ['BEARD_SOFTENING'],
        productFamily: 'CONDITIONER',
        hairLengthSuitability: 'NOT_APPLICABLE',
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe('NOT_FOR_BEARD');
  });

  it('rejects hair length mismatch on hair component', () => {
    const result = evaluateHardEligibility(
      service({ typicalHairLength: 'SHORT' }),
      product({
        hairLengthSuitability: 'LONG',
        incompatibilities: ['FOR_LONG_HAIR_ONLY'],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe('HAIR_LENGTH_MISMATCH');
  });

  it('Skin Fade SHORT + valid SHORT Matte Clay is eligible', () => {
    const result = evaluateHardEligibility(
      service({ typicalHairLength: 'SHORT', techniques: ['SKIN_FADE'] }),
      product({ hairLengthSuitability: 'SHORT', incompatibilities: [], productFamily: 'CLAY' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.matchedAreas).toEqual(['HAIR']);
  });

  it('Skin Fade SHORT + explicit FOR_LONG_HAIR_ONLY product is rejected', () => {
    const result = evaluateHardEligibility(
      service({ typicalHairLength: 'SHORT' }),
      product({ hairLengthSuitability: 'LONG', incompatibilities: ['FOR_LONG_HAIR_ONLY'] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe('HAIR_LENGTH_MISMATCH');
  });

  it('SHORT service + soft LONG suitability without exclusivity is not hard-rejected', () => {
    const result = evaluateHardEligibility(
      service({ typicalHairLength: 'SHORT' }),
      product({ hairLengthSuitability: 'LONG', incompatibilities: [] }),
    );
    expect(result.ok).toBe(true);
  });

  it('generic Haircut UNKNOWN + universal ANY styling product is eligible', () => {
    const result = evaluateHardEligibility(
      service({ typicalHairLength: 'UNKNOWN', techniques: ['SCISSOR_CUT'] }),
      product({ hairLengthSuitability: 'ANY', incompatibilities: [] }),
    );
    expect(result.ok).toBe(true);
  });

  it('generic Haircut UNKNOWN + merely SHORT-suitable non-exclusive product is not hard-rejected', () => {
    const result = evaluateHardEligibility(
      service({ typicalHairLength: 'UNKNOWN', techniques: ['SCISSOR_CUT'] }),
      product({ hairLengthSuitability: 'SHORT', incompatibilities: [] }),
    );
    expect(result.ok).toBe(true);
  });

  it('generic Haircut UNKNOWN + FOR_SHORT_HAIR_ONLY is unresolved', () => {
    const result = evaluateHardEligibility(
      service({ typicalHairLength: 'UNKNOWN', techniques: ['SCISSOR_CUT'] }),
      product({ hairLengthSuitability: 'SHORT', incompatibilities: ['FOR_SHORT_HAIR_ONLY'] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe('HAIR_LENGTH_UNRESOLVED_FOR_EXCLUSIVE_PRODUCT');
  });

  it('known LONG service + merely SHORT-suitable non-exclusive product is not hard-rejected', () => {
    const result = evaluateHardEligibility(
      service({ typicalHairLength: 'LONG', techniques: ['SCISSOR_CUT'] }),
      product({ hairLengthSuitability: 'SHORT', incompatibilities: [] }),
    );
    expect(result.ok).toBe(true);
  });

  it('known LONG service + FOR_SHORT_HAIR_ONLY is rejected', () => {
    const result = evaluateHardEligibility(
      service({ typicalHairLength: 'LONG' }),
      product({ hairLengthSuitability: 'SHORT', incompatibilities: ['FOR_SHORT_HAIR_ONLY'] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe('HAIR_LENGTH_MISMATCH');
  });

  it('exposes pair-scoped retail need fields on combo matches', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['HAIR', 'BEARD'],
        typicalHairLength: 'UNKNOWN',
        retailNeeds: ['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING', 'BEARD_SHAPING'],
      }),
      product({
        targetAreas: ['HAIR'],
        retailNeeds: ['HAIR_STYLING_CONTROL'],
        incompatibilities: ['HAIR_ONLY'],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.matchedAreas).toEqual(['HAIR']);
    expect(result.context.matchedServiceNeeds).toEqual(['HAIR_STYLING_CONTROL']);
    expect(result.context.matchedProductNeeds).toEqual(['HAIR_STYLING_CONTROL']);
    expect(result.context.pairRetailNeedF1).toBeCloseTo(1, 5);
  });

  it('rejects post-shave-only without shave context', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['HAIR', 'FACE'],
        retailNeeds: ['HAIR_STYLING_CONTROL', 'FACE_MOISTURISING'],
      }),
      product({
        targetAreas: ['FACE'],
        incompatibilities: ['POST_SHAVE_ONLY'],
        retailNeeds: ['POST_SHAVE_SOOTHING', 'FACE_MOISTURISING'],
        productFamily: 'AFTERSHAVE_BALM',
        hairLengthSuitability: 'NOT_APPLICABLE',
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe('POST_SHAVE_ONLY_PRODUCT');
  });

  it('allows strong general-grooming bridge with concrete domain on one side', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['HAIR'],
        retailNeeds: ['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION'],
      }),
      product({
        targetAreas: ['GENERAL_GROOMING'],
        retailNeeds: ['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION'],
        productFamily: 'GIFT_SET',
        hairLengthSuitability: 'ANY',
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.matchedComponent).toBe('HAIR');
    }
  });

  it('rejects weak general-grooming bridge when F1 is below threshold', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['HAIR'],
        retailNeeds: ['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION'],
      }),
      product({
        targetAreas: ['GENERAL_GROOMING'],
        retailNeeds: ['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING'],
        productFamily: 'GIFT_SET',
        hairLengthSuitability: 'ANY',
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe('NO_TARGET_AREA_OVERLAP');
  });

  it('rejects gift products when service has no gifting need', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['HAIR'],
        retailNeeds: ['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION'],
      }),
      product({
        targetAreas: ['GENERAL_GROOMING'],
        retailNeeds: ['HAIR_STYLING_CONTROL', 'GIFTING', 'BEARD_SOFTENING'],
        productFamily: 'GIFT_SET',
        hairLengthSuitability: 'ANY',
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe('NO_RETAIL_NEED_OVERLAP');
  });

  it('rejects unrelated general product without strong retail agreement', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['HAIR'],
        retailNeeds: ['HAIR_STYLING_CONTROL'],
      }),
      product({
        targetAreas: ['GENERAL_GROOMING'],
        retailNeeds: ['GIFTING'],
        productFamily: 'GIFT_SET',
        hairLengthSuitability: 'ANY',
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe('NO_RETAIL_NEED_OVERLAP');
  });

  it('allows explicit tools match when both sides have tools and GROOMING_TOOL overlaps', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['TOOLS_ACCESSORIES', 'HAIR'],
        retailNeeds: ['GROOMING_TOOL', 'HAIR_STYLING_CONTROL'],
      }),
      product({
        targetAreas: ['TOOLS_ACCESSORIES'],
        retailNeeds: ['GROOMING_TOOL'],
        productFamily: 'TOOL',
        hairLengthSuitability: 'ANY',
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.matchedComponent).toBe('TOOLS_ACCESSORIES');
  });

  it('rejects grooming tool for haircut without tools area on service', () => {
    const result = evaluateHardEligibility(
      service({
        targetAreas: ['HAIR'],
        retailNeeds: ['HAIR_STYLING_CONTROL'],
      }),
      product({
        targetAreas: ['TOOLS_ACCESSORIES', 'HAIR'],
        retailNeeds: ['GROOMING_TOOL'],
        productFamily: 'TOOL',
        hairLengthSuitability: 'ANY',
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe('NO_RETAIL_NEED_OVERLAP');
  });
});
