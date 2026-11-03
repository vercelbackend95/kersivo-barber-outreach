import { describe, expect, it } from 'vitest';
import {
  applyLightness,
  betterButtonText,
  chromaFromRelative,
  contrastRatio,
  evaluateContrast,
  formatContrastRatio,
  maxInGamutChroma,
  nearestPassingLightness,
  relativeChroma,
  siteBackgroundHex,
} from './contrast';
import { hexToClampedOklch, oklchToHex } from './space';
import { BUTTON_INK, BUTTON_WHITE } from './types';

describe('WCAG contrast', () => {
  it('gives black-on-white 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('picks the higher-contrast button text', () => {
    expect(betterButtonText('#C9A24A')).toBe(BUTTON_INK);
    expect(betterButtonText('#1F6F6B')).toBe(BUTTON_WHITE);
  });

  it('passes a readable brass button and a teal on dark', () => {
    const check = evaluateContrast({
      mainHex: '#1F6F6B',
      accentHex: '#C9A24A',
      tone: 'DARK',
    });
    expect(check.pass).toBe(true);
    expect(check.buttonPass).toBe(true);
    expect(check.fixLabel).toBeNull();
  });

  it('fails a mid grey button and offers Make it deeper', () => {
    const check = evaluateContrast({
      mainHex: '#1F6F6B',
      accentHex: '#7A7A7A',
      tone: 'DARK',
    });
    expect(check.buttonPass).toBe(false);
    expect(check.fixLabel).toBe('deeper');
    expect(check.fixHex).toBeTruthy();
    const after = evaluateContrast({
      mainHex: '#1F6F6B',
      accentHex: check.fixHex,
      tone: 'DARK',
    });
    expect(after.buttonPass).toBe(true);
  });

  it('moves lightness to the nearest passing value', () => {
    const start = hexToClampedOklch('#8A8A8A')!;
    const next = nearestPassingLightness(start, (hex) => contrastRatio(BUTTON_INK, hex) >= 4.5);
    expect(next).not.toBeNull();
    expect(contrastRatio(BUTTON_INK, oklchToHex(next!))).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(next!.L - start.L)).toBeLessThan(0.4);
  });

  it('Make it lighter raises L on a too-dark main against a dark ground', () => {
    const check = evaluateContrast({
      mainHex: '#1A1A1A',
      accentHex: '#C9A24A',
      tone: 'DARK',
    });
    expect(check.mainPass).toBe(false);
    expect(check.fixLabel).toBe('lighter');
    const from = hexToClampedOklch('#1A1A1A')!;
    const to = hexToClampedOklch(check.fixHex!)!;
    expect(to.L).toBeGreaterThan(from.L);
    const after = evaluateContrast({
      mainHex: check.fixHex,
      accentHex: '#C9A24A',
      tone: 'DARK',
    });
    expect(after.mainPass).toBe(true);
  });

  it('applyLightness keeps hue', () => {
    const from = hexToClampedOklch('#1F6F6B')!;
    const deeper = hexToClampedOklch(applyLightness('#1F6F6B', 0.28))!;
    expect(Math.abs(deeper.h - from.h)).toBeLessThan(1);
    expect(deeper.L).toBeLessThan(from.L);
  });
});

describe('site background (O5)', () => {
  it('DARK is a deep shade of the Main hue, LIGHT a near-white of it; no Main is neutral', () => {
    const main = hexToClampedOklch('#1F6F6B')!;
    const dark = hexToClampedOklch(siteBackgroundHex('DARK', '#1F6F6B'))!;
    const light = hexToClampedOklch(siteBackgroundHex('LIGHT', '#1F6F6B'))!;
    expect(dark.L).toBeCloseTo(0.16, 1);
    expect(dark.C).toBeLessThanOrEqual(0.031);
    expect(Math.abs(dark.h - main.h)).toBeLessThan(15);
    expect(light.L).toBeCloseTo(0.97, 1);
    expect(light.C).toBeLessThanOrEqual(0.016);
    expect(hexToClampedOklch(siteBackgroundHex('DARK', null))!.C).toBeLessThan(0.005);
    expect(hexToClampedOklch(siteBackgroundHex('LIGHT'))!.C).toBeLessThan(0.005);
  });

  it('evaluateContrast uses the same background', () => {
    for (const tone of ['DARK', 'LIGHT'] as const) {
      const check = evaluateContrast({ mainHex: '#1F6F6B', accentHex: '#C9A24A', tone });
      expect(check.background).toBe(siteBackgroundHex(tone, '#1F6F6B'));
      expect(check.mainRatio).toBeCloseTo(contrastRatio('#1F6F6B', check.background), 5);
    }
  });
});

describe('two-line contrast (O5)', () => {
  it('reports both lines with ratios', () => {
    const check = evaluateContrast({ mainHex: '#1F6F6B', accentHex: '#C9A24A', tone: 'LIGHT' });
    expect(check.button?.pass).toBe(true);
    expect(check.main?.pass).toBe(true);
    expect(formatContrastRatio(check.button!.ratio)).toMatch(/^\d+\.\d:1$/);
    expect(formatContrastRatio(4.49)).toBe('4.4:1');
  });

  it('fixes each line independently and both pass afterwards', () => {
    const check = evaluateContrast({ mainHex: '#123432', accentHex: '#7A7A7A', tone: 'DARK' });
    expect(check.button?.pass).toBe(false);
    expect(check.button?.fixLabel).toBe('deeper');
    expect(check.main?.pass).toBe(false);
    expect(check.main?.fixLabel).toBe('lighter');
    const fixed = evaluateContrast({ mainHex: check.main!.fixHex, accentHex: check.button!.fixHex, tone: 'DARK' });
    expect(fixed.button?.pass).toBe(true);
    expect(fixed.main?.pass).toBe(true);
    expect(fixed.pass).toBe(true);
  });

  it('without an accent only Main is checked', () => {
    const check = evaluateContrast({ mainHex: '#1F6F6B', accentHex: null, tone: 'LIGHT' });
    expect(check.button).toBeNull();
    expect(check.main).not.toBeNull();
    expect(check.buttonPass).toBe(true);
  });
});

describe('relative chroma (O5)', () => {
  it('a vivid red is 100 % intensity and keeps its chroma when set back to 100 %', () => {
    const red = hexToClampedOklch('#FF0000')!;
    expect(relativeChroma(red)).toBeGreaterThan(0.98);
    const C = chromaFromRelative(red.L, red.h, 1);
    expect(C).toBeGreaterThan(red.C - 0.005);
    expect(oklchToHex({ ...red, C })).toBe('#FF0000');
  });

  it('maps intensity to the in-gamut maximum for the hue and lightness', () => {
    const teal = hexToClampedOklch('#1F6F6B')!;
    const t = relativeChroma(teal);
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(1);
    expect(chromaFromRelative(teal.L, teal.h, t)).toBeCloseTo(teal.C, 3);
    expect(chromaFromRelative(teal.L, teal.h, 0.5)).toBeCloseTo(maxInGamutChroma(teal.L, teal.h) / 2, 5);
  });
});
