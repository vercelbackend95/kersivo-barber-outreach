import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MARKETING_NAV_DIRECT_LINKS,
  MARKETING_NAV_GROUPS,
  MARKETING_NAV_ITEMS,
  MARKETING_NAV_PRIMARY_ACTION,
  MARKETING_NAV_SECONDARY_ACTION,
  buildMarketingNavigation,
  isMarketingNavItemCurrent,
  isPublicMarketingHref,
  marketingNavItemMatch,
  type MarketingNavGroup,
  type MarketingNavItem,
} from './marketingNavigation';
import { MARKETING_NAV_ICONS } from './marketingNavIcons';
import { NAVBAR_SUBSCRIBE_CTA_LABEL } from './navbar17Items';
import { getRouteFamily } from '@/lib/navigation/routeFamilies';

const pagesDir = path.resolve(__dirname, '../../pages');

function pageExists(pathname: string): boolean {
  if (pathname === '/') return existsSync(path.join(pagesDir, 'index.astro'));
  const clean = pathname.replace(/^\//, '').replace(/\/$/, '');
  return (
    existsSync(path.join(pagesDir, `${clean}.astro`)) ||
    existsSync(path.join(pagesDir, clean, 'index.astro'))
  );
}

const allHrefs = [
  ...MARKETING_NAV_ITEMS.map((item) => item.href),
  ...MARKETING_NAV_DIRECT_LINKS.map((link) => link.href),
  ...MARKETING_NAV_GROUPS.flatMap((group) => (group.featuredAction ? [group.featuredAction.href] : [])),
  MARKETING_NAV_SECONDARY_ACTION.href!,
];

describe('marketing navigation config', () => {
  it('exposes the approved top-level IA in order', () => {
    const groups = buildMarketingNavigation();
    expect(groups.map((group) => group.label)).toEqual(['Platform', 'Compare', 'Resources']);
    expect(MARKETING_NAV_DIRECT_LINKS.map((link) => link.label)).toEqual(['Starter', 'Pricing', 'FAQ']);
    expect(MARKETING_NAV_DIRECT_LINKS.find((link) => link.id === 'starter')).toEqual({
      id: 'starter',
      label: 'Starter',
      href: '/starter',
    });
    expect(MARKETING_NAV_SECONDARY_ACTION).toMatchObject({ label: 'See live demo', href: '/demo' });
    expect(MARKETING_NAV_PRIMARY_ACTION).toMatchObject({
      label: NAVBAR_SUBSCRIBE_CTA_LABEL,
      href: '/admin/launch',
      track: 'saas_subscribe_click',
    });
  });

  it('links only to destinations that exist today', () => {
    for (const href of allHrefs) {
      expect(href.startsWith('/'), href).toBe(true);
      const { pathname, hash } = new URL(href, 'https://kersivo.co.uk');
      expect(pageExists(pathname), `${href} has no page`).toBe(true);
      if (hash) expect(pathname, `${href} should anchor into the homepage`).toBe('/');
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

  it('places the current SEO pages where the IA expects them', () => {
    const groups = buildMarketingNavigation();
    const compare = groups.find((group) => group.id === 'compare')!;
    const resources = groups.find((group) => group.id === 'resources')!;
    const compareHrefs = [...compare.featured, ...compare.sections.flatMap((section) => section.items)].map(
      (item) => item.href,
    );
    expect(compareHrefs).toEqual(
      expect.arrayContaining(['/booksy-alternative', '/fresha-alternative', '/nearcut-alternative', '/setora-alternative', '/barber-software-cost-calculator']),
    );
    const tools = resources.sections.find((section) => section.id === 'tools');
    expect(tools?.items.map((item) => item.href)).toContain('/barber-software-cost-calculator');
    expect(resources.sections.map((section) => section.id)).not.toContain('guides');
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
    { id: 'platform', label: 'Platform', eyebrow: 'P', heading: 'P', sections: [{ id: 'explore', label: null }] },
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
