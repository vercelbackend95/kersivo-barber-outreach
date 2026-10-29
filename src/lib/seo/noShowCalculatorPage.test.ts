import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MARKETING_SITEMAP_ENTRIES } from './marketingSitemap';
import { FOOTER_COLUMNS } from '@/lib/nav/footerNavigation';
import { MARKETING_CONTENT_PATHS } from '@/lib/navigation/routeFamilies';
import {
  NO_SHOW_CALCULATOR_DESCRIPTION,
  NO_SHOW_CALCULATOR_LAST_UPDATED_ISO,
  NO_SHOW_CALCULATOR_PAGE_PATH,
  NO_SHOW_CALCULATOR_TITLE,
  NO_SHOW_CTA,
  NO_SHOW_FAQ_ITEMS,
  buildNoShowCalculatorJsonLd,
} from './noShowCalculatorPage';

const root = process.cwd();
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

describe('/barbershop-no-show-calculator metadata', () => {
  it('title ≤ 60 and description ≤ 155 characters', () => {
    expect(NO_SHOW_CALCULATOR_TITLE).toBe('Barbershop No-Show Cost Calculator UK (Free Tool)');
    expect(NO_SHOW_CALCULATOR_TITLE.length).toBeLessThanOrEqual(60);
    expect(NO_SHOW_CALCULATOR_DESCRIPTION.length).toBeLessThanOrEqual(155);
  });

  it('JSON-LD graph: WebPage, WebApplication, BreadcrumbList, FAQPage — no ratings', () => {
    const graph = buildNoShowCalculatorJsonLd();
    expect(graph.map((n) => n['@type'])).toEqual(['WebPage', 'WebApplication', 'BreadcrumbList', 'FAQPage']);
    const json = JSON.stringify(graph);
    expect(json).not.toMatch(/aggregateRating|review/i);
    const [page, app] = graph;
    expect(page.dateModified).toBe(NO_SHOW_CALCULATOR_LAST_UPDATED_ISO);
    expect(page.inLanguage).toBe('en-GB');
    expect(app).toMatchObject({
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web browser',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
    });
    const faq = graph[3] as { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> };
    expect(faq.mainEntity.map((q) => q.name)).toEqual(NO_SHOW_FAQ_ITEMS.map((q) => q.question));
  });

  it('CTA keeps commission next to the Stripe fees note', () => {
    expect(NO_SHOW_CTA.text).toContain('0% KERSIVO commission. Stripe processing fees apply.');
    expect(NO_SHOW_CTA.primaryHref).toBe('/starter');
  });
});

describe('internal links', () => {
  it('is in the sitemap with lastmod, footer and marketing route family', () => {
    expect(MARKETING_SITEMAP_ENTRIES).toContainEqual({ path: NO_SHOW_CALCULATOR_PAGE_PATH, lastmod: NO_SHOW_CALCULATOR_LAST_UPDATED_ISO });
    expect(FOOTER_COLUMNS.flatMap((c) => c.links).some((l) => l.href === NO_SHOW_CALCULATOR_PAGE_PATH)).toBe(true);
    expect(MARKETING_CONTENT_PATHS).toContain(NO_SHOW_CALCULATOR_PAGE_PATH);
  });

  it('article links to the calculator after the worked example', () => {
    const md = read('editorial-staging/insights/barbershop-no-show-cost-when-deposit-makes-sense-display.md');
    const example = md.indexOf('## A worked example');
    const callout = md.indexOf('href="/barbershop-no-show-calculator"');
    const next = md.indexOf('## Who carries the loss');
    expect(example).toBeGreaterThan(-1);
    expect(callout).toBeGreaterThan(example);
    expect(callout).toBeLessThan(next);
  });

  it('starter and cost calculator pages link to it', () => {
    expect(read('src/pages/starter/index.astro')).toContain('href="/barbershop-no-show-calculator"');
    expect(read('src/pages/barber-software-cost-calculator/index.astro')).toContain('href="/barbershop-no-show-calculator"');
  });
});
