import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MARKETING_NAV_DIRECT_LINKS, MARKETING_NAV_ITEMS, buildMarketingNavigation, buildMarketingNavTopLevelEntries } from '@/lib/nav/marketingNavigation';
import { BARBERSHOP_WEBSITES_PAGE_INDEXABLE, buildBarbershopWebsitesJsonLd } from './barbershopWebsitesPage';
import { BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE, buildBarbershopWebsiteDesignJsonLd } from './barbershopWebsiteDesignPage';
import { BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE, buildBarbershopOnlineBookingJsonLd } from './barbershopOnlineBookingPage';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

const root = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Websites three-page integrated cluster release gates', () => {
  it('has three unique WebPage schema entities and aligned breadcrumb hierarchy', () => {
    const site = getPublicSiteUrl();
    const cases = [
      [buildBarbershopWebsitesJsonLd(), '/barbershop-websites', 2],
      [buildBarbershopWebsiteDesignJsonLd(), '/barbershop-website-design', 3],
      // Online booking is its own pillar: Home › Online booking (not under websites).
      [buildBarbershopOnlineBookingJsonLd(), '/barbershop-online-booking', 2],
    ] as const;
    for (const [schema, path, breadcrumbCount] of cases) {
      expect(schema).toMatchObject({ '@type': 'WebPage', '@id': site + path + '#webpage', url: site + path });
      const crumbs = (schema.breadcrumb as { itemListElement: unknown[] }).itemListElement;
      expect(crumbs).toHaveLength(breadcrumbCount);
      expect((crumbs[0] as { item: string }).item).toBe(site + '/');
      if (breadcrumbCount === 3) expect((crumbs[1] as { item: string }).item).toBe(site + '/barbershop-websites');
    }
  });

  it('publishes the pillar as a top-level link, both guides in Resources, and all three URLs in sitemap', () => {
    expect([
      BARBERSHOP_WEBSITES_PAGE_INDEXABLE,
      BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE,
      BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE,
    ]).toEqual([true, true, true]);
    expect(MARKETING_NAV_ITEMS.find((item) => item.href === '/barbershop-websites')).toMatchObject({
      group: 'product', label: 'Barbershop websites',
    });
    expect(MARKETING_NAV_DIRECT_LINKS.find((link) => link.id === 'websites')).toBeUndefined();
    expect(buildMarketingNavTopLevelEntries().map((entry) =>
      entry.kind === 'group' ? entry.group.label : entry.link.label,
    )).toEqual(['Product', 'Compare', 'Resources', 'Pricing']);

    for (const id of ['resources-website-design', 'resources-online-booking']) {
      const item = MARKETING_NAV_ITEMS.find((entry) => entry.id === id);
      expect(item, id).toBeDefined();
      expect(item?.visible, id).toBe(true);
    }
    const resources = buildMarketingNavigation().find((group) => group.id === 'resources')!;
    expect(resources.sections.find((section) => section.id === 'guides')?.items.map((x) => x.href)).toEqual([
      '/barbershop-website-design', '/barbershop-online-booking', '/insights',
    ]);
    const sitemap = buildMarketingSitemapEntries().map((entry) => entry.loc);
    for (const path of ['/barbershop-websites', '/barbershop-website-design', '/barbershop-online-booking']) {
      expect(sitemap).toContain(getPublicSiteUrl() + path);
    }
  });

  it('retains both guide routes from website essentials and preserves demo links', () => {
    const panel = read('../../components/barbershop-websites/WebsiteFeaturesPanel.astro');
    const essentials = read('../../components/barbershop-websites/WebsiteEssentials.astro');
    const design = read('../../components/barbershop-website-design/WebsiteDesignPhotography.astro');
    expect(essentials).toContain('href={BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH}');
    expect(essentials).toContain('href={BARBERSHOP_ONLINE_BOOKING_PAGE_PATH}');
    expect(essentials).toContain('BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH}#your-team');
    expect(design).toContain('id="your-team"');
    for (const href of ['DEMO_HOME_HREF', 'DEMO_SHOP_HREF', 'DEMO_CONTACT_HREF', 'DEMO_BOOK_HREF', '/demo/services', '/demo/barbers']) {
      expect(panel).toContain(href);
    }
    const pillar = read('../../pages/barbershop-websites/index.astro');
    const footer = read('../../lib/nav/footerNavigation.ts');
    expect(pillar).toContain('buildBarbershopWebsitesJsonLd()');
    expect(pillar).toContain('<Footer50');
    expect(footer).toContain("name: 'Website design guide'");
    expect(footer).toContain("name: 'Online booking & deposits', href: '/barbershop-online-booking'");
  });

  it('keeps a single main landmark per page with global footers outside content', () => {
    for (const path of ['barbershop-websites', 'barbershop-website-design', 'barbershop-online-booking']) {
      const page = read('../../pages/' + path + '/index.astro');
      expect(page.match(/<main\b/g), path).toHaveLength(1);
      expect(page.indexOf('</main>'), path).toBeGreaterThan(page.indexOf('<main'));
      expect(page.indexOf('<Footer50'), path).toBeGreaterThan(page.indexOf('</main>'));
    }
  });
});
