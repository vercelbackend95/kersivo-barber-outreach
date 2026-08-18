import { describe, expect, it } from 'vitest';
import {
  BLACKLINE_ADMIN_DEMO_PATH,
  PUBLIC_ADMIN_DEMO_PATH,
  blacklineAdminHref,
  isAnyPublicAdminDemoPathname,
  isBlacklineAdminDemoPathname,
  isPublicAdminDemoPathname,
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
