import { describe, expect, it } from 'vitest';

import { PROMPT_VERSION, SCHEMA_VERSION, TAXONOMY_VERSION } from '../../constants';
import { buildServiceProfileEnvelope } from '../../ai/prompts';
import { mapServiceTransportToProfile } from '../../ai/schemas';
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
    const result = validateCachedProductProfile({ bad: true }, {
      ...cacheKey,
      entityId: 'cal-prod-matte-clay',
      operation: 'classify_product',
    });
    expect(result.ok).toBe(false);
  });
});
