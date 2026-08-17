import { describe, expect, it } from 'vitest';
import { parseAdminSpaHref, resolveAdminSpaSection } from './sectionUrl';

describe('admin SPA section URLs', () => {
  it('resolves aliases and missing values to canonical sections', () => {
    expect(resolveAdminSpaSection('services')).toBe('services');
    expect(resolveAdminSpaSection('team')).toBe('bookings_blocks');
    expect(resolveAdminSpaSection('timeline')).toBe('bookings_dashboard');
    expect(resolveAdminSpaSection(null)).toBe('bookings_dashboard');
  });

  it('parses in-SPA hrefs and rejects wizard/full-page exits', () => {
    expect(parseAdminSpaHref('/admin?section=services')).toBe('services');
    expect(parseAdminSpaHref('/admin-demo?section=shop_orders')).toBe('shop_orders');
    expect(parseAdminSpaHref('/admin')).toBe('bookings_dashboard');
    expect(parseAdminSpaHref('/admin/onboarding')).toBeNull();
    expect(parseAdminSpaHref('/admin/launch')).toBeNull();
    expect(parseAdminSpaHref('https://stripe.com/pay')).toBeNull();
  });
});
