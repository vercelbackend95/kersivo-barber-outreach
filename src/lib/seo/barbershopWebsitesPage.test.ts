import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { resolveCanonicalUrl, resolveRobotsContent } from './meta';
import {
  BARBERSHOP_WEBSITES_PAGE_DESCRIPTION,
  BARBERSHOP_WEBSITES_PAGE_H1,
  BARBERSHOP_WEBSITES_PAGE_INDEXABLE,
  BARBERSHOP_WEBSITES_PAGE_PATH,
  BARBERSHOP_WEBSITES_PAGE_TITLE,
} from './barbershopWebsitesPage';
import { BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE } from './barbershopWebsiteDesignPage';
import { DEMO_SERVICES } from '@/lib/demo/services';
import { CUTSTATE_LOGO_SRC } from '@/components/demo/BlacklineWordmark';
import { getRouteFamily } from '@/lib/navigation/routeFamilies';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/barbershop-websites/index.astro');
const componentDir = '../../components/barbershop-websites/';
const hero = read(`${componentDir}BarbershopWebsitesHero.astro`);
const components = [
  hero,
  read(`${componentDir}BlacklineWebsitePreview.astro`),
  read(`${componentDir}BookingPreview.astro`),
  read(`${componentDir}WebsiteFeaturesPanel.astro`),
  read(`${componentDir}HeroBenefits.astro`),
];

