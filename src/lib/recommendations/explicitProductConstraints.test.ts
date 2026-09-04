import { describe, expect, it } from 'vitest';

import {
  applyExplicitProductConstraintsToDraft,
  CATALOGUE_PRODUCT_CONSTRAINT_CONFLICT,
  SOURCE_EXPLICIT_BEARD_ONLY,
  SOURCE_EXPLICIT_NOT_FOR_BEARD,
} from './explicitProductConstraints';
import type { ProductSemanticProfileAiV2 } from './contracts';

function draft(overrides: Partial<ProductSemanticProfileAiV2> = {}): ProductSemanticProfileAiV2 {
  return {
    targetAreas: ['BEARD'],
    hairLengthSuitability: 'NOT_APPLICABLE',
    productFamily: 'OIL',
    benefits: ['BEARD_SOFTENING'],
    holdStrength: 'NONE',
    finish: 'NATURAL',
    incompatibilities: [],
    retailNeeds: ['BEARD_SOFTENING'],
    confidence: 0.9,
    fieldConfidence: { targetAreas: 0.9, retailNeeds: 0.9 },
    evidenceCodes: [],
    warnings: [],
    ...overrides,
  };
}

describe('explicitProductConstraints', () => {
  it('1. Hair and beard + not for beard → conflict', () => {
    const result = applyExplicitProductConstraintsToDraft(draft(), {
      name: 'Confused Balm',
      description: 'For hair and beard. Do not use on beard.',
      category: 'STYLING',
    });
    expect(result).toEqual({ ok: false, error: CATALOGUE_PRODUCT_CONSTRAINT_CONFLICT });
  });

  it('2. For beard only + not for beard → conflict', () => {
    const result = applyExplicitProductConstraintsToDraft(draft(), {
      name: 'Confused',
      description: 'For beard only; not for beard use.',
      category: 'BEARD',
    });
    expect(result).toEqual({ ok: false, error: CATALOGUE_PRODUCT_CONSTRAINT_CONFLICT });
  });

  it('3. Negation alone → no BEARD_ONLY / HAIR_ONLY', () => {
    const beard = applyExplicitProductConstraintsToDraft(draft(), {
      name: 'Versatile Oil',
      description: 'Not only for beard — works on hair too.',
      category: 'BEARD',
    });
    expect(beard.ok).toBe(true);
    if (!beard.ok) return;
    expect(beard.draft.incompatibilities).not.toContain('BEARD_ONLY');

    const hair = applyExplicitProductConstraintsToDraft(
      draft({ targetAreas: ['HAIR'], retailNeeds: ['HAIR_STYLING_CONTROL'] }),
      {
        name: 'Flexible Clay',
        description: 'Not only for hair. Not just for hair either.',
        category: 'STYLING',
      },
    );
    expect(hair.ok).toBe(true);
    if (!hair.ok) return;
    expect(hair.draft.incompatibilities).not.toContain('HAIR_ONLY');
  });

  it('4. Negation + independent exclusivity → only-tag still applies', () => {
    const beard = applyExplicitProductConstraintsToDraft(draft(), {
      name: 'Beard Oil',
      description: 'Not only for beard use in winter. Exclusively for beard year-round.',
      category: 'BEARD',
    });
    expect(beard.ok).toBe(true);
    if (!beard.ok) return;
    expect(beard.draft.incompatibilities).toContain('BEARD_ONLY');
    expect(beard.draft.evidenceCodes).toContain(SOURCE_EXPLICIT_BEARD_ONLY);

    const hair = applyExplicitProductConstraintsToDraft(
      draft({ targetAreas: ['HAIR'], retailNeeds: ['HAIR_STYLING_CONTROL'] }),
      {
        name: 'Hair Clay',
        description: 'Not just for hair styling demos. Designed exclusively for hair.',
        category: 'STYLING',
      },
    );
    expect(hair.ok).toBe(true);
    if (!hair.ok) return;
    expect(hair.draft.incompatibilities).toContain('HAIR_ONLY');
  });

  it('5. Hair & Beard Balm with no negative wording → no hard restriction', () => {
    const result = applyExplicitProductConstraintsToDraft(
      draft({
        targetAreas: ['HAIR', 'BEARD'],
        retailNeeds: ['HAIR_STYLING_CONTROL', 'BEARD_SOFTENING'],
        incompatibilities: ['HAIR_ONLY', 'BEARD_ONLY', 'NOT_FOR_BEARD'],
      }),
      {
        name: 'Hair & Beard Balm',
        description: 'Multi-purpose balm for hair and beard.',
        category: 'STYLING',
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.incompatibilities).toEqual([]);
  });

  it('6. Beard Oil with AI NOT_FOR_BEARD → AI tag stripped', () => {
    const result = applyExplicitProductConstraintsToDraft(
      draft({ incompatibilities: ['NOT_FOR_BEARD'] }),
      { name: 'Beard Oil', description: 'Softening beard oil.', category: 'BEARD' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.incompatibilities).not.toContain('NOT_FOR_BEARD');
  });

  it('7. Explicit not for beard use → NOT_FOR_BEARD retained with evidence', () => {
    const result = applyExplicitProductConstraintsToDraft(
      draft({ targetAreas: ['HAIR'], retailNeeds: ['HAIR_STYLING_CONTROL'] }),
      { name: 'Clay', description: 'Not for beard use.', category: 'STYLING' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.incompatibilities).toContain('NOT_FOR_BEARD');
    expect(result.draft.evidenceCodes).toContain(SOURCE_EXPLICIT_NOT_FOR_BEARD);
  });

  it('derives BEARD_ONLY from Beard exclusive oil', () => {
    const result = applyExplicitProductConstraintsToDraft(draft(), {
      name: 'Beard Only Oil',
      description: 'Beard exclusive oil.',
      category: 'BEARD',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.incompatibilities).toContain('BEARD_ONLY');
    expect(result.draft.evidenceCodes).toContain(SOURCE_EXPLICIT_BEARD_ONLY);
  });

  it('strips AI NOT_FOR_SHAVE from Shave Cream without source support', () => {
    const result = applyExplicitProductConstraintsToDraft(
      draft({
        targetAreas: ['SHAVE'],
        retailNeeds: ['SHAVE_PREPARATION'],
        incompatibilities: ['NOT_FOR_SHAVE'],
      }),
      { name: 'Shave Cream', description: 'Rich lather shave cream.', category: 'SHAVE' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.incompatibilities).not.toContain('NOT_FOR_SHAVE');
  });

  it('does not auto POST_SHAVE_ONLY from Post-Shave Balm name alone', () => {
    const result = applyExplicitProductConstraintsToDraft(
      draft({
        targetAreas: ['FACE', 'SHAVE'],
        retailNeeds: ['POST_SHAVE_SOOTHING'],
      }),
      { name: 'Post-Shave Balm', description: 'Soothing aftershave balm.', category: 'SHAVE' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.incompatibilities).not.toContain('POST_SHAVE_ONLY');
  });
});
