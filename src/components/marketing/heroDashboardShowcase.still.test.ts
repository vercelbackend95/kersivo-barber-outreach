import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DESKTOP_BLANK,
  PHONE_WIDTHS,
  STILL_DIR,
  STILL_SIZES,
  TABLET_MEDIA,
  TABLET_WIDTHS,
  phoneSrcset,
  tabletSrcset,
} from '@/lib/marketing/heroDashboardStill';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const text = (source: string) => source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const showcase = read('src/components/marketing/HeroDashboardShowcase.astro');
const css = read('src/styles/components/hero-dashboard-showcase.css');
const homepageHero = read('src/components/homepage/HomepageHero.astro');
const freshaHero = read('src/components/freshaAlternative/FreshaHero.astro');
const picture = showcase.slice(showcase.indexOf('<picture'), showcase.indexOf('</picture>') + '</picture>'.length);
const img = picture.match(/<img\b[\s\S]*?\/>/)?.[0] ?? '';
const mobileCss = css.slice(css.indexOf('@media (max-width: 48rem) {'));
const ASSET_DIR = 'public/images/hero-dashboard';

/** PNG/WebP/AVIF pixel dimensions straight from the file headers. */
function imageSize(path: string): { width: number; height: number } {
  const buf = readFileSync(join(ROOT, path));
  if (buf.toString('ascii', 1, 4) === 'PNG') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.toString('ascii', 12, 16) === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  const ispe = buf.indexOf('ispe');
  if (buf.toString('ascii', 4, 12) === 'ftypavif' && ispe > 0) {
    return { width: buf.readUInt32BE(ispe + 8), height: buf.readUInt32BE(ispe + 12) };
  }
  throw new Error(`Unexpected image format: ${path}`);
}

it('keeps the approved candidate widths', () => {
  expect(PHONE_WIDTHS).toEqual([800, 1000, 1200, 1280, 1600]);
  expect(TABLET_WIDTHS).toEqual([840, 1260, 1680]);
});

