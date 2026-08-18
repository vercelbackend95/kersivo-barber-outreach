import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEMO_GALLERY, demoGalleryCountLabel, demoGallerySequence } from './gallery';
import { DEMO_BOOK_HREF, DEMO_GALLERY_HREF } from './nav';

const pageSource = readFileSync(new URL('../../pages/demo/gallery.astro', import.meta.url), 'utf8');
const heroSource = readFileSync(new URL('../../components/demo/DemoGalleryHero.astro', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../../components/demo/DemoGalleryIndex.astro', import.meta.url), 'utf8');
const closeSource = readFileSync(new URL('../../components/demo/DemoGalleryClose.astro', import.meta.url), 'utf8');
const previewSource = readFileSync(
  new URL('../../components/demo/DemoGalleryPreview.astro', import.meta.url),
  'utf8',
);
const cssSource = readFileSync(new URL('../../styles/demo/blackline.css', import.meta.url), 'utf8');
const sources = [pageSource, heroSource, indexSource, closeSource].join('\n');

describe('BLACKLINE Gallery page', () => {
  it('keeps the shared demo shell and editorial landmarks', () => {
    expect(pageSource).toContain('DemoLayout');
    expect(pageSource).toContain('DemoGalleryHero');
    expect(pageSource).toContain('DemoGalleryIndex');
    expect(pageSource).toContain('DemoGalleryClose');
    expect(pageSource).toContain('canonicalPath="/demo/gallery"');
    expect(DEMO_GALLERY_HREF).toBe('/demo/gallery');
    expect(heroSource).toContain("from '@/components/demo/DemoPageHero.astro'");
    expect(heroSource).toContain('headingId="blackline-gallery-heading"');
    expect(indexSource).toContain('aria-labelledby="blackline-gallery-index-heading"');
    expect(indexSource).toContain('id="blackline-gallery-index-heading"');
    expect(indexSource).toContain('<ol');
    expect(indexSource).toContain('<figure');
    expect(indexSource).toContain('<dialog');
    expect(closeSource).toContain('id="blackline-gallery-close-heading"');
  });

  it('uses the exact hero, index, and closing copy with computed frame count', () => {
    expect(heroSource).toContain('The</span> Work');
    expect(heroSource).toContain('The work,');
    expect(heroSource).toContain('up close.');
    expect(heroSource).toContain('A visual study of cuts, details and moments around the chair.');
    expect(heroSource).toContain('demoGalleryCountLabel');
    expect(heroSource).toContain('{countLabel}');
    expect(demoGalleryCountLabel()).toBe('06 FRAMES');
    expect(indexSource).toContain('Visual Index');
    expect(indexSource).toContain('Cuts, details, atmosphere.');
    expect(indexSource).toContain('A curated sequence from the fictional BLACKLINE world.');
    expect(closeSource).toContain('Ready when you are');
    expect(closeSource).toContain('Your turn in the chair.');
    expect(closeSource).toContain('Choose your barber, service and time.');
    expect(closeSource).toContain('Book an appointment');
    expect(sources).not.toMatch(/luxury|award-winning|best in Manchester|expert|master|guaranteed|available today/i);
  });

  it('preserves local frames, editorial roles, and the generic booking destination', () => {
    expect(demoGallerySequence().map((image) => image.id)).toEqual([
      'barber-at-work',
      'fade',
      'hairline',
      'beard',
      'scissor-cut',
      'interior-detail',
    ]);
    expect(DEMO_GALLERY.every((image) => image.src.startsWith('/demo/gallery/') && image.src.endsWith('.webp'))).toBe(
      true,
    );
    expect(indexSource).toContain('demoGallerySequence');
    expect(indexSource).toContain('demoGalleryOpenLabel');
    expect(indexSource).toContain('aria-label={demoGalleryOpenLabel(image, index, total)}');
    expect(indexSource).toContain('type="button"');
    expect(indexSource).toContain('data-work-open');
    expect(indexSource).toContain('data-work-close');
    expect(indexSource).toContain('data-work-prev');
    expect(indexSource).toContain('data-work-next');
    expect(indexSource).toContain('aria-label="Close gallery"');
    expect(indexSource).toContain('aria-label="Previous image"');
    expect(indexSource).toContain('aria-label="Next image"');
    expect(indexSource).toContain('class="bl-work-dialog-stage"');
    expect(indexSource.match(/data-work-close[\s\S]*?<svg/)).toBeTruthy();
    expect(indexSource.match(/data-work-prev[\s\S]*?<svg/)).toBeTruthy();
    expect(indexSource.match(/data-work-next[\s\S]*?<svg/)).toBeTruthy();
    expect(indexSource).not.toContain('bl-work-dialog-nav');
    expect(indexSource).not.toMatch(/>Close</);
    expect(indexSource).not.toMatch(/>Previous</);
    expect(indexSource).not.toMatch(/>Next</);
    expect(indexSource).toContain("loading={index === 0 ? 'eager' : 'lazy'}");
    expect(closeSource).toContain('DEMO_BOOK_HREF');
    expect(closeSource).toContain('href={DEMO_BOOK_HREF}');
    expect(DEMO_BOOK_HREF).toBe('/demo/book');
    expect(closeSource).not.toMatch(/\?barber=|\?service=/);
    expect(sources).not.toMatch(/src=["']https?:\/\//);
    expect(sources).not.toMatch(/unsplash|images\.unsplash|blackline-0[1-8]\.png/i);
  });

  it('progressively enhances motion without hiding the closing CTA', () => {
    expect(cssSource).not.toMatch(/transition:\s*all/);
    expect(cssSource).toContain("[data-theme='blackline'][data-bl-gallery-motion]");
    expect(cssSource).toContain("[data-theme='blackline'][data-bl-gallery-motion] .bl-work-close-eyebrow");
    expect(cssSource).not.toContain("[data-theme='blackline'][data-bl-gallery-motion] .bl-work-close-cta");
    expect(cssSource).toContain("[data-theme='blackline'] .bl-gallery-page *");
    expect(cssSource).toContain('transition-duration: 0s !important');
    expect(cssSource).toContain('@media (min-width: 720px)');
    expect(cssSource).toContain('@media (min-width: 1100px)');
    expect(cssSource).toContain("@media (hover: hover) and (pointer: fine)");
    expect(cssSource).toContain('grid-template-columns: repeat(12, minmax(0, 1fr))');
    expect(cssSource).toContain('object-fit: contain');
    expect(cssSource).toContain('.bl-work-dialog');
    expect(cssSource).toContain('.bl-gallery-item--fade');
    expect(pageSource).toContain("setAttribute('data-bl-gallery-motion'");
    expect(pageSource).toContain("removeAttribute('data-bl-gallery-motion'");
    expect(pageSource).toContain("prefers-reduced-motion: reduce");
    expect(pageSource).toContain('IntersectionObserver');
    expect(pageSource).toContain('unobserve');
    expect(pageSource).toContain('disconnect');
    expect(pageSource).toContain('pageshow');
    expect(pageSource).toContain('showModal');
    expect(pageSource).toContain("overflow = 'hidden'");
    expect(pageSource).toContain('opener?.focus');
    expect(pageSource).toContain("removeEventListener('keydown'");
    expect(pageSource).toContain('ArrowRight');
    expect(pageSource).toContain('ArrowLeft');
    expect(pageSource).not.toMatch(/addEventListener\(['"]scroll['"]/);
    expect(indexSource).not.toContain('is-inview');
    expect(closeSource).not.toContain('is-inview');
    expect(closeSource).toContain('href={DEMO_BOOK_HREF}');
    expect(previewSource).toContain('bl-gallery-mosaic');
    expect(previewSource).not.toContain('bl-work-');
    expect(cssSource).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*\.bl-work-close-arrow[\s\S]*transform: rotate\(45deg\)/,
    );
  });

  it('keeps editorial stages distinct from the list and dialog at the documented breakpoints', () => {
    expect(cssSource).toContain('row-gap: clamp(56px, 12vw, 88px)');
    expect(cssSource).toContain('column-gap: clamp(16px, 2vw, 32px)');
    expect(cssSource).toContain('row-gap: clamp(64px, 9vw, 144px)');
    expect(cssSource).toContain('.bl-work-item--wide .bl-work-stage');
    expect(cssSource).toContain('.bl-work-item--full .bl-work-stage');
    expect(cssSource).toContain('.bl-work-dialog-control');
    expect(cssSource).toContain('.bl-work-dialog-stage');
    expect(cssSource).toContain('min-width: 48px');
    expect(cssSource).toContain('min-height: 48px');
    expect(cssSource).toContain('min-width: 56px');
    expect(cssSource).toContain('min-height: 56px');
    expect(cssSource).toContain('border-radius: 50%');
    expect(cssSource).toContain('backdrop-filter: blur(10px)');
    expect(cssSource).toContain('max-width: calc(100vw - 1.5rem)');
    expect(cssSource).toContain('env(safe-area-inset-top, 0px)');
    expect(cssSource).toContain('left: max(0.5rem, env(safe-area-inset-left, 0px))');
    expect(cssSource).toContain('right: max(0.5rem, env(safe-area-inset-right, 0px))');
    expect(cssSource).toContain('transform: translateY(-50%)');
    expect(cssSource).not.toMatch(/\.bl-work-dialog-prev[\s\S]{0,220}bottom:/);
    expect(cssSource).not.toMatch(/\.bl-work-dialog-next[\s\S]{0,220}bottom:/);
    expect(cssSource).not.toMatch(/\.bl-work-dialog-control[\s\S]{0,400}100vw/);
    expect(cssSource).not.toContain('.bl-work-dialog-nav');
    expect(cssSource).toContain('scale(1.035)');
    expect(cssSource).toContain('scale(0.985)');
    expect(cssSource).toContain('object-fit: cover');
    expect(cssSource).not.toContain('masonry');
  });
});
