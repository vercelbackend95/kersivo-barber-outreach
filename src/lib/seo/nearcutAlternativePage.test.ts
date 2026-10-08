import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NEARCUT_ALTERNATIVE_PAGE_PATH, NEARCUT_ALTERNATIVE_TITLE, NEARCUT_ALTERNATIVE_DESCRIPTION, NEARCUT_ALTERNATIVE_FAQ_ITEMS, buildNearcutAlternativeFaqJsonLd } from './nearcutAlternativeFaq';
import { buildNearcutAlternativeWebPageJsonLd, buildNearcutAlternativeBreadcrumbJsonLd } from './nearcutAlternativeJsonLd';
import { MARKETING_NAV_ITEMS } from '@/lib/nav/marketingNavigation';
import { GET as getRobots } from '../../pages/robots.txt';
import { NEARCUT_COMPARE_SECTIONS, NEARCUT_SOURCES } from './nearcutFacts';
import { buildMarketingSitemapEntries } from './marketingSitemap';
const dir=dirname(fileURLToPath(import.meta.url));
const read=(path:string)=>readFileSync(join(dir,path),'utf8');
const page=read('../../pages/nearcut-alternative/index.astro');
describe('Nearcut Alternative marketing page',()=>{
 it('has canonical UK search metadata and valid WebPage schema',()=>{
  expect(NEARCUT_ALTERNATIVE_PAGE_PATH).toBe('/nearcut-alternative');
  expect(NEARCUT_ALTERNATIVE_TITLE).toContain('Nearcut Alternative');
  expect(NEARCUT_ALTERNATIVE_TITLE.length).toBeLessThanOrEqual(65);
  expect(NEARCUT_ALTERNATIVE_DESCRIPTION.length).toBeLessThanOrEqual(160);
  expect(page).toContain('canonicalPath={NEARCUT_ALTERNATIVE_PAGE_PATH}');
  expect(page).toContain('buildNearcutAlternativeFaqJsonLd()');
  const schema=buildNearcutAlternativeWebPageJsonLd();
  expect(schema['@type']).toBe('WebPage');
  expect(schema.inLanguage).toBe('en-GB');
  expect(schema.url).toBe('https://kersivo.co.uk/nearcut-alternative');
 });
 it('has visible FAQ matching FAQPage structured data',()=>{
  expect(NEARCUT_ALTERNATIVE_FAQ_ITEMS.length).toBeGreaterThanOrEqual(8);
  const schema=buildNearcutAlternativeFaqJsonLd();
  expect(schema['@type']).toBe('FAQPage');
  expect((schema.mainEntity as unknown[]).length).toBe(NEARCUT_ALTERNATIVE_FAQ_ITEMS.length);
  expect(page).toContain('faqs={NEARCUT_ALTERNATIVE_FAQ_ITEMS}');
 });
 it('reuses the mature visual page flow without additional h1 elements',()=>{
  const order=['<NearcutHero','<NearcutQuickAnswer','<NearcutWhy','<NearcutCosts','<NearcutCompare','<NearcutProof','<NearcutFit','<NearcutSwitching','<NearcutPricing','<Faq4','<NearcutFinalCta','<NearcutSources'].map(x=>page.indexOf(x));
  expect(order.every(x=>x>=0)).toBe(true);
  expect(order).toEqual([...order].sort((a,b)=>a-b));
  const hero=read('../../components/nearcutAlternative/NearcutHero.astro');
  expect((hero.match(/<h1\b/g)||[]).length).toBe(1);
  expect(hero).not.toContain('marketplace discovery');
 });
 it('does not misrepresent the Nearcut plan or invent subscription quotes',()=>{
  const facts=read('nearcutFacts.ts');
  const costs=read('../../components/nearcutAlternative/NearcutCosts.astro');
  expect(facts).toContain('Free for You');
  expect(costs).toContain('Quote');
  expect(costs).toContain('customer booking charge');
  expect(costs).toContain('£5 deposit');
  expect(costs).toContain('Stripe processing fees');
  expect(NEARCUT_COMPARE_SECTIONS).toHaveLength(6);
  expect(NEARCUT_SOURCES.every(x=>x.url.startsWith('https://'))).toBe(true);
 });
 it('is discoverable through sitemap and cross-links from competitor pages',()=>{
  expect(buildMarketingSitemapEntries().some(e=>e.loc==='https://kersivo.co.uk/nearcut-alternative')).toBe(true);
  for(const p of ['../../components/freshaAlternative/FreshaFit.astro','../../components/booksyAlternative/BooksyFit.astro'])expect(read(p)).toContain('/nearcut-alternative');
 });

 it('has a visible breadcrumb that matches BreadcrumbList structured data',()=>{
  const hero=read('../../components/nearcutAlternative/NearcutHero.astro');
  expect(hero).toContain('aria-label="Breadcrumb"');
  expect(hero).toContain('aria-current="page">Nearcut alternative');
  expect(page).toContain('buildNearcutAlternativeBreadcrumbJsonLd()');
  const breadcrumb=buildNearcutAlternativeBreadcrumbJsonLd();
  expect(breadcrumb['@type']).toBe('BreadcrumbList');
  expect(breadcrumb['@id']).toBe('https://kersivo.co.uk/nearcut-alternative#breadcrumb');
  const items=breadcrumb.itemListElement as Array<Record<string,unknown>>;
  expect(items).toHaveLength(2);
  expect(items.map(x=>x.position)).toEqual([1,2]);
  expect(items.map(x=>x.item)).toEqual(['https://kersivo.co.uk/','https://kersivo.co.uk/nearcut-alternative']);
  expect(buildNearcutAlternativeWebPageJsonLd().breadcrumb).toEqual({'@id':breadcrumb['@id']});
 });
 it('does not show the copied Fresha brand name in the Nearcut comparison',()=>{
  const compare=read('../../components/nearcutAlternative/NearcutCompare.astro');
  expect(compare).toMatch(/>\s*nearcut\s*<\/span>/i);
  expect(compare).not.toMatch(/>\s*fresha\s*<\/span>/i);
  expect(compare).toContain('data-nearcut-comparison');
 });
 it('is exposed in the shared desktop and mobile Compare menu',()=>{
  const item=MARKETING_NAV_ITEMS.find(x=>x.href==='/nearcut-alternative');
  expect(item).toMatchObject({group:'compare',section:'alternatives',label:'Nearcut Alternative'});
 });
 it('is crawlable by Google and OAI SearchBot, with a marketing sitemap reference', async()=>{
  const robots=await (await getRobots({} as Parameters<typeof getRobots>[0])).text();
  expect(robots).toContain('User-agent: *');
  expect(robots).toContain('User-agent: OAI-SearchBot');
  expect(robots).toContain('Sitemap: https://kersivo.co.uk/sitemap.xml');
  expect(robots).not.toContain('Disallow: /nearcut');
  expect(page).not.toContain('noindex');
 });
 it('reflects verified UK Nearcut commercial specifics',()=>{
  const costs=read('../../components/nearcutAlternative/NearcutCosts.astro');
  const faqs=NEARCUT_ALTERNATIVE_FAQ_ITEMS.map(x=>x.question+' '+x.answer).join(' ');
  expect(costs).toContain('30-day Subscription trial');
  expect(costs).toContain('zero transaction fees');
  expect(costs).toContain('2.9% + £0.20');
  expect(faqs).toContain('Nearcut Free for You');
  expect(faqs).toContain('30-day free trial');
 });
});
