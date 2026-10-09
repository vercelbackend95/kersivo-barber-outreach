import { readFileSync } from 'node:fs';
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
import { DEMO_SERVICES } from '@/lib/demo/services';
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
    expect(BARBERSHOP_WEBSITES_PAGE_TITLE).toBe('Barbershop Websites UK | Design & Booking | KERSIVO');
    expect(BARBERSHOP_WEBSITES_PAGE_DESCRIPTION).toContain('£39/month');
    expect(page).toContain('canonicalPath={BARBERSHOP_WEBSITES_PAGE_PATH}');
  });

  it('stays noindex and out of the marketing sitemap until the pillar is approved', () => {
    expect(BARBERSHOP_WEBSITES_PAGE_INDEXABLE).toBe(false);
    expect(page).toContain('noindex={!BARBERSHOP_WEBSITES_PAGE_INDEXABLE}');
    expect(page).toContain('robotsFollow');
    expect(resolveRobotsContent({ noindex: true, robotsFollow: true })).toBe('noindex, follow');
    const locs = buildMarketingSitemapEntries().map((entry) => entry.loc);
    expect(locs).not.toContain('https://kersivo.co.uk/barbershop-websites');
  });

  it('renders exactly one H1 built from the approved headline', () => {
    const h1Count = [page, ...components].join('\n').match(/<h1\b/g) ?? [];
    expect(h1Count).toHaveLength(1);
    expect(hero).toContain('BARBERSHOP_WEBSITES_PAGE_H1');
    expect(BARBERSHOP_WEBSITES_PAGE_H1).toBe('Websites for barbershops that are built to book.');
  });

  it('uses real demo data, no iframes, and labels BLACKLINE as fictional', () => {
    const source = components.join('\n');
    expect(source).not.toMatch(/<iframe|<embed|<video/);
    expect(source).not.toMatch(/<select|<input|<button/);
    expect(hero).toContain('fictional demonstration shop');
    for (const slug of ['haircut-finish', 'beard-trim', 'skin-fade', 'wash-style-finish']) {
      expect(DEMO_SERVICES.some((service) => service.slug === slug)).toBe(true);
    }
  });

  it('shares the marketing route family for page transitions', () => {
    expect(getRouteFamily(BARBERSHOP_WEBSITES_PAGE_PATH)).toBe('marketing');
  });
});
