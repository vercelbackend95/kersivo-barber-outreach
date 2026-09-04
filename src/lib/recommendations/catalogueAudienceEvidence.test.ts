import { describe, expect, it } from 'vitest';

import {
  audienceMismatchChildOnly,
  isChildOnlyProduct,
  isChildService,
} from './catalogueAudienceEvidence';
import { TAXONOMY_VERSION } from './constants';
import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from './contracts';
import { evaluateServiceProductPair } from './pairEvaluation';

function service(
  name: string,
  description: string | null,
  overrides: Partial<ServiceSemanticProfileV2> = {},
): ServiceSemanticProfileV2 {
  return {
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'SERVICE',
    entityId: 'svc',
    shopId: 'shop',
    contentHash: 'h',
    sourceSnapshot: { name, description, category: 'cuts' },
    modelId: 'test',
    promptVersion: 'test',
    classifiedAt: new Date(0).toISOString(),
    targetAreas: ['HAIR'],
    typicalHairLength: 'SHORT',
    techniques: ['CLIPPER_CUT'],
    outcomes: ['NEAT_FINISH'],
    aftercareNeeds: ['DAILY_STYLING'],
    incompatibilities: [],
    retailNeeds: ['HAIR_STYLING_CONTROL'],
    confidence: 0.9,
    fieldConfidence: { targetAreas: 0.9, retailNeeds: 0.9 },
    evidenceCodes: [],
    warnings: [],
    ...overrides,
  };
}

function product(
  name: string,
  description: string | null,
  overrides: Partial<ProductSemanticProfileV2> = {},
): ProductSemanticProfileV2 {
  return {
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'PRODUCT',
    entityId: 'prod',
    shopId: 'shop',
    contentHash: 'h',
    sourceSnapshot: { name, description, category: 'STYLING' },
    modelId: 'test',
    promptVersion: 'test',
    classifiedAt: new Date(0).toISOString(),
    targetAreas: ['HAIR'],
    hairLengthSuitability: 'SHORT',
    productFamily: 'GEL',
    benefits: ['HOLD'],
    holdStrength: 'LIGHT',
    finish: 'SHINE',
    incompatibilities: [],
    retailNeeds: ['HAIR_STYLING_CONTROL'],
    confidence: 0.9,
    fieldConfidence: { targetAreas: 0.9, retailNeeds: 0.9 },
    evidenceCodes: [],
    warnings: [],
    ...overrides,
  };
}

describe('catalogueAudienceEvidence', () => {
  it('name-only child services with straight and curly apostrophes', () => {
    expect(isChildService({ name: "Children's Cut", description: null })).toBe(true);
    expect(isChildService({ name: 'Children’s Cut', description: null })).toBe(true);
    expect(isChildService({ name: 'Kids Cut', description: null })).toBe(true);
    expect(isChildService({ name: 'Junior Cut', description: null })).toBe(true);
  });

  it('detects child-only products including apostrophe forms', () => {
    expect(isChildOnlyProduct({ name: "Children's Styling Cream", description: null })).toBe(true);
    expect(isChildOnlyProduct({ name: 'Children’s Styling Cream', description: null })).toBe(true);
    expect(isChildOnlyProduct({ name: 'Kids Styling Gel', description: 'Gentle hold gel.' })).toBe(
      true,
    );
  });

  it('weak family phrases alone are not child-exclusive', () => {
    expect(
      isChildOnlyProduct({ name: 'Family Friendly Styling Gel', description: null }),
    ).toBe(false);
    expect(
      isChildOnlyProduct({ name: 'Styling Gel', description: 'Safe around children' }),
    ).toBe(false);
    expect(
      isChildOnlyProduct({ name: 'Styling Gel', description: 'Safe for kids' }),
    ).toBe(false);
    expect(
      isChildOnlyProduct({ name: 'Styling Gel', description: 'Safe for family' }),
    ).toBe(false);
    expect(
      isChildOnlyProduct({
        name: 'Styling Gel',
        description: 'Suitable for adults and children',
      }),
    ).toBe(false);
  });

  it('strong child evidence survives weak family copy in the same text', () => {
    expect(
      isChildOnlyProduct({
        name: 'Styling Gel',
        description: 'Formulated for kids. Safe for family.',
      }),
    ).toBe(true);
    expect(
      isChildOnlyProduct({
        name: 'Styling Cream',
        description: 'Family friendly. Designed for children.',
      }),
    ).toBe(true);
    expect(
      isChildOnlyProduct({
        name: 'Hold Gel',
        description: 'Safe for kids and formulated for kids.',
      }),
    ).toBe(true);
  });

  it('rejects kids gel for generic adult services', () => {
    const kidsGel = product('Kids Styling Gel', 'Gentle hold gel.');
    for (const svc of [
      service('Haircut', null),
      service('Skin Fade', 'Tight skin fade'),
      service('Haircut & Beard', 'Haircut plus beard trim combo.', {
        targetAreas: ['HAIR', 'BEARD'],
        retailNeeds: ['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING'],
        typicalHairLength: 'UNKNOWN',
      }),
    ]) {
      expect(audienceMismatchChildOnly(svc.sourceSnapshot, kidsGel.sourceSnapshot)).toBe(true);
      const pair = evaluateServiceProductPair({
        service: svc,
        product: kidsGel,
        productId: 'kids',
      });
      expect(pair.eligible).toBe(false);
      if (!pair.eligible) expect(pair.reasonCode).toBe('AUDIENCE_MISMATCH_CHILD_ONLY');
    }
  });

  it('allows kids gel for children’s cut when semantics overlap', () => {
    const pair = evaluateServiceProductPair({
      service: service("Children's Cut", null),
      product: product('Kids Styling Gel', 'Gentle hold gel.'),
      productId: 'kids',
    });
    expect(pair.eligible).toBe(true);
  });
});
