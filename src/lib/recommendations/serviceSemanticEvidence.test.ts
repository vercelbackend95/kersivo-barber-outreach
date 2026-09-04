import { describe, expect, it } from 'vitest';

import { SOURCE_EVIDENCE_CONFIDENCE } from './constants';
import {
  inferServiceSemanticEvidence,
  mergeServiceSemanticEvidence,
  normalizeServiceSourceText,
} from './serviceSemanticEvidence';

describe('normalizeServiceSourceText', () => {
  it('preserves & and + as and/plus before punctuation collapse', () => {
    expect(
      normalizeServiceSourceText({
        name: 'Haircut & Beard',
        description: null,
        category: null,
      }),
    ).toBe('haircut and beard');
    expect(
      normalizeServiceSourceText({
        name: 'Haircut + Beard',
        description: '',
        category: null,
      }),
    ).toBe('haircut plus beard');
  });
});

describe('inferServiceSemanticEvidence — name-only connectors', () => {
  const nameOnly = (name: string) =>
    inferServiceSemanticEvidence({ name, description: null, category: null });

  it.each([
    ['Haircut & Beard'],
    ['Haircut and Beard'],
    ['Haircut + Beard'],
    ['Hair Cut & Beard'],
  ])('%s → HAIR+BEARD with styling and beard needs', (name) => {
    const inference = nameOnly(name);
    expect(inference).not.toBeNull();
    expect(inference?.targetAreas).toEqual(['HAIR', 'BEARD']);
    expect(inference?.retailNeeds).toEqual([
      'HAIR_STYLING_CONTROL',
      'BEARD_SOFTENING',
      'BEARD_SHAPING',
    ]);
    expect(inference?.evidenceCodes).toContain('SOURCE_EVIDENCE_HAIRCUT_BEARD');
  });

  it('Cut & Finish name-only → HAIR styling', () => {
    const inference = nameOnly('Cut & Finish');
    expect(inference).not.toBeNull();
    expect(inference?.targetAreas).toEqual(['HAIR']);
    expect(inference?.retailNeeds).toEqual(['HAIR_STYLING_CONTROL']);
    expect(inference?.evidenceCodes).toContain('SOURCE_EVIDENCE_GENERIC_HAIRCUT');
  });
});

