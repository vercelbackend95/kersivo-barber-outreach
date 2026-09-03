import { describe, expect, it } from 'vitest';

import { PROMPT_VERSION, SCHEMA_VERSION, TAXONOMY_VERSION } from './constants';
import { buildServiceProfileEnvelope, CLASSIFIER_PROMPT_VERSION } from './ai/prompts';
import type { ServiceSemanticProfileAiV2 } from './contracts';

const validServiceAi: ServiceSemanticProfileAiV2 = {
  targetAreas: ['HAIR'],
  typicalHairLength: 'SHORT',
  techniques: ['BUZZ_CUT'],
  outcomes: ['NEAT_FINISH'],
  aftercareNeeds: [],
  incompatibilities: [],
  retailNeeds: ['UNKNOWN'],
  confidence: 0.88,
  fieldConfidence: { targetAreas: 0.9, retailNeeds: 0.85 },
  evidenceCodes: [],
  warnings: [],
};

describe('recommendations/constants', () => {
  it('exports PROMPT_VERSION v4 with unchanged taxonomy and schema versions', () => {
    expect(PROMPT_VERSION).toBe('2026-09-v4');
    expect(TAXONOMY_VERSION).toBe('2026-09-v2');
    expect(SCHEMA_VERSION).toBe('2');
    expect(CLASSIFIER_PROMPT_VERSION).toBe(PROMPT_VERSION);
  });

  it('stamps profile envelopes with the current classifier prompt version', () => {
    const envelope = buildServiceProfileEnvelope(
      {
        entityId: 'svc-buzz',
        shopId: 'shop-1',
        name: 'Buzz Cut',
        description: 'Uniform clipper cut',
        category: 'cuts',
      },
      validServiceAi,
      'gpt-4o-mini',
    );
    expect(envelope.promptVersion).toBe('2026-09-v4');
  });
});
