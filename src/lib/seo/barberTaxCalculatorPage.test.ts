import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SELF_EMPLOYED_RATES_CHECKED_ISO,
  SELF_EMPLOYED_RATE_SOURCES,
} from '@/data/self-employed-tax-rates';
import { DEFAULT_INPUTS, calculateTax } from '@/lib/barberTaxCalculator/engine';
import { formatGbp } from '@/lib/barberTaxCalculator/view';
import { buildMarketingNavigation } from '@/lib/nav/marketingNavigation';
import { FOOTER_COLUMNS } from '@/lib/nav/footerNavigation';
import { MARKETING_CONTENT_PATHS } from '@/lib/navigation/routeFamilies';
import {
  BARBER_TAX_CALCULATOR_DESCRIPTION,
  BARBER_TAX_CALCULATOR_LAST_UPDATED_ISO,
  BARBER_TAX_CALCULATOR_PAGE_PATH,
  BARBER_TAX_CALCULATOR_TITLE,
  BARBER_TAX_FAQ_ITEMS,
  BARBER_TAX_RELATED_LINKS,
  buildBarberTaxCalculatorJsonLd,
} from './barberTaxCalculatorPage';
import { FREE_TOOLS } from './freeToolsPage';
import { buildMarketingSitemapEntries } from './marketingSitemap';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const PAGE = 'src/pages/self-employed-barber-tax-calculator/index.astro';

describe('/self-employed-barber-tax-calculator SEO', () => {
  it('keeps the title and description within length limits', () => {
    expect(BARBER_TAX_CALCULATOR_TITLE).toBe('Self-Employed Barber Tax Calculator UK: What to Set Aside');
    expect(BARBER_TAX_CALCULATOR_TITLE.length).toBeLessThanOrEqual(60);
    expect(BARBER_TAX_CALCULATOR_DESCRIPTION.length).toBeLessThanOrEqual(155);
  });

  it('builds the WebPage, WebApplication, BreadcrumbList and FAQPage graph', () => {
    const graph = buildBarberTaxCalculatorJsonLd() as Array<Record<string, any>>;
    expect(graph.map((node) => node['@type'])).toEqual(['WebPage', 'WebApplication', 'BreadcrumbList', 'FAQPage']);
    const [page, app, breadcrumb, faq] = graph;
    expect(page['@id']).toMatch(/\/self-employed-barber-tax-calculator#webpage$/);
    expect(page.dateModified).toBe(BARBER_TAX_CALCULATOR_LAST_UPDATED_ISO);
    expect(app).toMatchObject({ isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' } });
    expect(breadcrumb.itemListElement.map((item: { name: string }) => item.name)).toEqual([
      'Home',
      'Free tools',
      'Self-employed barber tax calculator',
    ]);
    expect(faq.mainEntity.map((item: { name: string }) => item.name)).toEqual(BARBER_TAX_FAQ_ITEMS.map((item) => item.question));
    expect(JSON.stringify(graph)).not.toMatch(/aggregateRating|review/i);
  });

  it('is in the sitemap with its visible date, the marketing layout and is indexable', () => {
    const entry = buildMarketingSitemapEntries().find((item) => item.loc.endsWith(BARBER_TAX_CALCULATOR_PAGE_PATH));
    expect(entry?.lastmod).toBe(BARBER_TAX_CALCULATOR_LAST_UPDATED_ISO);
    expect(MARKETING_CONTENT_PATHS).toContain(BARBER_TAX_CALCULATOR_PAGE_PATH);
    expect(read(PAGE)).not.toMatch(/noindex/);
  });

  it('is easy to find: free tools hub, navigation, footer and llms.txt', () => {
    expect(FREE_TOOLS.map((tool) => tool.href)).toContain(BARBER_TAX_CALCULATOR_PAGE_PATH);
    const tools = buildMarketingNavigation().find((group) => group.id === 'tools')!;
    expect(tools.sections.flatMap((section) => section.items).map((item) => item.href)).toContain(BARBER_TAX_CALCULATOR_PAGE_PATH);
    expect(FOOTER_COLUMNS.flatMap((column) => column.links.map((link) => link.href))).toContain(BARBER_TAX_CALCULATOR_PAGE_PATH);
    expect(read('src/pages/llms.txt.ts')).toContain(`'${BARBER_TAX_CALCULATOR_PAGE_PATH}'`);
  });
});

describe('/self-employed-barber-tax-calculator content rules', () => {
  it('quotes the example figures the calculator actually produces', () => {
    const example = calculateTax(DEFAULT_INPUTS);
    const answer = BARBER_TAX_FAQ_ITEMS[0].answer;
    expect(answer).toContain(formatGbp(example.profit));
    expect(answer).toContain(formatGbp(example.bill));
  });

  it('dates every rate source and links only official pages', () => {
    for (const entry of Object.values(SELF_EMPLOYED_RATE_SOURCES)) {
      expect(entry.source).toMatch(/^https:\/\/www\.gov\.uk\//);
      expect(entry.checked).toBe(SELF_EMPLOYED_RATES_CHECKED_ISO);
    }
  });

  it('makes no commission or product claims and keeps related links internal', () => {
    const copy = JSON.stringify(BARBER_TAX_FAQ_ITEMS);
    expect(copy).not.toMatch(/commission|KERSIVO (Starter|Full)|£39/);
    for (const link of BARBER_TAX_RELATED_LINKS) expect(link.href.startsWith('/')).toBe(true);
  });

  it('says it is not tax advice', () => {
    expect(read('src/lib/barberTaxCalculator/view.ts')).toMatch(/Not tax advice/);
  });
});
