import { beforeEach, describe, expect, it, vi } from 'vitest';

const parse = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        parse: (...args: unknown[]) => parse(...args),
      },
    },
  })),
}));

vi.mock('./operationLimits', () => ({
  RECOMMENDATION_OPERATION_LIMITS: {
    classifyService: { conservativeInputTokens: 1800, maxOutputTokens: 1111 },
    classifyProduct: { conservativeInputTokens: 1800, maxOutputTokens: 2222 },
    rerank: { conservativeInputTokens: 2500, maxOutputTokens: 3333 },
  },
}));

import OpenAI from 'openai';
import {
  classifyProductEntity,
  classifyServiceEntity,
  rerankEligibleCandidates,
} from './classify';

const SERVICE_ENTITY = {
  id: 'svc-1',
  name: 'Skin Fade',
  description: 'Fade',
  category: 'cuts',
};

const PRODUCT_ENTITY = {
  id: 'prod-1',
  name: 'Matte Clay',
  description: 'Strong hold clay',
  category: 'styling',
};

const SERVICE_FIELD_CONFIDENCE = {
  targetAreas: 0.9,
  typicalHairLength: 0.8,
  techniques: 0.85,
  outcomes: 0.7,
  aftercareNeeds: 0.6,
  incompatibilities: 0.5,
  retailNeeds: 0.85,
};

const PRODUCT_FIELD_CONFIDENCE = {
  targetAreas: 0.9,
  hairLengthSuitability: 0.8,
  productFamily: 0.85,
  benefits: 0.7,
  holdStrength: 0.9,
  finish: 0.8,
  incompatibilities: 0.5,
  retailNeeds: 0.85,
};

function mockParseSuccess(data: Record<string, unknown>) {
  parse.mockResolvedValueOnce({
    choices: [{ message: { parsed: data, refusal: null } }],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
  });
}

describe('RECOMMENDATION_OPERATION_LIMITS wiring', () => {
  beforeEach(() => {
    parse.mockReset();
  });

  it('classifyServiceEntity uses classifyService maxOutputTokens', async () => {
    mockParseSuccess({
      targetAreas: ['HAIR'],
      typicalHairLength: 'SHORT',
      techniques: ['SKIN_FADE'],
      outcomes: ['SHAPE_STRUCTURE'],
      aftercareNeeds: ['DAILY_STYLING'],
      incompatibilities: [],
      retailNeeds: ['HAIR_STYLING_CONTROL'],
      confidence: 0.9,
      fieldConfidence: SERVICE_FIELD_CONFIDENCE,
      evidenceCodes: [],
      warnings: [],
    });

    const client = new OpenAI({ apiKey: 'test' });
    await classifyServiceEntity(client, SERVICE_ENTITY);
    expect(parse).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 1111 }));
  });

  it('classifyProductEntity uses classifyProduct maxOutputTokens', async () => {
    mockParseSuccess({
      targetAreas: ['HAIR'],
      hairLengthSuitability: 'SHORT',
      productFamily: 'CLAY',
      benefits: ['HOLD'],
      holdStrength: 'STRONG',
      finish: 'MATTE',
      incompatibilities: [],
      retailNeeds: ['HAIR_STYLING_CONTROL'],
      confidence: 0.9,
      fieldConfidence: PRODUCT_FIELD_CONFIDENCE,
      evidenceCodes: [],
      warnings: [],
    });

    const client = new OpenAI({ apiKey: 'test' });
    await classifyProductEntity(client, PRODUCT_ENTITY);
    expect(parse).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 2222 }));
  });

  it('rerankEligibleCandidates uses rerank maxOutputTokens', async () => {
    mockParseSuccess({
      schemaVersion: '1',
      serviceId: 'svc-1',
      orderedProductIds: ['prod-1'],
      confidence: 0.9,
      evidenceCodes: [],
      warnings: [],
    });

    const client = new OpenAI({ apiKey: 'test' });
    await rerankEligibleCandidates(
      client,
      'svc-1',
      { targetAreas: ['HAIR'] },
      [{ id: 'prod-1', summary: { family: 'CLAY' } }],
    );
    expect(parse).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 3333 }));
  });
});
