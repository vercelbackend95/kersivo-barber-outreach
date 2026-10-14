import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE } from './barbershopWebsiteDesignPage';
import { DEMO_BOOK_HREF } from '@/lib/demo/nav';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/barbershop-website-design/index.astro');
const section = read('../../components/barbershop-website-design/WebsiteDesignMobile.astro');
const frontmatter = section.split('---')[1] ?? '';
const markup = section.split('---').slice(2).join('---');
const styles = read('../../styles/components/barbershop-website-design-mobile.css');
const demoHome = read('../../pages/demo/index.astro');
const text = (source: string) => source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const constant = (name: string) => frontmatter.match(new RegExp(`const ${name} = '([^']+)'`))?.[1] ?? '';

const PRINCIPLES = ['Read it at a glance', 'Find the next step', 'Use it without friction'];

describe('/barbershop-website-design — Section 04 mobile design', () => {
  it('renders after Section 03 and before the footer', () => {
    const brand = page.indexOf('<WebsiteDesignBrand />');
    const mobile = page.indexOf('<WebsiteDesignMobile />');
    expect(brand).toBeGreaterThan(-1);
    expect(mobile).toBeGreaterThan(brand);
    expect(page.indexOf('<Footer50')).toBeGreaterThan(mobile);
    expect(page.match(/<WebsiteDesignMobile \/>/g) ?? []).toHaveLength(1);
  });

  it('has exactly one H2 with the approved heading, three principle H3s and no H1', () => {
    expect(markup.match(/<h2\b/g) ?? []).toHaveLength(1);
    expect(text(markup.match(/<h2[\s\S]*?<\/h2>/)?.[0] ?? '')).toBe('Designed for the Phone in Your Client’s Hand');
    expect(markup).toContain('aria-labelledby="bwm-heading"');
    expect(markup).not.toMatch(/<h1\b/);
    expect(markup.match(/<h3\b/g) ?? []).toHaveLength(1);
    expect(markup).toMatch(/<ol class="bwm-principles">[\s\S]*?\{principles\.map\(/);
    const titles = [...frontmatter.matchAll(/title: '([^']+)'/g)].map((match) => match[1]);
    expect(titles).toEqual(PRINCIPLES);
  });

  it('opens with the approved introduction', () => {
    expect(text(markup.match(/<p class="bwm__lede">([\s\S]*?)<\/p>/)?.[1] ?? '')).toBe(
      "A mobile-friendly barbershop website should make the shop name, services and booking route easy to use on a smaller screen. Text should stay readable, buttons should be easy to tap and important details shouldn't disappear behind visual effects.",
    );
  });

  it('recreates the CUTSTATE mobile homepage from real demo data and copy', () => {
    expect(frontmatter).toContain("from '@/lib/demo/site'");
    expect(frontmatter).toContain("from '@/lib/demo/services'");
    expect(frontmatter).toContain('getDemoFeaturedServices()');
    expect(frontmatter).toContain('formatDemoPriceGbp(');
    for (const name of ['HERO_EYEBROW', 'HERO_DISPLAY', 'HERO_LEDE']) {
      const copy = constant(name);
      expect(copy.length).toBeGreaterThan(0);
      expect(demoHome).toContain(copy);
    }
    expect(markup).toContain('{DEMO_SHOP_NAME}');
  });

  it('shows the approved CUTSTATE logo once, lazy-loaded with explicit dimensions', () => {
    const images = markup.match(/<img\b[\s\S]*?\/>/g) ?? [];
    expect(images).toHaveLength(1);
    expect(images[0]).toContain('src={CUTSTATE_LOGO_SRC}');
    expect(images[0]).toContain('width={CUTSTATE_LOGO_WIDTH}');
    expect(images[0]).toContain('height={CUTSTATE_LOGO_HEIGHT}');
    expect(images[0]).toContain('loading="lazy"');
    expect(images[0]).toContain('alt=""');
  });

  it('describes the illustration once and keeps it non-interactive', () => {
    expect(markup.match(/role="img"/g) ?? []).toHaveLength(1);
    expect(markup).toContain('aria-label={screenLabel}');
    expect(markup).toContain('class="bwm-screen__canvas" aria-hidden="true"');
    const figure = markup.match(/<figure[\s\S]*?<\/figure>/)?.[0] ?? '';
    expect(figure).not.toMatch(/<a\b|<button\b|<input\b|tabindex/);
    expect(frontmatter).toMatch(/const screenLabel = `Illustration of /);
    expect(frontmatter).toContain('fictional KERSIVO demonstration shop');
  });

  it('labels the visual as an illustration and discloses CUTSTATE as fictional', () => {
    const copy = text(markup);
    expect(copy).toContain('Illustration recreating the CUTSTATE demo mobile homepage.');
    expect(copy).toContain('CUTSTATE BARBERS is a fictional KERSIVO demonstration shop.');
    expect(copy).toContain('Explore the working booking journey in the demo.');
    expect(copy).not.toMatch(/lives in the demo, not in this illustration/);
  });

  it('describes the actions in the order the illustration shows them', () => {
    expect(frontmatter).toContain(
      "body: 'A full-width booking button follows the introduction, with ‘Explore services’ directly below. The header keeps booking and navigation easy to find.',",
    );
    expect(text(section).toLowerCase()).not.toMatch(/thumb|beside it|directly under the headline/);
    const next = markup.match(/<span class="bwm-phone__block bwm-phone__block--next">([\s\S]*?)<\/span>\s*<\/span>/)?.[1] ?? '';
    expect(next.indexOf('Book an appointment')).toBeGreaterThan(-1);
    expect(next.indexOf('Explore services')).toBeGreaterThan(next.indexOf('Book an appointment'));
  });

  it('anchors marker 01 to the shop name and headline rather than the eyebrow', () => {
    const read = markup.match(/<span class="bwm-phone__block bwm-phone__block--read">([\s\S]*?)<\/span>\s*<\/span>/)?.[1] ?? '';
    const children = [...read.matchAll(/<span class="([^"]+)">/g)].map((match) => match[1]);
    expect(children.slice(0, 3)).toEqual(['bwm-marker', 'bwm-phone__name', 'bwm-phone__display']);
    expect(read).not.toContain('bwm-phone__eyebrow');
    expect(markup).toMatch(/<span class="bwm-phone__intro">\s*<span class="bwm-phone__eyebrow">\{HERO_EYEBROW\}<\/span>/);
    expect(frontmatter).toContain('Markers 01 to 03 point to the shop name and headline, the booking buttons and the service rows.');
    expect(styles).toMatch(/\.bwm-phone__block--read \.bwm-marker \{[^}]*var\(--bwm-name-size\)/);
  });

  it('links once to the demo booking flow with tracking and a visible focus style', () => {
    const links = markup.match(/<a\b[\s\S]*?>/g) ?? [];
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('href={DEMO_BOOK_HREF}');
    expect(text(markup.match(/<a\b[\s\S]*?<\/a>/)?.[0] ?? '')).toBe('Try the demo booking flow');
    expect(DEMO_BOOK_HREF).toBe('/demo/book');
    expect(links[0]).toContain('data-track={TRACK_EVENT}');
    expect(links[0]).toContain('data-track-placement={TRACK_PLACEMENT}');
    expect(frontmatter).toContain("const TRACK_EVENT = 'view_live_demo_click';");
    expect(frontmatter).toContain("const TRACK_PLACEMENT = 'barbershop_website_design_mobile_demo_book';");
    expect(styles).toMatch(/\.bwm-try__link \{[^}]*min-height: 2\.75rem;/);
    expect(styles).toMatch(/\.bwm-try__link:focus-visible \{[^}]*outline: 2px solid/);
  });

  it('ships no client-side script, animation or BLACKLINE identity', () => {
    expect(section).not.toMatch(/<script\b|client:/);
    expect(styles).not.toMatch(/@keyframes|animation:/);
    expect(text(markup)).not.toMatch(/blackline/i);
    expect(frontmatter).not.toMatch(/'[^']*BLACKLINE[^']*'|`[^`]*BLACKLINE[^`]*`/);
  });

  it('makes no ranking, speed or conversion claims', () => {
    const copy = text(section).toLowerCase();
    for (const claim of [
      /\brank/,
      /seo boost|google loves/,
      /faster|speed|load time|pagespeed|core web vitals/,
      /conversion|convert/,
      /more bookings|more clients|increase/,
      /guarantee/,
      /\d+\s*%/,
    ]) {
      expect(copy).not.toMatch(claim);
    }
  });

  it('adds no structured data and leaves the page noindex, follow and out of the sitemap', () => {
    expect(section).not.toMatch(/application\/ld\+json|FAQPage/);
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE).toBe(false);
    expect(page).toContain('noindex={!BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE}');
    expect(page).toContain('robotsFollow');
    const locs = buildMarketingSitemapEntries().map((entry) => entry.loc);
    expect(locs).not.toContain('https://kersivo.co.uk/barbershop-website-design');
  });
});
