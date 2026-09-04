import { describe, expect, it } from 'vitest';

import {
  canonicalizeClosedEnumArray,
  clampAndCanonicalizeEnumArray,
} from './canonicalizeClosedEnumArray';
import { TARGET_AREAS } from './taxonomy';

describe('canonicalizeClosedEnumArray', () => {
  it('dedupes and strips UNKNOWN mixed with known values in taxonomy order', () => {
    expect(canonicalizeClosedEnumArray(TARGET_AREAS, ['HAIR', 'UNKNOWN', 'HAIR'])).toEqual(['HAIR']);
  });

  it('returns [UNKNOWN] when only UNKNOWN is present', () => {
    expect(canonicalizeClosedEnumArray(TARGET_AREAS, ['UNKNOWN', 'UNKNOWN'])).toEqual(['UNKNOWN']);
  });

  it('preserves multi-known taxonomy order', () => {
    expect(canonicalizeClosedEnumArray(TARGET_AREAS, ['BEARD', 'HAIR', 'UNKNOWN'])).toEqual([
      'HAIR',
      'BEARD',
    ]);
  });

  it('clampAndCanonicalize repairs Super Hold shape [HAIR, UNKNOWN]', () => {
    expect(clampAndCanonicalizeEnumArray(TARGET_AREAS, ['HAIR', 'UNKNOWN'])).toEqual(['HAIR']);
  });
});
