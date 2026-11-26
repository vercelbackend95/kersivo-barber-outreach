import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { INDEXABLE_ROBOTS_CONTENT, resolveCanonicalUrl, resolveRobotsContent } from './meta';
import {
  BARBERSHOP_WEBSITES_PAGE_DESCRIPTION,
  BARBERSHOP_WEBSITES_PAGE_INDEXABLE,
  BARBERSHOP_WEBSITES_PAGE_PATH,
  BARBERSHOP_WEBSITES_PAGE_TITLE,
} from './barbershopWebsitesPage';
import { BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE } from './barbershopWebsiteDesignPage';
import { HERITAGE_LOCKUP } from '@/lib/demo/heritage/mock';
import { getRouteFamily } from '@/lib/navigation/routeFamilies';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
// The live page sections are covered in barbershopWebsitesRedesign.test.ts.
const livePage = read('../../pages/barbershop-websites/index.astro');
const componentDir = '../../components/barbershop-websites/';

describe('/barbershop-websites metadata and indexing', () => {
  it('uses the approved metadata and canonical URL', () => {
    expect(BARBERSHOP_WEBSITES_PAGE_PATH).toBe('/barbershop-websites');
    expect(resolveCanonicalUrl(BARBERSHOP_WEBSITES_PAGE_PATH)).toBe('https://kersivo.co.uk/barbershop-websites');
    expect(BARBERSHOP_WEBSITES_PAGE_TITLE).toBe('Barbershop Website UK with Online Booking – £39/mo | KERSIVO');
    expect(BARBERSHOP_WEBSITES_PAGE_DESCRIPTION).toContain('£39/month');
    expect(livePage).toContain('canonicalPath={BARBERSHOP_WEBSITES_PAGE_PATH}');
  });

  it('publishes the canonical pillar for search and includes it in the sitemap', () => {
    expect(BARBERSHOP_WEBSITES_PAGE_INDEXABLE).toBe(true);
    expect(livePage).toContain('noindex={!BARBERSHOP_WEBSITES_PAGE_INDEXABLE}');
    expect(livePage).toContain('robotsFollow');
    expect(resolveRobotsContent({ noindex: !BARBERSHOP_WEBSITES_PAGE_INDEXABLE, robotsFollow: true })).toBe(INDEXABLE_ROBOTS_CONTENT);
    const locs = buildMarketingSitemapEntries().map((entry) => entry.loc);
    expect(locs).toContain('https://kersivo.co.uk/barbershop-websites');
  });

  it('has no working design-preview copies left in the site', () => {
    expect(existsSync(join(here, '../../pages/design-preview'))).toBe(false);
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

describe('Heritage Grooming website preview (used on /free-preview)', () => {
  it('brands the website preview with the Heritage Grooming lockup image', () => {
    const preview = read(`${componentDir}BlacklineWebsitePreview.astro`);
    const brand = preview.match(/<a class="bsw-site__brand"[\s\S]*?<\/a>/)?.[0] ?? '';
    expect(brand).toContain('aria-label="Heritage Grooming demo home"');
    expect(brand).toContain('href={DEMO_HOME_HREF}');
    expect(brand).toMatch(/<img\s[\s\S]*src=\{HERITAGE_LOCKUP\.src\}/);
    expect(brand).toContain('width={HERITAGE_LOCKUP.width}');
    expect(brand).toContain('height={HERITAGE_LOCKUP.height}');
    expect(brand).not.toMatch(/<span>/);
    expect(HERITAGE_LOCKUP.src).toBe('/images/heritage/heritage-lockup.webp');
    const css = read('../../styles/components/barbershop-websites-hero.css');
    expect(css).toMatch(/\.bsw-site__brand img \{[^}]*width: auto;[^}]*object-fit: contain;/);
    expect(css).not.toContain('.bsw-site__brand span');
  });

  it('renders no BLACKLINE identity in visible or accessible text', () => {
    const source = read(`${componentDir}BlacklineWebsitePreview.astro`);
    const markup = source.split(/^---$/m).slice(2).join('---') || source;
    const visibleText = markup.replace(/<[^>]+>/g, ' ');
    const accessibleText = [...markup.matchAll(/\b(?:aria-label|alt|title)=(["{`])([\s\S]*?)\1/g)]
      .map((match) => match[2])
      .join(' ');
    expect(visibleText).not.toMatch(/blackline/i);
    expect(accessibleText).not.toMatch(/blackline/i);
  });
});
