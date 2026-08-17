import { describe, expect, it } from 'vitest';
import {
  DEMO_GALLERY,
  demoGalleryCountLabel,
  demoGalleryIndexLabel,
  demoGalleryNextIndex,
  demoGalleryOpenLabel,
  demoGalleryPrevIndex,
  demoGallerySequence,
} from './gallery';

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
