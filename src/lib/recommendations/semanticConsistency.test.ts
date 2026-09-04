import { describe, expect, it } from 'vitest';

import {
  assertProductSemanticConsistency,
  canonicalizeIncompatibilities,
  validateProductSemanticConsistency,
  validateServiceSemanticConsistency,
} from './semanticConsistency';

describe('semanticConsistency', () => {
  it('rejects SHORT suitability with FOR_LONG_HAIR_ONLY', () => {
    const result = validateProductSemanticConsistency({
      targetAreas: ['HAIR'],
      hairLengthSuitability: 'SHORT',
      incompatibilities: ['FOR_LONG_HAIR_ONLY'],
    });
    expect(result).toEqual({ ok: false, code: 'PRODUCT_SHORT_WITH_LONG_ONLY' });
  });

  it('rejects LONG suitability with FOR_SHORT_HAIR_ONLY', () => {
    const result = validateProductSemanticConsistency({
      targetAreas: ['HAIR'],
      hairLengthSuitability: 'LONG',
      incompatibilities: ['FOR_SHORT_HAIR_ONLY'],
    });
    expect(result).toEqual({ ok: false, code: 'PRODUCT_LONG_WITH_SHORT_ONLY' });
  });

  it('accepts SHORT suitability without exclusivity (matte clay shape)', () => {
    const result = validateProductSemanticConsistency({
      targetAreas: ['HAIR'],
      hairLengthSuitability: 'SHORT',
      incompatibilities: ['UNKNOWN'],
    });
    expect(result.ok).toBe(true);
  });

  it('accepts SHORT with matching FOR_SHORT_HAIR_ONLY exclusivity', () => {
    const result = validateProductSemanticConsistency({
      targetAreas: ['HAIR'],
      hairLengthSuitability: 'SHORT',
      incompatibilities: ['FOR_SHORT_HAIR_ONLY'],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects BOTH FOR_SHORT_HAIR_ONLY and FOR_LONG_HAIR_ONLY', () => {
    expect(
      validateProductSemanticConsistency({
        targetAreas: ['HAIR'],
        hairLengthSuitability: 'SHORT',
        incompatibilities: ['FOR_SHORT_HAIR_ONLY', 'FOR_LONG_HAIR_ONLY'],
      }),
    ).toEqual({ ok: false, code: 'PRODUCT_CONFLICTING_HAIR_LENGTH_EXCLUSIVITY' });
  });

  it('rejects ANY / NOT_APPLICABLE / UNKNOWN with exclusivity tags', () => {
    expect(
      validateProductSemanticConsistency({
        targetAreas: ['HAIR'],
        hairLengthSuitability: 'ANY',
        incompatibilities: ['FOR_SHORT_HAIR_ONLY'],
      }),
    ).toEqual({ ok: false, code: 'PRODUCT_ANY_WITH_HAIR_LENGTH_EXCLUSIVITY' });

    expect(
      validateProductSemanticConsistency({
        targetAreas: ['HAIR'],
        hairLengthSuitability: 'NOT_APPLICABLE',
        incompatibilities: ['FOR_LONG_HAIR_ONLY'],
      }),
    ).toEqual({ ok: false, code: 'PRODUCT_NOT_APPLICABLE_WITH_HAIR_LENGTH_EXCLUSIVITY' });

    expect(
      validateProductSemanticConsistency({
        targetAreas: ['HAIR'],
        hairLengthSuitability: 'UNKNOWN',
        incompatibilities: ['FOR_SHORT_HAIR_ONLY'],
      }),
    ).toEqual({ ok: false, code: 'PRODUCT_UNKNOWN_WITH_HAIR_LENGTH_EXCLUSIVITY' });
  });

  it('rejects exclusivity that disagrees with MEDIUM suitability', () => {
    expect(
      validateProductSemanticConsistency({
        targetAreas: ['HAIR'],
        hairLengthSuitability: 'MEDIUM',
        incompatibilities: ['FOR_SHORT_HAIR_ONLY'],
      }),
    ).toEqual({ ok: false, code: 'PRODUCT_EXCLUSIVITY_SUITABILITY_MISMATCH' });
  });

  it('rejects mutually exclusive domain / leave-in tags', () => {
    expect(
      validateProductSemanticConsistency({
        targetAreas: ['HAIR', 'BEARD'],
        hairLengthSuitability: 'ANY',
        incompatibilities: ['HAIR_ONLY', 'BEARD_ONLY'],
      }),
    ).toEqual({ ok: false, code: 'INCOMPATIBILITY_HAIR_ONLY_AND_BEARD_ONLY' });

    expect(
      validateProductSemanticConsistency({
        targetAreas: ['BEARD'],
        hairLengthSuitability: 'NOT_APPLICABLE',
        incompatibilities: ['BEARD_ONLY', 'NOT_FOR_BEARD'],
      }),
    ).toEqual({ ok: false, code: 'INCOMPATIBILITY_BEARD_ONLY_AND_NOT_FOR_BEARD' });

    expect(
      validateProductSemanticConsistency({
        targetAreas: ['SHAVE'],
        hairLengthSuitability: 'NOT_APPLICABLE',
        incompatibilities: ['POST_SHAVE_ONLY', 'NOT_FOR_SHAVE'],
      }),
    ).toEqual({ ok: false, code: 'INCOMPATIBILITY_POST_SHAVE_ONLY_AND_NOT_FOR_SHAVE' });

    expect(
      validateProductSemanticConsistency({
        targetAreas: ['HAIR'],
        hairLengthSuitability: 'ANY',
        incompatibilities: ['LEAVE_IN_ONLY', 'RINSE_OUT_ONLY'],
      }),
    ).toEqual({ ok: false, code: 'INCOMPATIBILITY_LEAVE_IN_ONLY_AND_RINSE_OUT_ONLY' });
  });

  it('service consistency rejects mutually exclusive tags', () => {
    expect(
      validateServiceSemanticConsistency({
        incompatibilities: ['LEAVE_IN_ONLY', 'RINSE_OUT_ONLY'],
      }),
    ).toEqual({ ok: false, code: 'INCOMPATIBILITY_LEAVE_IN_ONLY_AND_RINSE_OUT_ONLY' });
  });

  it('rejects non-hair product with hair-length exclusivity', () => {
    const result = validateProductSemanticConsistency({
      targetAreas: ['BEARD'],
      hairLengthSuitability: 'ANY',
      incompatibilities: ['FOR_SHORT_HAIR_ONLY'],
    });
    expect(result).toEqual({ ok: false, code: 'NON_HAIR_PRODUCT_WITH_HAIR_LENGTH_CONSTRAINT' });
  });

  it('rejects non-hair product with SHORT suitability', () => {
    const result = validateProductSemanticConsistency({
      targetAreas: ['BEARD'],
      hairLengthSuitability: 'SHORT',
      incompatibilities: ['UNKNOWN'],
    });
    expect(result).toEqual({ ok: false, code: 'NON_HAIR_PRODUCT_WITH_HAIR_LENGTH_CONSTRAINT' });
  });

  it('rejects NOT_FOR_BEARD with BEARD target areas', () => {
    expect(() =>
      assertProductSemanticConsistency({
        targetAreas: ['BEARD'],
        hairLengthSuitability: 'NOT_APPLICABLE',
        incompatibilities: ['NOT_FOR_BEARD'],
        retailNeeds: ['BEARD_SOFTENING'],
      }),
    ).toThrow(/PRODUCT_NOT_FOR_BEARD_WITH_BEARD_SEMANTICS/);
  });

  it('rejects NOT_FOR_SHAVE with SHAVE_PREPARATION retail need', () => {
    expect(() =>
      assertProductSemanticConsistency({
        targetAreas: ['FACE'],
        hairLengthSuitability: 'NOT_APPLICABLE',
        incompatibilities: ['NOT_FOR_SHAVE'],
        retailNeeds: ['SHAVE_PREPARATION'],
      }),
    ).toThrow(/PRODUCT_NOT_FOR_SHAVE_WITH_SHAVE_SEMANTICS/);
  });

  it('benign-canonicalizes UNKNOWN mixed with known incompatibilities', () => {
    const { tags, removedUnknownMixedWithKnown } = canonicalizeIncompatibilities([
      'UNKNOWN',
      'HAIR_ONLY',
    ]);
    expect(removedUnknownMixedWithKnown).toBe(true);
    expect(tags).toEqual(['HAIR_ONLY']);

    const result = validateProductSemanticConsistency({
      targetAreas: ['HAIR'],
      hairLengthSuitability: 'SHORT',
      incompatibilities: ['UNKNOWN', 'HAIR_ONLY'],
    });
    expect(result).toEqual({ ok: true, canonicalized: true });
  });

  it('assertProductSemanticConsistency strips UNKNOWN and returns profile', () => {
    const out = assertProductSemanticConsistency({
      targetAreas: ['HAIR'] as const,
      hairLengthSuitability: 'SHORT' as const,
      incompatibilities: ['UNKNOWN', 'HAIR_ONLY'] as const,
    });
    expect(out.incompatibilities).toEqual(['HAIR_ONLY']);
  });

  it('assertProductSemanticConsistency throws on material contradiction', () => {
    expect(() =>
      assertProductSemanticConsistency({
        targetAreas: ['HAIR'],
        hairLengthSuitability: 'SHORT',
        incompatibilities: ['FOR_LONG_HAIR_ONLY'],
      }),
    ).toThrow(/PRODUCT_SHORT_WITH_LONG_ONLY/);
  });

  it('service consistency canonicalizes UNKNOWN mixed with known tags', () => {
    const result = validateServiceSemanticConsistency({
      incompatibilities: ['UNKNOWN', 'NOT_FOR_SHAVE'],
    });
    expect(result).toEqual({ ok: true, canonicalized: true });
  });
});
