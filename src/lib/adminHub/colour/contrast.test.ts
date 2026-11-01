import { describe, expect, it } from 'vitest';
import {
  applyLightness,
  betterButtonText,
  contrastRatio,
  evaluateContrast,
  nearestPassingLightness,
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
