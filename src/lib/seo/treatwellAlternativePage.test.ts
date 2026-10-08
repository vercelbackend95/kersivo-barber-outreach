import { readFileSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe,expect,it } from 'vitest';
import { TREATWELL_ALTERNATIVE_PAGE_PATH,TREATWELL_ALTERNATIVE_TITLE,TREATWELL_ALTERNATIVE_DESCRIPTION,TREATWELL_ALTERNATIVE_FAQ_ITEMS,buildTreatwellAlternativeFaqJsonLd } from './treatwellAlternativeFaq';
import { buildTreatwellAlternativeWebPageJsonLd,buildTreatwellAlternativeBreadcrumbJsonLd } from './treatwellAlternativeJsonLd';
import { TREATWELL_COMPARE_SECTIONS,TREATWELL_SOURCES } from './treatwellFacts';
import { MARKETING_NAV_ITEMS } from '@/lib/nav/marketingNavigation';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { getRouteFamily } from '@/lib/navigation/routeFamilies';
const dir=dirname(fileURLToPath(import.meta.url));
const read=(path:string)=>readFileSync(join(dir,path),'utf8');
const page=read('../../pages/treatwell-alternative/index.astro');
describe('Treatwell Alternative UK marketing page',()=>{
 it('has canonical URL, search title and visible content',()=>{
  expect(TREATWELL_ALTERNATIVE_PAGE_PATH).toBe('/treatwell-alternative');
  expect(TREATWELL_ALTERNATIVE_TITLE).toContain('Treatwell Alternative');
  expect(TREATWELL_ALTERNATIVE_TITLE.length).toBeLessThanOrEqual(65);
  expect(TREATWELL_ALTERNATIVE_DESCRIPTION.length).toBeLessThanOrEqual(160);
  expect(page).toContain('canonicalPath={TREATWELL_ALTERNATIVE_PAGE_PATH}');
  expect(page).toContain('faqs={TREATWELL_ALTERNATIVE_FAQ_ITEMS}');
  expect(page).toContain('buildTreatwellAlternativeBreadcrumbJsonLd()');
  expect(page).toContain('buildTreatwellAlternativeFaqJsonLd()');
  expect((read('../../components/treatwellAlternative/TreatwellHero.astro').match(/<h1\b/g)||[])).toHaveLength(1);
 });
 it('has WebPage, BreadcrumbList and FAQ structured data aligned with visible content',()=>{
  const web=buildTreatwellAlternativeWebPageJsonLd();
  const breadcrumb=buildTreatwellAlternativeBreadcrumbJsonLd();
  const faq=buildTreatwellAlternativeFaqJsonLd();
  expect(web.url).toBe('https://kersivo.co.uk/treatwell-alternative');
  expect(web.inLanguage).toBe('en-GB');
  expect(web.breadcrumb).toEqual({'@id':breadcrumb['@id']});
  expect((breadcrumb.itemListElement as unknown[]).length).toBe(2);
  expect((faq.mainEntity as unknown[]).length).toBe(TREATWELL_ALTERNATIVE_FAQ_ITEMS.length);
  expect(TREATWELL_ALTERNATIVE_FAQ_ITEMS.length).toBeGreaterThanOrEqual(8);
 });
 it('reuses the existing Nearcut page flow without stray Nearcut copy',()=>{
  const order=['<TreatwellHero','<TreatwellQuickAnswer','<TreatwellWhy','<TreatwellCosts','<TreatwellCompare','<TreatwellProof','<TreatwellFit','<TreatwellSwitching','<TreatwellPricing','<Faq4','<TreatwellFinalCta','<TreatwellSources'].map(x=>page.indexOf(x));
  expect(order.every(x=>x>=0)).toBe(true);
  expect(order).toEqual([...order].sort((a,b)=>a-b));
  const compare=read('../../components/treatwellAlternative/TreatwellCompare.astro');
  expect(compare).toContain('data-treatwell-comparison');
  expect(compare).not.toMatch(/>\s*nearcut\s*</i);
  expect(TREATWELL_COMPARE_SECTIONS).toHaveLength(6);
 });
 it('states correct first-marketplace versus repeat/direct fee distinction',()=>{
  const costs=read('../../components/treatwellAlternative/TreatwellCosts.astro');
  expect(costs).toContain('35%');
  expect(costs).toContain('2.5%');
  expect(costs).toContain('repeat');
  expect(costs).toContain('Stripe');
  expect(TREATWELL_SOURCES.every(x=>x.url.startsWith('https://'))).toBe(true);
 });
 it('is linked from marketing navigation, routing and sitemap',()=>{
  expect(MARKETING_NAV_ITEMS.find(x=>x.href==='/treatwell-alternative')).toMatchObject({group:'compare',section:'alternatives'});
  expect(getRouteFamily('/treatwell-alternative')).toBe('marketing');
  expect(buildMarketingSitemapEntries().some(x=>x.loc==='https://kersivo.co.uk/treatwell-alternative')).toBe(true);
 });
});