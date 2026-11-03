import { describe, expect, it } from 'vitest';
import { nameSwatch } from './name';
import { distinctRoleNames } from './roleNames';
import { hexToClampedOklch } from './space';

const name = (hex: string) => nameSwatch(hexToClampedOklch(hex)!);

/** Small deterministic PRNG so the sweep is the same on every run. */
function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
const hexOf = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

describe('distinctRoleNames', () => {
  it('keeps the table names when they already differ', () => {
    expect(distinctRoleNames('#1F6F6B', '#C9A24A')).toEqual({ main: 'Teal', accent: 'Brass' });
    expect(distinctRoleNames('#111111', '#F5F5F5')).toEqual({ main: 'Ink', accent: 'Cream' });
  });

  it('adds a lightness word when both are the same name', () => {
    expect(name('#401010')).toBe(name('#742A27'));
    // Dark pair: the darker one is tagged.
    expect(distinctRoleNames('#401010', '#742A27')).toEqual({ main: 'Dark copper', accent: 'Copper' });
    expect(distinctRoleNames('#742A27', '#401010')).toEqual({ main: 'Copper', accent: 'Dark copper' });
    // Light pair: the lighter one is tagged.
    expect(name('#C9A24A')).toBe(name('#E2C27A'));
    expect(distinctRoleNames('#C9A24A', '#E2C27A')).toEqual({ main: 'Brass', accent: 'Light brass' });
  });

  it('never says "Dark ink" or "Light cream"', () => {
    expect(distinctRoleNames('#050505', '#111111')).toEqual({ main: 'Ink', accent: 'Soft ink' });
    const cream = distinctRoleNames('#F2F2F2', '#FFFFFF');
    expect(cream).toEqual({ main: 'Dark cream', accent: 'Cream' });
  });

  it('empty roles and equal hexes are left as they are', () => {
    expect(distinctRoleNames(null, '#C9A24A')).toEqual({ main: null, accent: 'Brass' });
    expect(distinctRoleNames('#1F6F6B', '')).toEqual({ main: 'Teal', accent: null });
    expect(distinctRoleNames(undefined, undefined)).toEqual({ main: null, accent: null });
    expect(distinctRoleNames('#1f6f6b', '#1F6F6B')).toEqual({ main: 'Teal', accent: 'Teal' });
  });

  it('never gives two different hexes the same name (random sweep + near neighbours)', () => {
    const rand = lcg(10);
    const byte = () => Math.floor(rand() * 256);
    let sameTableName = 0;
    for (let i = 0; i < 4000; i += 1) {
      const a = hexOf(byte(), byte(), byte());
      // Half the pairs are near neighbours, so the table names usually collide.
      const b = i % 2 ? hexOf(byte(), byte(), byte()) : hexOf(
        parseInt(a.slice(1, 3), 16) + Math.round((rand() - 0.5) * 40),
        parseInt(a.slice(3, 5), 16) + Math.round((rand() - 0.5) * 40),
        parseInt(a.slice(5, 7), 16) + Math.round((rand() - 0.5) * 40),
      );
      if (a === b) continue;
      if (name(a) === name(b)) sameTableName += 1;
      const names = distinctRoleNames(a, b);
      expect(names.main, `${a} vs ${b}`).not.toBe(names.accent);
      expect(names.main).toBeTruthy();
      expect(names.accent).toBeTruthy();
    }
    expect(sameTableName).toBeGreaterThan(500);
  });

  it('one-step neighbours still differ', () => {
    for (const [a, b] of [
      ['#401010', '#401011'],
      ['#808080', '#818181'],
      ['#1F6F6B', '#1F6F6C'],
    ] as const) {
      const names = distinctRoleNames(a, b);
      expect(names.main).not.toBe(names.accent);
    }
  });
});
