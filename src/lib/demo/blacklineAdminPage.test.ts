import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLACKLINE_ADMIN_DEMO_PATH, blacklineAdminHref } from '@/lib/admin/demoConfig';
import { DEMO_NAV } from '@/lib/demo/nav';

const pageSource = readFileSync(new URL('../../pages/demo/admin.astro', import.meta.url), 'utf8');
const bannerSource = readFileSync(new URL('../../components/demo/DemoBanner.astro', import.meta.url), 'utf8');
const layoutSource = readFileSync(new URL('../../layouts/DemoLayout.astro', import.meta.url), 'utf8');
const adminDemoSource = readFileSync(new URL('../../pages/admin-demo.astro', import.meta.url), 'utf8');
const genericRouter = readFileSync(new URL('../admin/demoFixtureRouter.ts', import.meta.url), 'utf8');
const blacklineRouter = readFileSync(
  new URL('../admin/blacklineDemoFixtures/router.ts', import.meta.url),
  'utf8',
);

describe('BLACKLINE owner dashboard page', () => {
  it('boots the real AdminPanel without login on /demo/admin', () => {
    expect(pageSource).toContain("canonicalPath={BLACKLINE_ADMIN_DEMO_PATH}");
    expect(pageSource).toContain('demoMode={true}');
    expect(pageSource).toContain('demoTenant="blackline"');
    expect(pageSource).toContain('getBlacklineBookingsResponse');
    expect(pageSource).toContain('data-demo-tenant="blackline"');
    expect(pageSource).toContain('view="admin"');
    expect(pageSource).not.toContain('READY TO LAUNCH');
    expect(pageSource).not.toContain('Continue setup');
    expect(BLACKLINE_ADMIN_DEMO_PATH).toBe('/demo/admin');
  });

  it('keeps generic /admin-demo on the original fixture router', () => {
    expect(adminDemoSource).toContain('demoMode={true}');
    expect(adminDemoSource).not.toContain('demoTenant="blackline"');
    expect(adminDemoSource).toContain('getDemoBookingsResponse');
    expect(genericRouter).toContain("from './demoFixtures'");
    expect(genericRouter).not.toContain('blacklineDemoFixtures');
    expect(blacklineRouter).toContain('/api/demo/admin');
    expect(blacklineRouter).not.toContain('Jamie Reed');
  });

  it('wires banner navigation between customer and owner views', () => {
    expect(layoutSource).toContain('view="customer"');
    expect(bannerSource).toContain('aria-label="Open BLACKLINE owner dashboard"');
    expect(bannerSource).toContain('Owner dashboard');
    expect(bannerSource).toContain('Owner view');
    expect(bannerSource).toContain('aria-label="Open BLACKLINE customer website"');
    expect(bannerSource).toContain('Customer website');
    expect(bannerSource).toContain('href="/"');
    expect(bannerSource).toContain('data-astro-reload');
    expect(bannerSource).toContain("blacklineAdminHref('bookings_dashboard')");
    expect(blacklineAdminHref('bookings_dashboard')).toBe('/demo/admin?section=bookings_dashboard');
    expect(DEMO_NAV.some((item) => item.href.includes('/demo/admin'))).toBe(false);
  });
});
