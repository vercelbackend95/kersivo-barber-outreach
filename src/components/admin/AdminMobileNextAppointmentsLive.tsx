import React, { forwardRef, useCallback, useEffect, useRef } from 'react';
import AdminNextAppointmentsStripLive from './AdminNextAppointmentsStripLive';
import { useAdminTodayBookingsLive } from './useAdminTodayBookingsLive';

const DASH_HERO_SLOT_CLASS = [
  'admin-next-block',
  'admin-next-block--dash-hero-slot',
  'admin-next-block--dash-hero-slot--mobile',
].join(' ');

const HEIGHT_PUBLISH_THRESHOLD_PX = 2;

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
  const { sessionChecked, loggedIn } = useAdminTodayBookingsLive();
  const measureCleanupRef = useRef<(() => void) | null>(null);

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
        const nextPx = Math.round(node.offsetHeight);
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

      measureCleanupRef.current = () => {
        if (rafId !== null) window.cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
        window.removeEventListener('resize', schedulePublish);
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
      <AdminNextAppointmentsStripLive />
    </div>
  );
});

export default AdminMobileNextAppointmentsLive;
