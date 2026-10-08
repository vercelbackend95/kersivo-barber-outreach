import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SQUARE_ALTERNATIVE_PAGE_PATH, SQUARE_ALTERNATIVE_TITLE, SQUARE_ALTERNATIVE_DESCRIPTION, SQUARE_ALTERNATIVE_FAQ_ITEMS, buildSquareAlternativeFaqJsonLd } from './squareAlternativeFaq';
import { buildSquareAlternativeWebPageJsonLd, buildSquareAlternativeBreadcrumbJsonLd } from './squareAlternativeJsonLd';
import { SQUARE_UK_PLANS, SQUARE_UK_PAYMENT_FACTS, SQUARE_COMPARE_SECTIONS, SQUARE_SOURCES } from './squareFacts';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { MARKETING_NAV_ITEMS } from '@/lib/nav/marketingNavigation';
const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/square-appointments-alternative/index.astro');

describe('Square Appointments alternative', () => {
 it('has UK metadata, canonical URL, WebPage and BreadcrumbList JSON-LD', () => {
   expect(SQUARE_ALTERNATIVE_PAGE_PATH).toBe('/square-appointments-alternative');
   expect(SQUARE_ALTERNATIVE_TITLE.length).toBeLessThanOrEqual(65);
   expect(SQUARE_ALTERNATIVE_DESCRIPTION.length).toBeLessThanOrEqual(160);
   expect(page).toContain('canonicalPath={SQUARE_ALTERNATIVE_PAGE_PATH}');
   expect(page).toContain('buildSquareAlternativeWebPageJsonLd()');
   expect(page).toContain('buildSquareAlternativeBreadcrumbJsonLd()');
   const web=buildSquareAlternativeWebPageJsonLd();
   expect(web.url).toBe('https://kersivo.co.uk/square-appointments-alternative');
   expect(web.inLanguage).toBe('en-GB');
   const bc=buildSquareAlternativeBreadcrumbJsonLd();
   expect(bc['@type']).toBe('BreadcrumbList');
   expect((bc.itemListElement as unknown[]).length).toBe(2);
 });
 it('keeps FAQPage schema exactly aligned with the visible FAQ', () => {
   expect(SQUARE_ALTERNATIVE_FAQ_ITEMS.length).toBeGreaterThanOrEqual(10);
   const schema=buildSquareAlternativeFaqJsonLd();
   expect((schema.mainEntity as unknown[]).length).toBe(SQUARE_ALTERNATIVE_FAQ_ITEMS.length);
   expect(page).toContain('faqs={SQUARE_ALTERNATIVE_FAQ_ITEMS}');
 });
 it('reuses the same design sections in the right order', () => {
   const order=['<SquareHero','<SquareQuickAnswer','<SquareWhy','<SquareCosts','<SquareCompare','<SquareProof','<SquareFit','<SquareSwitching','<SquarePricing','<Faq4','<SquareFinalCta','<SquareSources'].map(token=>page.indexOf(token));
   expect(order.every(value=>value>=0)).toBe(true);
   expect(order).toEqual([...order].sort((a,b)=>a-b));
   expect(page).toContain("fresha-alternative.css");
   const hero=read('../../components/squareAlternative/SquareHero.astro');
   expect((hero.match(/<h1\b/g)||[]).length).toBe(1);
   expect(hero).toContain('aria-label="Breadcrumb"');
   expect(hero).toContain('Square Appointments');
 });
 it('uses official UK Square rates and honest competitor comparisons', () => {
   expect(SQUARE_UK_PLANS.map(p=>p.monthlyGbp)).toEqual([0,29,69]);
   expect(SQUARE_UK_PAYMENT_FACTS.onlineUkPercent).toBe(1.4);
   expect(SQUARE_UK_PAYMENT_FACTS.onlineUkFixedPence).toBe(25);
   expect(SQUARE_COMPARE_SECTIONS).toHaveLength(6);
   expect(SQUARE_SOURCES.every(s=>s.url.startsWith('https://squareup.com/'))).toBe(true);
   const costs=read('../../components/squareAlternative/SquareCosts.astro');
   expect(costs).toContain('Square Free costs £0/month');
   expect(costs).toContain('Stripe fees');
   const compare=read('../../components/squareAlternative/SquareCompare.astro');
   expect(compare).toContain('data-square-comparison');
   expect(compare).not.toContain('FRESHA ECOSYSTEM');
 });
 it('is discoverable in sitemap, navigation and internal links', () => {
   expect(buildMarketingSitemapEntries().some(e=>e.loc==='https://kersivo.co.uk/square-appointments-alternative')).toBe(true);
   expect(MARKETING_NAV_ITEMS.some(x=>x.href==='/square-appointments-alternative')).toBe(true);
   expect(read('../../components/freshaAlternative/FreshaFit.astro')).toContain('/square-appointments-alternative');
 });
 it('does not include draft or fake-review markup', () => {
   expect(page).not.toContain('noindex');
   expect(page).not.toContain('AggregateRating');
   expect(page).not.toContain('Review');
 });
});
