import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BARBERSHOP_WEBSITES_PAGE_INDEXABLE,
  BARBERSHOP_WEBSITES_PAGE_PATH,
  BARBERSHOP_WEBSITES_PAGE_TITLE,
  buildBarbershopWebsitesJsonLd,
} from './barbershopWebsitesPage';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE } from './barbershopOnlineBookingPage';
import { BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE } from './barbershopWebsiteDesignPage';
import { MARKETING_NAV_ITEMS, MARKETING_NAV_DIRECT_LINKS, buildMarketingNavigation, buildMarketingNavTopLevelEntries } from '@/lib/nav/marketingNavigation';
import { getKersivoOrganizationId, getKersivoWebsiteId } from './kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../pages/barbershop-websites/index.astro');
const hero = read('../../components/barbershop-websites/BarbershopWebsitesHero.astro');
const panel = read('../../components/barbershop-websites/WebsiteFeaturesPanel.astro');
const css = read('../../styles/components/barbershop-websites-hero.css');
const designTeamSection = read('../../components/barbershop-website-design/WebsiteDesignPhotography.astro');

describe('/barbershop-websites Batch 2 — technical SEO and link integrity', () => {
  it('creates a canonical WebPage entity with existing brand IDs and no invented rich-result proof', () => {
    const siteUrl = getPublicSiteUrl();
    const url = siteUrl + BARBERSHOP_WEBSITES_PAGE_PATH;
    const schema = buildBarbershopWebsitesJsonLd();
    expect(schema).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': url + '#webpage',
      url,
      name: BARBERSHOP_WEBSITES_PAGE_TITLE,
      inLanguage: 'en-GB',
      isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
      publisher: { '@id': getKersivoOrganizationId(siteUrl) },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        '@id': url + '#breadcrumb',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl + '/' },
          { '@type': 'ListItem', position: 2, name: 'Barbershop Websites', item: url },
        ],
      },
    });
    expect(JSON.stringify(schema)).not.toMatch(/FAQPage|AggregateRating|Review|Offer|ratingValue|testimonial/);
    expect(page).toContain('jsonLd={buildBarbershopWebsitesJsonLd()}');
    expect(page).toContain('canonicalPath={BARBERSHOP_WEBSITES_PAGE_PATH}');
  });

  it('matches visible accessible breadcrumb order to JSON-LD', () => {
    const breadcrumb = hero.match(/<nav class="bsw-hero__breadcrumb"[\s\S]*?<\/nav>/)?.[0] ?? '';
    expect(breadcrumb).toContain('aria-label="Breadcrumb"');
    expect(breadcrumb).toContain('<li><a href="/">Home</a></li>');
    expect(breadcrumb).toContain('<li><span aria-current="page">Barbershop Websites</span></li>');
    expect(breadcrumb.indexOf('Home')).toBeLessThan(breadcrumb.indexOf('Barbershop Websites'));
    expect(css).toContain('.bsw-hero__breadcrumb a:focus-visible');
  });

  it('links to both guides from website essentials without deleting the real demo paths', () => {
    const essentials = read('../../components/barbershop-websites/WebsiteEssentials.astro');
    expect(essentials).toContain('href={BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH}');
    expect(essentials).toContain('BARBERSHOP_WEBSITE_DESIGN_PAGE_PATH}#your-team');
    expect(essentials).toContain('href={BARBERSHOP_ONLINE_BOOKING_PAGE_PATH}');
    expect(designTeamSection).toContain('id="your-team"');
    for (const route of ['DEMO_HOME_HREF', 'DEMO_SHOP_HREF', 'DEMO_CONTACT_HREF', 'DEMO_BOOK_HREF', '/demo/services', '/demo/barbers']) {
      expect(panel).toContain(route);
    }
    const footer = read('../../lib/nav/footerNavigation.ts');
    expect(footer).toContain("name: 'Website design guide', href: '/barbershop-website-design'");
    expect(footer).toContain("name: 'Online booking & deposits', href: '/barbershop-online-booking'");
  });

  it('keeps global footer outside main and does not add a second primary landmark', () => {
    const open = page.indexOf('<main class="bsw-page">');
    const close = page.indexOf('</main>');
    const footer = page.indexOf('<Footer50');
    expect(open).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(open);
    expect(footer).toBeGreaterThan(close);
    expect(page.match(/<main\b/g)).toHaveLength(1);
  });

  it('publishes all three pages in the marketing sitemap and exposes the Websites navigation hierarchy', () => {
    expect(BARBERSHOP_WEBSITES_PAGE_INDEXABLE).toBe(true);
    expect(BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE).toBe(true);
    expect(BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE).toBe(true);
    expect(page).toContain('noindex={!BARBERSHOP_WEBSITES_PAGE_INDEXABLE}');
    const urls = buildMarketingSitemapEntries().map((entry) => entry.loc);
    for (const path of ['/barbershop-websites', '/barbershop-website-design', '/barbershop-online-booking']) {
      expect(urls).toContain(`https://kersivo.co.uk${path}`);
    }
    expect(MARKETING_NAV_ITEMS.find((entry) => entry.href === BARBERSHOP_WEBSITES_PAGE_PATH)).toMatchObject({
      group: 'product',
      label: 'Barbershop websites',
    });
    expect(MARKETING_NAV_DIRECT_LINKS.find((entry) => entry.id === 'websites')).toBeUndefined();
    expect(buildMarketingNavTopLevelEntries().map((entry) =>
      entry.kind === 'group' ? entry.group.label : entry.link.label,
    )).toEqual(['Product', 'Compare', 'Resources', 'Pricing']);
    const resources = buildMarketingNavigation().find((group) => group.id === 'resources')!;
    expect(resources.sections.find((section) => section.id === 'guides')?.items.map((item) => item.href)).toEqual([
      '/barbershop-website-design',
      '/barbershop-online-booking',
      '/insights',
    ]);
  });
});
