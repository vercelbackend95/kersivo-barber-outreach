import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PHOREST_ALTERNATIVE_PAGE_PATH, PHOREST_ALTERNATIVE_TITLE, PHOREST_ALTERNATIVE_DESCRIPTION, PHOREST_ALTERNATIVE_FAQ_ITEMS, buildPhorestAlternativeFaqJsonLd } from './phorestAlternativeFaq';
import { buildPhorestAlternativeWebPageJsonLd, buildPhorestAlternativeBreadcrumbJsonLd } from './phorestAlternativeJsonLd';
import { PHOREST_COMPARE_SECTIONS, PHOREST_SOURCES } from './phorestFacts';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { MARKETING_NAV_ITEMS } from '@/lib/nav/marketingNavigation';
const dir=dirname(fileURLToPath(import.meta.url));
const read=(path:string)=>readFileSync(join(dir,path),'utf8');
describe('Phorest alternative page',()=>{
it('has UK metadata, correct canonical and structured data',()=>{
expect(PHOREST_ALTERNATIVE_PAGE_PATH).toBe('/phorest-alternative');
expect(PHOREST_ALTERNATIVE_TITLE.length).toBeLessThanOrEqual(65);
expect(PHOREST_ALTERNATIVE_DESCRIPTION.length).toBeLessThanOrEqual(160);
const page=read('../../pages/phorest-alternative/index.astro');
expect(page).toContain('canonicalPath={PHOREST_ALTERNATIVE_PAGE_PATH}');
expect(page).toContain('buildPhorestAlternativeFaqJsonLd()');
expect(buildPhorestAlternativeWebPageJsonLd()).toMatchObject({'@type':'WebPage',url:'https://kersivo.co.uk/phorest-alternative',inLanguage:'en-GB'});
expect(buildPhorestAlternativeBreadcrumbJsonLd()['@type']).toBe('BreadcrumbList');
});
it('uses the existing visual page structure and a single H1',()=>{
const page=read('../../pages/phorest-alternative/index.astro');
const order=['<PhorestHero','<PhorestQuickAnswer','<PhorestWhy','<PhorestCosts','<PhorestCompare','<PhorestProof','<PhorestFit','<PhorestSwitching','<PhorestPricing','<Faq4','<PhorestFinalCta','<PhorestSources'].map(x=>page.indexOf(x));
expect(order.every(x=>x>=0)).toBe(true);
expect(order).toEqual([...order].sort((a,b)=>a-b));
expect((read('../../components/phorestAlternative/PhorestHero.astro').match(/<h1\b/g)||[]).length).toBe(1);
});
it('has accurate visible FAQs and no invented Phorest price',()=>{
expect(PHOREST_ALTERNATIVE_FAQ_ITEMS.length).toBeGreaterThanOrEqual(10);
expect((buildPhorestAlternativeFaqJsonLd().mainEntity as unknown[]).length).toBe(PHOREST_ALTERNATIVE_FAQ_ITEMS.length);
expect(read('../../pages/phorest-alternative/index.astro')).toContain('faqs={PHOREST_ALTERNATIVE_FAQ_ITEMS}');
expect(read('../../components/phorestAlternative/PhorestCosts.astro')).toContain('Quote');
expect(PHOREST_COMPARE_SECTIONS).toHaveLength(6);
expect(PHOREST_SOURCES.every(x=>x.url.startsWith('https://www.phorest.com/gb/'))).toBe(true);
});
it('is discoverable via sitemap and compare navigation',()=>{
expect(buildMarketingSitemapEntries().some(e=>e.loc==='https://kersivo.co.uk/phorest-alternative')).toBe(true);
expect(MARKETING_NAV_ITEMS.find(x=>x.href==='/phorest-alternative')).toMatchObject({group:'compare',section:'alternatives'});
});
});
