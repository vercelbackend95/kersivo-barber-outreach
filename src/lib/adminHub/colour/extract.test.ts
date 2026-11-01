import { describe, expect, it } from 'vitest';
import { assignDefaultRoles, extractPalette, lightnessSteps } from './extract';
import { blackAndWhiteLogo, gradientLogo, transparentPng, twoColourLogo, verySmallLogo } from './fixtures';
import { nameSwatch } from './name';
import { hexToClampedOklch } from './space';

describe('extractPalette', () => {
  it('finds two colours in a two-colour logo', () => {
    const swatches = extractPalette(twoColourLogo());
    expect(swatches.length).toBeGreaterThanOrEqual(2);
    expect(swatches.length).toBeLessThanOrEqual(5);
    const hexes = swatches.map((row) => row.hex);
    expect(hexes.some((hex) => hex.startsWith('#1') || hex.startsWith('#2'))).toBe(true);
    expect(swatches.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1, 1);
    const roles = assignDefaultRoles(swatches);
    expect(roles.blackAndWhite).toBe(false);
    expect(roles.main).not.toBeNull();
    expect(roles.main!.chromatic).toBe(true);
  });

  it('keeps Ink/Cream on a black-and-white logo and does not auto-assign Main', () => {
    const swatches = extractPalette(blackAndWhiteLogo());
    expect(swatches.length).toBeGreaterThanOrEqual(1);
    expect(swatches.every((row) => ['Ink', 'Cream', 'Grey', 'Charcoal'].includes(row.name))).toBe(true);
    const roles = assignDefaultRoles(swatches);
    expect(roles.blackAndWhite).toBe(true);
    expect(roles.main).toBeNull();
    expect(roles.accent).toBeNull();
  });

  it('ignores fully transparent pixels', () => {
    const swatches = extractPalette(transparentPng());
    expect(swatches.length).toBeGreaterThanOrEqual(1);
    expect(swatches[0]!.hex).toMatch(/^#1/);
    expect(swatches.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1, 1);
  });

  it('returns several related swatches from a gradient', () => {
    const swatches = extractPalette(gradientLogo());
    expect(swatches.length).toBeGreaterThanOrEqual(2);
    expect(swatches.length).toBeLessThanOrEqual(5);
    expect(swatches[0]!.share).toBeGreaterThanOrEqual(swatches.at(-1)!.share);
  });

  it('works on a 2×2 logo', () => {
    const swatches = extractPalette(verySmallLogo());
    expect(swatches.length).toBeGreaterThanOrEqual(1);
    expect(swatches.length).toBeLessThanOrEqual(2);
    const roles = assignDefaultRoles(swatches);
    expect(roles.main?.chromatic ?? roles.blackAndWhite).toBeTruthy();
  });

  it('is deterministic', () => {
    const a = extractPalette(twoColourLogo()).map((row) => row.hex);
    const b = extractPalette(twoColourLogo()).map((row) => row.hex);
    expect(a).toEqual(b);
  });
});

describe('naming and quick picks', () => {
  it('names near-black / near-white / teal / brass', () => {
    expect(nameSwatch(hexToClampedOklch('#141414')!)).toBe('Ink');
    expect(nameSwatch(hexToClampedOklch('#F2E8D5')!)).toBe('Cream');
    expect(nameSwatch(hexToClampedOklch('#1F6F6B')!)).toBe('Teal');
    expect(nameSwatch(hexToClampedOklch('#C9A24A')!)).toBe('Brass');
  });

  it('builds seven lightness steps of the same hue', () => {
    const steps = lightnessSteps('#1F6F6B');
    expect(steps).toHaveLength(7);
    const hues = steps.map((hex) => hexToClampedOklch(hex)!.h);
    for (const h of hues) expect(Math.abs(h - hues[0]!)).toBeLessThan(2);
    const Ls = steps.map((hex) => hexToClampedOklch(hex)!.L);
    expect(Ls[0]!).toBeGreaterThan(Ls.at(-1)!);
  });
});
