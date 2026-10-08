import { readFileSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe,expect,it } from 'vitest';
import { TREATWELL_ALTERNATIVE_PAGE_PATH,TREATWELL_ALTERNATIVE_TITLE,TREATWELL_ALTERNATIVE_DESCRIPTION,TREATWELL_ALTERNATIVE_FAQ_ITEMS,buildTreatwellAlternativeFaqJsonLd } from './treatwellAlternativeFaq';
import { buildTreatwellAlternativeWebPageJsonLd,buildTreatwellAlternativeBreadcrumbJsonLd } from './treatwellAlternativeJsonLd';
import { TREATWELL_COMPARE_SECTIONS,TREATWELL_SOURCES,requireVerifiedTreatwellFact,TREATWELL_UK_COMMERCIAL_FACTS } from './treatwellFacts';
import { resolvePageSeo } from './meta';
import { GET as getRobots } from '../../pages/robots.txt';
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
  expect(page).toContain('buildKersivoEntityJsonLd()');
  expect(page).not.toContain('noindex');
  expect((read('../../components/treatwellAlternative/TreatwellHero.astro').match(/<h1\b/g)||[])).toHaveLength(1);
 });
 it('has WebPage, BreadcrumbList and FAQ structured data aligned with visible content',()=>{
  const web=buildTreatwellAlternativeWebPageJsonLd();
  const breadcrumb=buildTreatwellAlternativeBreadcrumbJsonLd();
  const faq=buildTreatwellAlternativeFaqJsonLd();
  expect(web.url).toBe('https://kersivo.co.uk/treatwell-alternative');
  expect(web.inLanguage).toBe('en-GB');
  expect(web.breadcrumb).toEqual({'@id':breadcrumb['@id']});
  expect(web.isPartOf).toEqual({'@id':'https://kersivo.co.uk/#website'});
  expect(web.publisher).toEqual({'@id':'https://kersivo.co.uk/#organization'});
  expect(breadcrumb.itemListElement).toEqual([
    {'@type':'ListItem',position:1,name:'Home',item:'https://kersivo.co.uk/'},
    {'@type':'ListItem',position:2,name:'Treatwell alternative',item:'https://kersivo.co.uk/treatwell-alternative'},
  ]);
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
  expect(costs).toContain("requireVerifiedTreatwellFact('newMarketplaceClientCommission')");
  expect(costs).toContain("requireVerifiedTreatwellFact('onlinePrepaymentProcessing')");
  expect(costs).toContain('365-day');
  expect(costs).toContain('Stripe processing fees');
  expect(requireVerifiedTreatwellFact('newMarketplaceClientCommission').percent).toBe(35);
  expect(requireVerifiedTreatwellFact('onlinePrepaymentProcessing').percent).toBe(2.5);
  expect(TREATWELL_UK_COMMERCIAL_FACTS.softwareMonthlySubscription.status).toBe('unresolved');
  expect(TREATWELL_SOURCES.every(x=>x.url.startsWith('https://'))).toBe(true);
 });
 it('is linked from marketing navigation, routing and sitemap',()=>{
  expect(MARKETING_NAV_ITEMS.find(x=>x.href==='/treatwell-alternative')).toMatchObject({group:'compare',section:'alternatives'});
  expect(getRouteFamily('/treatwell-alternative')).toBe('marketing');
  expect(buildMarketingSitemapEntries().some(x=>x.loc==='https://kersivo.co.uk/treatwell-alternative' && x.lastmod==='2026-10-08')).toBe(true);
  for(const other of ['booksyAlternative/BooksyFit.astro','freshaAlternative/FreshaFit.astro','nearcutAlternative/NearcutFit.astro']) {
    expect(read('../../components/'+other)).toContain('/treatwell-alternative');
  }
 });
 it('is indexable, crawlable and has a canonical OpenGraph URL', async () => {
  const robots = await (await getRobots({} as Parameters<typeof getRobots>[0])).text();
  expect(robots).toContain('User-agent: *');
  expect(robots).toContain('User-agent: OAI-SearchBot');
  expect(robots).toContain('Sitemap: https://kersivo.co.uk/sitemap.xml');
  expect(robots).not.toContain('Disallow: /treatwell-alternative');
  const seo = resolvePageSeo({
    title: TREATWELL_ALTERNATIVE_TITLE,
    description: TREATWELL_ALTERNATIVE_DESCRIPTION,
    canonicalPath: TREATWELL_ALTERNATIVE_PAGE_PATH,
  });
  expect(seo.canonical).toBe('https://kersivo.co.uk/treatwell-alternative');
  expect(seo.robotsContent).toBeUndefined();
  expect(seo.ogImage).toMatch(/^https:\/\/kersivo.co.uk\//);
 });
 it('keeps main SEO facts in visible copy and FAQ rather than inaccessible scripts',()=>{
  const faqs = TREATWELL_ALTERNATIVE_FAQ_ITEMS.map(x=>x.question+' '+x.answer).join(' ');
  expect(faqs).toContain('365');
  expect(faqs).toContain('£39');
  expect(faqs).toContain('2.5%');
  expect(faqs).toContain('35%');
  expect(faqs).toContain('simultaneously');
  expect(page).toContain('<TreatwellCosts');
  expect(page).toContain('<TreatwellSources');
  expect(page).toContain('<Faq4');
 });
});