import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PHOREST_ALTERNATIVE_PAGE_PATH,
  PHOREST_ALTERNATIVE_TITLE,
  PHOREST_ALTERNATIVE_DESCRIPTION,
  PHOREST_ALTERNATIVE_FAQ_ITEMS,
  buildPhorestAlternativeFaqJsonLd,
} from './phorestAlternativeFaq';
import { buildPhorestAlternativeWebPageJsonLd, buildPhorestAlternativeBreadcrumbJsonLd } from './phorestAlternativeJsonLd';
import { PHOREST_COMPARE_SECTIONS, PHOREST_SOURCES, getPublishedPhorestSubscriptionGbp } from './phorestFacts';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { MARKETING_NAV_ITEMS } from '@/lib/nav/marketingNavigation';
import { GET as getRobots } from '../../pages/robots.txt';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(dir, path), 'utf8');
const page = read('../../pages/phorest-alternative/index.astro');

describe('Phorest Alternative SEO page', () => {
  it('exposes a correct canonical, UK metadata and linked WebPage schema', () => {
    expect(PHOREST_ALTERNATIVE_PAGE_PATH).toBe('/phorest-alternative');
    expect(PHOREST_ALTERNATIVE_TITLE).toContain('Phorest Alternative');
    expect(PHOREST_ALTERNATIVE_TITLE.length).toBeLessThanOrEqual(65);
    expect(PHOREST_ALTERNATIVE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(page).toContain('canonicalPath={PHOREST_ALTERNATIVE_PAGE_PATH}');
    const schema = buildPhorestAlternativeWebPageJsonLd();
    expect(schema).toMatchObject({
      '@type': 'WebPage',
      url: 'https://kersivo.co.uk/phorest-alternative',
      inLanguage: 'en-GB',
      breadcrumb: { '@id': 'https://kersivo.co.uk/phorest-alternative#breadcrumb' },
    });
  });
  it('has visible and structured FAQs with exactly matching content', () => {
    expect(PHOREST_ALTERNATIVE_FAQ_ITEMS.length).toBeGreaterThanOrEqual(12);
    expect(page).toContain('faqs={PHOREST_ALTERNATIVE_FAQ_ITEMS}');
    const faq = buildPhorestAlternativeFaqJsonLd();
    expect(faq['@type']).toBe('FAQPage');
    const questions = faq.mainEntity as Array<{name: string; acceptedAnswer: {text: string}}>;
    expect(questions).toHaveLength(PHOREST_ALTERNATIVE_FAQ_ITEMS.length);
    expect(questions.map(x=>x.name)).toEqual(PHOREST_ALTERNATIVE_FAQ_ITEMS.map(x=>x.question));
    expect(questions.map(x=>x.acceptedAnswer.text)).toEqual(PHOREST_ALTERNATIVE_FAQ_ITEMS.map(x=>x.answer));
  });
  it('keeps the Nearcut visual flow with one H1 and correct breadcrumb trail', () => {
    const flow = [
      '<PhorestHero', '<PhorestQuickAnswer', '<PhorestWhy',
      '<PhorestCosts', '<PhorestCompare', '<PhorestProof',
      '<PhorestFit', '<PhorestSwitching', '<PhorestPricing',
      '<Faq4', '<PhorestFinalCta', '<PhorestSources',
    ].map(tag => page.indexOf(tag));
    expect(flow.every(index=>index>=0)).toBe(true);
    expect(flow).toEqual([...flow].sort((a,b)=>a-b));
    const hero = read('../../components/phorestAlternative/PhorestHero.astro');
    expect((hero.match(/<h1\b/g)||[])).toHaveLength(1);
    expect(hero).toContain('aria-current="page">Phorest alternative');
    const breadcrumb = buildPhorestAlternativeBreadcrumbJsonLd();
    expect(breadcrumb['@type']).toBe('BreadcrumbList');
    expect((breadcrumb.itemListElement as Array<{position:number;item:string}>)).toEqual([
      { '@type': 'ListItem', position:1, name:'Home', item:'https://kersivo.co.uk/' },
      { '@type': 'ListItem', position:2, name:'Phorest alternative', item:'https://kersivo.co.uk/phorest-alternative' },
    ]);
  });
  it('does not invent subscription prices and links to official sources', () => {
    expect(read('../../components/phorestAlternative/PhorestCosts.astro')).toContain('Quote');
    expect(read('../../components/phorestAlternative/PhorestCosts.astro')).toContain('PHOREST_UK_PLANS');
    expect(PHOREST_COMPARE_SECTIONS).toHaveLength(6);
    expect(getPublishedPhorestSubscriptionGbp('starter')).toBeNull();
    expect(PHOREST_SOURCES.every(source=>{
      const host = new URL(source.url).hostname;
      return host === 'www.phorest.com' || host === 'support.phorest.com';
    })).toBe(true);
  });
  it('is discoverable by sitemap, Compare navigation and contextual internal links', () => {
    expect(buildMarketingSitemapEntries().some(x=>x.loc==='https://kersivo.co.uk/phorest-alternative')).toBe(true);
    expect(MARKETING_NAV_ITEMS.find(x=>x.href==='/phorest-alternative'))
      .toMatchObject({group:'compare',section:'alternatives'});
    for (const path of [
      '../../components/nearcutAlternative/NearcutFit.astro',
      '../../components/booksyAlternative/BooksyFit.astro',
      '../../components/freshaAlternative/FreshaFit.astro',
    ]) expect(read(path)).toContain('/phorest-alternative');
    expect(page).not.toContain('noindex');
  });
  it('is crawlable and uses canonical/Open Graph/Twitter infrastructure', async () => {
    const robots = await (await getRobots({} as Parameters<typeof getRobots>[0])).text();
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('User-agent: OAI-SearchBot');
    expect(robots).toContain('Sitemap: https://kersivo.co.uk/sitemap.xml');
    expect(robots).not.toContain('Disallow: /phorest');
    expect(read('../../layouts/LandingLayout.astro')).toContain('type="application/ld+json"');
    const seoHead = read('../../components/seo/SeoHead.astro');
    expect(seoHead).toContain('rel="canonical"');
    expect(seoHead).toContain('property="og:url"');
    expect(seoHead).toContain('name="twitter:card"');
  });
});
