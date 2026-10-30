import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, HOMEPAGE_DESCRIPTION, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const hero = read('src/components/homepage/HomepageHero.astro');
const heroCss = read('src/styles/components/homepage-hero.css');
const freshaCss = read('src/styles/components/fresha-alternative.css');
const homepage = read('src/pages/index.astro');

const text = (source: string) => source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const between = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)) + end.length);

describe('homepage SEO', () => {
  it('uses the approved title and meta description', () => {
    expect(DEFAULT_TITLE).toBe('Barbershop Software & Barber Booking System UK | KERSIVO');
    expect(DEFAULT_DESCRIPTION).toBe(
      'UK barbershop software with your own branded website, domain and online bookings. Full KERSIVO is £39/month per location, with 0% KERSIVO commission.',
    );
    expect(DEFAULT_DESCRIPTION).toContain(`£${SAAS_MONTHLY_GBP}/month`);
    expect(DEFAULT_DESCRIPTION.length).toBeLessThanOrEqual(165);
  });

  it('keeps the canonical root, structured data and layout', () => {
    expect(homepage).toContain('title={DEFAULT_TITLE}');
    expect(homepage).toContain('description={getHomepageDescription(freePreview)}');
    expect(HOMEPAGE_DESCRIPTION).toContain(`£${SAAS_MONTHLY_GBP}/month`);
    expect(homepage).toContain('canonicalPath="/"');
    expect(homepage).toContain('jsonLd={buildHomepageJsonLd(freePreview)}');
    expect(homepage).not.toMatch(/noindex/);
  });
});

describe('homepage hero markup', () => {
  it('renders the product-first hero in place of the phone hero', () => {
    expect(homepage).toContain("import HomepageHero from '@/components/homepage/HomepageHero.astro';");
    expect(homepage).toMatch(/<HomepageHero \/>\s*<LandingDifference \/>/);
    expect(homepage).not.toMatch(/SystemChooser|LandingValueCards/);
    expect(homepage).not.toMatch(/BarbershopBookingHero|hero227|phone-5|iphonemockup|fetchpriority/);
    expect(existsSync(join(process.cwd(), 'src/components/barbershopBookingHero.astro'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'src/components/barbershopBookingHero.tsx'))).toBe(false);
  });

  it('keeps the #hero anchor and labels the section by its heading', () => {
    expect(hero).toContain('<section id="hero" class="home-hero" aria-labelledby="home-hero-title">');
  });

  it('server-renders exactly one H1 with the approved accessible text on three lines', () => {
    expect(hero.match(/<h1\b/g)).toHaveLength(1);
    const h1 = between(hero, '<h1', '</h1>');
    expect(h1).toContain('id="home-hero-title"');
    expect(text(h1)).toBe('Your own barbershop website and booking system. Not a marketplace listing.');
    expect(h1.match(/class="home-hero__title-line[^"]*"/g)).toEqual([
      'class="home-hero__title-line home-hero__title-line--primary"',
      'class="home-hero__title-line"',
      'class="home-hero__title-line"',
    ]);
    expect(h1).toMatch(
      />Your own barbershop<\/span><br \/>\s+<span[^>]*>website and booking system\.<\/span><br \/>\s+<span[^>]*>Not a marketplace listing\.<\/span>/,
    );
    expect(hero).not.toMatch(/sr-only|visually-hidden|display: none|aria-hidden="true">[A-Za-z]/);
  });

  it('has no other H1 on the homepage', () => {
    const imports = [...homepage.matchAll(/from '(?:@\/|\.\.\/)components\/([^']+)'/g)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(8);
    expect(homepage).not.toMatch(/<h1\b/);
    for (const file of imports) {
      const resolved = ['', '.astro', '.tsx'].map((ext) => join(process.cwd(), 'src/components', file + ext)).find(existsSync);
      if (!resolved || file === 'homepage/HomepageHero.astro') continue;
      expect(read(resolved.replace(process.cwd(), '')), file).not.toMatch(/<h1\b/);
    }
  });

  it('shows the approved eyebrow, lead, CTAs and meta row', () => {
    expect(text(between(hero, '<p class="home-hero__eyebrow">', '</p>'))).toBe(
      'Barbershop software for independent UK shops',
    );
    expect(text(between(hero, '<p class="home-hero__lead">', '</p>'))).toContain(
      `a month per location, not per barber`,
    );
    expect(hero).toMatch(
      /<a\s+href="\/admin\/launch"\s+class="btn btn--primary btn--lg home-hero__action home-hero__action--primary"\s+data-track="saas_subscribe_click"\s+data-track-placement="homepage_hero"\s*>\s*Start Full KERSIVO — £\{SAAS_MONTHLY_GBP\}\/month\s*<\/a>/,
    );
    expect(hero).toMatch(
      /<a href="#live-demo" class="btn btn--outline btn--lg home-hero__action home-hero__action--secondary" data-track="view_live_demo_click" data-track-placement="homepage_hero">\s*See it working\s*<\/a>/,
    );
    const meta = between(hero, '<div class="home-hero__meta"', '</div>');
    expect(meta).toContain('aria-label="KERSIVO commercial model"');
    expect(text(meta)).toBe(
      'No setup fee · No VAT added · 0% KERSIVO commission · Cancel anytime',
    );
    expect(hero).toContain('href="/starter"');
    expect(hero).toContain('starter_plan_explore_click');
    expect(read('src/components/landingDemoPreview.astro')).toContain("sectionId = 'live-demo'");
  });

  it('uses no phone mockup, device frame, scissors or display-face treatment', () => {
    expect(hero).not.toMatch(/<img|<picture|<svg|phone|iphone|mockup|scissors|antonio|hero227/i);
    expect(heroCss).not.toMatch(/phone|mockup|scissors|antonio|url\(/i);
  });

  it('places the shared live dashboard showcase below the copy', () => {
    expect(hero.indexOf('<HeroDashboardShowcase />')).toBeGreaterThan(hero.indexOf('home-hero__meta'));
  });
});

