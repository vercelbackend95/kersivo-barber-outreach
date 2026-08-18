import { describe, expect, it } from 'vitest';
import {
  BLACKLINE_ADMIN_DEMO_PATH,
  CREATE_OWN_BARBERSHOP_HREF,
  PUBLIC_ADMIN_DEMO_PATH,
  blacklineAdminHref,
  getPublicAdminDemoCapabilities,
  isAnyPublicAdminDemoPathname,
  isBlacklineAdminDemoPathname,
  isPublicAdminDemoPathname,
  resolveDemoSectionAlias,
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
    expect(caps.previewWebsiteHref).toBe('/demo');
    expect(caps.kersivoHomeHref).toBe('/');
    expect(caps.showLaunchCta).toBe(false);
  });

  it('aliases bookings_services to the services section', () => {
    expect(resolveDemoSectionAlias('bookings_services')).toBe('services');
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
