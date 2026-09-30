import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getBlacklineBookingsResponse } from '@/lib/admin/blacklineDemoFixtures/schedule';
import { BLACKLINE_HERO_SHOWCASE_DAY, blacklineHeroShowcaseNow } from '@/lib/admin/heroShowcase';
import AdminNextAppointmentsStripLive from './AdminNextAppointmentsStripLive';
import { AdminClockContext, HERO_SHOWCASE_ADMIN_CLOCK, REAL_ADMIN_CLOCK, type AdminClock } from './adminClock';
import { AdminTodayBookingsLiveProvider } from './useAdminTodayBookingsLive';

const { bookings } = getBlacklineBookingsResponse(
  new URLSearchParams({ date: BLACKLINE_HERO_SHOWCASE_DAY, mode: 'day' }),
  blacklineHeroShowcaseNow(),
);

function renderStrip(clock: AdminClock) {
  return renderToString(
    <AdminClockContext.Provider value={clock}>
      <AdminTodayBookingsLiveProvider isPublicDemo isBlacklineDemo initialBookings={bookings}>
        <AdminNextAppointmentsStripLive />
      </AdminTodayBookingsLiveProvider>
    </AdminClockContext.Provider>,
  );
}

describe('Next appointments with the hero showcase clock', () => {
  it('server-renders the final strip instead of a skeleton', () => {
    const html = renderStrip(HERO_SHOWCASE_ADMIN_CLOCK);
    expect(html).not.toContain('admin-mobile-next-strip-list--skeleton');
    expect(html).toContain('Noah Reid');
    expect(html).toContain('Skin Fade');
    expect(html).toContain('15:15');
    expect(html).toContain('LIVE');
  });

  it('keeps the skeleton-first SSR for the live dashboard, whose relative times need the client clock', () => {
    const html = renderStrip(REAL_ADMIN_CLOCK);
    expect(html).toContain('admin-mobile-next-strip-list--skeleton');
  });
});
