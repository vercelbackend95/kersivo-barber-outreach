import React from 'react';
import AdminBookingsOpsDashHero from './AdminBookingsOpsDashHero';
import { useAdminTodayBookingsLive } from './useAdminTodayBookingsLive';

/**
 * Same Bookings ops dash hero (next booking + LIVE + freshness), with its own
 * poll of today's schedule — used when BookingsAdminPanel is not mounted (e.g. Services tab desktop).
 */
export default function AdminBookingsOpsDashHeroLive() {
  const {
    sessionChecked,
    loggedIn,
    nextBooking,
    connectionStateLabel,
    hasLivePulse,
    freshnessLabel,
    formatStartTime,
    formatRelativeTime,
  } = useAdminTodayBookingsLive();

  if (!sessionChecked || !loggedIn) return null;

  return (
    <AdminBookingsOpsDashHero
      nextBooking={nextBooking}
      connectionStateLabel={connectionStateLabel}
      hasLivePulse={hasLivePulse}
      freshnessLabel={freshnessLabel}
      formatStartTime={formatStartTime}
      formatRelativeTime={formatRelativeTime}
    />
  );
}
