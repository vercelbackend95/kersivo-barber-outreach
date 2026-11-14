import { readFileSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe,expect,it } from 'vitest';
import { TREATWELL_ALTERNATIVE_PAGE_PATH,TREATWELL_ALTERNATIVE_TITLE,TREATWELL_ALTERNATIVE_DESCRIPTION,TREATWELL_ALTERNATIVE_FAQ_ITEMS,buildTreatwellAlternativeFaqJsonLd } from './treatwellAlternativeFaq';
import { buildTreatwellAlternativeWebPageJsonLd,buildTreatwellAlternativeBreadcrumbJsonLd } from './treatwellAlternativeJsonLd';
import { TREATWELL_COMPARE_SECTIONS,TREATWELL_SOURCES,requireVerifiedTreatwellFact,TREATWELL_UK_COMMERCIAL_FACTS } from './treatwellFacts';
import { resolvePageSeo } from './meta';
import { TW_HERO_FACTS,TW_STARTING_POINTS,TW_SWITCHING_LEAD } from './treatwellAlternativeContent';
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
 it('runs the owner-first section order without stray competitor copy',()=>{
  const order=['<TreatwellHero','<TreatwellAnswer','<TreatwellOutcomes','<TreatwellRule','<TreatwellCosts','<TreatwellCompare','<TreatwellProof','<TreatwellFit','<TreatwellSwitching','<TreatwellPricing','<Faq4','<ComparisonFinalCta','<TreatwellSources'].map(x=>page.indexOf(x));
  expect(order.every(x=>x>=0)).toBe(true);
  expect(order).toEqual([...order].sort((a,b)=>a-b));
  const compare=read('../../components/treatwellAlternative/TreatwellCompare.astro');
  expect(compare).toContain('data-treatwell-comparison');
  expect(compare).toContain('role="tablist"');
  expect(compare).not.toMatch(/>\s*nearcut\s*</i);
  expect(TREATWELL_COMPARE_SECTIONS).toHaveLength(6);
 });
 it('does not assume the reader already uses Treatwell',()=>{
  const ids=TW_STARTING_POINTS.map(x=>x.id);
  expect(ids).toEqual(['on-treatwell','first-system','other-app','phone-dm']);
  expect(read('../../components/treatwellAlternative/TreatwellAnswer.astro')).toContain('Where are you starting from?');
  expect(TREATWELL_ALTERNATIVE_TITLE).toMatch(/Your Brand, Direct Bookings/);
  expect(TREATWELL_ALTERNATIVE_DESCRIPTION).toContain('£39/month per location');
  expect(TREATWELL_ALTERNATIVE_DESCRIPTION).toContain('Stripe fees apply');
  expect(TREATWELL_ALTERNATIVE_DESCRIPTION).toMatch(/own branded site/);
 });
 it('keeps setup-time and commission wording within the claims policy',()=>{
  const all=['TreatwellHero','TreatwellOutcomes','TreatwellRule','TreatwellCosts','TreatwellSwitching','TreatwellPricing'].map(n=>read(`../../components/treatwellAlternative/${n}.astro`)).join(' ')+JSON.stringify([TW_HERO_FACTS,TW_SWITCHING_LEAD]);
  expect(all).toContain('a few days');
  expect(all).not.toMatch(/1[–-]2 weeks|\d+ days? to go live/i);
  expect(all).toMatch(/Stripe/);
  expect(TW_HERO_FACTS.join(' ')).toContain('0% KERSIVO commission · Stripe fees apply');
 });
 it('is linked from marketing navigation, routing and sitemap',()=>{
  expect(MARKETING_NAV_ITEMS.find(x=>x.href==='/treatwell-alternative')).toMatchObject({group:'compare',section:'alternatives'});
  expect(getRouteFamily('/treatwell-alternative')).toBe('marketing');
  expect(buildMarketingSitemapEntries().some(x=>x.loc==='https://kersivo.co.uk/treatwell-alternative' && x.lastmod==='2026-11-14')).toBe(true);
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