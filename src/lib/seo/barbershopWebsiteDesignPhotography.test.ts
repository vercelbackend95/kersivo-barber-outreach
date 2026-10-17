import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE } from './barbershopWebsiteDesignPage';
import { DEMO_GALLERY } from '@/lib/demo/gallery';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const designDir = '../../components/barbershop-website-design/';
const page = read('../../pages/barbershop-website-design/index.astro');
const section = read(`${designDir}WebsiteDesignPhotography.astro`);
const frontmatter = section.split('---')[1] ?? '';
const markup = section.split('---').slice(2).join('---');
const styles = read('../../styles/components/barbershop-website-design-photography.css');
const text = (source: string) => source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const POINTS = ['The shop', 'The barbers', 'The work', 'The details'];

describe('/barbershop-website-design — Section 05 people and photography', () => {
  it('renders after Section 04 and before the footer', () => {
    const mobile = page.indexOf('<WebsiteDesignMobile />');
    const photography = page.indexOf('<WebsiteDesignPhotography />');
    expect(mobile).toBeGreaterThan(-1);
    expect(photography).toBeGreaterThan(mobile);
    expect(page.indexOf('<Footer50')).toBeGreaterThan(photography);
    expect(page.match(/<WebsiteDesignPhotography \/>/g) ?? []).toHaveLength(1);
  });

  it('exposes the #your-team anchor exactly once across the page', () => {
    expect(markup).toContain('<section id="your-team" class="bwp" aria-labelledby="bwp-heading">');
    const sources = [page, ...['WebsiteDesignHero', 'WebsiteDesignBreakdown', 'WebsiteDesignBrand', 'WebsiteDesignMobile', 'WebsiteDesignPhotography']
      .map((name) => read(`${designDir}${name}.astro`))];
    expect(sources.join('\n').match(/id="your-team"/g) ?? []).toHaveLength(1);
    expect(styles).toMatch(/\.bwp \{[^}]*scroll-margin-top:/);
  });

  it('has one H2 with the approved heading, four point H3s in an ordered list and no H1', () => {
    expect(markup.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(text(markup.match(/<h2[\s\S]*?<\/h2>/)?.[0] ?? '')).toBe('Show Your Shop, Your Barbers and Your Work');
    expect(section).not.toMatch(/Show the People Behind the Chairs/i);
    expect(markup).not.toMatch(/<h1\b/);
    expect(markup).toMatch(/<ol class="bwp-points">[\s\S]*?\{points\.map\([\s\S]*?<h3 class="bwp-point__title">/);
    const titles = [...frontmatter.matchAll(/title: '([^']+)'/g)].map((match) => match[1]);
    expect(titles).toEqual(POINTS);
    expect(frontmatter).toMatch(/title: 'The details',\s*optional: true,/);
    expect(markup).toContain('<span class="bwp-point__optional">Optional</span>');
  });

  it('opens with the approved introduction', () => {
    expect(text(markup.match(/<p class="bwp__lede">([\s\S]*?)<\/p>/)?.[1] ?? '')).toBe(
      'Photography should help people recognise your shop and understand what you do. Start with the space, the barbers and the cuts — then add detail shots only where they earn their place.',
    );
  });

  it('reuses one existing CUTSTATE demo gallery photograph with its own alt text and dimensions', () => {
    expect(frontmatter).toContain("from '@/lib/demo/gallery'");
    expect(frontmatter).toContain("image.id === 'fade'");
    const photo = DEMO_GALLERY.find((image) => image.id === 'fade');
    expect(photo?.src).toBe('/demo/gallery/fade.webp');
    expect(photo?.width).toBe(1333);
    expect(photo?.height).toBe(2000);
    expect(existsSync(join(here, '../../../public/demo/gallery/fade.webp'))).toBe(true);
    const images = markup.match(/<img\b[\s\S]*?\/>/g) ?? [];
    expect(images).toHaveLength(1);
    for (const attr of ['src={photo.src}', 'alt={photo.alt}', 'width={photo.width}', 'height={photo.height}', 'loading="lazy"']) {
      expect(images[0]).toContain(attr);
    }
  });

  it('discloses the demo photograph as fictional stock imagery', () => {
    expect(text(markup.match(/<figcaption[\s\S]*?<\/figcaption>/)?.[0] ?? '')).toBe(
      'CUTSTATE BARBERS is a fictional KERSIVO demo. Stock photography shown, not a real customer.',
    );
    expect(markup).toMatch(/<\/figcaption>\s*<\/figure>/);
  });

  it('crops the photograph without distortion, taller beside the list than when stacked', () => {
    expect(styles).toMatch(/\.bwp-photo__img \{[^}]*aspect-ratio: 1 \/ 1;[^}]*object-fit: cover;/);
    expect(styles).toMatch(/@container \(min-width: 40rem\) \{\s*\.bwp-photo__img \{[^}]*aspect-ratio: 3 \/ 2;/);
    expect(styles).toMatch(/@container \(min-width: 56rem\) \{[\s\S]*?\.bwp-photo__img \{[^}]*aspect-ratio: 4 \/ 5;/);
  });

  it('gives a practical photo checklist and the approved takeaway', () => {
    const items = [...frontmatter.matchAll(/^\s*'([^']+)',$/gm)].map((match) => match[1]);
    expect(items).toEqual([
      'Framed so the subject is clear',
      'Sharp at full-screen size, not a cropped thumbnail',
      'Similar lighting across the set',
      'Photos you own or have permission to publish',
      'Consent from anyone recognisable in them',
    ]);
    expect(text(markup)).toContain(
      "Choose a few clear, genuine photographs over a large gallery that doesn't represent your shop.",
    );
  });

  it('explains missing-photo fallbacks without promising photography', () => {
    const copy = text(markup);
    expect(copy).toContain('No professional photographs yet?');
    expect(copy).toContain('a neutral placeholder can be used for a missing barber portrait');
    expect(copy).toContain('a neutral placeholder can be used for a missing barber portrait');
    expect(copy).toContain('an optional gallery can be left out');
    expect(copy).toContain('Your shop’s address and contact details are still needed before launch.');
  });

  it('links once to the demo team with tracking and a visible focus style', () => {
    const links = markup.match(/<a\b[\s\S]*?>/g) ?? [];
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('href={TEAM_HREF}');
    expect(links[0]).toContain('data-track={TRACK_EVENT}');
    expect(links[0]).toContain('data-track-placement={TRACK_PLACEMENT}');
    expect(frontmatter).toContain("const TEAM_HREF = '/demo/barbers';");
    expect(existsSync(join(here, '../../pages/demo/barbers.astro'))).toBe(true);
    expect(frontmatter).toContain("const TRACK_EVENT = 'view_live_demo_click';");
    expect(frontmatter).toContain("const TRACK_PLACEMENT = 'barbershop_website_design_photography_demo_team';");
    expect(text(markup.match(/<a\b[\s\S]*?<\/a>/)?.[0] ?? '')).toBe('Meet the CUTSTATE demo team');
    expect(styles).toMatch(/\.bwp-more__link \{[^}]*min-height: 2\.75rem;/);
    expect(styles).toMatch(/\.bwp-more__link:focus-visible \{[^}]*outline: 2px solid/);
  });

  it('makes no photography, results or bespoke promises and invents no thresholds', () => {
    const copy = text(section).toLowerCase();
    for (const claim of [
      /photo ?shoot|photography (service|session)|professional photography (is )?included|we (take|provide) (the )?photos/,
      /free (replacement )?photo/,
      /bespoke|unlimited|custom artwork/,
      /guarantee|\brank|more bookings|more clients|conversion/,
      /\d+\s*(photos|images|pictures)/,
      /\d+\s*(px|pixels|mp|megapixels)|\d{3,4}\s*x\s*\d{3,4}/,
      /award-winning|qualified|certified/,
    ]) {
      expect(copy).not.toMatch(claim);
    }
  });

  it('ships no client-side script, animation, gradient or BLACKLINE identity', () => {
    expect(section).not.toMatch(/<script\b|client:/);
    expect(styles).not.toMatch(/@keyframes|animation:|gradient\(/);
    expect(text(markup)).not.toMatch(/blackline/i);
  });

  it('adds no extra structured data and keeps the released page in the sitemap', () => {
    expect(section).not.toMatch(/application\/ld\+json|FAQPage/);
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE).toBe(true);
    expect(page).toContain('noindex={!BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE}');
    expect(page).toContain('robotsFollow');
    const locs = buildMarketingSitemapEntries().map((entry) => entry.loc);
    expect(locs).toContain('https://kersivo.co.uk/barbershop-website-design');
  });
});