describe('inferServiceSemanticEvidence — compositional', () => {
  it('Generic Haircut → HAIR + styling', () => {
    const inference = inferServiceSemanticEvidence({
      name: 'Haircut',
      description: null,
      category: null,
    });
    expect(inference?.targetAreas).toEqual(['HAIR']);
    expect(inference?.retailNeeds).toEqual(['HAIR_STYLING_CONTROL']);
  });

  it('Buzz Cut alone may mark HAIR but must not invent styling needs', () => {
    const inference = inferServiceSemanticEvidence({
      name: 'Buzz Cut',
      description: null,
      category: null,
    });
    expect(inference).not.toBeNull();
    expect(inference?.targetAreas).toEqual(['HAIR']);
    expect(inference?.retailNeeds).toEqual([]);
    expect(inference?.evidenceCodes).toEqual(['SOURCE_EVIDENCE_BUZZ_HEAD_BALD_AREA']);
    expect(inference?.fieldConfidence.targetAreas).toBe(SOURCE_EVIDENCE_CONFIDENCE);
    expect(inference?.fieldConfidence.retailNeeds).toBeUndefined();
  });

  it('Buzz Cut & Beard Trim keeps beard needs without hair styling', () => {
    const inference = inferServiceSemanticEvidence({
      name: 'Buzz Cut & Beard Trim',
      description: null,
      category: null,
    });
    expect(inference?.targetAreas).toEqual(['HAIR', 'BEARD']);
    expect(inference?.retailNeeds).toEqual(['BEARD_SOFTENING', 'BEARD_SHAPING']);
    expect(inference?.retailNeeds).not.toContain('HAIR_STYLING_CONTROL');
    expect(inference?.evidenceCodes).toEqual([
      'SOURCE_EVIDENCE_BEARD_TRIM',
      'SOURCE_EVIDENCE_BUZZ_HEAD_BALD_AREA',
    ]);
  });

  it('Head Shave & Beard Trim preserves beard evidence', () => {
    const inference = inferServiceSemanticEvidence({
      name: 'Head Shave & Beard Trim',
      description: null,
      category: null,
    });
    expect(inference?.targetAreas).toEqual(['HAIR', 'BEARD']);
    expect(inference?.retailNeeds).toEqual(['BEARD_SOFTENING', 'BEARD_SHAPING']);
    expect(inference?.evidenceCodes).toContain('SOURCE_EVIDENCE_BEARD_TRIM');
    expect(inference?.evidenceCodes).toContain('SOURCE_EVIDENCE_BUZZ_HEAD_BALD_AREA');
  });

  it('Haircut & Hot Towel Shave unions haircut and shave evidence', () => {
    const inference = inferServiceSemanticEvidence({
      name: 'Haircut & Hot Towel Shave',
      description: null,
      category: null,
    });
    expect(inference?.targetAreas).toEqual(['HAIR', 'FACE', 'SHAVE']);
    expect(inference?.retailNeeds).toEqual([
      'HAIR_STYLING_CONTROL',
      'SHAVE_PREPARATION',
      'POST_SHAVE_SOOTHING',
    ]);
    expect(inference?.evidenceCodes).toEqual([
      'SOURCE_EVIDENCE_GENERIC_HAIRCUT',
      'SOURCE_EVIDENCE_HOT_SHAVE',
    ]);
  });

  it('Scalp Treatment & Haircut unions scalp and haircut evidence', () => {
    const inference = inferServiceSemanticEvidence({
      name: 'Scalp Treatment & Haircut',
      description: null,
      category: null,
    });
    expect(inference?.targetAreas).toEqual(['HAIR', 'SCALP']);
    expect(inference?.retailNeeds).toEqual(['HAIR_STYLING_CONTROL', 'SCALP_CARE']);
    expect(inference?.evidenceCodes).toEqual([
      'SOURCE_EVIDENCE_GENERIC_HAIRCUT',
      'SOURCE_EVIDENCE_SCALP',
    ]);
  });

  it('dedupes areas/needs and keeps deterministic ordering for reordered wording', () => {
    const a = inferServiceSemanticEvidence({
      name: 'Haircut and Beard Trim',
      description: null,
      category: null,
    });
    const b = inferServiceSemanticEvidence({
      name: 'Beard Trim and Haircut',
      description: null,
      category: null,
    });
    expect(a?.targetAreas).toEqual(b?.targetAreas);
    expect(a?.retailNeeds).toEqual(b?.retailNeeds);
    expect(a?.targetAreas).toEqual(['HAIR', 'BEARD']);
    expect(new Set(a?.retailNeeds).size).toBe(a?.retailNeeds.length);
  });

  it('does not turn empty component set into UNKNOWN wildcard needs', () => {
    expect(
      inferServiceSemanticEvidence({
        name: 'Premium Package',
        description: null,
        category: null,
      }),
    ).toBeNull();
  });
});

describe('mergeServiceSemanticEvidence', () => {
  it('does not invent retail needs when only buzz area evidence exists', () => {
    const merged = mergeServiceSemanticEvidence(
      {
        targetAreas: ['UNKNOWN'],
        typicalHairLength: 'UNKNOWN',
        techniques: ['UNKNOWN'],
        outcomes: ['UNKNOWN'],
        aftercareNeeds: ['UNKNOWN'],
        incompatibilities: [],
        retailNeeds: ['UNKNOWN'],
        confidence: 0.7,
        fieldConfidence: { targetAreas: 0.4, retailNeeds: 0.4 },
        evidenceCodes: [],
        warnings: [],
      },
      { name: 'Buzz Cut', description: null, category: null },
    );
    expect(merged.targetAreas).toEqual(['HAIR']);
    expect(merged.retailNeeds).toEqual(['UNKNOWN']);
    expect(merged.fieldConfidence.retailNeeds).toBe(0.4);
    expect(merged.confidence).toBe(0.7);
  });
});
