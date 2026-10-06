import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

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
      'Barbershop software for independent UK barbershops. Start KERSIVO Starter at £0/month or choose Full for your own website and domain. 0% KERSIVO commission.',
    );
    expect(DEFAULT_DESCRIPTION).toContain(`£${SAAS_MONTHLY_GBP}/month`);
    expect(DEFAULT_DESCRIPTION.length).toBeLessThanOrEqual(165);
  });

  it('keeps the canonical root, structured data and layout', () => {
    expect(homepage).toContain('title={DEFAULT_TITLE}');
    expect(homepage).toContain('description={DEFAULT_DESCRIPTION}');
    expect(homepage).toContain('canonicalPath="/"');
    expect(homepage).toContain('jsonLd={[buildBarberDemoJsonLd(), buildBarbershopBookingFaqJsonLd()]}');
    expect(homepage).not.toMatch(/noindex/);
  });
});

describe('homepage hero markup', () => {
  it('renders the product-first hero in place of the phone hero', () => {
    expect(homepage).toContain("import HomepageHero from '@/components/homepage/HomepageHero.astro';");
    expect(homepage).toMatch(/<SystemChooser \/>\s*<HomepageHero \/>\s*<LandingValueCards \/>/);
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
    expect(text(h1)).toBe('Barbershop software built around your brand.');
    expect(h1.match(/class="home-hero__title-line[^"]*"/g)).toEqual([
      'class="home-hero__title-line home-hero__title-line--primary"',
      'class="home-hero__title-line"',
      'class="home-hero__title-line"',
    ]);
    expect(h1).toMatch(
      />Barbershop software<\/span><br \/>\s+<span[^>]*>built around your<\/span><br \/>\s+<span[^>]*>brand\.<\/span>/,
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
    expect(text(between(hero, '<p class="home-hero__eyebrow">', '</p>'))).toBe('Built for independent UK barbershops');
    expect(text(between(hero, '<p class="home-hero__lead">', '</p>'))).toBe(
      'A barber booking system for independent UK barbershops. Start with payment-powered bookings for £0/month, or choose Full KERSIVO to put the complete customer journey on your own website and domain.',
    );
    expect(hero).toMatch(
      /<a\s+href="\/admin"\s+class="home-hero__action home-hero__action--primary"\s+data-track="starter_signup_click"\s+data-track-placement="homepage_hero"\s*>\s*Start KERSIVO Starter — £0\/month\s*<\/a>/,
    );
    expect(hero).toMatch(
      /<a href="#live-demo" class="home-hero__action home-hero__action--secondary">\s*See KERSIVO in action\s*<\/a>/,
    );
    const meta = between(hero, '<div class="home-hero__meta"', '</div>');
    expect(meta).toContain('aria-label="KERSIVO commercial model"');
    expect(text(meta)).toBe('Starter £0/month · Full £{SAAS_MONTHLY_GBP}/month per location · 0% KERSIVO commission');
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

describe('homepage hero styles', () => {
  it('match the Fresha Alternative hero rule for rule, so both heroes share one visual language', () => {
    const MOTION = '@media (prefers-reduced-motion: no-preference) {';
    const freshaHeroRules = freshaCss.slice(freshaCss.indexOf('.fresha-alt-hero {'), freshaCss.indexOf(MOTION));
    const homeRules = heroCss.slice(heroCss.indexOf('.home-hero {'), heroCss.indexOf(MOTION));
    expect(homeRules.trim()).toBe(
      freshaHeroRules.replaceAll('fresha-alt-hero', 'home-hero').replaceAll('freshaAltHeroRise', 'homeHeroRise').trim(),
    );
  });

  it('uses the black product background and the shared content width', () => {
    expect(heroCss).toMatch(/^\.home-hero \{[^}]*background: #030303;/m);
    expect(heroCss).toMatch(/\.home-hero__content \{[^}]*width: min\(94vw, 91\.1rem\);/);
    expect(heroCss).toMatch(/\.home-hero__action \{[^}]*min-height: 2\.75rem;/);
  });

  it('stacks the CTAs full width on phones', () => {
    expect(heroCss).toMatch(
      /@media \(max-width: 38rem\) \{\s*\.home-hero__actions \{\s*width: min\(100%, 28rem\);\s*flex-direction: column;\s*\}\s*\.home-hero__action \{\s*width: 100%;\s*\}/,
    );
  });

  it('staggers the text entrance only when motion is allowed, and never per letter', () => {
    const motion = heroCss.slice(heroCss.indexOf('@media (prefers-reduced-motion: no-preference) {'));
    expect(motion).toMatch(/animation: homeHeroRise 720ms cubic-bezier\(0\.18, 0\.82, 0\.2, 1\) both;/);
    const delays = [...motion.matchAll(/\.home-hero__(\w+) \{\s*animation-delay: (\d+)ms;/g)].map((m) => `${m[1]}:${m[2]}`);
    expect(delays).toEqual(['title:70', 'lead:130', 'actions:190', 'meta:240']);
    expect(motion).toMatch(/\.home-hero__eyebrow,\s*\.home-hero__lead,\s*\.home-hero__actions,\s*\.home-hero__meta \{\s*animation: homeHeroRise /);
    const outside = heroCss.slice(0, heroCss.indexOf('@media (prefers-reduced-motion: no-preference) {'));
    expect(outside).not.toMatch(/animation|@keyframes|(?<!text-)transform/);
    expect(heroCss).not.toMatch(/title-line[^{]*\{[^}]*animation|char|letter-\d/);
  });

  it('keeps the H1 fully visible from first paint so it can be the LCP element', () => {
    const titleAnimations = [...heroCss.matchAll(/\.home-hero__title\s*(?:,[^{]*)?\{[^}]*animation(?:-name)?: (\w+)/g)].map((m) => m[1]);
    expect(titleAnimations).toEqual(['homeHeroTitleRise']);
    expect(heroCss).not.toMatch(/(?:^|[\s,])\.home-hero__title\s*,/m);
    const keyframes = heroCss.match(/@keyframes homeHeroTitleRise \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(keyframes).toMatch(/from \{\s*transform: translateY\(14px\);\s*\}\s*to \{\s*transform: translateY\(0\);\s*\}/);
    expect(keyframes).not.toContain('opacity');
    expect(heroCss.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/\.home-hero__title[^-{]*\{[^}]*(?:opacity|visibility)/);
  });

  it('renders the H1 lines inline so the whole heading is one LCP text block', () => {
    const lineRules = [...heroCss.matchAll(/^\.home-hero__title-line \{([^}]*)\}/gm)].map((m) => m[1]);
    expect(lineRules.at(-1)).toMatch(/display: inline;/);
  });
});
