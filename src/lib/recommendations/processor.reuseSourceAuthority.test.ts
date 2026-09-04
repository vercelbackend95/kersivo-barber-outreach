import { describe, expect, it } from 'vitest';

import { TAXONOMY_VERSION } from './constants';
import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from './contracts';
import {
  applyAuthoritativeSourceToReusedProduct,
  applyAuthoritativeSourceToReusedService,
} from './profileReuseSourceAuthority';

function baseProduct(
  overrides: Partial<ProductSemanticProfileV2> = {},
): ProductSemanticProfileV2 {
  return {
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'PRODUCT',
    entityId: 'prod-1',
    shopId: 'shop-1',
    contentHash: 'hash-match',
    sourceSnapshot: {
      name: 'Stale Fibre',
      description: 'Designed exclusively for hair.',
      category: 'STYLING',
    },
    modelId: 'test-model',
    promptVersion: 'test',
    classifiedAt: new Date(0).toISOString(),
    targetAreas: ['HAIR'],
    hairLengthSuitability: 'SHORT',
    productFamily: 'WAX',
    benefits: ['HOLD'],
    holdStrength: 'MEDIUM',
    finish: 'MATTE',
    incompatibilities: ['HAIR_ONLY'],
    retailNeeds: ['HAIR_STYLING_CONTROL'],
    confidence: 0.9,
    fieldConfidence: { targetAreas: 0.9, retailNeeds: 0.9 },
    evidenceCodes: ['SOURCE_EXPLICIT_HAIR_ONLY'],
    warnings: [],
    ...overrides,
  };
}

function baseService(
  overrides: Partial<ServiceSemanticProfileV2> = {},
): ServiceSemanticProfileV2 {
  return {
    schemaVersion: '2',
    taxonomyVersion: TAXONOMY_VERSION,
    entityType: 'SERVICE',
    entityId: 'svc-1',
    shopId: 'shop-1',
    contentHash: 'hash-match',
    sourceSnapshot: {
      name: 'Generic Cut',
      description: 'A basic cut.',
      category: 'cuts',
    },
    modelId: 'test-model',
    promptVersion: 'test',
    classifiedAt: new Date(0).toISOString(),
    targetAreas: ['HAIR'],
    typicalHairLength: 'SHORT',
    techniques: ['CLIPPER_CUT'],
    outcomes: ['NEAT_FINISH'],
    aftercareNeeds: ['DAILY_STYLING'],
    incompatibilities: [],
    retailNeeds: ['HAIR_STYLING_CONTROL'],
    confidence: 0.5,
    fieldConfidence: { targetAreas: 0.5, retailNeeds: 0.5 },
    evidenceCodes: [],
    warnings: [],
    ...overrides,
  };
}

describe('applyAuthoritativeSourceToReusedProduct', () => {
  it('strips exclusivity when stale snapshot claims it but current DB text does not', () => {
    const reused = baseProduct({
      incompatibilities: ['HAIR_ONLY'],
      evidenceCodes: ['SOURCE_EXPLICIT_HAIR_ONLY'],
      sourceSnapshot: {
        name: 'Super Hold Fibre',
        description: 'Designed exclusively for hair.',
        category: 'STYLING',
      },
    });

    const result = applyAuthoritativeSourceToReusedProduct(reused, {
      name: 'Super Hold Fibre',
      description: 'Strong hold fibre for textured styles.',
      category: 'STYLING',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.incompatibilities).not.toContain('HAIR_ONLY');
    expect(result.profile.sourceSnapshot.description).toBe(
      'Strong hold fibre for textured styles.',
    );
  });

  it('applies exclusivity when current DB text has it but cached snapshot lacks it', () => {
    const reused = baseProduct({
      incompatibilities: [],
      evidenceCodes: [],
      sourceSnapshot: {
        name: 'Hair Fibre',
        description: 'Matte fibre paste.',
        category: 'STYLING',
      },
    });

    const result = applyAuthoritativeSourceToReusedProduct(reused, {
      name: 'Hair Fibre',
      description: 'Designed exclusively for hair.',
      category: 'STYLING',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.incompatibilities).toContain('HAIR_ONLY');
    expect(result.profile.sourceSnapshot.description).toBe('Designed exclusively for hair.');
  });
});

describe('applyAuthoritativeSourceToReusedService', () => {
  it('restores Haircut & Beard evidence despite stale snapshot', () => {
    const reused = baseService({
      sourceSnapshot: {
        name: 'Haircut',
        description: 'Standard haircut.',
        category: 'cuts',
      },
      targetAreas: ['HAIR'],
      retailNeeds: ['HAIR_STYLING_CONTROL'],
      fieldConfidence: { targetAreas: 0.4, retailNeeds: 0.4 },
      evidenceCodes: [],
    });

    const result = applyAuthoritativeSourceToReusedService(reused, {
      name: 'Haircut & Beard',
      description: 'Haircut plus beard tidy.',
      category: 'cuts',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.targetAreas).toEqual(expect.arrayContaining(['HAIR', 'BEARD']));
    expect(result.profile.retailNeeds).toEqual(
      expect.arrayContaining(['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING']),
    );
    expect(result.profile.evidenceCodes).toContain('SOURCE_EVIDENCE_HAIRCUT_BEARD');
    expect(result.profile.sourceSnapshot.name).toBe('Haircut & Beard');
  });
});
