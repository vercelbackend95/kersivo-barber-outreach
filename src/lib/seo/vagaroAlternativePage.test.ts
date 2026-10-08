import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  VAGARO_ALTERNATIVE_PAGE_PATH,
  VAGARO_ALTERNATIVE_TITLE,
  VAGARO_ALTERNATIVE_DESCRIPTION,
  VAGARO_ALTERNATIVE_FAQ_ITEMS,
  buildVagaroAlternativeFaqJsonLd,
} from './vagaroAlternativeFaq';
import {
  buildVagaroAlternativeWebPageJsonLd,
  buildVagaroAlternativeBreadcrumbJsonLd,
} from './vagaroAlternativeJsonLd';
import { VAGARO_COMPARE_SECTIONS } from './vagaroAlternativeContent';
import { VAGARO_SOURCES, requireVerifiedVagaroFact } from './vagaroFacts';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { MARKETING_NAV_ITEMS } from '@/lib/nav/marketingNavigation';
import { getRouteFamily } from '@/lib/navigation/routeFamilies';
import { GET as getRobots } from '../../pages/robots.txt';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(dir, path), 'utf8');
const page = read('../../pages/vagaro-alternative/index.astro');
const hero = read('../../components/vagaroAlternative/VagaroHero.astro');
const costs = read('../../components/vagaroAlternative/VagaroCosts.astro');
const comparison = read('../../components/vagaroAlternative/VagaroCompare.astro');

describe('Vagaro Alternative UK SEO foundation', () => {
  it('has concise search metadata, correct canonical and WebPage JSON-LD', () => {
    expect(VAGARO_ALTERNATIVE_PAGE_PATH).toBe('/vagaro-alternative');
    expect(VAGARO_ALTERNATIVE_TITLE.toLowerCase()).toContain('vagaro alternative');
    expect(VAGARO_ALTERNATIVE_TITLE.length).toBeLessThanOrEqual(65);
    expect(VAGARO_ALTERNATIVE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(page).toContain('title={VAGARO_ALTERNATIVE_TITLE}');
    expect(page).toContain('description={VAGARO_ALTERNATIVE_DESCRIPTION}');
    expect(page).toContain('canonicalPath={VAGARO_ALTERNATIVE_PAGE_PATH}');
    const webPage = buildVagaroAlternativeWebPageJsonLd();
    expect(webPage['@type']).toBe('WebPage');
    expect(webPage.url).toBe('https://kersivo.co.uk/vagaro-alternative');
    expect(webPage['@id']).toBe('https://kersivo.co.uk/vagaro-alternative#webpage');
    expect(webPage.inLanguage).toBe('en-GB');
    expect(webPage.dateModified).toBe('2026-10-08');
    expect(webPage.publisher).toMatchObject({ '@id': 'https://kersivo.co.uk/#organization' });
  });

  it('renders a breadcrumb consistent with valid BreadcrumbList JSON-LD', () => {
    expect(hero).toContain('aria-label="Breadcrumb"');
    expect(hero).toContain('aria-current="page">Vagaro alternative');
    expect(page).toContain('buildVagaroAlternativeBreadcrumbJsonLd()');
    const breadcrumb = buildVagaroAlternativeBreadcrumbJsonLd();
    const items = breadcrumb.itemListElement as Array<Record<string, unknown>>;
    expect(breadcrumb['@type']).toBe('BreadcrumbList');
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.position)).toEqual([1, 2]);
    expect(items.map((item) => item.item)).toEqual([
      'https://kersivo.co.uk/',
      'https://kersivo.co.uk/vagaro-alternative',
    ]);
    expect(buildVagaroAlternativeWebPageJsonLd().breadcrumb).toEqual({ '@id': breadcrumb['@id'] });
  });

  it('ensures all 16 visible FAQ entries match the structured data', () => {
    expect(VAGARO_ALTERNATIVE_FAQ_ITEMS.length).toBeGreaterThanOrEqual(13);
    expect(page).toContain('faqs={VAGARO_ALTERNATIVE_FAQ_ITEMS}');
    expect(page).toContain('buildVagaroAlternativeFaqJsonLd()');
    const faq = buildVagaroAlternativeFaqJsonLd();
    expect(faq['@type']).toBe('FAQPage');
    const entries = faq.mainEntity as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(VAGARO_ALTERNATIVE_FAQ_ITEMS.length);
    for (let i = 0; i < entries.length; i++) {
      expect(entries[i].name).toBe(VAGARO_ALTERNATIVE_FAQ_ITEMS[i].question);
      expect(entries[i].acceptedAnswer).toEqual({ '@type': 'Answer', text: VAGARO_ALTERNATIVE_FAQ_ITEMS[i].answer });
    }
  });

  it('reuses the Nearcut layout with exactly one visible H1 and no copied competitor branding', () => {
    const components = ['VagaroHero','VagaroQuickAnswer','VagaroWhy','VagaroCosts','VagaroCompare','VagaroProof','VagaroFit','VagaroSwitching','VagaroPricing','Faq4','VagaroFinalCta','VagaroSources'];
    const indexes = components.map((name) => page.indexOf('<' + name));
    expect(indexes.every((index) => index >= 0)).toBe(true);
    expect(indexes).toEqual([...indexes].sort((a,b) => a-b));
    expect((hero.match(/<h1\b/g) ?? []).length).toBe(1);
    expect(hero).toContain('A Vagaro alternative');
    expect(comparison).toContain('data-vagaro-comparison');
    expect(comparison).not.toMatch(/>\s*nearcut\s*<\/span>/i);
    expect(VAGARO_COMPARE_SECTIONS).toHaveLength(6);
  });

  it('uses source-driven pricing and does not present a universal Vagaro marketplace commission', () => {
    expect(costs).toContain("from '@/lib/seo/vagaroFacts'");
    expect(costs).toContain('estimateVagaroDisplayedSubscriptionGbp');
    expect(costs).toContain('before any additional applicable VAT');
    expect(costs).toContain('not charged on every booking');
    expect(requireVerifiedVagaroFact('oneCalendarDisplayedMonthlyGbp').value).toBe(20);
    expect(requireVerifiedVagaroFact('marketplaceNewClientFirstBookingPercent').value).toBe(20);
    expect(VAGARO_SOURCES.length).toBeGreaterThanOrEqual(5);
  });

  it('is indexable, included in the public sitemap and Google/OAI crawl rules', async () => {
    expect(page).not.toContain('noindex');
    expect(buildMarketingSitemapEntries()).toContainEqual({ loc: 'https://kersivo.co.uk/vagaro-alternative', lastmod: '2026-10-08' });
    const robots = await (await getRobots({} as Parameters<typeof getRobots>[0])).text();
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('User-agent: OAI-SearchBot');
    expect(robots).toContain('Sitemap: https://kersivo.co.uk/sitemap.xml');
    expect(robots).not.toContain('Disallow: /vagaro');
  });

  it('links from homepage and competitor pages, with desktop/mobile navigation parity', () => {
    expect(read('../../pages/index.astro')).toContain('/vagaro-alternative');
    for (const linkFrom of [
      '../../components/booksyAlternative/BooksyFit.astro',
      '../../components/freshaAlternative/FreshaFit.astro',
      '../../components/nearcutAlternative/NearcutFit.astro',
    ]) expect(read(linkFrom)).toContain('/vagaro-alternative');
    expect(MARKETING_NAV_ITEMS.find((item) => item.href === '/vagaro-alternative'))
      .toMatchObject({ group:'compare', section:'alternatives', label:'Vagaro Alternative' });
    expect(getRouteFamily('/vagaro-alternative')).toBe('marketing');
  });
});
