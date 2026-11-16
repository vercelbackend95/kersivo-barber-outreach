import { describe, expect, it } from 'vitest';
import { hexAtPoint, hueStripGradient, paintPickerArea, pickerPoint, shadeSteps, withHue } from './picker';
import { hexToClampedOklch } from './space';

describe('picker area', () => {
  it('round-trips a colour through its point (what is under the thumb is what you get)', () => {
    for (const hex of ['#1F6F6B', '#C9A24A', '#7A1F2B', '#E3C58E', '#2B2B2E']) {
      const point = pickerPoint(hex)!;
      const a = hexToClampedOklch(hex)!;
      const b = hexToClampedOklch(hexAtPoint(point))!;
      expect(Math.abs(a.L - b.L)).toBeLessThan(0.01);
      expect(Math.abs(a.C - b.C)).toBeLessThan(0.01);
    }
  });

  it('top-right is light and vivid, bottom-left is deep and grey', () => {
    const top = hexToClampedOklch(hexAtPoint({ x: 1, y: 0.2, h: 25 }))!;
    const bottom = hexToClampedOklch(hexAtPoint({ x: 0, y: 1, h: 25 }))!;
    expect(top.L).toBeGreaterThan(bottom.L);
    expect(top.C).toBeGreaterThan(0.1);
    expect(bottom.C).toBeLessThan(0.01);
  });

  it('changing hue keeps lightness and gives a grey some colour', () => {
    const next = withHue('#1F6F6B', 25)!;
    expect(Math.abs(hexToClampedOklch(next)!.L - hexToClampedOklch('#1F6F6B')!.L)).toBeLessThan(0.01);
    expect(hexToClampedOklch(withHue('#808080', 250)!)!.C).toBeGreaterThan(0.05);
  });

  it('shades keep the colour vivid from light to deep', () => {
    const steps = shadeSteps('#C8102E');
    expect(steps.length).toBe(7);
    const Ls = steps.map((hex) => hexToClampedOklch(hex)!.L);
    for (let i = 1; i < Ls.length; i += 1) expect(Ls[i]!).toBeLessThan(Ls[i - 1]!);
    for (const hex of steps) expect(hexToClampedOklch(hex)!.C).toBeGreaterThan(0.04);
  });

  it('paints an opaque area and stripes only the hard-to-read part', () => {
    const w = 40;
    const h = 30;
    const plain = new Uint8ClampedArray(w * h * 4);
    paintPickerArea(plain, { width: w, height: h, hue: 25 });
    const marked = new Uint8ClampedArray(w * h * 4);
    paintPickerArea(marked, { width: w, height: h, hue: 25, readable: (lum) => lum > 0.2 });
    expect(plain.every((v, i) => i % 4 !== 3 || v === 255)).toBe(true);
    expect(Array.from(marked.slice(0, w * 4))).toEqual(Array.from(plain.slice(0, w * 4)));
    const last = (h - 1) * w * 4;
    expect(Array.from(marked.slice(last))).not.toEqual(Array.from(plain.slice(last)));
  });

  it('builds a hue strip gradient', () => {
    expect(hueStripGradient(12)).toMatch(/^linear-gradient\(90deg, #/);
  });
});
