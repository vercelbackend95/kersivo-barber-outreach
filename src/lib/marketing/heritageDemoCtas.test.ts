import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { heritageAdminHref } from '@/lib/admin/demoConfig';
import { HERITAGE_SHOP_NAME } from '@/lib/demo/heritage/data';
import { HERITAGE_LANDING_BOOKING_DATA } from '@/lib/landing/heritageLandingBookingData';
import { FEATURE261_MONETIZATION_ROW } from '@/lib/landing/feature261MonetizationRow';
import {
  HERITAGE_ADMIN_DASHBOARD_HREF,
  HERITAGE_ADMIN_DEMO_PATH,
  HERITAGE_DEMO_BOOK_HREF,
  HERITAGE_DEMO_SHOP_HREF,
} from '@/lib/demo/heritage/links';
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

describe('marketing CTAs route to the live Heritage Grooming demo', () => {
  it('uses the canonical Heritage Grooming routes', () => {
    expect(heritageAdminHref('bookings_dashboard')).toBe(`${HERITAGE_ADMIN_DEMO_PATH}?section=bookings_dashboard`);
    expect(HERITAGE_ADMIN_DEMO_PATH).toBe('/demo/heritage-grooming/admin');
    expect(HERITAGE_DEMO_BOOK_HREF).toBe('/demo/heritage-grooming/services.html#book');
    expect(HERITAGE_DEMO_SHOP_HREF).toBe('/demo/heritage-grooming/shop.html');
  });

  for (const [page, source] of Object.entries(SOURCES)) {
    it(`${page}: admin, booking and retail CTAs open Heritage Grooming`, () => {
      expect(ctaHrefExpr(source, 'Explore the admin system')).toBe("heritageAdminHref('bookings_dashboard')");
      expect(ctaHrefExpr(source, 'Try the booking experience')).toBe('DEMO_BOOK_HREF');
      expect(ctaHrefExpr(source, 'Explore the retail shop')).toBe('DEMO_SHOP_HREF');
      expect(source).not.toContain('adminDemoHref');
      expect(source).not.toMatch(/localhost/);
    });
  }

  it('routes the Platform menu admin, booking and retail items to the Heritage Grooming demo', () => {
    const href = (id: string) => MARKETING_NAV_ITEMS.find((item) => item.id === id)?.href;
    expect(href('platform-admin')).toBe('/barbershop-reports');
    expect(href('platform-admin-demo')).toBe(HERITAGE_ADMIN_DASHBOARD_HREF);
    expect(href('platform-retail')).toBe(HERITAGE_DEMO_SHOP_HREF);
    expect(href('platform-booking')).toBe(HERITAGE_DEMO_BOOK_HREF);
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

  it('routes Explore reports to the Heritage Grooming reports section', () => {
    expect(FEATURE261_MONETIZATION_ROW.ctaLabel).toBe('Explore reports');
    expect(FEATURE261_MONETIZATION_ROW.ctaHref).toBe('/demo/heritage-grooming/admin?section=bookings_reports');
    expect(resolveAdminSpaSection('bookings_reports')).toBe('bookings_reports');
  });

  it('presents the shared marketing demo as Heritage Grooming', () => {
    const preview = SOURCES.homepage;
    const deferred = read('components/landing/DeferredWidget.tsx');
    const retailRail = read('components/landing/RetailDemoRail.tsx');
    expect(HERITAGE_SHOP_NAME).toBe('Heritage Grooming');
    expect(deferred).toContain("import('@/components/landing/RetailDemoRail')");
    expect(retailRail).toContain('fallbackBrandMark="HG"');
    expect(retailRail).toContain('shopName={DEMO_SHOP_NAME}');
    expect(retailRail).toContain('ariaLabel={`${DEMO_SHOP_NAME} products`}');
    expect(preview).not.toMatch(/BLACKLINE"|Blackline products|Cutstate|CUTSTATE|fallbackBrandMark="(BL|CS)"/);
    expect(HERITAGE_LANDING_BOOKING_DATA.presentation.eyebrow).toBe('Heritage Grooming');
    expect(HERITAGE_LANDING_BOOKING_DATA.presentation.confirmCtas?.[0]?.label).toBe('Back to Heritage Grooming');
  });

  it('routes the homepage live admin widget to the Heritage Grooming bookings dashboard', () => {
    const widget = read('components/InsideSystemLiveWidget.tsx');
    expect(widget).toContain("const ADMIN_DEMO_HREF = heritageAdminHref('bookings_dashboard');");
    expect(widget).not.toContain('adminDemoHref');
    expect(resolveAdminSpaSection('bookings_dashboard')).toBe('bookings_dashboard');
  });
});