describe('hero showcase: static phone image', () => {
  it('renders a server-side picture with AVIF and lossless WebP sources and a PNG fallback', () => {
    expect(picture).toContain('<picture class="hero-showcase__still">');
    expect(showcase).toContain("from '@/lib/marketing/heroDashboardStill';");
    expect(phoneSrcset('avif')).toBe(
      PHONE_WIDTHS.map((w) => `/images/hero-dashboard/hero-dashboard-mobile-${w}.avif ${w}w`).join(', '),
    );
    expect(tabletSrcset('webp')).toBe(
      TABLET_WIDTHS.map((w) => `/images/hero-dashboard/hero-dashboard-tablet-${w}.webp ${w}w`).join(', '),
    );
    expect(img).toContain("srcset={phoneSrcset('png')}");
    expect(img).toContain('src={`${STILL_DIR}/hero-dashboard-mobile-1600.png`}');
    expect(STILL_DIR).toBe('/images/hero-dashboard');
    expect(STILL_SIZES).toBe('(max-width: 48rem) calc(100vw - 0.375rem), 48rem');
    expect(picture).not.toMatch(/\.jpe?g/i);
  });

  it('orders sources desktop blank, tablet crop, then phone crop, AVIF before WebP', () => {
    const sources = picture.match(/<source\b[\s\S]*?\/>/g) ?? [];
    expect(sources).toHaveLength(5);
    expect(TABLET_MEDIA).toBe('(min-width: 40.0625rem)');
    expect(sources[1]).toBe(
      '<source media={TABLET_MEDIA} type="image/avif" srcset={tabletSrcset(\'avif\')} sizes={STILL_SIZES} width="840" height="680" />',
    );
    expect(sources[2]).toBe(
      '<source media={TABLET_MEDIA} type="image/webp" srcset={tabletSrcset(\'webp\')} sizes={STILL_SIZES} width="840" height="680" />',
    );
    expect(sources[3]).toBe('<source type="image/avif" srcset={phoneSrcset(\'avif\')} sizes={STILL_SIZES} />');
    expect(sources[4]).toBe('<source type="image/webp" srcset={phoneSrcset(\'webp\')} sizes={STILL_SIZES} />');
  });

  it('gives tablets a shallower crop at the same breakpoint as the picture source', () => {
    expect(mobileCss).toMatch(
      /@media \(min-width: 40\.0625rem\) \{\s*\.hero-showcase__still img \{\s*aspect-ratio: 840 \/ 680;\s*object-fit: cover;\s*object-position: left top;\s*\}/,
    );
  });

  it('has the approved alt text and explicit intrinsic dimensions', () => {
    expect(img).toContain('alt="KERSIVO barbershop admin dashboard preview"');
    expect(img).toContain('width="800"');
    expect(img).toContain('height="900"');
    expect(mobileCss).toMatch(/\.hero-showcase__still img \{[^}]*height: auto;[^}]*aspect-ratio: 800 \/ 900;/);
  });

  it('runs to the right edge of the screen, open on that side, and fades out', () => {
    const still = mobileCss.match(/\.hero-showcase__still \{[^}]*\}/)?.[0] ?? '';
    expect(still).toContain('max-width: none;');
    expect(still).toContain('margin-right: -0.375rem;');
    expect(still).toContain('border-radius: 0.78rem 0 0 0.78rem;');
    const fade = 'linear-gradient(to right, #000 0%, #000 78%, transparent 100%)';
    expect(still).toContain(`-webkit-mask-image: ${fade};`);
    expect(still).toContain(`  mask-image: ${fade};`);
    expect(still).not.toMatch(/box-shadow|filter|blur/);
  });

  it('loads eagerly at high priority as the phone LCP image, without a preload', () => {
    expect(img).toContain('loading="eager"');
    expect(img).toContain('fetchpriority="high"');
    expect(img).toContain('decoding="async"');
    expect(showcase.match(/fetchpriority/g)).toHaveLength(1);
    expect(showcase).not.toContain('rel="preload"');
    expect(read('src/layouts/LandingLayout.astro')).not.toContain('hero-dashboard');
    for (const page of ['src/pages/index.astro', 'src/pages/fresha-alternative/index.astro']) {
      expect(read(page)).not.toContain('hero-dashboard');
    }
  });

  it('resolves to an inline blank above 48rem so desktop never downloads the image', () => {
    const sources = picture.match(/<source\b[\s\S]*?\/>/g) ?? [];
    expect(sources[0]).toContain('media="not all and (max-width: 48rem)"');
    expect(sources[0]).toContain('srcset={DESKTOP_BLANK}');
    expect(DESKTOP_BLANK).toMatch(/^data:image\/gif;base64,[A-Za-z0-9+/=]+$/);
    expect(css).toContain('@media (max-width: 48rem) {');
  });

  it('keeps the desktop iframe route and title, and puts no image inside the live viewport', () => {
    const viewport = showcase.slice(showcase.indexOf('data-deferred-demo-frame'), showcase.indexOf('<picture'));
    expect(viewport).toContain('data-deferred-src="/demo/admin?embed=hero&section=bookings_dashboard"');
    expect(viewport.match(/title="Interactive KERSIVO owner dashboard demo"/g)).toHaveLength(2);
    expect(viewport).not.toMatch(/<img|<picture/);
  });

  it('keeps the desktop caption and gives the phone image a caption without interactive claims', () => {
    const interactive = showcase.match(/<p class="hero-showcase__caption hero-showcase__caption--interactive">([\s\S]*?)<\/p>/)?.[1];
    const still = showcase.match(/<p class="hero-showcase__caption hero-showcase__caption--still">([\s\S]*?)<\/p>/)?.[1];
    expect(text(interactive ?? '')).toBe(
      'This is the real KERSIVO demo dashboard. Click around — bookings, team, reports and more.',
    );
    expect(text(still ?? '')).toBe('Real KERSIVO dashboard preview.');
    expect(still).not.toMatch(/click|interactive|explore|tap/i);
  });

  it('swaps image and live frame at 48rem in CSS', () => {
    expect(css).toMatch(/\.hero-showcase__still,\s*\.hero-showcase__caption--still \{\s*display: none;\s*\}/);
    expect(mobileCss).toMatch(/\.hero-showcase__viewport,\s*\.hero-showcase__caption--interactive \{\s*display: none;\s*\}/);
    expect(mobileCss).toMatch(/\.hero-showcase__still \{[^}]*display: block;[^}]*border-radius: 0\.78rem 0 0 0\.78rem;[^}]*background: #030303;/);
    expect(mobileCss).toMatch(/\.hero-showcase__caption--still \{\s*display: block;\s*\}/);
    expect(mobileCss).not.toMatch(/32rem|35rem|44rem|40rem/);
  });

  it('shows the glow under the image without waiting for the live frame', () => {
    expect(mobileCss).toMatch(
      /\.hero-showcase:has\(> \.hero-showcase__viewport:not\(\[data-frame-state='ready'\]\)\)\s*> \.hero-showcase__glow \{\s*opacity: 0\.82;\s*\}/,
    );
  });

  it('ships the native-resolution assets the markup references', () => {
    const expected: Record<string, { width: number; height: number }> = {};
    for (const ext of ['png', 'webp', 'avif']) {
      for (const w of PHONE_WIDTHS) expected[`hero-dashboard-mobile-${w}.${ext}`] = { width: w, height: (w * 720) / 640 };
      for (const w of TABLET_WIDTHS) expected[`hero-dashboard-tablet-${w}.${ext}`] = { width: w, height: (w * 680) / 840 };
    }
    expect(readdirSync(join(ROOT, ASSET_DIR)).sort()).toEqual(Object.keys(expected).sort());
    const limits = { avif: 80_000, webp: 150_000, png: 250_000 };
    for (const [file, size] of Object.entries(expected)) {
      const path = `${ASSET_DIR}/${file}`;
      expect(existsSync(join(ROOT, path)), path).toBe(true);
      expect(imageSize(path), path).toEqual(size);
      expect(statSync(join(ROOT, path)).size, path).toBeLessThan(limits[file.split('.').pop() as keyof typeof limits]);
    }
  });

  it('is produced by the repeatable capture script from the real hero dashboard', () => {
    const script = read('scripts/capture-hero-dashboard-mobile.mjs');
    expect(script).toContain('/demo/admin?embed=hero&section=bookings_dashboard');
    expect(script).toContain('html[data-hero-showcase-ready="true"]');
    expect(script).toContain("default: '1100x900'");
    expect(script).toContain("phone: { crop: '0,0,640,720', dprs: '2.5,2,1.875,1.5625,1.25', name: 'hero-dashboard-mobile' }");
    expect(script).toContain("tablet: { crop: '0,0,840,680', dprs: '2,1.5,1', name: 'hero-dashboard-tablet' }");
    expect(script).toContain("'kersivo:hero-showcase-visible'");
    expect(script).toContain("nowLabel.includes('15:25')");
    expect(script).toContain('webp({ lossless: true, quality: 100');
    expect(script).toContain("avif({ quality: avifQuality, effort: 9, chromaSubsampling: '4:4:4' })");
    expect(script).toContain("'avif-quality': { type: 'string', default: '70' }");
  });
});

describe('hero showcase: one shared implementation', () => {
  it('is used, unduplicated, by the homepage and Fresha heroes', () => {
    for (const hero of [homepageHero, freshaHero]) {
      expect(hero).toContain("import HeroDashboardShowcase from '@/components/marketing/HeroDashboardShowcase.astro';");
      expect(hero.split('<HeroDashboardShowcase />')).toHaveLength(2);
      expect(hero).not.toMatch(/hero-dashboard-mobile|hero-showcase__still|<picture|<iframe/);
    }
  });
});
