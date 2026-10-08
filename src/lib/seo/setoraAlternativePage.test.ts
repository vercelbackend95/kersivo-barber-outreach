import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SETORA_ALTERNATIVE_PAGE_PATH, SETORA_ALTERNATIVE_TITLE, SETORA_ALTERNATIVE_DESCRIPTION,
  SETORA_ALTERNATIVE_FAQ_ITEMS, buildSetoraAlternativeFaqJsonLd,
} from './setoraAlternativeFaq';
import { buildSetoraAlternativeBreadcrumbJsonLd, buildSetoraAlternativeWebPageJsonLd } from './setoraAlternativeJsonLd';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { MARKETING_NAV_ITEMS } from '@/lib/nav/marketingNavigation';
import { GET as getRobots } from '../../pages/robots.txt';
import { SETORA_SOURCES, requireVerifiedSetoraFact } from './setoraFacts';
const dir = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(dir,p),'utf8');
const page = read('../../pages/setora-alternative/index.astro');
const prefix = '../../components/setoraAlternative/';

describe('Setora Alternative landing page', () => {
  it('uses unique canonical and indexable UK-focused metadata', () => {
    expect(SETORA_ALTERNATIVE_PAGE_PATH).toBe('/setora-alternative');
    expect(SETORA_ALTERNATIVE_TITLE).toContain('Setora Alternative UK');
    expect(SETORA_ALTERNATIVE_TITLE.length).toBeLessThanOrEqual(65);
    expect(SETORA_ALTERNATIVE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(page).toContain('canonicalPath={SETORA_ALTERNATIVE_PAGE_PATH}');
    expect(page).not.toContain('noindex');
    const schema=buildSetoraAlternativeWebPageJsonLd();
    expect(schema['@type']).toBe('WebPage');
    expect(schema.url).toBe('https://kersivo.co.uk/setora-alternative');
    expect(schema.inLanguage).toBe('en-GB');
    expect(schema.breadcrumb).toEqual({'@id':'https://kersivo.co.uk/setora-alternative#breadcrumb'});
  });
  it('contains exactly one visible H1 and the mature comparison structure', () => {
    const ordered=['SetoraHero','SetoraQuickAnswer','SetoraWhy','SetoraCosts','SetoraCompare','SetoraProof','SetoraFit','SetoraSwitching','SetoraPricing','Faq4','SetoraFinalCta','SetoraSources'].map(x=>page.indexOf('<'+x));
    expect(ordered.every(x=>x>=0)).toBe(true);
    expect(ordered).toEqual([...ordered].sort((a,b)=>a-b));
    const hero=read(prefix+'SetoraHero.astro');
    expect((hero.match(/<h1\b/g)||[])).toHaveLength(1);
    expect(hero).toContain('aria-current="page">Setora alternative');
  });
  it('emits BreadcrumbList schema consistent with visible hero breadcrumb', () => {
    const ld=buildSetoraAlternativeBreadcrumbJsonLd();
    expect(ld['@type']).toBe('BreadcrumbList');
    const elements=ld.itemListElement as Record<string, unknown>[];
    expect(elements.map(x=>x.position)).toEqual([1,2]);
    expect(elements.map(x=>x.item)).toEqual(['https://kersivo.co.uk/','https://kersivo.co.uk/setora-alternative']);
    expect(page).toContain('buildSetoraAlternativeBreadcrumbJsonLd()');
  });
  it('displays the same FAQ items that appear in JSON-LD, without duplicated invented answers', () => {
    expect(SETORA_ALTERNATIVE_FAQ_ITEMS.length).toBeGreaterThanOrEqual(10);
    const schema=buildSetoraAlternativeFaqJsonLd();
    expect(schema['@type']).toBe('FAQPage');
    expect((schema.mainEntity as unknown[]).length).toBe(SETORA_ALTERNATIVE_FAQ_ITEMS.length);
    expect(page).toContain('faqs={SETORA_ALTERNATIVE_FAQ_ITEMS}');
  });
  it('does not hide Setora strengths, pricing conflict, or fabricate £39 standard pricing', () => {
    const costs=read(prefix+'SetoraCosts.astro');
    const facts=read('setoraFacts.ts');
    const compare=read(prefix+'SetoraCompare.astro');
    const pricing=requireVerifiedSetoraFact('canonicalMonthlyGbp');
    expect(pricing.value).toBe(59);
    expect(costs).toContain('canonical');
    expect(costs).toContain('pricing discrepancy');
    expect(facts).toContain('legacyBarberLandingMonthlyGbp');
    expect(compare).toContain('data-setora-comparison');
    expect(compare).toContain('src="/images/brand/kersivo-mark.png"');
    expect(compare).not.toMatch(/>\s*fresha\s*<\/span>/i);
    expect(SETORA_SOURCES.some(x=>x.url.includes('setora.co.uk'))).toBe(true);
  });
  it('has public nav, sitemap, cross-links and nonblocking robots rules', async () => {
    expect(MARKETING_NAV_ITEMS.find(x=>x.href==='/setora-alternative')).toMatchObject({group:'compare',section:'alternatives'});
    expect(buildMarketingSitemapEntries().some(x=>x.loc==='https://kersivo.co.uk/setora-alternative' && x.lastmod==='2026-10-08')).toBe(true);
    const robots=await (await getRobots({} as Parameters<typeof getRobots>[0])).text();
    expect(robots).toContain('Sitemap: https://kersivo.co.uk/sitemap.xml');
    expect(robots).not.toContain('Disallow: /setora');
    expect(read(prefix+'SetoraFit.astro')).toContain('/nearcut-alternative');
  });
});
