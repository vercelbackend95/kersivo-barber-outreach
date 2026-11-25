import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MARKETING_NAV_DIRECT_LINKS,
  MARKETING_NAV_GROUPS,
  MARKETING_NAV_ITEMS,
  MARKETING_NAV_PRIMARY_ACTION,
  MARKETING_NAV_SECONDARY_ACTION,
  buildMarketingNavFinderEntries,
  buildMarketingNavigation,
  buildMarketingNavQuickLinks,
  buildMarketingNavTopLevelEntries,
  isMarketingNavGroupCurrent,
  isMarketingNavItemCurrent,
  isMarketingNavSelfHref,
  isPublicMarketingHref,
  marketingNavItemMatch,
  type MarketingNavGroup,
  type MarketingNavItem,
} from './marketingNavigation';
import { MARKETING_NAV_ICONS } from './marketingNavIcons';
import { NAVBAR_SUBSCRIBE_CTA_LABEL } from './navbar17Items';
import { BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE } from '@/lib/seo/barbershopWebsiteDesignPage';
import { BARBERSHOP_WEBSITES_PAGE_INDEXABLE } from '@/lib/seo/barbershopWebsitesPage';
import { BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE } from '@/lib/seo/barbershopOnlineBookingPage';
import { getRouteFamily } from '@/lib/navigation/routeFamilies';
import {
  HERITAGE_ADMIN_DASHBOARD_HREF,
  HERITAGE_DEMO_BASE_PATH,
  HERITAGE_DEMO_BOOK_HREF,
  HERITAGE_DEMO_SERVICES_HREF,
  HERITAGE_DEMO_SITE_HREF,
} from '@/lib/demo/heritage/links';

const pagesDir = path.resolve(__dirname, '../../pages');
const publicDir = path.resolve(__dirname, '../../../public');

