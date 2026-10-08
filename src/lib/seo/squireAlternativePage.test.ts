import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMarketingSitemapEntries, buildMarketingSitemapXml } from './marketingSitemap';
import { resolveCanonicalUrl } from './meta';
import { GET as getRobots } from '../../pages/robots.txt';
import {
 SQUIRE_ALTERNATIVE_PAGE_PATH,
 SQUIRE_ALTERNATIVE_TITLE,
 SQUIRE_ALTERNATIVE_DESCRIPTION,
 SQUIRE_ALTERNATIVE_FAQ_ITEMS,
 SQUIRE_ALTERNATIVE_LAST_UPDATED_ISO,
 buildSquireAlternativeFaqJsonLd,
} from './squireAlternativeFaq';
import { buildSquireAlternativeWebPageJsonLd, buildSquireAlternativeBreadcrumbJsonLd } from './squireAlternativeJsonLd';
import { MARKETING_NAV_ITEMS, buildMarketingNavigation } from '@/lib/nav/marketingNavigation';
import {
 SQUIRE_OFFICIAL_SOURCES,
 SQUIRE_COMPARE_SECTIONS,
 SQUIRE_US_LIST_PLANS,
 SQUIRE_UK_LIST_PLANS,
 SQUIRE_FACTS_CHECKED_ISO,
} from './squireFacts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here,path),'utf8');
const page = read('../../pages/squire-alternative/index.astro');
const hero = read('../../components/squireAlternative/SquireHero.astro');
const intro = read('../../components/squireAlternative/SquireIntro.astro');
const compare = read('../../components/squireAlternative/SquireCompare.astro');
const fit = read('../../components/squireAlternative/SquireFit.astro');
const sources = read('../../components/squireAlternative/SquireSources.astro');
const nearcutFit = read('../../components/nearcutAlternative/NearcutFit.astro');
const booksyFit = read('../../components/booksyAlternative/BooksyFit.astro');
const freshaFit = read('../../components/freshaAlternative/FreshaFit.astro');

