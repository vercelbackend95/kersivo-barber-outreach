import { describe, expect, it } from 'vitest';
import { buildAdminTimelineHref } from './bookingPresentation';

describe('buildAdminTimelineHref', () => {
  it('defaults to /admin without a demo journey', () => {
    expect(
      buildAdminTimelineHref({
        bookingId: 'abc',
        bookingDate: '2026-08-12',
      }),
    ).toBe('/admin?section=bookings_dashboard&bookingId=abc&bookingDate=2026-08-12');
  });

  it('builds a BLACKLINE /demo/admin deep link with demoJourney', () => {
    const href = buildAdminTimelineHref({
      adminBasePath: '/demo/admin',
      bookingId: 'session-1',
      bookingDate: '2026-08-12',
      demoJourney: true,
    });
    expect(href.startsWith('/demo/admin?')).toBe(true);
    expect(href.startsWith('/admin?')).toBe(false);
    expect(href).toContain('bookingId=session-1');
    expect(href).toContain('bookingDate=2026-08-12');
    expect(href).toContain('demoJourney=booking');
    expect(href).toContain('section=bookings_dashboard');
  });
});
