import { describe, expect, it } from 'vitest';
import { retiredDemoRedirectTarget } from './retiredDemoRedirect';

describe('retired CUTSTATE demo pages redirect to Heritage Grooming', () => {
  it.each([
    ['/demo', '/demo/heritage-grooming/index.html'],
    ['/demo/', '/demo/heritage-grooming/index.html'],
    ['/demo/services', '/demo/heritage-grooming/services.html'],
    ['/demo/barbers', '/demo/heritage-grooming/team.html'],
    ['/demo/gallery', '/demo/heritage-grooming/gallery.html'],
    ['/demo/contact', '/demo/heritage-grooming/index.html#find'],
    ['/demo/book', '/demo/heritage-grooming/services.html#book'],
    ['/demo/shop', '/demo/heritage-grooming/shop.html'],
    ['/demo/shop/matte-clay', '/demo/heritage-grooming/shop.html'],
    ['/demo/shop/checkout', '/demo/heritage-grooming/shop.html'],
    ['/demo/admin', '/demo/heritage-grooming/admin'],
  ])('%s → %s', (path, target) => {
    expect(retiredDemoRedirectTarget(path)).toBe(target);
  });

  it('keeps the admin section and hero embed, drops anything else', () => {
    expect(retiredDemoRedirectTarget('/demo/admin', '?section=shop_orders&order=x')).toBe(
      '/demo/heritage-grooming/admin?section=shop_orders',
    );
    expect(retiredDemoRedirectTarget('/demo/admin', '?embed=hero&section=bookings_dashboard')).toBe(
      '/demo/heritage-grooming/admin?section=bookings_dashboard&embed=hero',
    );
  });

  it('leaves Heritage Grooming and unrelated paths alone', () => {
    for (const path of [
      '/demo/heritage-grooming',
      '/demo/heritage-grooming/index.html',
      '/demo/heritage-grooming/admin',
      '/demonstration',
      '/admin-demo',
      '/',
    ]) {
      expect(retiredDemoRedirectTarget(path)).toBeNull();
    }
  });
});
