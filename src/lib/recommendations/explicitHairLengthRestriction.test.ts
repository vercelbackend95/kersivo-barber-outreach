import { describe, expect, it } from 'vitest';

import type { ProductSemanticProfileAiV2 } from './contracts';
import {
  CATALOGUE_HAIR_LENGTH_RESTRICTION_CONFLICT,
  SOURCE_EXPLICIT_LONG_HAIR_ONLY,
  SOURCE_EXPLICIT_SHORT_HAIR_ONLY,
  applyExplicitHairLengthToProductDraft,
  deriveExplicitHairLengthRestriction,
} from './explicitHairLengthRestriction';
import { assertProductSemanticConsistency } from './semanticConsistency';

function productDraft(
  overrides: Partial<ProductSemanticProfileAiV2> = {},
): ProductSemanticProfileAiV2 {
  return {
    targetAreas: ['HAIR'],
    hairLengthSuitability: 'SHORT',
    productFamily: 'CLAY',
    benefits: ['HOLD'],
    holdStrength: 'STRONG',
    finish: 'MATTE',
    incompatibilities: [],
    retailNeeds: ['HAIR_STYLING_CONTROL'],
    confidence: 0.9,
    fieldConfidence: { targetAreas: 0.9, retailNeeds: 0.9 },
    evidenceCodes: [],
    warnings: [],
    ...overrides,
  };
}

describe('deriveExplicitHairLengthRestriction', () => {
  it('A: for short styles → NONE', () => {
    expect(
      deriveExplicitHairLengthRestriction({
        name: 'Northgate Matte Clay',
        description: 'Strong hold matte clay for short styles.',
        category: 'STYLING',
      }),
    ).toBe('NONE');
  });

  it('B: FOR SHORT HAIR ONLY → SHORT_ONLY', () => {
    expect(
      deriveExplicitHairLengthRestriction({
        name: 'Short Hair Clay',
        description: 'FOR SHORT HAIR ONLY strong clay.',
        category: 'STYLING',
      }),
    ).toBe('SHORT_ONLY');
  });

  it('C: For long hair only → LONG_ONLY', () => {
    expect(
      deriveExplicitHairLengthRestriction({
        name: 'Long Hair Repair Shampoo',
        description: 'For long hair only. Rich moisture.',
        category: 'WASH',
      }),
    ).toBe('LONG_ONLY');
  });

  it('D: conflicting short-only and long-only → CONFLICT', () => {
    expect(
      deriveExplicitHairLengthRestriction({
        name: 'Confused Clay',
        description: 'For short hair only. Also for long hair only.',
        category: 'STYLING',
      }),
    ).toBe('CONFLICT');
  });

  it('E: long-lasting hold → NONE', () => {
    expect(
      deriveExplicitHairLengthRestriction({
        name: 'Wax',
        description: 'long-lasting hold',
        category: 'STYLING',
      }),
    ).toBe('NONE');
  });

  it('F: for short and long hair → NONE', () => {
    expect(
      deriveExplicitHairLengthRestriction({
        name: 'Universal',
        description: 'for short and long hair',
        category: 'STYLING',
      }),
    ).toBe('NONE');
  });

  it('G: ideal for long hair → NONE', () => {
    expect(
      deriveExplicitHairLengthRestriction({
        name: 'Serum',
        description: 'ideal for long hair',
        category: 'STYLING',
      }),
    ).toBe('NONE');
  });

  it('category alone never establishes exclusivity', () => {
    expect(
      deriveExplicitHairLengthRestriction({
        name: 'Product',
        description: null,
        category: 'for short hair only',
      }),
    ).toBe('NONE');
  });

  it.each([
    ['exclusively for short hair'],
    ['suitable only for short hair'],
    ['designed only for short hair'],
    ['made only for short hair'],
    ['formulated only for short hair'],
  ])('extended SHORT phrase: %s', (phrase) => {
    expect(
      deriveExplicitHairLengthRestriction({
        name: 'Clay',
        description: phrase,
        category: 'STYLING',
      }),
    ).toBe('SHORT_ONLY');
  });

  it.each([
    ['exclusively for long hair'],
    ['suitable only for long hair'],
    ['designed only for long hair'],
    ['made only for long hair'],
    ['formulated only for long hair'],
  ])('extended LONG phrase: %s', (phrase) => {
    expect(
      deriveExplicitHairLengthRestriction({
        name: 'Shampoo',
        description: phrase,
        category: 'WASH',
      }),
    ).toBe('LONG_ONLY');
  });

  it('not only for short hair → NONE', () => {
    expect(
      deriveExplicitHairLengthRestriction({
        name: 'Clay',
        description: 'not only for short hair',
        category: 'STYLING',
      }),
    ).toBe('NONE');
  });

  it('not only for long hair → NONE', () => {
    expect(
      deriveExplicitHairLengthRestriction({
        name: 'Serum',
        description: 'not only for long hair',
        category: 'STYLING',
      }),
    ).toBe('NONE');
  });

  it('not only for short hair with independent exclusion still SHORT_ONLY', () => {
    expect(
      deriveExplicitHairLengthRestriction({
        name: 'Clay',
        description: 'not only for short hair; not for long hair',
        category: 'STYLING',
      }),
    ).toBe('SHORT_ONLY');
  });

  it.each([
    ['suitable for short hair'],
    ['ideal for long hair'],
    ['works well on short styles'],
  ])('soft preference stays NONE: %s', (phrase) => {
    expect(
      deriveExplicitHairLengthRestriction({
        name: 'Product',
        description: phrase,
        category: 'STYLING',
      }),
    ).toBe('NONE');
  });
});

