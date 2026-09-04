import { describe, expect, it } from 'vitest';

import { mergeProductDualDomainEvidence } from './productDualDomainEvidence';
import type { ProductSemanticProfileAiV2 } from './contracts';

function draft(overrides: Partial<ProductSemanticProfileAiV2> = {}): ProductSemanticProfileAiV2 {
  return {
    targetAreas: ['HAIR'],
    hairLengthSuitability: 'SHORT',
    productFamily: 'BALM',
    benefits: ['HOLD'],
    holdStrength: 'LIGHT',
    finish: 'NATURAL',
    incompatibilities: [],
    retailNeeds: ['UNKNOWN'],
    confidence: 0.7,
    fieldConfidence: { targetAreas: 0.7, retailNeeds: 0.5 },
    evidenceCodes: [],
    warnings: [],
    ...overrides,
  };
}

describe('productDualDomainEvidence', () => {
  it('pomade/clay/wax/paste/gel/fibre → styling + beard shaping, not softening', () => {
    for (const cue of ['pomade', 'clay', 'wax', 'paste', 'gel', 'fibre'] as const) {
      const merged = mergeProductDualDomainEvidence(
        draft({ productFamily: 'POMADE', retailNeeds: ['UNKNOWN'] }),
        {
          name: `Hair and Beard ${cue}`,
          description: `Multi-purpose ${cue} for hair and beard.`,
          category: 'STYLING',
        },
      );
      expect(merged.targetAreas).toEqual(expect.arrayContaining(['HAIR', 'BEARD']));
      expect(merged.retailNeeds).toEqual(
        expect.arrayContaining(['HAIR_STYLING_CONTROL', 'BEARD_SHAPING']),
      );
      expect(merged.retailNeeds).not.toContain('BEARD_SOFTENING');
    }
  });

  it('balm → styling + softening + shaping', () => {
    const merged = mergeProductDualDomainEvidence(draft(), {
      name: 'Hair & Beard Balm',
      description: 'Multi-purpose balm for hair and beard.',
      category: 'STYLING',
    });
    expect(merged.targetAreas).toEqual(expect.arrayContaining(['HAIR', 'BEARD']));
    expect(merged.retailNeeds).toEqual(
      expect.arrayContaining(['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING', 'BEARD_SHAPING']),
    );
    expect(merged.evidenceCodes).toContain('SOURCE_EVIDENCE_HAIR_AND_BEARD_PRODUCT');
    expect(merged.fieldConfidence.retailNeeds).toBeGreaterThanOrEqual(0.85);
  });

  it('oil → softening only from source; preserves valid AI needs; no auto styling/shaping', () => {
    const merged = mergeProductDualDomainEvidence(
      draft({
        productFamily: 'OIL',
        retailNeeds: ['HAIR_STYLING_CONTROL'],
      }),
      {
        name: 'Hair and Beard Oil',
        description: 'Light oil for hair and beard.',
        category: 'CARE',
      },
    );
    expect(merged.targetAreas).toEqual(expect.arrayContaining(['HAIR', 'BEARD']));
    expect(merged.retailNeeds).toContain('BEARD_SOFTENING');
    expect(merged.retailNeeds).toContain('HAIR_STYLING_CONTROL');
    expect(merged.retailNeeds).not.toContain('BEARD_SHAPING');
    // Source does not invent styling — AI need is preserved, not newly inferred as soft+shape.
  });

  it('wash/shampoo/cleanser → cleansing pair only', () => {
    const merged = mergeProductDualDomainEvidence(draft({ productFamily: 'WASH_SHAMPOO' }), {
      name: 'Hair & Beard Wash',
      description: 'Cleansing wash for hair and beard.',
      category: 'WASH',
    });
    expect(merged.targetAreas).toEqual(expect.arrayContaining(['HAIR', 'BEARD']));
    expect(merged.retailNeeds).toEqual(
      expect.arrayContaining(['HAIR_CLEANSING', 'BEARD_CLEANSING']),
    );
    expect(merged.retailNeeds).not.toContain('HAIR_STYLING_CONTROL');
    expect(merged.retailNeeds).not.toContain('BEARD_SHAPING');
  });

  it('conditioner (+ soften language) → conditioning / softening', () => {
    const merged = mergeProductDualDomainEvidence(draft({ productFamily: 'CONDITIONER' }), {
      name: 'Hair & Beard Conditioner',
      description: 'Softening conditioner for hair and beard.',
      category: 'CARE',
    });
    expect(merged.targetAreas).toEqual(expect.arrayContaining(['HAIR', 'BEARD']));
    expect(merged.retailNeeds).toContain('HAIR_CONDITIONING');
    expect(merged.retailNeeds).toContain('BEARD_SOFTENING');
    expect(merged.retailNeeds).not.toContain('HAIR_CLEANSING');
  });

  it('comb/brush/tool → GROOMING_TOOL', () => {
    const merged = mergeProductDualDomainEvidence(draft({ productFamily: 'TOOL' }), {
      name: 'Hair & Beard Comb',
      description: 'Comb for hair and beard.',
      category: 'TOOLS',
    });
    expect(merged.targetAreas).toEqual(expect.arrayContaining(['HAIR', 'BEARD']));
    expect(merged.retailNeeds).toEqual(['GROOMING_TOOL']);
  });

  it('generic cream / dual wording only → no invented known needs; preserves AI needs', () => {
    const unknownOnly = mergeProductDualDomainEvidence(draft({ retailNeeds: ['UNKNOWN'] }), {
      name: 'Hair & Beard Cream',
      description: 'Cream for both hair and beard.',
      category: 'GENERAL',
    });
    expect(unknownOnly.targetAreas).toEqual(expect.arrayContaining(['HAIR', 'BEARD']));
    expect(unknownOnly.retailNeeds).toEqual(['UNKNOWN']);
    expect(unknownOnly.fieldConfidence.retailNeeds).toBe(0.5);

    const withAi = mergeProductDualDomainEvidence(
      draft({ retailNeeds: ['HAIR_CONDITIONING'] }),
      {
        name: 'Beard and Hair Product',
        description: 'For both hair and beard.',
        category: 'GENERAL',
      },
    );
    expect(withAi.targetAreas).toEqual(expect.arrayContaining(['HAIR', 'BEARD']));
    expect(withAi.retailNeeds).toEqual(['HAIR_CONDITIONING']);
    expect(withAi.retailNeeds).not.toContain('HAIR_STYLING_CONTROL');
    expect(withAi.retailNeeds).not.toContain('BEARD_SOFTENING');
    expect(withAi.evidenceCodes).toContain('SOURCE_EVIDENCE_HAIR_AND_BEARD_PRODUCT');
  });

  it('does not invent dual evidence for hair-only products', () => {
    const merged = mergeProductDualDomainEvidence(draft(), {
      name: 'Matte Clay',
      description: 'Strong hold matte clay.',
      category: 'STYLING',
    });
    expect(merged.targetAreas).toEqual(['HAIR']);
    expect(merged.evidenceCodes).not.toContain('SOURCE_EVIDENCE_HAIR_AND_BEARD_PRODUCT');
  });
});
