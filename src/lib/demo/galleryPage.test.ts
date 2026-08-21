import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEMO_GALLERY, demoGallerySequence } from './gallery';
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
const workCss = cssSource.slice(
  cssSource.indexOf("[data-theme='blackline'] .bl-gallery-intro"),
  cssSource.indexOf("[data-theme='blackline'] .bl-contact-page"),
);

describe('BLACKLINE Gallery page', () => {
  it('keeps the shared demo shell and compact gallery landmarks', () => {
    expect(pageSource).toContain('DemoLayout');
    expect(pageSource).toContain('DemoGalleryHero');
    expect(pageSource).toContain('DemoGalleryIndex');
    expect(pageSource).toContain('DemoGalleryClose');
    expect(pageSource).toContain('canonicalPath="/demo/gallery"');
    expect(DEMO_GALLERY_HREF).toBe('/demo/gallery');
    expect(heroSource).not.toContain("from '@/components/demo/DemoPageHero.astro'");
    expect(heroSource).not.toContain('<DemoPageHero');
    expect(heroSource).toContain('id="blackline-gallery-heading"');
    expect(indexSource).toContain('aria-labelledby="blackline-gallery-heading"');
    expect(indexSource).toContain('<figure');
    expect(indexSource).toContain('<dialog');
    expect(indexSource).toContain('role="dialog"');
    expect(indexSource).toContain('aria-modal="true"');
    expect(closeSource).toContain('id="blackline-gallery-close-heading"');
  });

  it('uses the compact intro copy and keeps the booking close', () => {
    expect(heroSource).toContain('03 · RECENT WORK');
    expect(heroSource).toContain('THE BLACKLINE CUT, IN FOCUS.');
    expect(heroSource).toContain('Fades, scissor work, beard shaping and the details in between.');
    expect(heroSource).not.toContain('The work,');
    expect(indexSource).not.toContain('Visual Index');
    expect(closeSource).toContain('Ready when you are');
    expect(closeSource).toContain('Your turn in the chair.');
    expect(closeSource).toContain('Choose your barber, service and time.');
    expect(closeSource).toContain('Book an appointment');
    expect(sources).not.toMatch(/luxury|award-winning|best in Manchester|expert|master|guaranteed|available today/i);
  });

  it('renders the six unique frames from curated clusters without duplicating sources', () => {
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
    expect(indexSource).toContain('demoGalleryBentoClusters');
    expect(indexSource).toContain('bl-work-clusters');
    expect(indexSource).toContain('bl-work-cluster--primary');
    expect(indexSource).toContain('bl-work-cluster--secondary');
    expect(indexSource).toContain('bl-work-cluster--closing');
    expect(indexSource).toContain('bl-work-cluster-stack');
    expect(indexSource).toContain('demoGalleryOpenLabel');
    expect(indexSource).toContain('data-work-open');
    expect(indexSource).toContain('data-work-alt');
    expect(indexSource).toContain('data-work-close');
    expect(indexSource).toContain('data-work-prev');
    expect(indexSource).toContain('data-work-next');
    expect(indexSource).toContain('aria-label="Close gallery"');
    expect(indexSource).toContain('aria-label="Previous image"');
    expect(indexSource).toContain('aria-label="Next image"');
    expect(indexSource).toContain('class="bl-work-dialog-stage"');
    expect(indexSource).toContain('View image');
    expect(indexSource).not.toContain('<button class="bl-work-view"');
    expect(indexSource.match(/data-work-close[\s\S]*?<svg/)).toBeTruthy();
    expect(indexSource).not.toContain('bl-work-dialog-nav');
    expect(indexSource).not.toMatch(/>Close</);
    expect(indexSource).toContain('loading="eager"');
    expect(indexSource).toContain('loading="lazy"');
    expect(closeSource).toContain('href={DEMO_BOOK_HREF}');
    expect(DEMO_BOOK_HREF).toBe('/demo/book');
    expect(sources).not.toMatch(/src=["']https?:\/\//);
    expect(sources).not.toMatch(/unsplash|images\.unsplash|blackline-0[1-8]\.png/i);
  });

  it('progressively enhances motion and keeps a single native dialog', () => {
    expect(cssSource).not.toMatch(/transition:\s*all/);
    expect(cssSource).toContain("[data-theme='blackline'][data-bl-gallery-motion]");
    expect(cssSource).toContain("[data-theme='blackline'] .bl-gallery-page *");
    expect(cssSource).toContain('transition-duration: 0s !important');
    expect(cssSource).toContain('@media (min-width: 700px)');
    expect(cssSource).toContain('@media (min-width: 1100px)');
    expect(cssSource).toContain("@media (hover: hover) and (pointer: fine)");
    expect(workCss).toContain('.bl-work-clusters');
    expect(workCss).toContain('.bl-work-cluster--primary');
    expect(workCss).toContain('aspect-ratio: var(--bl-work-ratio');
    expect(workCss).not.toContain('grid-template-columns: repeat(12, minmax(0, 1fr))');
    expect(workCss).not.toContain('grid-auto-rows: clamp(200px, 22vw, 280px)');
    expect(workCss).not.toContain('grid-auto-rows: clamp(140px, 36vw, 180px)');
    expect(workCss).toContain('object-fit: contain');
    expect(workCss).toContain('max-width: 92vw');
    expect(workCss).toContain('max-height: 86vh');
    expect(cssSource).toContain('.bl-work-dialog');
    expect(cssSource).toContain('.bl-gallery-item--fade');
    expect(pageSource).toContain("setAttribute('data-bl-gallery-motion'");
    expect(pageSource).toContain('showModal');
    expect(pageSource).toContain("overflow = 'hidden'");
    expect(pageSource).toContain('opener?.focus');
    expect(pageSource).toContain("toggleAttribute('inert'");
    expect(workCss).not.toMatch(/^\s*order:/m);
    expect(pageSource).toContain('touchstart');
    expect(pageSource).toContain('ArrowRight');
    expect(pageSource).not.toMatch(/addEventListener\(['"]scroll['"]/);
    expect(previewSource).toContain('bl-gallery-mosaic');
    expect(previewSource).not.toContain('bl-work-');
  });

  it('uses nested editorial clusters instead of one fragile global bento grid', () => {
    expect(indexSource).toContain('bl-work-index--editorial');
    expect(indexSource).toContain('--bl-work-ratio');
    expect(indexSource).toContain('--bl-work-ratio-mobile');
    expect(workCss).toContain('--bl-container-max: 90rem');
    expect(workCss).toContain('grid-template-columns: minmax(0, 2fr) minmax(0, 1fr)');
    expect(workCss).toContain('grid-template-columns: minmax(0, 42fr) minmax(0, 58fr)');
    expect(workCss).toContain('.bl-work-tile--featured');
    expect(workCss).toContain('.bl-work-cluster-stack');
    expect(workCss).toContain('.bl-work-tile--medium');
    expect(workCss).toContain('.bl-work-tile--large');
    expect(workCss).toContain('.bl-work-cluster--closing');
    expect(workCss).toContain('scale(1.02)');
    expect(workCss).toContain('translateY(14px)');
    expect(workCss).not.toContain('clip-path: inset(12% 8% 12% 8%)');
    expect(workCss).not.toContain('grid-column: 1 / 9');
    expect(workCss).not.toContain('grid-column: 1 / 6');
    expect(workCss).not.toContain('grid-column: 6 / 13');
    expect(workCss).not.toContain('.bl-work-tile--feature.bl-work-tile--left');
    expect(workCss).not.toContain('.bl-work-tile--remainder-one');
    expect(workCss).not.toContain('masonry');
    expect(workCss).not.toMatch(/(?<![-\w])columns\s*:/);
    expect(indexSource).not.toContain('nth-child');
    expect(cssSource).toContain('.bl-work-dialog-control');
    expect(cssSource).toContain('min-width: 48px');
    expect(cssSource).toContain('min-height: 48px');
    expect(cssSource).toContain('env(safe-area-inset-top, 0px)');
    expect(cssSource).toContain('object-fit: cover');
  });
});
