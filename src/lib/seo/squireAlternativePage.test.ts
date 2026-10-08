import { describe, expect, it } from 'vitest';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { resolveCanonicalUrl } from './meta';
import {
 SQUIRE_ALTERNATIVE_PAGE_PATH,
 SQUIRE_ALTERNATIVE_TITLE,
 SQUIRE_ALTERNATIVE_DESCRIPTION,
 SQUIRE_ALTERNATIVE_FAQ_ITEMS,
 SQUIRE_ALTERNATIVE_LAST_UPDATED_ISO,
 buildSquireAlternativeFaqJsonLd,
} from './squireAlternativeFaq';
import { buildSquireAlternativeWebPageJsonLd } from './squireAlternativeJsonLd';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here,path),'utf8');

describe('SQUIRE alternative UK SEO',()=>{
 it('publishes a unique canonical, SERP title and description',()=>{
   expect(SQUIRE_ALTERNATIVE_PAGE_PATH).toBe('/squire-alternative');
   expect(resolveCanonicalUrl(SQUIRE_ALTERNATIVE_PAGE_PATH)).toBe('https://kersivo.co.uk/squire-alternative');
   expect(SQUIRE_ALTERNATIVE_TITLE.length).toBeLessThanOrEqual(60);
   expect(SQUIRE_ALTERNATIVE_DESCRIPTION.length).toBeLessThanOrEqual(160);
   expect(SQUIRE_ALTERNATIVE_DESCRIPTION.length).toBeGreaterThanOrEqual(110);
 });
 it('keeps visible FAQ exactly aligned with structured data',()=>{
   const structured=buildSquireAlternativeFaqJsonLd();
   const items=structured.mainEntity as {name:string;acceptedAnswer:{text:string}}[];
   expect(items).toHaveLength(SQUIRE_ALTERNATIVE_FAQ_ITEMS.length);
   expect(items.length).toBeGreaterThanOrEqual(8);
   items.forEach((item,index)=>{
     expect(item.name).toBe(SQUIRE_ALTERNATIVE_FAQ_ITEMS[index].question);
     expect(item.acceptedAnswer.text).toBe(SQUIRE_ALTERNATIVE_FAQ_ITEMS[index].answer);
   });
 });
 it('sets WebPage structured data and editorial sitemap lastmod',()=>{
   const data=buildSquireAlternativeWebPageJsonLd();
   expect(data.url).toBe('https://kersivo.co.uk/squire-alternative');
   expect(data.dateModified).toBe(SQUIRE_ALTERNATIVE_LAST_UPDATED_ISO);
   expect(buildMarketingSitemapEntries().find(e=>e.loc===data.url)?.lastmod).toBe(SQUIRE_ALTERNATIVE_LAST_UPDATED_ISO);
   expect(JSON.stringify([data,buildSquireAlternativeFaqJsonLd()])).not.toMatch(/aggregateRating|reviewCount/);
 });
 it('renders one H1 and reuses the established comparison layout and product demo',()=>{
   const hero=read('../../components/squireAlternative/SquireHero.astro');
   const sections=read('../../components/squireAlternative/SquireSections.astro');
   const page=read('../../pages/squire-alternative/index.astro');
   expect(hero.match(/<h1\b/g)?.length).toBe(1);
   expect(sections).not.toMatch(/<h1\b/);
   expect(page).toContain('canonicalPath={SQUIRE_ALTERNATIVE_PAGE_PATH}');
   expect(page).toContain('faqs={SQUIRE_ALTERNATIVE_FAQ_ITEMS}');
   expect(sections).toContain('<FreshaProof />');
   expect(sections).toContain('<FreshaPricing />');
   expect(page).toContain("fresha-alternative.css");
 });
 it('identifies public SQUIRE USD prices rather than inventing GBP quotes',()=>{
   const sections=read('../../components/squireAlternative/SquireSections.astro');
   const faq=read('squireAlternativeFaq.ts');
   expect(sections).toContain('not verified UK prices');
   expect(sections).toContain('$30');
   expect(sections).toContain('$50');
   expect(sections).toContain('$150');
   expect(sections).toContain('$250');
   expect(faq).toContain('not verified GBP prices');
 });
});
