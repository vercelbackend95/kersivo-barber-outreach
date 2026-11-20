import { describe, expect, it } from 'vitest';
import { generateOrderReference } from './orderReference';

describe('generateOrderReference', () => {
  it('always returns KRV- plus six characters from the pickup alphabet', () => {
    for (let i = 0; i < 2000; i += 1) {
      expect(generateOrderReference(Date.now() + i * 7919)).toMatch(/^KRV-[A-HJ-NP-Z2-9]{6}$/);
    }
  });
});
