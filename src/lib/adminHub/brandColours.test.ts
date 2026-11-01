import { describe, expect, it } from 'vitest';
import { brandColoursSchema, parseBrandPalette } from './brandColours';

describe('brandColoursSchema', () => {
  it('accepts #RGB and #RRGGBB and normalises them', () => {
    const parsed = brandColoursSchema.parse({
      brandPrimaryColour: '#1f6',
      brandSecondaryColour: '#c9a24a',
      brandBackgroundTone: 'DARK',
      brandColoursSource: 'LOGO',
      brandPaletteExtracted: [{ hex: '#141', share: 0.2 }],
      send: false,
    });
    expect(parsed.brandPrimaryColour).toBe('#11FF66');
    expect(parsed.brandSecondaryColour).toBe('#C9A24A');
    expect(parsed.brandPaletteExtracted).toEqual([{ hex: '#114411', share: 0.2 }]);
  });

  it('rejects a bad hex, enum or oversized palette', () => {
    expect(brandColoursSchema.safeParse({ brandPrimaryColour: 'red' }).success).toBe(false);
    expect(brandColoursSchema.safeParse({ brandBackgroundTone: 'NAVY' }).success).toBe(false);
    expect(brandColoursSchema.safeParse({ brandColoursSource: 'AI' }).success).toBe(false);
    expect(
      brandColoursSchema.safeParse({
        brandPaletteExtracted: Array.from({ length: 6 }, (_, i) => ({ hex: '#111111', share: i / 10 })),
      }).success,
    ).toBe(false);
  });

  it('allows clearing colours and sending KERSIVO’s choice', () => {
    const parsed = brandColoursSchema.parse({
      brandPrimaryColour: null,
      brandSecondaryColour: '',
      brandBackgroundTone: 'LIGHT',
      brandColoursSource: 'KERSIVO_CHOOSES',
      brandPaletteExtracted: null,
      send: true,
    });
    expect(parsed.brandPrimaryColour).toBeNull();
    expect(parsed.brandSecondaryColour).toBeNull();
    expect(parsed.brandPaletteExtracted).toBeNull();
    expect(parsed.send).toBe(true);
  });
});

describe('parseBrandPalette', () => {
  it('keeps at most five valid rows', () => {
    expect(
      parseBrandPalette([
        { hex: '#1f6f6b', share: 0.5 },
        { hex: 'nope', share: 1 },
        { hex: '#c9a24a', share: 2 },
        { hex: '#141414', share: 0.1 },
      ]),
    ).toEqual([
      { hex: '#1F6F6B', share: 0.5 },
      { hex: '#C9A24A', share: 1 },
      { hex: '#141414', share: 0.1 },
    ]);
  });
});
