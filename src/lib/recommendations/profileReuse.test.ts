import { describe, expect, it } from 'vitest';

import { isStoredProfileReusable, type StoredProfileMetadata } from './profileReuse';

const BASE: StoredProfileMetadata = {
  contentHash: 'hash-1',
  taxonomyVersion: '2026-09-v2',
  schemaVersion: '2',
  promptVersion: '2026-09-v8',
  modelId: 'gpt-4o-mini',
};

describe('isStoredProfileReusable', () => {
  it('returns true when all metadata matches', () => {
    expect(isStoredProfileReusable(BASE, { ...BASE })).toBe(true);
  });

  it('returns false when content hash mismatches', () => {
    expect(
      isStoredProfileReusable(BASE, { ...BASE, contentHash: 'hash-2' }),
    ).toBe(false);
  });

  it('returns false when taxonomy version mismatches', () => {
    expect(
      isStoredProfileReusable(BASE, { ...BASE, taxonomyVersion: '2026-09-v1' }),
    ).toBe(false);
  });

  it('returns false when schema version mismatches', () => {
    expect(
      isStoredProfileReusable(BASE, { ...BASE, schemaVersion: '1' }),
    ).toBe(false);
  });

  it('returns false when prompt version mismatches', () => {
    expect(
      isStoredProfileReusable(BASE, { ...BASE, promptVersion: '2026-09-v2' }),
    ).toBe(false);
  });

  it('returns false when stored v7 profile is checked against v8 expected', () => {
    expect(
      isStoredProfileReusable(
        { ...BASE, promptVersion: '2026-09-v7' },
        { ...BASE, promptVersion: '2026-09-v8' },
      ),
    ).toBe(false);
  });

  it('returns false when model id mismatches', () => {
    expect(
      isStoredProfileReusable(BASE, { ...BASE, modelId: 'gpt-other' }),
    ).toBe(false);
  });
});
