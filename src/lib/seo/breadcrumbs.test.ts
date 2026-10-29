import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildAboutBreadcrumbJsonLd, buildAboutPageJsonLd } from './aboutPage';
import { buildBarbershopOnlineBookingJsonLd } from './barbershopOnlineBookingPage';
import { buildBarbershopWebsiteDesignJsonLd } from './barbershopWebsiteDesignPage';
import { buildBarbershopWebsitesJsonLd } from './barbershopWebsitesPage';
import { buildPricingBreadcrumbJsonLd, buildPricingWebPageJsonLd } from './pricingPage';
import { buildStarterBreadcrumbJsonLd, buildStarterWebPageJsonLd } from './starterPage';

type Crumb = { position: number; name: string; item: string };
const items = (list: Record<string, unknown>) => list.itemListElement as Crumb[];

describe('shared BreadcrumbList helper', () => {
  const cases: Array<[string, Record<string, unknown>, Record<string, unknown>, string]> = [
    ['/pricing', buildPricingBreadcrumbJsonLd(), buildPricingWebPageJsonLd(), 'Pricing'],
    ['/starter', buildStarterBreadcrumbJsonLd(), buildStarterWebPageJsonLd(), 'KERSIVO Starter'],
    ['/about', buildAboutBreadcrumbJsonLd(), buildAboutPageJsonLd(), 'About KERSIVO'],
  ];

  it.each(cases)('%s: Home → page, last item equals the canonical URL', (path, list, page, label) => {
    const url = page.url as string;
    expect(url.endsWith(path)).toBe(true);
    expect(list['@type']).toBe('BreadcrumbList');
    expect(list['@id']).toBe(`${url}#breadcrumb`);
    expect(page.breadcrumb).toEqual({ '@id': `${url}#breadcrumb` });
    const crumbs = items(list);
    expect(crumbs[0]).toMatchObject({ position: 1, name: 'Home' });
    expect(crumbs[0].item.endsWith('/')).toBe(true);
    expect(crumbs.at(-1)).toMatchObject({ position: 2, name: label, item: url });
  });

  it('nests the same trail in the Websites cluster WebPage nodes', () => {
    for (const [page, label] of [
      [buildBarbershopWebsitesJsonLd(), 'Barbershop Websites'],
      [buildBarbershopOnlineBookingJsonLd(), 'Online Booking for Barbershops'],
      [buildBarbershopWebsiteDesignJsonLd(), 'Barbershop Website Design'],
    ] as const) {
      const list = page.breadcrumb as Record<string, unknown>;
      expect(list['@context']).toBeUndefined();
      expect(items(list).at(-1)).toMatchObject({ name: label, item: page.url });
    }
  });

  it('renders the visible trail on pricing, starter and about heroes', () => {
    for (const [file, trail] of [
      ['src/pages/pricing.astro', 'PRICING_BREADCRUMBS'],
      ['src/pages/starter/index.astro', 'STARTER_BREADCRUMBS'],
      ['src/pages/about.astro', 'ABOUT_BREADCRUMBS'],
    ]) {
      expect(readFileSync(file, 'utf8')).toContain(`<PageBreadcrumbs trail={${trail}} />`);
    }
  });
});