const FRESHA_HERO_END = '/* Fresha Alternative — isolated draft page styles.';
const HOME_HERO_END = '/*\n * One text block for LCP';

describe('homepage hero styles', () => {
  it('match the Fresha Alternative hero rule for rule, so both heroes share one visual language', () => {
    const freshaHeroRules = freshaCss.slice(freshaCss.indexOf('.fresha-alt-hero {'), freshaCss.indexOf(FRESHA_HERO_END));
    const homeRules = heroCss.slice(heroCss.indexOf('.home-hero {'), heroCss.indexOf(HOME_HERO_END));
    // Homepage-only conversion link can add isolated CSS without changing shared Fresha hero rules.
    const sharedHomeRules = homeRules
      .replace(/\.home-hero__honesty \{[^}]*\}\s*/g, '')
      .replace(/\.home-hero__starter-path(?: [^{]+)? \{[^}]*\}\s*/g, '');
    expect(sharedHomeRules.trim()).toBe(
      freshaHeroRules.replaceAll('fresha-alt-hero', 'home-hero').trim(),
    );
  });

  it('uses the black product background and the shared content width', () => {
    expect(heroCss).toMatch(/^\.home-hero \{[^}]*background: #030303;/m);
    expect(heroCss).toMatch(/\.home-hero__content \{[^}]*width: min\(94vw, 91\.1rem\);/);
    expect(heroCss).toMatch(/\.home-hero__action \{[^}]*min-height: var\(--btn-height-lg\);/);
  });

  it('stacks the CTAs full width on phones', () => {
    expect(heroCss).toMatch(
      /@media \(max-width: 38rem\) \{\s*\.home-hero__actions \{\s*width: min\(100%, 28rem\);\s*flex-direction: column;\s*\}\s*\.home-hero__action \{\s*width: 100%;\s*\}/,
    );
  });

  it('paints the first viewport immediately: no entrance animation on any hero text', () => {
    expect(heroCss).not.toMatch(/animation|@keyframes/);
    expect(heroCss.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/\.home-hero__title[^-{]*\{[^}]*(?:opacity|visibility)/);
  });

  it('renders the H1 lines inline so the whole heading is one LCP text block', () => {
    const lineRules = [...heroCss.matchAll(/^\.home-hero__title-line \{([^}]*)\}/gm)].map((m) => m[1]);
    expect(lineRules.at(-1)).toMatch(/display: inline;/);
  });
});
