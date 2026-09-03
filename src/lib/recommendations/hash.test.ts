import { describe, expect, it } from 'vitest';

import {
  computeProductSemanticHash,
  computeServiceSemanticHash,
  productSemanticFieldsChanged,
  serviceSemanticFieldsChanged,
} from './hash';

describe('recommendations/hash', () => {
  it('produces stable service hashes for equivalent normalized input', () => {
    const a = computeServiceSemanticHash({
      name: 'Skin Fade',
      description: 'A seamless fade',
      category: 'cuts & fades',
    });
    const b = computeServiceSemanticHash({
      name: '  skin   fade ',
      description: '  a seamless fade ',
      category: 'Cuts & Fades',
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects service semantic field changes', () => {
    const before = { name: 'Beard Trim', description: null, category: 'beard' };
    const afterName = { ...before, name: 'Beard Sculpt' };
    expect(serviceSemanticFieldsChanged(before, afterName)).toBe(true);
    expect(serviceSemanticFieldsChanged(before, { ...before })).toBe(false);
  });

  it('normalizes product categories to uppercase for hashing', () => {
    const lower = computeProductSemanticHash({
      name: 'Matte Clay',
      description: 'Hold',
      category: 'styling',
    });
    const upper = computeProductSemanticHash({
      name: 'Matte Clay',
      description: 'Hold',
      category: 'STYLING',
    });
    expect(lower).toBe(upper);
  });

  it('detects product semantic field changes', () => {
    const before = { name: 'Beard Oil', description: 'Oil', category: 'BEARD_CARE' };
    const afterDesc = { ...before, description: 'Nourishing oil' };
    expect(productSemanticFieldsChanged(before, afterDesc)).toBe(true);
    expect(productSemanticFieldsChanged(before, { ...before })).toBe(false);
  });
});
