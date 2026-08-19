import { describe, expect, it } from 'vitest';
import {
  DEMO_GALLERY,
  demoGalleryCountLabel,
  demoGalleryIndexLabel,
  demoGalleryNextIndex,
  demoGalleryOpenLabel,
  demoGalleryPrevIndex,
  demoGallerySequence,
  type DemoGalleryImage,
} from './gallery';
import { demoGalleryBentoClassName, demoGalleryBentoSizes, demoGalleryBentoTiles } from './galleryBento';

describe('BLACKLINE demo gallery', () => {
  it('exposes six unique local WebP frames', () => {
    expect(DEMO_GALLERY.map((image) => image.id)).toEqual([
      'fade',
      'hairline',
      'barber-at-work',
      'beard',
      'scissor-cut',
      'interior-detail',
    ]);
    expect(new Set(DEMO_GALLERY.map((image) => image.src)).size).toBe(6);
    expect(DEMO_GALLERY.every((image) => image.src.startsWith('/demo/gallery/'))).toBe(true);
    expect(DEMO_GALLERY.every((image) => image.src.endsWith('.webp'))).toBe(true);
    expect(DEMO_GALLERY.every((image) => !image.src.includes('://'))).toBe(true);
    expect(demoGalleryCountLabel()).toBe('06 FRAMES');
  });

  it('orders the editorial sequence without duplicating sources', () => {
    expect(demoGallerySequence().map((image) => image.id)).toEqual([
      'barber-at-work',
      'fade',
      'hairline',
      'beard',
      'scissor-cut',
      'interior-detail',
    ]);
    expect(demoGallerySequence().map((image) => image.role)).toEqual([
      'wide',
      'offset',
      'portrait',
      'landscape',
      'portrait',
      'full',
    ]);
    expect(demoGallerySequence().map((image) => image.caption)).toEqual([
      'Work at the chair.',
      'Comb and scissor work over a taper.',
      'Fade detailing at the hairline.',
      'Shaping the beard line.',
      'Scissor work in progress.',
      'A demonstration shop workstation.',
    ]);
  });

  it('keeps descriptive alt text and captions without claiming a real BLACKLINE shop', () => {
    for (const image of DEMO_GALLERY) {
      expect(image.alt.length).toBeGreaterThan(20);
      expect(image.alt.toLowerCase()).not.toMatch(/^image of/);
      expect(image.alt.toLowerCase()).not.toContain('blackline');
      expect(image.caption.toLowerCase()).not.toContain('blackline');
      expect(image.caption.toLowerCase()).not.toContain('our client');
      expect(image.alt.toLowerCase()).not.toContain('our barber');
      expect(image.alt.toLowerCase()).not.toContain('our client');
    }
  });

  it('stores intrinsic dimensions and separate desktop/mobile crops', () => {
    expect(DEMO_GALLERY.map((image) => [image.width, image.height])).toEqual([
      [1333, 2000],
      [1333, 2000],
      [2000, 1333],
      [2000, 1335],
      [1333, 2000],
      [1333, 2000],
    ]);
    expect(DEMO_GALLERY.every((image) => image.objectPosition.desktop && image.objectPosition.mobile)).toBe(
      true,
    );
  });

  it('wraps focus-mode indexes and names the opening control', () => {
    expect(demoGalleryIndexLabel(0)).toBe('01 / 06');
    expect(demoGalleryIndexLabel(5)).toBe('06 / 06');
    expect(demoGalleryNextIndex(5, 6)).toBe(0);
    expect(demoGalleryPrevIndex(0, 6)).toBe(5);
    expect(demoGalleryOpenLabel(demoGallerySequence()[0]!, 0)).toBe(
      'View frame 01 / 06, Work at the chair.',
    );
  });
});

describe('BLACKLINE gallery bento assignment', () => {
  const prototype = DEMO_GALLERY[0]!;

  function frames(count: number): DemoGalleryImage[] {
    return Array.from({ length: count }, (_, index) => ({
      ...prototype,
      src: `/demo/gallery/frame-${index}.webp`,
      sequence: index + 1,
    }));
  }

  it('maps six frames to a left feature group and one remainder', () => {
    const tiles = demoGalleryBentoTiles();
    expect(tiles.map((tile) => tile.image.src)).toEqual(demoGallerySequence().map((image) => image.src));
    expect(new Set(tiles.map((tile) => tile.image.src)).size).toBe(6);
    expect(tiles).toHaveLength(6);
    expect(tiles.slice(0, 5).map((tile) => tile.size)).toEqual([
      'feature',
      'standard',
      'standard',
      'standard',
      'standard',
    ]);
    expect(tiles.slice(0, 5).every((tile) => tile.side === 'left' && !tile.remainder)).toBe(true);
    expect(tiles[5]).toMatchObject({
      size: 'standard',
      remainder: true,
      remainderKind: 'one',
    });
  });

  it('assigns feature side by group and remainder layouts without duplicating sources', () => {
    const five = demoGalleryBentoTiles(frames(5));
    expect(five).toHaveLength(5);
    expect(five[0]).toMatchObject({ size: 'feature', side: 'left', remainder: false });
    expect(five.every((tile) => !tile.remainder)).toBe(true);

    const seven = demoGalleryBentoTiles(frames(7));
    expect(seven).toHaveLength(7);
    expect(seven.slice(5).map((tile) => tile.remainderKind)).toEqual(['pair', 'pair']);
    expect(seven.slice(5).every((tile) => tile.size === 'standard')).toBe(true);

    const eight = demoGalleryBentoTiles(frames(8));
    expect(eight).toHaveLength(8);
    expect(eight[5]).toMatchObject({ size: 'feature', remainder: true, remainderKind: 'partial' });
    expect(eight.slice(6).every((tile) => tile.size === 'standard' && tile.remainderKind === 'partial')).toBe(true);

    const nine = demoGalleryBentoTiles(frames(9));
    expect(nine).toHaveLength(9);
    expect(nine.slice(5).every((tile) => tile.size === 'standard' && tile.remainderKind === 'four')).toBe(true);

    const ten = demoGalleryBentoTiles(frames(10));
    expect(ten).toHaveLength(10);
    expect(ten[5]).toMatchObject({ size: 'feature', side: 'right', remainder: false });
    expect(new Set(ten.map((tile) => tile.image.src)).size).toBe(10);
  });

  it('keeps reading order identical to sequence and never asks CSS for masonry', () => {
    const tiles = demoGalleryBentoTiles();
    expect(tiles.map((tile) => tile.image.id)).toEqual(demoGallerySequence().map((image) => image.id));
    expect(demoGalleryBentoClassName(tiles[0]!)).toContain('bl-work-tile--feature');
    expect(demoGalleryBentoClassName(tiles[0]!)).toContain('bl-work-tile--left');
    expect(demoGalleryBentoClassName(tiles[5]!)).toContain('bl-work-tile--remainder-one');
    expect(demoGalleryBentoSizes(tiles[0]!)).toContain('50vw');
  });
});
