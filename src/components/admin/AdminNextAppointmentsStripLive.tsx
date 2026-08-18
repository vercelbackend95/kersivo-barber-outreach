import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminMobileNextAppointmentsStrip from './AdminMobileNextAppointmentsStrip';
import { useAdminTodayBookingsLive } from './useAdminTodayBookingsLive';

function bookingStableId(booking: { id?: string; startAt: string; endAt: string }, index: number) {
  return booking.id ?? `${booking.startAt}-${booking.endAt}-${index}`;
}

/**
 * Live next-appointments strip (same data as Bookings today poll): up to four upcoming rows,
 * expandable via chevron — shared by mobile header host and desktop Bookings dash slot.
 */
export default function AdminNextAppointmentsStripLive() {
  const {
    sessionChecked,
    loggedIn,
    isPublicDemo,
    hasLoadedOnce,
    upcomingBookings,
    connectionStateLabel,
    formatStartTime,
    formatRelativeTime,
    showDemoModePills,
  } = useAdminTodayBookingsLive();

  const [isNextExpanded, setIsNextExpanded] = useState(false);
  const userCollapsedRef = useRef(false);
  const latestTopFourFingerprintRef = useRef('');

  const topFourUpcomingBookings = useMemo(() => upcomingBookings.slice(0, 4), [upcomingBookings]);

  const stripAppointments = useMemo(
    () =>
      topFourUpcomingBookings.map((booking, index) => ({
        id: bookingStableId(booking, index),
        barberName: booking.barber?.name ?? 'Barber',
        serviceName: booking.service?.name ?? 'Service',
        startAt: booking.startAt,
        relativeLabel: formatRelativeTime(booking.startAt, booking.endAt),
      })),
    [formatRelativeTime, topFourUpcomingBookings],
  );

  useEffect(() => {
    const nextFingerprint = topFourUpcomingBookings
      .map((booking, i) => `${bookingStableId(booking, i)}:${booking.startAt}:${booking.endAt}`)
      .join('|');
    const previousFingerprint = latestTopFourFingerprintRef.current;

    if (!previousFingerprint) {
      latestTopFourFingerprintRef.current = nextFingerprint;
      return;
    }

    if (nextFingerprint && nextFingerprint !== previousFingerprint && !userCollapsedRef.current) {
      setIsNextExpanded(true);
    }

    latestTopFourFingerprintRef.current = nextFingerprint;
  }, [topFourUpcomingBookings]);

  const handleToggleExpanded = useCallback(() => {
    setIsNextExpanded((current) => {
      const next = !current;
      userCollapsedRef.current = !next;
      return next;
    });
  }, []);

  if (!sessionChecked || !loggedIn) return null;

  return (
    <AdminMobileNextAppointmentsStrip
      appointments={stripAppointments}
      isExpanded={isNextExpanded}
      onToggleExpanded={handleToggleExpanded}
      formatStartTime={formatStartTime}
      connectionStateLabel={connectionStateLabel}
      isDemo={isPublicDemo}
      showDemoPill={showDemoModePills}
      isLoading={!hasLoadedOnce}
    />
  );
}
