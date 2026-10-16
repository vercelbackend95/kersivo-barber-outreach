import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MARKETING_NAV_ITEMS, buildMarketingNavigation } from '@/lib/nav/marketingNavigation';
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
      [buildBarbershopOnlineBookingJsonLd(), '/barbershop-online-booking', 3],
    ] as const;
    for (const [schema, path, breadcrumbCount] of cases) {
      expect(schema).toMatchObject({ '@type': 'WebPage', '@id': site + path + '#webpage', url: site + path });
      const crumbs = (schema.breadcrumb as { itemListElement: unknown[] }).itemListElement;
      expect(crumbs).toHaveLength(breadcrumbCount);
      expect((crumbs[0] as { item: string }).item).toBe(site + '/');
      if (breadcrumbCount === 3) expect((crumbs[1] as { item: string }).item).toBe(site + '/barbershop-websites');
    }
  });

  it('keeps all three Resources items hidden pending cluster release', () => {
    expect([BARBERSHOP_WEBSITES_PAGE_INDEXABLE, BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE, BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE]).toEqual([false, false, false]);
    for (const id of ['resources-barbershop-websites', 'resources-website-design', 'resources-online-booking']) {
      const item = MARKETING_NAV_ITEMS.find((entry) => entry.id === id);
      expect(item, id).toBeDefined();
      expect(item?.visible, id).toBe(false);
    }
    const visible = buildMarketingNavigation().flatMap((g) => [...g.featured, ...g.sections.flatMap((s) => s.items)]);
    for (const id of ['resources-barbershop-websites', 'resources-website-design', 'resources-online-booking']) {
      expect(visible.map((x) => x.id)).not.toContain(id);
    }
    const sitemap = buildMarketingSitemapEntries().map((entry) => entry.loc);
    for (const path of ['/barbershop-websites', '/barbershop-website-design', '/barbershop-online-booking']) {
      expect(sitemap).not.toContain(getPublicSiteUrl() + path);
    }
  });

  it('retains both guide routes from the pillar panel and preserves demo links', () => {
    const panel = read('../../components/barbershop-websites/WebsiteFeaturesPanel.astro');
    const design = read('../../components/barbershop-website-design/WebsiteDesignPhotography.astro');
    expect(panel).toContain('href: BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH');
    expect(panel).toContain('href: BARBERSHOP_ONLINE_BOOKING_PAGE_PATH');
    expect(panel).toContain('BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH}#your-team');
    expect(design).toContain('id="your-team"');
    for (const href of ['DEMO_SHOP_HREF', 'DEMO_CONTACT_HREF', '/demo/services']) expect(panel).toContain(href);
    const pillar = read('../../pages/barbershop-websites/index.astro');
    expect(pillar).toContain('buildBarbershopWebsitesJsonLd()');
    expect(pillar).toContain("name: 'Website design guide'");
    expect(pillar).toContain("name: 'Online booking guide'");
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
