import { describe, expect, it } from 'vitest';

import { normalizeServiceAiDraft } from './ai/prompts';
import { stripProductOnlyServiceIncompatibilities } from './serviceIncompatibilitySanitize';
import type { ServiceSemanticProfileAiV2 } from './contracts';

describe('serviceIncompatibilitySanitize', () => {
  it('strips product-only tags and keeps UNKNOWN when empty', () => {
    expect(
      stripProductOnlyServiceIncompatibilities([
        'FOR_LONG_HAIR_ONLY',
        'HAIR_ONLY',
        'NOT_FOR_BEARD',
      ]),
    ).toEqual(['UNKNOWN']);
  });

  it('Skin Fade draft with AI FOR_LONG_HAIR_ONLY is stripped; length/areas/needs unchanged', () => {
    const draft: ServiceSemanticProfileAiV2 = {
      targetAreas: ['HAIR'],
      typicalHairLength: 'SHORT',
      techniques: ['SKIN_FADE'],
      outcomes: ['NEAT_FINISH'],
      aftercareNeeds: ['DAILY_STYLING'],
      incompatibilities: ['FOR_LONG_HAIR_ONLY'],
      retailNeeds: ['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION'],
      confidence: 0.9,
      fieldConfidence: { targetAreas: 0.9, retailNeeds: 0.9 },
      evidenceCodes: [],
      warnings: [],
    };
    const normalized = normalizeServiceAiDraft(draft);
    expect(normalized.incompatibilities).toEqual(['UNKNOWN']);
    expect(normalized.typicalHairLength).toBe('SHORT');
    expect(normalized.targetAreas).toEqual(['HAIR']);
    expect(normalized.retailNeeds).toEqual(['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION']);
  });
});
