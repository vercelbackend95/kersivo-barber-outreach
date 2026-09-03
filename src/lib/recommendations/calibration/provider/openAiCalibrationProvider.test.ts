import { describe, expect, it, vi } from 'vitest';

import { createOpenAiCalibrationProvider } from './openAiCalibrationProvider';

const FULL_FIELD_CONFIDENCE = {
  targetAreas: 0.9,
  typicalHairLength: 0.8,
  techniques: 0.85,
  outcomes: 0.7,
  aftercareNeeds: 0.6,
  incompatibilities: 0.5,
  retailNeeds: 0.85,
};

describe('createOpenAiCalibrationProvider', () => {
  it('captures call-local usage without external onUsage callback', async () => {
    const client = {
      chat: {
        completions: {
          parse: vi.fn().mockResolvedValue({
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            choices: [{
              message: {
                parsed: {
                  targetAreas: ['HAIR'],
                  typicalHairLength: 'SHORT',
                  techniques: ['SKIN_FADE'],
                  outcomes: ['SHAPE_STRUCTURE'],
                  aftercareNeeds: ['DAILY_STYLING'],
                  incompatibilities: [],
                  retailNeeds: ['HAIR_STYLING_CONTROL'],
                  confidence: 0.9,
                  fieldConfidence: FULL_FIELD_CONFIDENCE,
                  evidenceCodes: [],
                  warnings: [],
                },
              },
            }],
          }),
        },
      },
    };

    const provider = createOpenAiCalibrationProvider({
      client: client as never,
      modelId: 'gpt-4o-mini-2024-07-18',
    });

    const result = await provider.classifyService({
      id: 'svc-1',
      name: 'Fade',
      description: 'Skin fade',
      category: 'Hair',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.usage?.usageKnown).toBe(true);
      if (result.usage?.usageKnown) {
        expect(result.usage.promptTokens).toBe(10);
      }
    }
  });

  it('does not leak usage from one call into the next', async () => {
    let callIndex = 0;
    const client = {
      chat: {
        completions: {
          parse: vi.fn().mockImplementation(async () => {
            callIndex += 1;
            return {
              usage: { prompt_tokens: callIndex * 10, completion_tokens: 5, total_tokens: callIndex * 10 + 5 },
              choices: [{
                message: {
                  parsed: callIndex === 1
                    ? {
                        targetAreas: ['HAIR'],
                        typicalHairLength: 'SHORT',
                        techniques: ['SKIN_FADE'],
                        outcomes: ['SHAPE_STRUCTURE'],
                        aftercareNeeds: ['DAILY_STYLING'],
                        incompatibilities: [],
                        retailNeeds: ['HAIR_STYLING_CONTROL'],
                        confidence: 0.9,
                        fieldConfidence: FULL_FIELD_CONFIDENCE,
                        evidenceCodes: [],
                        warnings: [],
                      }
                    : {
                        targetAreas: ['HAIR'],
                        hairLengthSuitability: 'SHORT',
                        productFamily: 'CLAY',
                        benefits: ['HOLD'],
                        holdStrength: 'STRONG',
                        finish: 'MATTE',
                        incompatibilities: [],
                        retailNeeds: ['HAIR_STYLING_CONTROL'],
                        confidence: 0.85,
                        fieldConfidence: {
                          targetAreas: 0.9,
                          hairLengthSuitability: 0.8,
                          productFamily: 0.85,
                          benefits: 0.7,
                          holdStrength: 0.9,
                          finish: 0.8,
                          incompatibilities: 0.5,
                          retailNeeds: 0.85,
                        },
                        evidenceCodes: [],
                        warnings: [],
                      },
                },
              }],
            };
          }),
        },
      },
    };

    const provider = createOpenAiCalibrationProvider({
      client: client as never,
      modelId: 'gpt-4o-mini-2024-07-18',
    });

    const first = await provider.classifyService({ id: 's1', name: 'S', description: 'd', category: 'c' });
    const second = await provider.classifyProduct({ id: 'p1', name: 'P', description: 'd', category: 'c' });

    expect(first.usage?.usageKnown).toBe(true);
    expect(second.usage?.usageKnown).toBe(true);
    if (first.usage?.usageKnown && second.usage?.usageKnown) {
      expect(first.usage.promptTokens).toBe(10);
      expect(second.usage.promptTokens).toBe(20);
    }
  });

  it('returns usage on billed failure responses', async () => {
    const client = {
      chat: {
        completions: {
          parse: vi.fn().mockResolvedValue({
            usage: { prompt_tokens: 8, completion_tokens: 0, total_tokens: 8 },
            choices: [{ message: { refusal: 'no' } }],
          }),
        },
      },
    };

    const provider = createOpenAiCalibrationProvider({
      client: client as never,
      modelId: 'gpt-4o-mini-2024-07-18',
    });

    const result = await provider.classifyService({ id: 's1', name: 'S', description: 'd', category: 'c' });
    expect(result.ok).toBe(false);
    expect(result.usage?.usageKnown).toBe(true);
  });
});
