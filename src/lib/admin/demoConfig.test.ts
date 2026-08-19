import { describe, expect, it } from 'vitest';
import {
  BLACKLINE_ADMIN_DEMO_PATH,
  CREATE_OWN_BARBERSHOP_HREF,
  KERSIVO_PLANS_HREF,
  PUBLIC_ADMIN_DEMO_PATH,
  applyBlacklineRetailFocusCleanup,
  blacklineAdminHref,
  buildBlacklineRetailHref,
  getPublicAdminDemoCapabilities,
  isAnyPublicAdminDemoPathname,
  isBlacklineAdminDemoPathname,
  isPublicAdminDemoPathname,
  parseBlacklineRetailFocusSearch,
  resolveDemoSectionAlias,
  stripBlacklineRetailFocusSearch,
} from './demoConfig';

describe('public admin demo paths', () => {
  it('keeps /admin-demo as the generic public demo', () => {
    expect(isPublicAdminDemoPathname('/admin-demo')).toBe(true);
    expect(isPublicAdminDemoPathname('/admin-demo/')).toBe(true);
    expect(isBlacklineAdminDemoPathname('/admin-demo')).toBe(false);
  });

  it('treats /demo/admin as the BLACKLINE owner dashboard', () => {
    expect(BLACKLINE_ADMIN_DEMO_PATH).toBe('/demo/admin');
    expect(isBlacklineAdminDemoPathname('/demo/admin')).toBe(true);
    expect(isBlacklineAdminDemoPathname('/demo/admin/')).toBe(true);
    expect(isPublicAdminDemoPathname('/demo/admin')).toBe(false);
    expect(blacklineAdminHref('bookings_dashboard')).toBe(
      '/demo/admin?section=bookings_dashboard',
    );
  });

  it('does not treat customer /demo routes as admin demos', () => {
    expect(isAnyPublicAdminDemoPathname('/demo')).toBe(false);
    expect(isAnyPublicAdminDemoPathname('/demo/shop')).toBe(false);
    expect(isAnyPublicAdminDemoPathname(PUBLIC_ADMIN_DEMO_PATH)).toBe(true);
    expect(isAnyPublicAdminDemoPathname(BLACKLINE_ADMIN_DEMO_PATH)).toBe(true);
  });
});

describe('public admin demo capabilities', () => {
  it('keeps generic demo pills and lock-gated guest actions', () => {
    const caps = getPublicAdminDemoCapabilities('generic');
    expect(caps.isBlackline).toBe(false);
    expect(caps.showDemoModePills).toBe(true);
    expect(caps.conversionAccountMenu).toBe(false);
    expect(caps.showLaunchCta).toBe(true);
  });

  it('scopes BLACKLINE to one create-shop conversion path', () => {
    const caps = getPublicAdminDemoCapabilities('blackline');
    expect(caps.isBlackline).toBe(true);
    expect(caps.showDemoModePills).toBe(false);
    expect(caps.showDuplicateOwnerNotice).toBe(false);
    expect(caps.conversionAccountMenu).toBe(true);
    expect(caps.createShopHref).toBe(CREATE_OWN_BARBERSHOP_HREF);
    expect(CREATE_OWN_BARBERSHOP_HREF).toBe('/admin/onboarding');
    expect(KERSIVO_PLANS_HREF).toBe('/#pricing');
    expect(caps.previewWebsiteHref).toBe('/demo');
    expect(caps.kersivoHomeHref).toBe('/');
    expect(caps.showLaunchCta).toBe(false);
  });

  it('aliases bookings_services to the services section', () => {
    expect(resolveDemoSectionAlias('bookings_services')).toBe('services');
  });
});

describe('BLACKLINE retail deep links', () => {
  it('builds Orders and Sales hrefs with canonical section, order, and demoJourney', () => {
    const orders = buildBlacklineRetailHref({
      section: 'shop_orders',
      orderId: 'order-1',
      demoJourney: true,
    });
    expect(orders).toBe('/demo/admin?section=shop_orders&order=order-1&demoJourney=retail');
    expect(orders.startsWith('/admin')).toBe(false);

    const parsed = parseBlacklineRetailFocusSearch(new URL(orders, 'https://kersivo.local').search);
    expect(parsed.section).toBe('shop_orders');
    expect(parsed.orderId).toBe('order-1');
    expect(parsed.demoJourney).toBe('retail');

    const sales = buildBlacklineRetailHref({
      section: 'shop_sales',
      orderId: 'order-1',
      demoJourney: true,
    });
    expect(sales).toContain('section=shop_sales');
    expect(stripBlacklineRetailFocusSearch(new URL(sales, 'https://kersivo.local').search)).toBe(
      '?section=shop_sales',
    );
    expect(applyBlacklineRetailFocusCleanup(sales)).toBe('/demo/admin?section=shop_sales');
  });
});

describe('public admin demo paths', () => {
  it('keeps /admin-demo as the generic public demo', () => {
    expect(isPublicAdminDemoPathname('/admin-demo')).toBe(true);
    expect(isPublicAdminDemoPathname('/admin-demo/')).toBe(true);
    expect(isBlacklineAdminDemoPathname('/admin-demo')).toBe(false);
  });

  it('treats /demo/admin as the BLACKLINE owner dashboard', () => {
    expect(BLACKLINE_ADMIN_DEMO_PATH).toBe('/demo/admin');
    expect(isBlacklineAdminDemoPathname('/demo/admin')).toBe(true);
    expect(isBlacklineAdminDemoPathname('/demo/admin/')).toBe(true);
    expect(isPublicAdminDemoPathname('/demo/admin')).toBe(false);
    expect(blacklineAdminHref('bookings_dashboard')).toBe(
      '/demo/admin?section=bookings_dashboard',
    );
  });

  it('does not treat customer /demo routes as admin demos', () => {
    expect(isAnyPublicAdminDemoPathname('/demo')).toBe(false);
    expect(isAnyPublicAdminDemoPathname('/demo/shop')).toBe(false);
    expect(isAnyPublicAdminDemoPathname(PUBLIC_ADMIN_DEMO_PATH)).toBe(true);
    expect(isAnyPublicAdminDemoPathname(BLACKLINE_ADMIN_DEMO_PATH)).toBe(true);
  });
});
