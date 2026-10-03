import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLACKLINE_ADMIN_DEMO_PATH, blacklineAdminHref } from '@/lib/admin/demoConfig';
import { DEMO_BOOK_HREF, DEMO_SHOP_HREF } from '@/lib/demo/nav';
import { FEATURE261_MONETIZATION_ROW } from '@/lib/landing/feature261MonetizationRow';
import { MARKETING_NAV_GROUPS, MARKETING_NAV_ITEMS, MARKETING_NAV_SECONDARY_ACTION } from '@/lib/nav/marketingNavigation';
import { resolveAdminSpaSection } from '@/lib/admin/sectionUrl';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const SOURCES = {
  homepage: read('components/landingDemoPreview.astro'),
  booksy: read('components/booksyAlternative/BooksyProof.astro'),
  fresha: read('components/freshaAlternative/FreshaProof.astro'),
};

function ctaHrefExpr(source: string, label: string): string | undefined {
  const match = source.match(new RegExp(`ctaLabel: '${label}',\\s*ctaHref: ([^,]+),`));
  return match?.[1];
}

describe('marketing CTAs route to the live BLACKLINE demo', () => {
  it('uses the canonical BLACKLINE routes', () => {
    expect(blacklineAdminHref('bookings_dashboard')).toBe(`${BLACKLINE_ADMIN_DEMO_PATH}?section=bookings_dashboard`);
    expect(BLACKLINE_ADMIN_DEMO_PATH).toBe('/demo/admin');
    expect(DEMO_BOOK_HREF).toBe('/demo/book');
    expect(DEMO_SHOP_HREF).toBe('/demo/shop');
  });

  for (const [page, source] of Object.entries(SOURCES)) {
    it(`${page}: admin, booking and retail CTAs open BLACKLINE`, () => {
      expect(ctaHrefExpr(source, 'Explore the admin system')).toBe("blacklineAdminHref('bookings_dashboard')");
      expect(ctaHrefExpr(source, 'Try the booking experience')).toBe('DEMO_BOOK_HREF');
      expect(ctaHrefExpr(source, 'Explore the retail shop')).toBe('DEMO_SHOP_HREF');
      expect(source).not.toContain('adminDemoHref');
      expect(source).not.toMatch(/localhost/);
    });
  }

  it('routes the Platform menu admin and retail items to BLACKLINE', () => {
    const href = (id: string) => MARKETING_NAV_ITEMS.find((item) => item.id === id)?.href;
    expect(href('platform-admin')).toBe(blacklineAdminHref('bookings_dashboard'));
    expect(href('platform-retail')).toBe(DEMO_SHOP_HREF);
    expect(href('platform-booking')).toBe(DEMO_BOOK_HREF);
  });

  it('keeps every marketing navigation link off the generic demo', () => {
    const hrefs = [
      ...MARKETING_NAV_ITEMS.map((item) => item.href),
      ...MARKETING_NAV_GROUPS.flatMap((group) => (group.featuredAction ? [group.featuredAction.href] : [])),
      MARKETING_NAV_SECONDARY_ACTION.href!,
    ];
    for (const href of hrefs) {
      const { pathname } = new URL(href, 'https://kersivo.co.uk');
      expect(pathname, href).not.toBe('/admin-demo');
      expect(pathname, href).not.toBe('/shop');
    }
  });

  it('routes Explore reports to the BLACKLINE reports section', () => {
    expect(FEATURE261_MONETIZATION_ROW.ctaLabel).toBe('Explore reports');
    expect(FEATURE261_MONETIZATION_ROW.ctaHref).toBe('/demo/admin?section=bookings_reports');
    expect(resolveAdminSpaSection('bookings_reports')).toBe('bookings_reports');
  });

  it('routes the homepage live admin widget to the BLACKLINE bookings dashboard', () => {
    const widget = read('components/InsideSystemLiveWidget.tsx');
    expect(widget).toContain("const ADMIN_DEMO_HREF = blacklineAdminHref('bookings_dashboard');");
    expect(widget).not.toContain('adminDemoHref');
    expect(resolveAdminSpaSection('bookings_dashboard')).toBe('bookings_dashboard');
  });
});
