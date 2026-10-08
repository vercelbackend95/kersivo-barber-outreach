import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NEARCUT_ALTERNATIVE_PAGE_PATH, NEARCUT_ALTERNATIVE_TITLE, NEARCUT_ALTERNATIVE_DESCRIPTION, NEARCUT_ALTERNATIVE_FAQ_ITEMS, buildNearcutAlternativeFaqJsonLd } from './nearcutAlternativeFaq';
import { buildNearcutAlternativeWebPageJsonLd } from './nearcutAlternativeJsonLd';
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
});
