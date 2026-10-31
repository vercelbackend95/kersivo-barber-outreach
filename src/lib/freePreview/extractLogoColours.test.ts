import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { extractLogoHexes, normaliseHexColour } from './extractLogoColours';

async function pixelsFromPng(buffer: Buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
}

async function solidLogo(colour: { r: number; g: number; b: number }, size = 48) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { ...colour, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

async function twoBandLogo(left: { r: number; g: number; b: number }, right: { r: number; g: number; b: number }) {
  const leftBuf = await sharp({
    create: { width: 32, height: 48, channels: 4, background: { ...left, alpha: 1 } },
  })
    .png()
    .toBuffer();
  const rightBuf = await sharp({
    create: { width: 32, height: 48, channels: 4, background: { ...right, alpha: 1 } },
  })
    .png()
    .toBuffer();
  return sharp({
    create: { width: 64, height: 48, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([
      { input: leftBuf, left: 0, top: 0 },
      { input: rightBuf, left: 32, top: 0 },
    ])
    .png()
    .toBuffer();
}

function near(hex: string, expected: { r: number; g: number; b: number }, slop = 18) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  expect(Math.abs(r - expected.r)).toBeLessThanOrEqual(slop);
  expect(Math.abs(g - expected.g)).toBeLessThanOrEqual(slop);
  expect(Math.abs(b - expected.b)).toBeLessThanOrEqual(slop);
}

describe('extractLogoColours', () => {
  it('extracts the red from a red fixture logo and ignores the white field', async () => {
    const png = await solidLogo({ r: 196, g: 30, b: 58 });
    const hexes = extractLogoHexes(await pixelsFromPng(png));
    expect(hexes.length).toBeGreaterThan(0);
    near(hexes[0]!, { r: 196, g: 30, b: 58 });
  });

  it('extracts both blue and gold from a two-colour fixture logo', async () => {
    const png = await twoBandLogo({ r: 27, g: 77, b: 140 }, { r: 212, g: 160, b: 23 });
    const hexes = extractLogoHexes(await pixelsFromPng(png));
    expect(hexes.length).toBeGreaterThanOrEqual(2);
    const hasBlue = hexes.some((hex) => {
      const b = parseInt(hex.slice(5, 7), 16);
      const r = parseInt(hex.slice(1, 3), 16);
      return b > r + 20;
    });
    const hasGold = hexes.some((hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return r > 150 && b < 80;
    });
    expect(hasBlue).toBe(true);
    expect(hasGold).toBe(true);
  });

  it('ignores near-black and near-white on a green fixture logo', async () => {
    const mark = await sharp({
      create: { width: 20, height: 20, channels: 4, background: { r: 45, g: 106, b: 79, alpha: 1 } },
    })
      .png()
      .toBuffer();
    const png = await sharp({
      create: { width: 64, height: 64, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .composite([
        { input: Buffer.alloc(4 * 8 * 8, 0), raw: { width: 8, height: 8, channels: 4 }, left: 0, top: 0 },
        { input: mark, left: 22, top: 22 },
      ])
      .png()
      .toBuffer();
    const hexes = extractLogoHexes(await pixelsFromPng(png));
    expect(hexes.length).toBeGreaterThan(0);
    near(hexes[0]!, { r: 45, g: 106, b: 79 }, 24);
    for (const hex of hexes) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      expect(r > 240 && g > 240 && b > 240).toBe(false);
      expect(r < 20 && g < 20 && b < 20).toBe(false);
    }
  });

  it('normalises #rrggbb and rejects junk', () => {
    expect(normaliseHexColour('#d72638')).toBe('#D72638');
    expect(normaliseHexColour('red')).toBeNull();
    expect(normaliseHexColour('#fff')).toBeNull();
  });
});