describe('/barbershop-websites pillar hero', () => {
  it('uses the approved metadata and canonical URL', () => {
    expect(BARBERSHOP_WEBSITES_PAGE_PATH).toBe('/barbershop-websites');
    expect(resolveCanonicalUrl(BARBERSHOP_WEBSITES_PAGE_PATH)).toBe('https://kersivo.co.uk/barbershop-websites');
    expect(BARBERSHOP_WEBSITES_PAGE_TITLE).toBe('Barbershop Website with Online Booking UK | KERSIVO');
    expect(BARBERSHOP_WEBSITES_PAGE_DESCRIPTION).toContain('£39/month');
    expect(page).toContain('canonicalPath={BARBERSHOP_WEBSITES_PAGE_PATH}');
  });

  it('publishes the canonical pillar for search and includes it in the sitemap', () => {
    expect(BARBERSHOP_WEBSITES_PAGE_INDEXABLE).toBe(true);
    expect(page).toContain('noindex={!BARBERSHOP_WEBSITES_PAGE_INDEXABLE}');
    expect(page).toContain('robotsFollow');
    expect(resolveRobotsContent({ noindex: !BARBERSHOP_WEBSITES_PAGE_INDEXABLE, robotsFollow: true })).toBeUndefined();
    const locs = buildMarketingSitemapEntries().map((entry) => entry.loc);
    expect(locs).toContain('https://kersivo.co.uk/barbershop-websites');
  });

  it('renders exactly one H1 built from the approved headline', () => {
    const h1Count = [page, ...components].join('\n').match(/<h1\b/g) ?? [];
    expect(h1Count).toHaveLength(1);
    expect(hero).toContain('BARBERSHOP_WEBSITES_PAGE_H1');
    expect(BARBERSHOP_WEBSITES_PAGE_H1).toBe('Barbershop Websites with Online Booking');
  });

  it('only draws the accent full stop inside the final headline line when the H1 ends with one', () => {
    expect(hero).toContain("const endsWithFullStop = BARBERSHOP_WEBSITES_PAGE_H1.endsWith('.')");
    expect(hero).toContain('endsWithFullStop && index === lines.length - 1');
    expect(hero).not.toMatch(/<span>\{lineTwo\}<span class="bsw-accent">/);
  });

  it('keeps the price line under the H1 and moves Stripe fees plus the refund line into pricing', () => {
    expect(hero).toContain('your own domain');
    expect(hero).not.toContain('a standard domain');
    expect(hero).toContain('0% KERSIVO commission');
    expect(hero).not.toContain('STRIPE_FEES_NOTE');
    expect(hero).not.toContain('bsw-hero__price-note');
    const offer = read(`${componentDir}FullOffer.astro`);
    expect(offer).toContain('STRIPE_FEES_NOTE');
    expect(offer).toContain('landingConditionsLine2');
    expect(offer).toContain('How payment works');
    expect(offer).toContain('part="primary"');
    expect(offer).not.toContain('part="all"');
  });

  it('uses real demo data, no iframes, and labels CUTSTATE as fictional', () => {
    const source = components.join('\n');
    expect(source).not.toMatch(/<iframe|<embed|<video/);
    expect(source).not.toMatch(/<select|<input|<button/);
    expect(hero).toContain('CUTSTATE BARBERS is a fictional demonstration shop');
    for (const slug of ['haircut-finish', 'beard-trim', 'skin-fade', 'wash-style-finish']) {
      expect(DEMO_SERVICES.some((service) => service.slug === slug)).toBe(true);
    }
  });

  it('points all six feature links at the working demo and keeps guide pages in essentials', () => {
    const panel = read(`${componentDir}WebsiteFeaturesPanel.astro`);
    const essentials = read(`${componentDir}WebsiteEssentials.astro`);
    expect(panel).toContain('Your website. Your business.');
    const capabilities = ['Branding', 'Services', 'Your team', 'Retail shop', 'Online booking', 'Contact & location'];
    for (const label of capabilities) expect(panel).toContain(`label: '${label}'`);
    expect((panel.match(/key: '/g) ?? [])).toHaveLength(6);
    expect(panel).not.toContain('Hero sections');
    expect(panel).not.toContain("label: 'Gallery'");
    expect(panel).toContain('aria-labelledby=');
    expect(panel).toContain('class="bsw-thumb__booking-slots" aria-hidden="true"');
    for (const route of ['DEMO_HOME_HREF', '/demo/services', '/demo/barbers', 'DEMO_SHOP_HREF', 'DEMO_BOOK_HREF', 'DEMO_CONTACT_HREF']) {
      expect(panel).toContain(route);
    }
    expect(panel).not.toContain('BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH');
    expect(panel).not.toContain('BARBERSHOP_ONLINE_BOOKING_PAGE_PATH');
    expect(essentials).toContain('BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH');
    expect(essentials).toContain('#your-team');
    expect(essentials).toContain('BARBERSHOP_ONLINE_BOOKING_PAGE_PATH');
  });

  it('uses a visual-only calendar rail matching the real booking date picker', () => {
    const preview = read(`${componentDir}BookingPreview.astro`);
    const calendar = preview.split('<p class="bsw-step__label">Pick a date')[1]
      ?.split('<p class="bsw-step__label">Choose a time')[0] ?? '';
    expect(calendar).toContain('bsw-date-preview__header');
    expect(calendar).toContain('bsw-date-preview__days');
    expect(calendar).toContain("'is-selected': day.selected");
    expect(calendar).toContain('dates.monthLabel');
    expect(calendar).toContain('Example dates');
    expect(calendar).toContain('not interactive');
    expect(calendar).not.toMatch(/October|20\d{2}|<button|<input|<a\b|onClick|onChange/);
    expect(preview).toContain('bookingPreviewDates');
    expect(preview).toContain('Client booking flow');
    expect(preview).toContain('Try the booking demo');
    expect(preview).toContain('class="btn btn--primary btn--lg bsw-booking__cta"');
    const css = read('../../styles/components/barbershop-websites-hero.css');
    expect(css).toContain('.bsw-date-preview__day.is-selected');
    expect(css).toContain('background: var(--accent);');
  });

  it('brands the website preview with the approved CUTSTATE logo image', () => {
    const preview = read(`${componentDir}BlacklineWebsitePreview.astro`);
    const brand = preview.match(/<a class="bsw-site__brand"[\s\S]*?<\/a>/)?.[0] ?? '';
    expect(brand).toContain('aria-label="CUTSTATE BARBERS demo home"');
    expect(brand).toContain('href={DEMO_HOME_HREF}');
    expect(brand).toMatch(/<img\s[\s\S]*src=\{CUTSTATE_LOGO_SRC\}/);
    expect(brand).toContain('width={CUTSTATE_LOGO_WIDTH}');
    expect(brand).toContain('height={CUTSTATE_LOGO_HEIGHT}');
    expect(brand).not.toMatch(/<span>/);
    expect(CUTSTATE_LOGO_SRC).toBe('/demo/cutstate-logo.png');
    const css = read('../../styles/components/barbershop-websites-hero.css');
    expect(css).toMatch(/\.bsw-site__brand img \{[^}]*width: auto;[^}]*object-fit: contain;/);
    expect(css).not.toContain('.bsw-site__brand span');
  });

  it('renders no BLACKLINE identity anywhere on the page', () => {
    const sources = [page, ...readdirSync(join(here, componentDir)).map((file) => read(`${componentDir}${file}`))];
    for (const source of sources) {
      const markup = source.split(/^---$/m).slice(2).join('---') || source;
      const visibleText = markup.replace(/<[^>]+>/g, ' ');
      const accessibleText = [...markup.matchAll(/\b(?:aria-label|alt|title)=(["{`])([\s\S]*?)\1/g)]
        .map((match) => match[2])
        .join(' ');
      expect(visibleText).not.toMatch(/blackline/i);
      expect(accessibleText).not.toMatch(/blackline/i);
    }
  });

  it('publishes the companion website-design guide in the sitemap', () => {
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE).toBe(true);
    const locs = buildMarketingSitemapEntries().map((entry) => entry.loc);
    expect(locs).toContain('https://kersivo.co.uk/barbershop-website-design');
  });

  it('shares the marketing route family for page transitions', () => {
    expect(getRouteFamily(BARBERSHOP_WEBSITES_PAGE_PATH)).toBe('marketing');
  });
});
