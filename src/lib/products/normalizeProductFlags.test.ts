import { describe, expect, it } from 'vitest';
import { normalizeProductFlags } from './normalizeProductFlags';

describe('normalizeProductFlags', () => {
  it('hides a Featured product in one step (Hidden + not Featured)', () => {
    expect(
      normalizeProductFlags({ active: true, featured: true }, { active: false })
    ).toEqual({ active: false, featured: false });
  });

  it('featuring a Hidden product forces Live', () => {
    expect(
      normalizeProductFlags({ active: false, featured: false }, { featured: true })
    ).toEqual({ active: true, featured: true });
  });

  it('removing Featured does not hide the product', () => {
    expect(
      normalizeProductFlags({ active: true, featured: true }, { featured: false })
    ).toEqual({ active: true, featured: false });
  });

  it('sets live alone without changing featured', () => {
    expect(
      normalizeProductFlags({ active: false, featured: false }, { active: true })
    ).toEqual({ active: true, featured: false });
  });

  it('hides alone when already not Featured', () => {
    expect(
      normalizeProductFlags({ active: true, featured: false }, { active: false })
    ).toEqual({ active: false, featured: false });
  });

  it('applies both fields when provided together', () => {
    expect(
      normalizeProductFlags(
        { active: true, featured: true },
        { active: false, featured: false }
      )
    ).toEqual({ active: false, featured: false });
  });
});