describe('SQUIRE alternative: SEO and factual safety', () => {
 it('publishes a unique UK-focused title, description and canonical',()=>{
   expect(SQUIRE_ALTERNATIVE_PAGE_PATH).toBe('/squire-alternative');
   expect(SQUIRE_ALTERNATIVE_TITLE).toContain('SQUIRE Alternative');
   expect(SQUIRE_ALTERNATIVE_TITLE.length).toBeLessThanOrEqual(60);
   expect(SQUIRE_ALTERNATIVE_DESCRIPTION.length).toBeGreaterThanOrEqual(110);
   expect(SQUIRE_ALTERNATIVE_DESCRIPTION.length).toBeLessThanOrEqual(160);
   expect(resolveCanonicalUrl(SQUIRE_ALTERNATIVE_PAGE_PATH)).toBe('https://kersivo.co.uk/squire-alternative');
   expect(page).toContain('title={SQUIRE_ALTERNATIVE_TITLE}');
   expect(page).toContain('description={SQUIRE_ALTERNATIVE_DESCRIPTION}');
   expect(page).toContain('canonicalPath={SQUIRE_ALTERNATIVE_PAGE_PATH}');
   expect(page).not.toMatch(/noindex\s*[=:]/);
 });
 it('has WebPage structured data consistent with the sitemap',()=>{
   const web = buildSquireAlternativeWebPageJsonLd();
   const canonical = resolveCanonicalUrl(SQUIRE_ALTERNATIVE_PAGE_PATH);
   const sitemap = buildMarketingSitemapEntries().find(item=>item.loc===canonical);
   expect(web['@type']).toBe('WebPage');
   expect(web.url).toBe(canonical);
   expect(web['@id']).toBe(canonical+'#webpage');
   expect(web.inLanguage).toBe('en-GB');
   expect(web.dateModified).toBe(SQUIRE_ALTERNATIVE_LAST_UPDATED_ISO);
   expect(sitemap).toEqual({loc:canonical,lastmod:SQUIRE_ALTERNATIVE_LAST_UPDATED_ISO});
   expect(buildMarketingSitemapXml()).toContain('<loc>'+canonical+'</loc>');
   expect(page).toContain('buildSquireAlternativeWebPageJsonLd(), buildSquireAlternativeBreadcrumbJsonLd(), buildSquireAlternativeFaqJsonLd()');
 });
 it('keeps FAQ schema exactly aligned with visible answers, without fake ratings',()=>{
   const faq = buildSquireAlternativeFaqJsonLd();
   const items = faq.mainEntity as {name:string;acceptedAnswer:{text:string}}[];
   expect(faq['@type']).toBe('FAQPage');
   expect(faq['@id']).toBe('https://kersivo.co.uk/squire-alternative#faq');
   expect(SQUIRE_ALTERNATIVE_FAQ_ITEMS.length).toBeGreaterThanOrEqual(10);
   expect(items).toHaveLength(SQUIRE_ALTERNATIVE_FAQ_ITEMS.length);
   items.forEach((item,i)=>{
      expect(item.name).toBe(SQUIRE_ALTERNATIVE_FAQ_ITEMS[i].question);
      expect(item.acceptedAnswer.text).toBe(SQUIRE_ALTERNATIVE_FAQ_ITEMS[i].answer);
   });
   expect(page).toContain('faqs={SQUIRE_ALTERNATIVE_FAQ_ITEMS}');
   expect(JSON.stringify([faq,buildSquireAlternativeWebPageJsonLd()])).not.toMatch(/aggregateRating|reviewCount|"Review"/);
 });
 it('keeps official GBP pricing central while identifying the unresolved UK tax and payment fees',()=>{
   expect(SQUIRE_US_LIST_PLANS.map(plan=>plan.usdMonthly)).toEqual([30,50,150,250]);
   expect(SQUIRE_UK_LIST_PLANS.map(plan=>plan.gbpMonthly)).toEqual([20,30,60,90]);
   expect(intro).toContain('SQUIRE_US_LIST_PLANS.map');
   expect(intro).toContain('Official SQUIRE pricing');
   expect(intro).toContain('not verified VAT-inclusive totals');
   expect(intro).toContain('£{SQUIRE_UK_LIST_PLANS.find');
   expect(SQUIRE_ALTERNATIVE_FAQ_ITEMS.map(item=>item.question)).toContain('Is SQUIRE available in the UK?');
   expect(SQUIRE_ALTERNATIVE_FAQ_ITEMS.some(item=>item.answer.includes('publicly lists UK barbershops'))).toBe(true);
   expect(SQUIRE_FACTS_CHECKED_ISO).toBe('2026-10-08');
 });
 it('backs comparative facts with official SQUIRE first-party sources',()=>{
   expect(SQUIRE_OFFICIAL_SOURCES.length).toBeGreaterThanOrEqual(4);
   SQUIRE_OFFICIAL_SOURCES.forEach(source=>{
     expect(new URL(source.url).hostname).toMatch(/^(www\.)?getsquire\.com$/);
     expect(sources).toContain('SQUIRE_OFFICIAL_SOURCES.map');
   });
   expect(sources).toContain('Squire Europe');
   expect(sources).toContain('not affiliated with, endorsed by or sponsored by SQUIRE');
 });
 it('renders one H1 and preserves the complete shared visual-section sequence',()=>{
   expect(hero.match(/<h1\b/g)?.length).toBe(1);
   for(const src of [intro,compare,fit,sources,page]) expect(src).not.toMatch(/<h1\b/);
   const tags=['<SquireHero','<SquireIntro','<SquireCompare','<FreshaProof','<SquireFit','<FreshaPricing','<Faq4','<SquireFinalCta','<Contact16','<SquireSources','<Footer50'];
   const order=tags.map(tag=>page.indexOf(tag));
   expect(order.every(n=>n>=0)).toBe(true);
   expect(order).toEqual([...order].sort((a,b)=>a-b));
   expect(page).toContain("fresha-alternative.css");
 });
 it('restores accessible full feature accordion, all six comparison categories',()=>{
   expect(SQUIRE_COMPARE_SECTIONS.map(item=>item.id)).toEqual(['bookings','payments','brand','retail','clients','reports']);
   expect(compare).toContain('SQUIRE_COMPARE_SECTIONS.map');
   expect(compare).toContain('data-squire-comparison');
   expect(compare).toContain('data-comparison-trigger');
   expect(compare).toContain('aria-expanded=');
   expect(compare).toContain('aria-controls=');
   expect(compare).toContain('data-comparison-reveal-inner');
   expect(compare).toContain('section.squirePoints.map');
   expect(compare).toContain('section.kersivoPoints.map');
   expect(compare).toContain("bindComparisonAccordions('[data-squire-comparison]')");
   expect(compare).toContain('href="#sources"');
 });
 it('is crawlable through robots.txt and gets a homepage + comparison cluster link',async()=>{
   const robots=await (await getRobots({} as Parameters<typeof getRobots>[0])).text();
   expect(robots).toContain('User-agent: *');
   expect(robots).toContain('Sitemap: https://kersivo.co.uk/sitemap.xml');
   expect(robots).not.toMatch(/Disallow: \/squire-alternative/);
   expect(MARKETING_NAV_ITEMS.find(item=>item.href==='/squire-alternative')).toMatchObject({id:'compare-squire',group:'compare',section:'alternatives',label:'SQUIRE Alternative'});
   expect(buildMarketingNavigation().find(group=>group.id==='compare')?.sections[0].items.some(item=>item.href==='/squire-alternative')).toBe(true);
   expect(booksyFit).toContain('href="/squire-alternative"');
   expect(freshaFit).toContain('href="/squire-alternative"');
   expect(nearcutFit).toContain('href="/squire-alternative"');
   expect(fit).toContain('href="/booksy-alternative"');
   expect(fit).toContain('href="/fresha-alternative"');
 });
 it('has visible breadcrumb and matching BreadcrumbList structured data',()=>{
   expect(hero).toContain('aria-label="Breadcrumb"');
   expect(hero).toContain('aria-current="page">SQUIRE alternative');
   expect(page).toContain('buildSquireAlternativeBreadcrumbJsonLd()');
   const breadcrumb=buildSquireAlternativeBreadcrumbJsonLd();
   expect(breadcrumb['@type']).toBe('BreadcrumbList');
   expect(breadcrumb['@id']).toBe('https://kersivo.co.uk/squire-alternative#breadcrumb');
   expect((breadcrumb.itemListElement as Array<Record<string,unknown>>).map(x=>x.item)).toEqual(['https://kersivo.co.uk/','https://kersivo.co.uk/squire-alternative']);
   expect(buildSquireAlternativeWebPageJsonLd().breadcrumb).toEqual({'@id':breadcrumb['@id']});
 });
 it('uses the exact same KERSIVO comparison logo as Booksy',()=>{
   const booksyComparison = read('../../components/booksyAlternative/BooksyCompare.astro');
   const logo = '<img src="/images/logo_nobg.png" alt="" width="72" height="72" loading="lazy" decoding="async" />';
   expect(compare).toContain(logo);
   expect(booksyComparison).toContain(logo);
   expect(compare).not.toContain('src="/images/logo-kersivo.png"');
 });
 it('has no placeholders, unverifiable bargain promises or artificial review markup',()=>{
   const text=[page,hero,intro,compare,fit,sources,...SQUIRE_ALTERNATIVE_FAQ_ITEMS.map(x=>x.answer)].join('\n').toLowerCase();
   for(const banned of [
      'lorem ipsum','tbd','todo:','squire is not available in the uk',
      'squire does not operate in the uk','guaranteed savings','guaranteed traffic',
      'commission on every booking','squire does not offer deposits',
   ]) expect(text).not.toContain(banned);
 });
});
