import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminMobileNextAppointmentsStrip from './AdminMobileNextAppointmentsStrip';
import { useAdminTodayBookingsLive } from './useAdminTodayBookingsLive';

const DASH_HERO_SLOT_CLASS = [
  'admin-next-block',
  'admin-next-block--dash-hero-slot',
  'admin-next-block--dash-hero-slot--mobile',
].join(' ');

const HEIGHT_PUBLISH_THRESHOLD_PX = 2;

function bookingStableId(booking: { id?: string; startAt: string; endAt: string }, index: number) {
  return booking.id ?? `${booking.startAt}-${booking.endAt}-${index}`;
}

function assignForwardedRef<T>(r: React.Ref<T> | undefined, value: T | null) {
  if (typeof r === 'function') r(value);
  else if (r && typeof r === 'object' && 'current' in r) {
    (r as React.MutableRefObject<T | null>).current = value;
  }
}

/**
 * Mobile header next-appointments strip with the same data source as Bookings (today poll),
 * for tabs that do not mount BookingsAdminPanel (e.g. Services).
 */
const AdminMobileNextAppointmentsLive = forwardRef<HTMLDivElement>(function AdminMobileNextAppointmentsLive(
  _props,
  ref,
) {
  const {
    sessionChecked,
    loggedIn,
    upcomingBookings,
    connectionStateLabel,
    formatStartTime,
    formatRelativeTime,
  } = useAdminTodayBookingsLive();

  const [isMobileNextExpanded, setIsMobileNextExpanded] = useState(false);
  const userCollapsedRef = useRef(false);
  const latestTopFourFingerprintRef = useRef('');
  const measureCleanupRef = useRef<(() => void) | null>(null);

  const topFourUpcomingBookings = useMemo(() => upcomingBookings.slice(0, 4), [upcomingBookings]);

  const mobileTopAppointments = useMemo(
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
      setIsMobileNextExpanded(true);
    }

    latestTopFourFingerprintRef.current = nextFingerprint;
  }, [topFourUpcomingBookings]);

  const handleToggleMobileNextExpanded = useCallback(() => {
    setIsMobileNextExpanded((current) => {
      const next = !current;
      userCollapsedRef.current = !next;
      return next;
    });
  }, []);

  const setRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      measureCleanupRef.current?.();
      measureCleanupRef.current = null;
      assignForwardedRef(ref, node);

      if (!node) {
        return;
      }

      const mainContentNode = node.closest('.admin-main-content') as HTMLElement | null;
      if (!mainContentNode) {
        return;
      }

      let lastPublishedPx = -1;
      let rafId: number | null = null;

      const publishNextBlockHeight = () => {
        const nextPx = Math.round(node.getBoundingClientRect().height);
        if (lastPublishedPx < 0) {
          mainContentNode.style.setProperty('--admin-next-block-h', `${nextPx}px`);
          lastPublishedPx = nextPx;
          return;
        }
        if (Math.abs(nextPx - lastPublishedPx) >= HEIGHT_PUBLISH_THRESHOLD_PX) {
          mainContentNode.style.setProperty('--admin-next-block-h', `${nextPx}px`);
          lastPublishedPx = nextPx;
        }
      };

      const schedulePublish = () => {
        if (rafId !== null) return;
        rafId = window.requestAnimationFrame(() => {
          rafId = null;
          publishNextBlockHeight();
        });
      };

      publishNextBlockHeight();
      if (node.closest('.admin-mobile-header-extension')) {
        mainContentNode.style.setProperty(
          '--admin-mobile-sheet-strip-chrome',
          'calc(0.42rem + 0.2rem + 0.55rem)',
        );
      }
      const resizeObserver = new ResizeObserver(schedulePublish);
      resizeObserver.observe(node);
      window.addEventListener('resize', schedulePublish);
      const visualViewport = window.visualViewport;
      visualViewport?.addEventListener('resize', schedulePublish);

      measureCleanupRef.current = () => {
        if (rafId !== null) window.cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
        window.removeEventListener('resize', schedulePublish);
        visualViewport?.removeEventListener('resize', schedulePublish);
        mainContentNode.style.removeProperty('--admin-next-block-h');
        mainContentNode.style.removeProperty('--admin-mobile-sheet-strip-chrome');
      };
    },
    [ref],
  );

  useEffect(
    () => () => {
      measureCleanupRef.current?.();
      measureCleanupRef.current = null;
    },
    [],
  );

  if (!sessionChecked || !loggedIn) return null;

  return (
    <div ref={setRootRef} className={DASH_HERO_SLOT_CLASS}>
      <AdminMobileNextAppointmentsStrip
        appointments={mobileTopAppointments}
        isExpanded={isMobileNextExpanded}
        onToggleExpanded={handleToggleMobileNextExpanded}
        formatStartTime={formatStartTime}
        connectionStateLabel={connectionStateLabel}
      />
    </div>
  );
});

export default AdminMobileNextAppointmentsLive;
