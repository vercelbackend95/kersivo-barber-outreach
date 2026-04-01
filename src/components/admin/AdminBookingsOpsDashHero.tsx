import React from 'react';
import AdminOpsDashHero from './AdminOpsDashHero';

export type AdminBookingsOpsDashHeroBooking = {
  startAt: string;
  endAt: string;
  barber?: { name: string } | null;
  service?: { name: string } | null;
};

export type AdminBookingsOpsDashHeroProps = {
  nextBooking: AdminBookingsOpsDashHeroBooking | null;
  connectionStateLabel: string;
  hasLivePulse: boolean;
  freshnessLabel: string;
  formatStartTime: (iso: string) => string;
  formatRelativeTime: (startAt: string, endAt: string) => string;
};

export default function AdminBookingsOpsDashHero({
  nextBooking,
  connectionStateLabel,
  hasLivePulse,
  freshnessLabel,
  formatStartTime,
  formatRelativeTime,
}: AdminBookingsOpsDashHeroProps) {
  return (
    <AdminOpsDashHero
      ariaLabel="Next booking and live connection status"
      lead="Next"
      detail={
        nextBooking ? (
          <>
            {nextBooking.barber?.name} · {nextBooking.service?.name} · {formatStartTime(nextBooking.startAt)}
          </>
        ) : (
          'No upcoming bookings'
        )
      }
      secondary={
        nextBooking ? formatRelativeTime(nextBooking.startAt, nextBooking.endAt) : undefined
      }
      footer={freshnessLabel}
      connectionStateLabel={connectionStateLabel}
      hasLivePulse={hasLivePulse}
    />
  );
}
