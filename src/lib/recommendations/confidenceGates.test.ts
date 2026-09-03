import { describe, expect, it } from 'vitest';

import {
  CRITICAL_FIELD_CONFIDENCE_MIN,
  PROFILE_CONFIDENCE_MIN,
  TAXONOMY_VERSION,
} from './constants';
import type { ProductSemanticProfileV2, ServiceSemanticProfileV2 } from './contracts';
import {
  checkProductConfidenceGates,
  checkServiceConfidenceGates,
  isValidUnitConfidence,
} from './confidenceGates';

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

describe('isValidUnitConfidence', () => {
  it('accepts values within range at minimum threshold', () => {
    expect(isValidUnitConfidence(PROFILE_CONFIDENCE_MIN, PROFILE_CONFIDENCE_MIN)).toBe(true);
    expect(isValidUnitConfidence(CRITICAL_FIELD_CONFIDENCE_MIN, CRITICAL_FIELD_CONFIDENCE_MIN)).toBe(
      true,
    );
  });

  it('rejects NaN, infinity, negative, and above 1', () => {
    expect(isValidUnitConfidence(Number.NaN, 0)).toBe(false);
    expect(isValidUnitConfidence(Number.POSITIVE_INFINITY, 0)).toBe(false);
    expect(isValidUnitConfidence(Number.NEGATIVE_INFINITY, 0)).toBe(false);
    expect(isValidUnitConfidence(-0.1, 0)).toBe(false);
    expect(isValidUnitConfidence(1.01, 0)).toBe(false);
  });
});

describe('confidenceGates', () => {
  it('rejects NaN overall service confidence', () => {
    expect(checkServiceConfidenceGates(service({ confidence: Number.NaN }))).toBe(
      'SERVICE_PROFILE_LOW_CONFIDENCE',
    );
  });

  it('rejects infinite product confidence', () => {
    expect(checkProductConfidenceGates(product({ confidence: Number.POSITIVE_INFINITY }))).toBe(
      'PRODUCT_PROFILE_LOW_CONFIDENCE',
    );
  });

  it('rejects negative service confidence', () => {
    expect(checkServiceConfidenceGates(service({ confidence: -0.1 }))).toBe(
      'SERVICE_PROFILE_LOW_CONFIDENCE',
    );
  });

  it('rejects confidence above 1', () => {
    expect(checkProductConfidenceGates(product({ confidence: 1.2 }))).toBe(
      'PRODUCT_PROFILE_LOW_CONFIDENCE',
    );
  });

  it('rejects missing critical field confidence', () => {
    expect(
      checkServiceConfidenceGates(service({ fieldConfidence: { targetAreas: 0.85 } })),
    ).toBe('SERVICE_CRITICAL_FIELD_LOW_CONFIDENCE');
  });

  it('rejects critical field confidence above 1', () => {
    expect(
      checkProductConfidenceGates(
        product({ fieldConfidence: { targetAreas: 1.5, retailNeeds: 0.85 } }),
      ),
    ).toBe('PRODUCT_CRITICAL_FIELD_LOW_CONFIDENCE');
  });
});
