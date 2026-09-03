import { describe, expect, it } from 'vitest';

import { RETAIL_NEED_DEFINITIONS, RETAIL_NEEDS, type RetailNeed } from './taxonomy';
import { canonicalizeRetailNeeds } from './retailNeeds';

describe('RETAIL_NEED_DEFINITIONS', () => {
  it('defines every retail need exactly once', () => {
    for (const need of RETAIL_NEEDS) {
      expect(RETAIL_NEED_DEFINITIONS[need]).toMatch(/\S/);
    }
    expect(Object.keys(RETAIL_NEED_DEFINITIONS).sort()).toEqual([...RETAIL_NEEDS].sort());
  });
});

describe('canonicalizeRetailNeeds', () => {
  it('deduplicates while preserving order', () => {
    expect(
      canonicalizeRetailNeeds([
        'HAIR_STYLING_CONTROL',
        'HAIR_TEXTURE_DEFINITION',
        'HAIR_STYLING_CONTROL',
      ]),
    ).toEqual(['HAIR_STYLING_CONTROL', 'HAIR_TEXTURE_DEFINITION']);
  });

  it('removes UNKNOWN when known values exist', () => {
    expect(
      canonicalizeRetailNeeds(['UNKNOWN', 'HAIR_CLEANSING', 'UNKNOWN', 'BEARD_SOFTENING']),
    ).toEqual(['HAIR_CLEANSING', 'BEARD_SOFTENING']);
  });

  it('returns UNKNOWN for empty input', () => {
    expect(canonicalizeRetailNeeds([])).toEqual(['UNKNOWN']);
  });

  it('returns UNKNOWN when only UNKNOWN is supplied', () => {
    expect(canonicalizeRetailNeeds(['UNKNOWN', 'UNKNOWN'])).toEqual(['UNKNOWN']);
  });

  it('caps at eight values', () => {
    const input = RETAIL_NEEDS.filter((need) => need !== 'UNKNOWN') as RetailNeed[];
    expect(canonicalizeRetailNeeds(input)).toHaveLength(8);
  });
});
