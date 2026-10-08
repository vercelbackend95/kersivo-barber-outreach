import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { resolveCanonicalUrl, resolveRobotsContent } from './meta';
import { MARKETING_NAV_ITEMS } from '@/lib/nav/marketingNavigation';
import {
  TIMELY_ALTERNATIVE_PAGE_PATH,
  TIMELY_ALTERNATIVE_TITLE,
  TIMELY_ALTERNATIVE_DESCRIPTION,
  TIMELY_ALTERNATIVE_LAST_UPDATED_ISO,
  TIMELY_ALTERNATIVE_FAQ_ITEMS,
  buildTimelyAlternativeFaqJsonLd,
} from './timelyAlternativeFaq';
import {
  buildTimelyAlternativeWebPageJsonLd,
  buildTimelyAlternativeBreadcrumbJsonLd,
} from './timelyAlternativeJsonLd';
import { TIMELY_COMPARE_SECTIONS, TIMELY_SOURCES } from './timelyFacts';

const here=dirname(fileURLToPath(import.meta.url));
const read=(path:string)=>readFileSync(join(here,path),'utf8');
const page=read('../../pages/timely-alternative/index.astro');
const comparison=read('../../components/timelyAlternative/TimelyCompare.astro');
const siteUrl='https://kersivo.co.uk';
const pageUrl=siteUrl+'/timely-alternative';

describe('Timely alternative: on-page and technical SEO',()=>{
  it('keeps the canonical, metadata, date and indexability in one place',()=>{
    expect(TIMELY_ALTERNATIVE_PAGE_PATH).toBe('/timely-alternative');
    expect(resolveCanonicalUrl(TIMELY_ALTERNATIVE_PAGE_PATH)).toBe(pageUrl);
    expect(TIMELY_ALTERNATIVE_TITLE).toContain('Timely Alternative UK');
    expect(TIMELY_ALTERNATIVE_TITLE.length).toBeLessThanOrEqual(65);
    expect(TIMELY_ALTERNATIVE_DESCRIPTION).toContain('UK barbershops');
    expect(TIMELY_ALTERNATIVE_DESCRIPTION.length).toBeLessThanOrEqual(165);
    expect(page).toContain('canonicalPath={path}');
    expect(page).toContain('title={title}');
    expect(page).toContain('description={description}');
    expect(page).not.toMatch(/\bnoindex\b/i);
    expect(resolveRobotsContent({noindex:false})).toBeUndefined();
  });

  it('includes one H1, clear topical sections, an operable comparison and live demo',()=>{
    expect(page.match(/<h1\b/g)).toHaveLength(1);
    expect(page).toContain('A Timely alternative');
    expect(page).toContain('Timely pricing vs KERSIVO in the UK');
    expect(page).toContain('Switching from Timely to KERSIVO');
    expect(page).toContain('<TimelyCompare />');
    expect(comparison).toContain('bindComparisonAccordions');
    expect(comparison).toContain('data-timely-comparison');
    expect(comparison).toContain('data-comparison-reveal');
    expect(comparison).toContain('data-comparison-trigger');
    expect(TIMELY_COMPARE_SECTIONS).toHaveLength(6);
    expect(page).toContain('href="/demo"');
    expect(page).toContain('href="/barber-software-cost-calculator"');
  });

  it('is discoverable via the live marketing sitemap and navigation',()=>{
    const entries=buildMarketingSitemapEntries().filter(x=>x.loc===pageUrl);
    expect(entries).toHaveLength(1);
    expect(entries[0].lastmod).toBe(TIMELY_ALTERNATIVE_LAST_UPDATED_ISO);
    expect(page).toContain('datetime="2026-10-08"');
    expect(MARKETING_NAV_ITEMS.filter(x=>x.href===TIMELY_ALTERNATIVE_PAGE_PATH)).toHaveLength(1);
    const robots=read('../../pages/robots.txt.ts');
    expect(robots).toContain("'Allow: /'");
    expect(robots).not.toMatch(/Disallow:\s*\/timely-alternative/);
  });

  it('emits WebPage, BreadcrumbList and FAQPage without fabricated ratings or pricing',()=>{
    const web=buildTimelyAlternativeWebPageJsonLd();
    const breadcrumb=buildTimelyAlternativeBreadcrumbJsonLd();
    const faq=buildTimelyAlternativeFaqJsonLd();
    expect(web['@type']).toBe('WebPage');
    expect(web['@id']).toBe(pageUrl+'#webpage');
    expect(web.url).toBe(pageUrl);
    expect(web.breadcrumb).toEqual({'@id':pageUrl+'#breadcrumb'});
    expect(web.dateModified).toBe(TIMELY_ALTERNATIVE_LAST_UPDATED_ISO);
    expect(breadcrumb['@type']).toBe('BreadcrumbList');
    expect((breadcrumb.itemListElement as Array<{name:string;item:string;position:number}>)).toEqual([
      {'@type':'ListItem',position:1,name:'Home',item:siteUrl+'/'},
      {'@type':'ListItem',position:2,name:'Timely alternative',item:pageUrl},
    ]);
    expect(page).toContain('faqs={faqs}');
    expect(faq['@id']).toBe(pageUrl+'#faq');
    const entities=faq.mainEntity as Array<{name:string;acceptedAnswer:{text:string}}>;
    expect(entities).toHaveLength(TIMELY_ALTERNATIVE_FAQ_ITEMS.length);
    TIMELY_ALTERNATIVE_FAQ_ITEMS.forEach((item,i)=>{
      expect(entities[i].name).toBe(item.question);
      expect(entities[i].acceptedAnswer.text).toBe(item.answer);
    });
    for(const bad of ['"AggregateRating"','"reviewCount"','"offers":','"priceCurrency"','"priceSpecification"','"Product"','"SoftwareApplication"']){
      expect(JSON.stringify([web,breadcrumb,faq])).not.toContain(bad);
    }
  });

  it('uses official first-party sources, transparent geography and unique Timely attribution',()=>{
    expect(TIMELY_SOURCES.length).toBeGreaterThanOrEqual(3);
    expect(TIMELY_SOURCES.every(x=>x.url.startsWith('https://'))).toBe(true);
    expect(page).toContain('USA market');
    expect(page).toContain('not a confirmed UK GBP subscription');
    expect(comparison).not.toContain('Nearcut');
    expect(page).toContain('TIMELY_TRADEMARK_DISCLAIMER');
    expect(read('../../components/timelyAlternative/TimelyFinalCta.astro')).toContain('timely_final');
  });
});
