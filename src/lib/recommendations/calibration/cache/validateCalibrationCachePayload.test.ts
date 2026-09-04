import { describe, expect, it } from 'vitest';

import { PROMPT_VERSION, SCHEMA_VERSION, TAXONOMY_VERSION } from '../../constants';
import { buildProductProfileEnvelope, buildServiceProfileEnvelope } from '../../ai/prompts';
import { mapProductTransportToProfile, mapServiceTransportToProfile } from '../../ai/schemas';
import {
  validateCachedProductProfile,
  validateCachedRerankDecision,
  validateCachedServiceProfile,
} from './validateCalibrationCachePayload';

const MODEL = 'gpt-4o-mini-2024-07-18';

function sampleServiceEnvelope(entityId = 'cal-svc-skin-fade') {
  return buildServiceProfileEnvelope(
    { entityId, shopId: 'calibration-shop', name: 'Fade', description: 'Skin fade', category: 'Hair' },
    mapServiceTransportToProfile({
      targetAreas: ['HAIR'],
      typicalHairLength: 'SHORT',
      techniques: ['SKIN_FADE'],
      outcomes: ['SHAPE_STRUCTURE'],
      aftercareNeeds: ['DAILY_STYLING'],
      incompatibilities: [],
      retailNeeds: ['HAIR_STYLING_CONTROL'],
      confidence: 0.9,
      fieldConfidence: {
        targetAreas: 0.9,
        typicalHairLength: 0.8,
        techniques: 0.85,
        outcomes: 0.7,
        aftercareNeeds: 0.6,
        incompatibilities: 0.5,
        retailNeeds: 0.85,
      },
      evidenceCodes: [],
      warnings: [],
    }),
    MODEL,
  );
}

function sampleProductEnvelope() {
  return buildProductProfileEnvelope(
    {
      entityId: 'cal-prod-matte-clay',
      shopId: 'calibration-shop',
      name: 'Northgate Matte Clay',
      description: 'Strong hold matte clay for short styles.',
      category: 'STYLING',
    },
    mapProductTransportToProfile({
      targetAreas: ['HAIR'],
      hairLengthSuitability: 'SHORT',
      productFamily: 'CLAY',
      benefits: ['HOLD'],
      holdStrength: 'STRONG',
      finish: 'MATTE',
      incompatibilities: [],
      retailNeeds: ['HAIR_STYLING_CONTROL'],
      confidence: 0.9,
      fieldConfidence: {
        targetAreas: 0.9,
        hairLengthSuitability: 0.9,
        productFamily: 0.9,
        benefits: 0.9,
        holdStrength: 0.9,
        finish: 0.9,
        incompatibilities: 0.8,
        retailNeeds: 0.9,
      },
      evidenceCodes: [],
      warnings: [],
    }),
    MODEL,
  );
}

describe('validateCalibrationCachePayload', () => {
  const envelope = sampleServiceEnvelope();
  const cacheKey = {
    entityId: 'cal-svc-skin-fade',
    contentHash: envelope.contentHash,
    modelId: MODEL,
    promptVersion: PROMPT_VERSION,
    taxonomyVersion: TAXONOMY_VERSION,
    schemaVersion: SCHEMA_VERSION,
    operation: 'classify_service' as const,
  };

  it('accepts valid service envelope', () => {
    const result = validateCachedServiceProfile(envelope, cacheKey);
    expect(result.ok).toBe(true);
  });

  it('rejects wrong entity id', () => {
    const result = validateCachedServiceProfile(sampleServiceEnvelope('other'), {
      ...cacheKey,
      entityId: 'cal-svc-skin-fade',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects invalid rerank permutation', () => {
    const result = validateCachedRerankDecision(
      { orderedProductIds: ['a', 'c'], confidence: 0.9 },
      ['a', 'b'],
    );
    expect(result.ok).toBe(false);
  });

  it('accepts valid rerank permutation', () => {
    const result = validateCachedRerankDecision(
      { orderedProductIds: ['b', 'a'], confidence: 0.9 },
      ['a', 'b'],
    );
    expect(result.ok).toBe(true);
  });

  it('rejects malformed product cache shape', () => {
    const result = validateCachedProductProfile(
      { bad: true },
      {
        ...cacheKey,
        entityId: 'cal-prod-matte-clay',
        operation: 'classify_product',
      },
    );
    expect(result.ok).toBe(false);
  });

  it('strips orphan FOR_LONG_HAIR_ONLY without source support and accepts repaired profile', () => {
    const contradictory = {
      ...sampleProductEnvelope(),
      hairLengthSuitability: 'SHORT' as const,
      incompatibilities: ['FOR_LONG_HAIR_ONLY' as const],
    };
    const key = {
      entityId: 'cal-prod-matte-clay',
      contentHash: contradictory.contentHash,
      modelId: MODEL,
      promptVersion: PROMPT_VERSION,
      taxonomyVersion: TAXONOMY_VERSION,
      schemaVersion: SCHEMA_VERSION,
      operation: 'classify_product' as const,
    };
    const result = validateCachedProductProfile(contradictory, key);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.incompatibilities).not.toContain('FOR_LONG_HAIR_ONLY');
      expect(result.profile.hairLengthSuitability).toBe('SHORT');
    }
  });

  it('rejects when source exclusivity conflicts with remaining material constraints', () => {
    const conflicting = {
      ...sampleProductEnvelope(),
      sourceSnapshot: {
        name: 'Confused Clay',
        description: 'For short hair only. For long hair only.',
        category: 'STYLING',
      },
      hairLengthSuitability: 'SHORT' as const,
      incompatibilities: [] as const,
    };
    const key = {
      entityId: 'cal-prod-matte-clay',
      contentHash: conflicting.contentHash,
      modelId: MODEL,
      promptVersion: PROMPT_VERSION,
      taxonomyVersion: TAXONOMY_VERSION,
      schemaVersion: SCHEMA_VERSION,
      operation: 'classify_product' as const,
    };
    const result = validateCachedProductProfile(conflicting, key);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/CACHE_PRODUCT_SOURCE_CONSTRAINT|CATALOGUE_HAIR_LENGTH_RESTRICTION_CONFLICT/);
    }
  });

  it('accepts valid SHORT product without exclusivity conflict', () => {
    const valid = sampleProductEnvelope();
    const key = {
      entityId: 'cal-prod-matte-clay',
      contentHash: valid.contentHash,
      modelId: MODEL,
      promptVersion: PROMPT_VERSION,
      taxonomyVersion: TAXONOMY_VERSION,
      schemaVersion: SCHEMA_VERSION,
      operation: 'classify_product' as const,
    };
    expect(validateCachedProductProfile(valid, key).ok).toBe(true);
  });

  it('does not accept old prompt-version metadata against current key', () => {
    const valid = sampleProductEnvelope();
    const key = {
      entityId: 'cal-prod-matte-clay',
      contentHash: valid.contentHash,
      modelId: MODEL,
      promptVersion: '2026-09-v4',
      taxonomyVersion: TAXONOMY_VERSION,
      schemaVersion: SCHEMA_VERSION,
      operation: 'classify_product' as const,
    };
    const result = validateCachedProductProfile(valid, key);
    expect(result.ok).toBe(false);
  });
});
