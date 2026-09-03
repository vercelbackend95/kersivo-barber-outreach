import { describe, expect, it } from 'vitest';

import {
  mapProductTransportToProfile,
  mapServiceTransportToProfile,
  productClassificationTransportSchema,
  rerankTransportSchema,
  serviceClassificationTransportSchema,
} from './schemas';

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

function validServiceTransport(overrides: Record<string, unknown> = {}) {
  return {
    targetAreas: ['HAIR'],
    typicalHairLength: 'SHORT',
    techniques: ['SKIN_FADE'],
    outcomes: ['SHAPE_STRUCTURE'],
    aftercareNeeds: ['DAILY_STYLING'],
    incompatibilities: [],
    retailNeeds: ['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION'],
    confidence: 0.9,
    fieldConfidence: SERVICE_FIELD_CONFIDENCE,
    evidenceCodes: ['NAME'],
    warnings: [],
    ...overrides,
  };
}

function validProductTransport(overrides: Record<string, unknown> = {}) {
  return {
    targetAreas: ['HAIR'],
    hairLengthSuitability: 'SHORT',
    productFamily: 'CLAY',
    benefits: ['HOLD'],
    holdStrength: 'STRONG',
    finish: 'MATTE',
    incompatibilities: [],
    retailNeeds: ['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION'],
    confidence: 0.85,
    fieldConfidence: PRODUCT_FIELD_CONFIDENCE,
    evidenceCodes: ['NAME'],
    warnings: [],
    ...overrides,
  };
}

function validRerankTransport(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: '1',
    serviceId: 'svc-1',
    orderedProductIds: ['prod-a', 'prod-b'],
    confidence: 0.7,
    evidenceCodes: [],
    warnings: [],
    ...overrides,
  };
}

describe('serviceClassificationTransportSchema', () => {
  it('accepts valid service transport', () => {
    expect(serviceClassificationTransportSchema.safeParse(validServiceTransport()).success).toBe(true);
  });

  it('rejects additional properties', () => {
    expect(
      serviceClassificationTransportSchema.safeParse(validServiceTransport({ extra: true })).success,
    ).toBe(false);
  });

  it('rejects missing required fields', () => {
    const { confidence: _confidence, ...incomplete } = validServiceTransport();
    expect(serviceClassificationTransportSchema.safeParse(incomplete).success).toBe(false);
  });

  it('rejects invalid enum COLOR_TREATED', () => {
    expect(
      serviceClassificationTransportSchema.safeParse(
        validServiceTransport({ incompatibilities: ['COLOR_TREATED'] }),
      ).success,
    ).toBe(false);
  });

  it('rejects confidence below 0', () => {
    expect(
      serviceClassificationTransportSchema.safeParse(validServiceTransport({ confidence: -0.1 }))
        .success,
    ).toBe(false);
  });

  it('rejects confidence above 1', () => {
    expect(
      serviceClassificationTransportSchema.safeParse(validServiceTransport({ confidence: 1.1 }))
        .success,
    ).toBe(false);
  });

  it('rejects missing retailNeeds', () => {
    const { retailNeeds: _retailNeeds, ...withoutRetailNeeds } = validServiceTransport();
    expect(serviceClassificationTransportSchema.safeParse(withoutRetailNeeds).success).toBe(false);
  });

  it('rejects invalid retail need enum', () => {
    expect(
      serviceClassificationTransportSchema.safeParse(
        validServiceTransport({ retailNeeds: ['COLOR_TREATED'] }),
      ).success,
    ).toBe(false);
  });

  it('maps transport retail needs through canonicalizer', () => {
    const mapped = mapServiceTransportToProfile(
      serviceClassificationTransportSchema.parse(
        validServiceTransport({
          retailNeeds: ['UNKNOWN', 'HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION'],
        }),
      ),
    );
    expect(mapped.retailNeeds).toEqual(['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION']);
  });
});

describe('productClassificationTransportSchema', () => {
  it('accepts valid product transport', () => {
    expect(productClassificationTransportSchema.safeParse(validProductTransport()).success).toBe(true);
  });

  it('rejects additional properties', () => {
    expect(
      productClassificationTransportSchema.safeParse(validProductTransport({ extra: true })).success,
    ).toBe(false);
  });

  it('rejects missing required fields', () => {
    const { confidence: _confidence, ...incomplete } = validProductTransport();
    expect(productClassificationTransportSchema.safeParse(incomplete).success).toBe(false);
  });

  it('rejects invalid enum COLOR_TREATED', () => {
    expect(
      productClassificationTransportSchema.safeParse(
        validProductTransport({ incompatibilities: ['COLOR_TREATED'] }),
      ).success,
    ).toBe(false);
  });

  it('rejects confidence below 0', () => {
    expect(
      productClassificationTransportSchema.safeParse(validProductTransport({ confidence: -0.1 }))
        .success,
    ).toBe(false);
  });

  it('rejects confidence above 1', () => {
    expect(
      productClassificationTransportSchema.safeParse(validProductTransport({ confidence: 1.1 }))
        .success,
    ).toBe(false);
  });

  it('rejects missing retailNeeds', () => {
    const { retailNeeds: _retailNeeds, ...withoutRetailNeeds } = validProductTransport();
    expect(productClassificationTransportSchema.safeParse(withoutRetailNeeds).success).toBe(false);
  });

  it('rejects invalid retail need enum', () => {
    expect(
      productClassificationTransportSchema.safeParse(
        validProductTransport({ retailNeeds: ['COLOR_TREATED'] }),
      ).success,
    ).toBe(false);
  });

  it('maps transport retail needs through canonicalizer', () => {
    const mapped = mapProductTransportToProfile(
      productClassificationTransportSchema.parse(
        validProductTransport({
          retailNeeds: ['UNKNOWN', 'HAIR_STYLING_CONTROL'],
        }),
      ),
    );
    expect(mapped.retailNeeds).toEqual(['HAIR_STYLING_CONTROL']);
  });
});

describe('rerankTransportSchema', () => {
  it('accepts valid rerank transport', () => {
    expect(rerankTransportSchema.safeParse(validRerankTransport()).success).toBe(true);
  });

  it('rejects additional properties', () => {
    expect(rerankTransportSchema.safeParse(validRerankTransport({ extra: true })).success).toBe(
      false,
    );
  });

  it('rejects missing required fields', () => {
    const { confidence: _confidence, ...incomplete } = validRerankTransport();
    expect(rerankTransportSchema.safeParse(incomplete).success).toBe(false);
  });

  it('rejects invalid schemaVersion', () => {
    expect(
      rerankTransportSchema.safeParse(validRerankTransport({ schemaVersion: '2' })).success,
    ).toBe(false);
  });

  it('rejects confidence below 0', () => {
    expect(rerankTransportSchema.safeParse(validRerankTransport({ confidence: -0.1 })).success).toBe(
      false,
    );
  });

  it('rejects confidence above 1', () => {
    expect(rerankTransportSchema.safeParse(validRerankTransport({ confidence: 1.1 })).success).toBe(
      false,
    );
  });
});