function pageExists(pathname: string): boolean {
  if (pathname === '/') return existsSync(path.join(pagesDir, 'index.astro'));
  const clean = pathname.replace(/^\//, '').replace(/\/$/, '');
  return (
    existsSync(path.join(pagesDir, `${clean}.astro`)) ||
    existsSync(path.join(pagesDir, clean, 'index.astro')) ||
    // The Heritage Grooming demo site is static HTML under public/.
    (clean.endsWith('.html') && existsSync(path.join(publicDir, clean)))
  );
}

const allHrefs = [
  ...MARKETING_NAV_ITEMS.map((item) => item.href),
  ...MARKETING_NAV_DIRECT_LINKS.map((link) => link.href),
  ...MARKETING_NAV_GROUPS.flatMap((group) => (group.featuredAction ? [group.featuredAction.href] : [])),
  MARKETING_NAV_SECONDARY_ACTION.href!,
  ...buildMarketingNavQuickLinks().map((link) => link.href),
  ...buildMarketingNavFinderEntries().map((entry) => entry.href),
];

describe('marketing navigation config', () => {
  it('exposes the approved top-level IA in order', () => {
    const groups = buildMarketingNavigation();
    expect(groups.map((group) => group.label)).toEqual(['Product', 'Compare', 'Free tools', 'Resources']);
    expect(MARKETING_NAV_DIRECT_LINKS).toEqual([{ id: 'pricing', label: 'Pricing', href: '/pricing' }]);
    expect(buildMarketingNavTopLevelEntries().map((entry) => (entry.kind === 'group' ? entry.group.label : entry.link.label))).toEqual([
      'Product',
      'Compare',
      'Free tools',
      'Resources',
      'Pricing',
    ]);
    expect(MARKETING_NAV_SECONDARY_ACTION).toMatchObject({ label: 'See live demo', href: HERITAGE_DEMO_SITE_HREF });
    expect(MARKETING_NAV_PRIMARY_ACTION).toMatchObject({
      label: NAVBAR_SUBSCRIBE_CTA_LABEL,
      href: '/admin/launch',
      track: 'saas_subscribe_click',
    });
  });

  it('keeps websites, booking, starter and insights inside panels, not as top-level links', () => {
    expect(MARKETING_NAV_DIRECT_LINKS.some((link) => link.id === 'websites' || link.id === 'insights' || link.id === 'starter')).toBe(
      false,
    );
    const product = buildMarketingNavigation().find((group) => group.id === 'product')!;
    const included = product.sections.find((section) => section.id === 'included')!;
    expect(included.items.map((item) => item.href)).toEqual([
      '/barbershop-websites',
      '/barbershop-online-booking',
      '/barbershop-reports',
      '/barbershop-retail-pickup',
      '/starter',
    ]);
    expect(included.items.at(-1)).toMatchObject({ id: 'product-starter', emphasis: 'quiet' });
    // Admin & reports explains the dashboard; the demo section opens the demo dashboard itself.
    expect(product.sections.find((section) => section.id === 'demo')?.items.map((item) => item.href)).toEqual([
      HERITAGE_DEMO_SITE_HREF,
      HERITAGE_DEMO_BOOK_HREF,
      HERITAGE_ADMIN_DASHBOARD_HREF,
    ]);
    expect(product).toMatchObject({
      eyebrow: 'KERSIVO',
      heading: 'Your website, bookings and shop in one system.',
      defaultOpen: true,
      currentPrefixes: ['/demo'],
      featuredAction: { label: 'See KERSIVO in action', href: '/#live-demo' },
    });
    const resources = buildMarketingNavigation().find((group) => group.id === 'resources')!;
    expect(resources.sections.map((section) => section.id)).toEqual(['guides', 'help']);
    expect(resources.sections.find((section) => section.id === 'help')?.items.map((item) => item.id)).toEqual([
      'resources-faq',
      'resources-about',
      'resources-contact',
    ]);
  });

  it('puts guides and help in Resources and every calculator or template in Free tools', () => {
    const readyGuides = MARKETING_NAV_ITEMS.map((item) =>
      item.id === 'resources-online-booking' || item.id === 'resources-website-design' ? { ...item, visible: true } : item,
    );
    const groups = buildMarketingNavigation(readyGuides);
    const resources = groups.find((group) => group.id === 'resources')!;
    expect(resources.sections.find((section) => section.id === 'guides')?.items.map((item) => item.href)).toEqual([
      '/barbershop-website-design',
      '/barbershop-online-booking',
      '/insights',
    ]);
    const tools = groups.find((group) => group.id === 'tools')!;
    expect(tools).toMatchObject({
      label: 'Free tools',
      tabLabel: 'Tools',
      featuredAction: { label: 'See all free tools', href: '/free-tools' },
      currentPrefixes: ['/free-tools'],
    });
    expect(tools.featured.map((item) => item.href)).toEqual(['/barber-software-cost-calculator']);
    expect(tools.sections.find((section) => section.id === 'calculators')?.items.map((item) => item.href)).toEqual([
      '/barber-price-calculator',
      '/barbershop-no-show-calculator',
      '/chair-rent-vs-commission-calculator',
    ]);
    expect(tools.sections.find((section) => section.id === 'templates')?.items.map((item) => item.href)).toEqual([
      '/barbershop-cancellation-policy-template',
      '/barbershop-price-list-template',
    ]);
    const resourceHrefs = [...resources.featured, ...resources.sections.flatMap((section) => section.items)].map((item) => item.href);
    expect(resourceHrefs).not.toContain('/compare');
    expect(resourceHrefs.some((href) => href.includes('calculator'))).toBe(false);
  });

  it('builds four mobile quick links and a finder entry for every destination', () => {
    expect(buildMarketingNavQuickLinks().map((link) => link.href)).toEqual([
      '/pricing',
      HERITAGE_DEMO_SITE_HREF,
      '/compare',
      '/barber-software-cost-calculator',
    ]);
    const finder = buildMarketingNavFinderEntries();
    const hrefs = finder.map((entry) => entry.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const item of buildMarketingNavigation().flatMap((group) => [...group.featured, ...group.sections.flatMap((section) => section.items)])) {
      expect(hrefs, item.id).toContain(item.href);
    }
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/pricing', '/about']));
    const noShow = finder.find((entry) => entry.href === '/barbershop-no-show-calculator')!;
    expect(noShow.terms).toContain('deposit');
    expect(noShow.terms).toBe(noShow.terms.toLowerCase());
  });

  it('links only to destinations that exist today', () => {
    for (const href of allHrefs) {
      expect(href.startsWith('/'), href).toBe(true);
      const { pathname, hash } = new URL(href, 'https://kersivo.co.uk');
      expect(pageExists(pathname), `${href} has no page`).toBe(true);
      // Hash links anchor into the homepage, or into a page of the static Heritage Grooming demo (#book).
      if (hash && !pathname.startsWith(`${HERITAGE_DEMO_BASE_PATH}/`)) {
        expect(pathname, `${href} should anchor into the homepage`).toBe('/');
      }
    }
  });

  it('never links to private application surfaces', () => {
    for (const href of allHrefs) expect(isPublicMarketingHref(href), href).toBe(true);
    for (const href of [
      '/admin',
      '/admin/launch',
      '/setup',
      '/setup/step-2',
      '/preview/abc',
      '/ops',
      '/api/contact',
      '/checkout',
      '/book/abc',
      '/shop/live-shop-id',
    ]) {
      expect(isPublicMarketingHref(href), href).toBe(false);
    }
    expect(isPublicMarketingHref('/shop')).toBe(true);
    expect(isPublicMarketingHref('/shop/demo/matte')).toBe(true);
    expect(isPublicMarketingHref('/admin-demo?section=bookings_dashboard')).toBe(true);
  });

  it('keeps every page destination in the marketing route family or an intentional reload', () => {
    const pages = MARKETING_NAV_ITEMS.map((item) => new URL(item.href, 'https://kersivo.co.uk').pathname);
    for (const pathname of ['/booksy-alternative', '/fresha-alternative', '/nearcut-alternative', '/setora-alternative', '/barber-software-cost-calculator']) {
      expect(pages).toContain(pathname);
      expect(getRouteFamily(pathname)).toBe('marketing');
    }
    expect(getRouteFamily('/insights')).toBe('marketing');
    expect(getRouteFamily('/insights/google-reviews-barbershop-uk-rules')).toBe('marketing');
    expect(getRouteFamily('/design-preview/insights')).not.toBe('marketing');
  });

  it('marks Insights as current for hub and descendant article paths', () => {
    const insights = MARKETING_NAV_ITEMS.find((item) => item.id === 'resources-insights')!;
    expect(isMarketingNavItemCurrent(insights, '/insights')).toBe(true);
    expect(isMarketingNavItemCurrent(insights, '/insights/')).toBe(true);
    expect(isMarketingNavItemCurrent(insights, '/insights/barbershop-gift-vouchers-uk')).toBe(true);
    expect(isMarketingNavItemCurrent(insights, '/compare')).toBe(false);
    expect(isMarketingNavItemCurrent(insights, '/design-preview/insights')).toBe(false);
    const resources = buildMarketingNavigation().find((group) => group.id === 'resources')!;
    expect(isMarketingNavGroupCurrent(resources, '/insights/barbershop-gift-vouchers-uk')).toBe(true);
  });

  it('marks Product current on product pages and any demo path', () => {
    const product = buildMarketingNavigation().find((group) => group.id === 'product')!;
    for (const path of ['/barbershop-websites', '/barbershop-online-booking', '/starter', '/demo', '/demo/book', '/demo/gallery']) {
      expect(isMarketingNavGroupCurrent(product, path), path).toBe(true);
    }
    expect(isMarketingNavGroupCurrent(product, '/pricing')).toBe(false);
    const overview = MARKETING_NAV_ITEMS.find((item) => item.id === 'product-demo')!;
    expect(isMarketingNavGroupCurrent(product, HERITAGE_DEMO_SITE_HREF)).toBe(true);
    expect(isMarketingNavItemCurrent(overview, HERITAGE_DEMO_SITE_HREF)).toBe(true);
    expect(isMarketingNavItemCurrent(overview, HERITAGE_DEMO_SERVICES_HREF)).toBe(false);
    expect(
      isMarketingNavItemCurrent(MARKETING_NAV_ITEMS.find((item) => item.id === 'platform-booking')!, HERITAGE_DEMO_SERVICES_HREF),
    ).toBe(true);
  });

  it('hides a primary action that points at the current page and keeps hash links', () => {
    expect(isMarketingNavSelfHref('/free-preview', '/free-preview')).toBe(true);
    expect(isMarketingNavSelfHref('/free-preview/', '/free-preview')).toBe(true);
    expect(isMarketingNavSelfHref('/free-preview', '/pricing')).toBe(false);
    expect(isMarketingNavSelfHref('/#faq', '/')).toBe(false);
    expect(isMarketingNavSelfHref(null, '/free-preview')).toBe(false);
  });

  it('gives every item a unique id, a description, a known icon and a configured section', () => {
    const ids = MARKETING_NAV_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of MARKETING_NAV_ITEMS) {
      expect(item.label.trim(), item.id).not.toBe('');
      expect(item.description.trim(), item.id).not.toBe('');
      expect(Object.keys(MARKETING_NAV_ICONS), item.id).toContain(item.icon);
      const group = MARKETING_NAV_GROUPS.find((candidate) => candidate.id === item.group);
      expect(group, item.id).toBeDefined();
      if (!item.featured) expect(group!.sections.map((section) => section.id), item.id).toContain(item.section);
    }
  });

  it('keeps the booking guide out of global navigation until its route and parent are released', () => {
    const guide = MARKETING_NAV_ITEMS.find((item) => item.id === 'resources-online-booking');
    expect(guide).toMatchObject({
      label: 'Online booking for barbershops',
      href: '/barbershop-online-booking',
      group: 'resources',
      section: 'guides',
      icon: 'guide',
    });
    expect(guide?.visible).toBe(BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE && BARBERSHOP_WEBSITES_PAGE_INDEXABLE);
  });

  it('keeps the website-design guide hidden in global navigation until both cluster pages are released', () => {
    const guide = MARKETING_NAV_ITEMS.find((item) => item.id === 'resources-website-design');
    expect(guide).toMatchObject({
      label: 'Barbershop website design',
      href: '/barbershop-website-design',
      group: 'resources',
      section: 'guides',
      icon: 'guide',
    });
    expect(guide?.visible).toBe(BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE && BARBERSHOP_WEBSITES_PAGE_INDEXABLE);
  });

  it('places the current SEO pages where the IA expects them', () => {
    const groups = buildMarketingNavigation();
    const compare = groups.find((group) => group.id === 'compare')!;
    const resources = groups.find((group) => group.id === 'resources')!;
    const compareHrefs = [...compare.featured, ...compare.sections.flatMap((section) => section.items)].map(
      (item) => item.href,
    );
    expect(compareHrefs).toEqual(
      expect.arrayContaining(['/booksy-alternative', '/fresha-alternative', '/nearcut-alternative', '/setora-alternative']),
    );
    expect(compare.featured.map((item) => item.id)).toEqual(['compare-hub', 'compare-kersivo-vs-booksy']);
    expect(compare).toMatchObject({ featuredAction: { href: '/barber-software-cost-calculator' } });
    expect(compare.sections.map((section) => [section.id, section.layout])).toEqual([
      ['alternatives', 'compact'],
      ['reports', undefined],
    ]);
    // The compact grid prefixes every tile with "vs" under "KERSIVO vs": only KERSIVO-vs-competitor pages belong there,
    // each with a short name, and each competitor appears once.
    const alternatives = compare.sections.find((section) => section.id === 'alternatives')!.items;
    expect(alternatives.map((item) => item.id)).not.toContain('compare-hub');
    for (const item of alternatives) {
      expect(item.shortLabel, item.id).toBeTruthy();
      expect(item.href, item.id).toMatch(/-alternative$/);
      expect(item.shortLabel, item.id).not.toMatch(/vs|report/i);
    }
    expect(new Set(alternatives.map((item) => item.shortLabel)).size).toBe(alternatives.length);
    expect(compare.sections.find((section) => section.id === 'reports')!.items.map((item) => item.href)).toEqual([
      '/booksy-vs-fresha',
      '/barber-booking-fees-uk',
    ]);
    const guides = resources.sections.find((section) => section.id === 'guides');
    const guideReady = BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE && BARBERSHOP_WEBSITES_PAGE_INDEXABLE;
    expect(guides?.items.some((item) => item.href === '/barbershop-website-design') ?? false).toBe(guideReady);
  });
});

