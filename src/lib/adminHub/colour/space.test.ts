import { describe, expect, it } from 'vitest';
import { HEX_COLOUR_RE, expandShortHex, normaliseHexColour } from './hex';
import {
  clampToGamut,
  deltaEok,
  hexToClampedOklch,
  hexToOklab,
  hueDistance,
  isInGamut,
  oklchToHex,
  oklchToOklab,
  srgbToOklab,
} from './space';

describe('hex', () => {
  it('accepts #RGB and #RRGGBB', () => {
    expect(HEX_COLOUR_RE.test('#1F6')).toBe(true);
    expect(HEX_COLOUR_RE.test('#1F6F6B')).toBe(true);
    expect(HEX_COLOUR_RE.test('red')).toBe(false);
    expect(normaliseHexColour('#1f6')).toBe('#11FF66');
    expect(expandShortHex('#abc')).toBe('#AABBCC');
    expect(normaliseHexColour('#1f6f6b')).toBe('#1F6F6B');
  });
});

describe('OKLab / OKLCH', () => {
  it('round-trips white, black and a mid teal', () => {
    const white = srgbToOklab({ r: 1, g: 1, b: 1 });
    expect(white.L).toBeGreaterThan(0.99);
    expect(Math.abs(white.a)).toBeLessThan(0.02);
    expect(Math.abs(white.b)).toBeLessThan(0.02);

    const black = srgbToOklab({ r: 0, g: 0, b: 0 });
    expect(black.L).toBeLessThan(0.02);

    const teal = hexToOklab('#1F6F6B');
    expect(teal).not.toBeNull();
    expect(oklchToHex(hexToClampedOklch('#1F6F6B')!)).toBe('#1F6F6B');
  });

  it('ΔE_OK is 0 for the same colour and rises with distance', () => {
    const a = hexToOklab('#1F6F6B')!;
    const b = hexToOklab('#C9A24A')!;
    expect(deltaEok(a, a)).toBeCloseTo(0, 8);
    expect(deltaEok(a, b)).toBeGreaterThan(0.1);
  });

  it('reduces chroma until the colour is in sRGB', () => {
    const wild = { L: 0.6, C: 0.5, h: 150 };
    expect(isInGamut(oklchToOklab(wild))).toBe(false);
    const clamped = clampToGamut(wild);
    expect(isInGamut(oklchToOklab(clamped))).toBe(true);
    expect(clamped.h).toBe(150);
    expect(clamped.L).toBeCloseTo(0.6, 5);
    expect(clamped.C).toBeLessThan(wild.C);
  });

  it('measures shortest hue distance', () => {
    expect(hueDistance(10, 350)).toBeCloseTo(20);
    expect(hueDistance(0, 180)).toBeCloseTo(180);
  });
});
