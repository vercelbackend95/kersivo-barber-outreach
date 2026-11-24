import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildMarketingNavigation } from '@/lib/nav/marketingNavigation';
import { FOOTER_COLUMNS } from '@/lib/nav/footerNavigation';
import {
  FREE_TOOLS,
  FREE_TOOLS_DESCRIPTION,
  FREE_TOOLS_PAGE_PATH,
  FREE_TOOLS_TITLE,
  FREE_TOOL_GROUPS,
  buildFreeToolsJsonLd,
} from './freeToolsPage';
import {
  PRICE_CALCULATOR_DESCRIPTION,
  PRICE_CALCULATOR_FAQ_ITEMS,
  PRICE_CALCULATOR_PAGE_PATH,
  buildPriceCalculatorJsonLd,
} from './priceCalculatorPage';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('/free-tools hub', () => {
  it('lists exactly the tools in the "Free tools" navigation group, each once', () => {
    const tools = buildMarketingNavigation().find((group) => group.id === 'tools')!;
    const navHrefs = [...tools.featured, ...tools.sections.flatMap((section) => section.items)].map((item) => item.href);
    const hubHrefs = FREE_TOOLS.map((tool) => tool.href);
    expect(new Set(hubHrefs).size).toBe(hubHrefs.length);
    expect([...hubHrefs].sort()).toEqual([...navHrefs].sort());
  });

  it('is reachable from the navigation panel and the footer', () => {
    const tools = buildMarketingNavigation().find((group) => group.id === 'tools')!;
    expect(tools.featuredAction?.href).toBe(FREE_TOOLS_PAGE_PATH);
    const footerHrefs = FOOTER_COLUMNS.flatMap((column) => column.links.map((link) => link.href));
    expect(footerHrefs).toContain(FREE_TOOLS_PAGE_PATH);
    expect(footerHrefs).toContain(PRICE_CALCULATOR_PAGE_PATH);
  });

  it('groups tools by job and puts pricing first', () => {
    expect(FREE_TOOL_GROUPS[0].id).toBe('pricing');
    expect(FREE_TOOL_GROUPS[0].tools[0].href).toBe(PRICE_CALCULATOR_PAGE_PATH);
    for (const group of FREE_TOOL_GROUPS) expect(group.tools.length).toBeGreaterThan(0);
  });

  it('keeps search snippets within length', () => {
    expect(FREE_TOOLS_TITLE.length).toBeLessThanOrEqual(60);
    expect(FREE_TOOLS_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(PRICE_CALCULATOR_DESCRIPTION.length).toBeLessThanOrEqual(160);
  });

  it('lists every tool in the ItemList JSON-LD', () => {
    const list = buildFreeToolsJsonLd().find((entry) => entry['@type'] === 'ItemList')!;
    const items = list.itemListElement as { url: string }[];
    expect(items.map((item) => new URL(item.url).pathname)).toEqual(FREE_TOOLS.map((tool) => tool.href));
  });

  it('keeps the hub and calculator public and indexable', () => {
    for (const path of ['src/pages/free-tools/index.astro', 'src/pages/barber-price-calculator/index.astro']) {
      expect(read(path)).not.toMatch(/noindex/);
    }
  });
});

describe('/barber-price-calculator JSON-LD', () => {
  it('mirrors the visible FAQ', () => {
    const faq = buildPriceCalculatorJsonLd().find((entry) => entry['@type'] === 'FAQPage')!;
    const questions = (faq.mainEntity as { name: string }[]).map((item) => item.name);
    expect(questions).toEqual(PRICE_CALCULATOR_FAQ_ITEMS.map((item) => item.question));
  });

  it('places the calculator under Free tools in the breadcrumb', () => {
    const crumbs = buildPriceCalculatorJsonLd().find((entry) => entry['@type'] === 'BreadcrumbList')!;
    const names = (crumbs.itemListElement as { name: string }[]).map((item) => item.name);
    expect(names).toEqual(['Home', 'Free tools', 'Barber price calculator']);
  });
});
