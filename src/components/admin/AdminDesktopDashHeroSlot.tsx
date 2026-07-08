import React, { useCallback, useEffect, useRef } from 'react';
import AdminNextAppointmentsStripLive from './AdminNextAppointmentsStripLive';
import { useAdminMobileChromeBreakpoint } from './useAdminMobileNextAppointmentsChrome';

const DASH_HERO_SLOT_CLASS = 'admin-next-block admin-next-block--dash-hero-slot';
const HEIGHT_PUBLISH_THRESHOLD_PX = 2;

/**
 * Desktop in-flow Next appointments strip (same slot as History / Blocks / Reports).
 * Mobile uses AdminGlobalMobileNextStripHost instead.
 */
export default function AdminDesktopDashHeroSlot() {
  const isMobileAdminChrome = useAdminMobileChromeBreakpoint();
  const measureCleanupRef = useRef<(() => void) | null>(null);

  const setRootRef = useCallback((node: HTMLDivElement | null) => {
    measureCleanupRef.current?.();
    measureCleanupRef.current = null;

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
  }, []);

  useEffect(
    () => () => {
      measureCleanupRef.current?.();
      measureCleanupRef.current = null;
    },
    [],
  );

  if (isMobileAdminChrome) {
    return null;
  }

  return (
    <div ref={setRootRef} className={DASH_HERO_SLOT_CLASS}>
      <AdminNextAppointmentsStripLive />
    </div>
  );
}