describe('current page matching', () => {
  it('matches page links by pathname and ignores in-page section links', () => {
    expect(marketingNavItemMatch({ href: '/booksy-alternative' })).toBe('/booksy-alternative');
    expect(marketingNavItemMatch({ href: '/admin-demo?section=bookings_dashboard' })).toBe('/admin-demo');
    expect(marketingNavItemMatch({ href: '/#pricing' })).toBeNull();
    expect(marketingNavItemMatch({ href: '/#faq', match: '/faq' })).toBe('/faq');

    expect(isMarketingNavItemCurrent({ href: '/booksy-alternative' }, '/booksy-alternative/')).toBe(true);
    expect(isMarketingNavItemCurrent({ href: '/booksy-alternative' }, '/fresha-alternative')).toBe(false);
    expect(isMarketingNavItemCurrent({ href: '/' }, '/')).toBe(true);
    expect(isMarketingNavItemCurrent({ href: '/' }, '/shop')).toBe(false);
    expect(isMarketingNavItemCurrent({ href: '/#pricing' }, '/')).toBe(false);
  });
});

describe('future scale', () => {
  const groups: MarketingNavGroup[] = [
    { id: 'product', label: 'Product', eyebrow: 'P', heading: 'P', sections: [{ id: 'included', label: 'What you get' }] },
    { id: 'compare', label: 'Compare', eyebrow: 'C', heading: 'C', sections: [{ id: 'alternatives', label: 'Alternatives' }] },
    {
      id: 'resources',
      label: 'Resources',
      eyebrow: 'R',
      heading: 'R',
      sections: [
        { id: 'tools', label: 'Tools' },
        { id: 'guides', label: 'Guides' },
        { id: 'help', label: 'Help' },
        { id: 'empty', label: 'Nothing yet' },
      ],
    },
  ];
  const make = (group: MarketingNavItem['group'], section: string, count: number, extra: Partial<MarketingNavItem> = {}) =>
    Array.from({ length: count }, (_, index): MarketingNavItem => ({
      id: `${group}-${section}-${index}`,
      label: `${section} ${index}`,
      description: `Description ${index}`,
      href: `/${section}-${index}`,
      group,
      section,
      icon: 'guide',
      ...extra,
    }));

  const items = [
    ...make('compare', 'alternatives', 6),
    ...make('compare', 'alternatives', 1, { id: 'compare-featured', featured: true }),
    ...make('resources', 'tools', 4),
    ...make('resources', 'guides', 12),
    ...make('resources', 'help', 2, { visible: false }),
  ];
  const resolved = buildMarketingNavigation(items, groups);

  it('renders every configured item without count assumptions', () => {
    const compare = resolved.find((group) => group.id === 'compare')!;
    const resources = resolved.find((group) => group.id === 'resources')!;
    expect(compare.featured).toHaveLength(1);
    expect(compare.sections[0].items).toHaveLength(6);
    expect(resources.sections.find((section) => section.id === 'tools')!.items).toHaveLength(4);
    expect(resources.sections.find((section) => section.id === 'guides')!.items).toHaveLength(12);
  });

  it('hides invisible items, empty sections and empty groups', () => {
    const resources = resolved.find((group) => group.id === 'resources')!;
    expect(resources.sections.map((section) => section.id)).toEqual(['tools', 'guides']);
    expect(resolved.map((group) => group.id)).toEqual(['compare', 'resources']);
  });

  it('preserves configured order within sections', () => {
    const guides = resolved
      .find((group) => group.id === 'resources')!
      .sections.find((section) => section.id === 'guides')!;
    expect(guides.items.map((item) => item.label)).toEqual(Array.from({ length: 12 }, (_, index) => `guides ${index}`));
  });
});