describe('applyExplicitHairLengthToProductDraft', () => {
  it('A: short styles keeps soft SHORT, strips exclusivity, accepts', () => {
    const applied = applyExplicitHairLengthToProductDraft(
      productDraft({
        hairLengthSuitability: 'SHORT',
        incompatibilities: ['FOR_LONG_HAIR_ONLY'],
      }),
      {
        name: 'Northgate Matte Clay',
        description: 'Strong hold matte clay for short styles.',
        category: 'STYLING',
      },
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.draft.hairLengthSuitability).toBe('SHORT');
    expect(applied.draft.incompatibilities).not.toContain('FOR_SHORT_HAIR_ONLY');
    expect(applied.draft.incompatibilities).not.toContain('FOR_LONG_HAIR_ONLY');
    expect(() => assertProductSemanticConsistency(applied.draft)).not.toThrow();
  });

  it('B: short-only source overrides opposite AI tag', () => {
    const applied = applyExplicitHairLengthToProductDraft(
      productDraft({
        hairLengthSuitability: 'LONG',
        incompatibilities: ['FOR_LONG_HAIR_ONLY'],
      }),
      {
        name: 'Short Hair Clay',
        description: 'FOR SHORT HAIR ONLY strong clay.',
        category: 'STYLING',
      },
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.draft.hairLengthSuitability).toBe('SHORT');
    expect(applied.draft.incompatibilities).toContain('FOR_SHORT_HAIR_ONLY');
    expect(applied.draft.incompatibilities).not.toContain('FOR_LONG_HAIR_ONLY');
    expect(applied.draft.evidenceCodes).toContain(SOURCE_EXPLICIT_SHORT_HAIR_ONLY);
    expect(() => assertProductSemanticConsistency(applied.draft)).not.toThrow();
  });

  it('C: long-only source overrides opposite AI tag', () => {
    const applied = applyExplicitHairLengthToProductDraft(
      productDraft({
        hairLengthSuitability: 'SHORT',
        incompatibilities: ['FOR_SHORT_HAIR_ONLY'],
      }),
      {
        name: 'Long Hair Repair Shampoo',
        description: 'For long hair only. Rich moisture.',
        category: 'WASH',
      },
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.draft.hairLengthSuitability).toBe('LONG');
    expect(applied.draft.incompatibilities).toContain('FOR_LONG_HAIR_ONLY');
    expect(applied.draft.evidenceCodes).toContain(SOURCE_EXPLICIT_LONG_HAIR_ONLY);
    expect(() => assertProductSemanticConsistency(applied.draft)).not.toThrow();
  });

  it('D: conflict fail-closed', () => {
    const applied = applyExplicitHairLengthToProductDraft(productDraft(), {
      name: 'Confused',
      description: 'for short hair only and not for short hair',
      category: 'STYLING',
    });
    expect(applied).toEqual({
      ok: false,
      error: CATALOGUE_HAIR_LENGTH_RESTRICTION_CONFLICT,
    });
  });

  it('H: AI-invented FOR_LONG_HAIR_ONLY without source is stripped', () => {
    const applied = applyExplicitHairLengthToProductDraft(
      productDraft({
        hairLengthSuitability: 'SHORT',
        incompatibilities: ['FOR_LONG_HAIR_ONLY'],
      }),
      {
        name: 'Matte Clay',
        description: 'Strong hold matte clay for short styles.',
        category: 'STYLING',
      },
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.draft.incompatibilities).not.toContain('FOR_LONG_HAIR_ONLY');
    expect(applied.draft.incompatibilities).not.toContain('FOR_SHORT_HAIR_ONLY');
    expect(() => assertProductSemanticConsistency(applied.draft)).not.toThrow();
  });
});
