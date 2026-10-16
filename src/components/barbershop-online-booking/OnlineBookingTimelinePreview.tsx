/**
 * OnlineBookingTimelinePreview — the real admin `TodayTimeline` for
 * /barbershop-online-booking Section 03, in the landing page's floating widget treatment
 * (`.isw`), fed by the CUTSTATE demo owner timeline for the section's example weekday.
 *
 * Safety follows `InsideSystemLiveWidget`: every /api/admin write is answered by the demo
 * interceptor with a blocked 403, `previewSwipe` stops the status/service sheets from opening,
 * and booking or client-profile actions open a read-only message instead of fetching anything.
 * At max-width 899px the timeline is inert with no scroll of its own, but it still follows the
 * selected client time.
 *
 * The selected time is drawn as a marker over the timeline, never inside it. Its position is
 * read from the rendered rows: a time with its own row sits on that row; a time between rows
 * (12:15 between the 12:00 and 12:30 rows) sits proportionally between them.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type HTMLAttributes } from 'react';

import TodayTimeline from '@/components/admin/TodayTimeline';
import '@/styles/components/admin-demo.css';
import '@/styles/components/booking.css';
import '@/styles/components/insideSystemLiveWidget.css';
import '@/styles/components/skeleton.css';
import '@/styles/components/barbershop-online-booking-timeline.css';
import {
  ADMIN_DEMO_BLOCKED_EVENT,
  installAdminFetchInterceptor,
  setPublicAdminDemoMode,
} from '@/components/admin/adminAuth';
import { blacklineAdminHref } from '@/lib/admin/demoConfig';
import { getAvailabilityTimelineData } from '@/lib/barbershopOnlineBooking/availabilityTimeline';
import { locateTimelineMinute, type TimelineRowAnchor } from '@/lib/barbershopOnlineBooking/timelineFocus';
import { computeCenteredScrollTop, prefersReducedMotion } from '@/lib/landing/liveTimelineScroll';
import { useMaxWidthPassive } from '@/lib/landing/useMaxWidthPassive';

const ADMIN_DEMO_HREF = blacklineAdminHref('bookings_dashboard');

export type TimelineFocus = {
  /** Minutes after midnight, London time. */
  minute: number;
  label: string;
  caption: string;
};

type Marker = { top: number; left: number; visible: boolean };

function readAnchors(container: HTMLElement): TimelineRowAnchor[] {
  const box = container.getBoundingClientRect();
  return Array.from(container.querySelectorAll<HTMLElement>('[data-vtl-slot]')).flatMap((group) => {
    const [h, m] = (group.dataset.vtlSlot ?? '').split(':').map(Number);
    const row = group.querySelector<HTMLElement>('.admin-vtl-slot');
    if (!row || Number.isNaN(h) || Number.isNaN(m)) return [];
    const rowBox = row.getBoundingClientRect();
    const groupBox = group.getBoundingClientRect();
    const offset = container.scrollTop - box.top;
    return [
      {
        minute: h * 60 + m,
        center: rowBox.top + rowBox.height / 2 + offset,
        bottom: groupBox.bottom + offset,
        expanded: group.dataset.expanded === 'true',
      },
    ];
  });
}

export function OnlineBookingTimelinePreview({ focus }: { focus: TimelineFocus }) {
  const [lockOpen, setLockOpen] = useState(false);
  const [marker, setMarker] = useState<Marker>({ top: 0, left: 0, visible: false });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const hasFocusedRef = useRef(false);
  const isPassive = useMaxWidthPassive();
  const isPassiveRef = useRef(isPassive);
  isPassiveRef.current = isPassive;

  const data = useMemo(() => getAvailabilityTimelineData(), []);

  useEffect(() => {
    setPublicAdminDemoMode(true);
    installAdminFetchInterceptor();

    const onBlocked = () => {
      if (!isPassiveRef.current) setLockOpen(true);
    };
    window.addEventListener(ADMIN_DEMO_BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(ADMIN_DEMO_BLOCKED_EVENT, onBlocked);
  }, []);

  useEffect(() => {
    if (isPassive) setLockOpen(false);
  }, [isPassive]);

  const measure = useCallback(() => {
    const container = scrollRef.current;
    const stage = stageRef.current;
    if (!container || !stage) return null;
    const y = locateTimelineMinute(readAnchors(container), focusRef.current.minute);
    if (y === null) return null;
    const body = container.querySelector<HTMLElement>('.admin-vtl-slot-body');
    const left = body ? body.getBoundingClientRect().left - stage.getBoundingClientRect().left : 0;
    return { y, left, container, stage };
  }, []);

  const updateMarker = useCallback(() => {
    const m = measure();
    if (!m) return;
    const offsetTop = m.container.getBoundingClientRect().top - m.stage.getBoundingClientRect().top;
    const top = m.y - m.container.scrollTop + offsetTop;
    const visible = top >= offsetTop - 1 && top <= offsetTop + m.container.clientHeight + 1;
    setMarker((prev) =>
      Math.abs(prev.top - top) < 0.5 && Math.abs(prev.left - m.left) < 0.5 && prev.visible === visible
        ? prev
        : { top, left: m.left, visible },
    );
  }, [measure]);

  // Keep the marker on its time while the timeline scrolls, resizes or expands a row.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return undefined;
    let raf: number | null = null;
    let burstUntil = 0;
    const tick = () => {
      raf = null;
      updateMarker();
      if (performance.now() < burstUntil) raf = window.requestAnimationFrame(tick);
    };
    const schedule = (burstMs = 0) => {
      burstUntil = Math.max(burstUntil, performance.now() + burstMs);
      if (raf === null) raf = window.requestAnimationFrame(tick);
    };
    const onScroll = () => schedule();
    const onResize = () => schedule(150);
    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedule(150)) : null;
    resizeObserver?.observe(container);
    const mutationObserver =
      typeof MutationObserver === 'function'
        ? new MutationObserver(() => schedule(700))
        : null;
    mutationObserver?.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-expanded'] });
    schedule(300);
    return () => {
      if (raf !== null) window.cancelAnimationFrame(raf);
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [updateMarker]);

  // Move only the timeline's own scroll area to the selected time — never the page. The first
  // positioning is instant so hydration never animates; later selections glide unless motion is reduced.
  useEffect(() => {
    let retry: number | undefined;
    const go = (attempt = 0) => {
      const m = measure();
      if (!m) {
        if (attempt < 10) retry = window.setTimeout(() => go(attempt + 1), 50);
        return;
      }
      const smooth = hasFocusedRef.current && !prefersReducedMotion();
      hasFocusedRef.current = true;
      m.container.scrollTo({
        top: computeCenteredScrollTop(m.container.clientHeight, m.y, 0),
        behavior: smooth ? 'smooth' : 'auto',
      });
      updateMarker();
    };
    go();
    return () => {
      if (retry !== undefined) window.clearTimeout(retry);
    };
  }, [focus.minute, isPassive, measure, updateMarker]);

  useEffect(() => {
    if (!lockOpen) return undefined;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLockOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lockOpen]);

  const openLock = () => {
    if (!isPassiveRef.current) setLockOpen(true);
  };

  return (
    <div
      className={`isw bot${isPassive ? ' bot--passive' : ''}${lockOpen ? ' is-dimmed' : ''}`}
      data-bot-passive={isPassive ? 'true' : undefined}
    >
      <div ref={stageRef} className="isw__stage bot__stage">
        <div
          className="bot__timeline"
          aria-hidden={lockOpen || isPassive ? 'true' : undefined}
          {...(isPassive ? ({ inert: true } as HTMLAttributes<HTMLDivElement>) : {})}
        >
          <TodayTimeline
            barbers={data.barbers}
            bookings={data.bookings}
            timeBlocks={data.timeBlocks}
            selectedDate={data.selectedDate}
            allowInitialNowScroll={false}
            scrollContainerRef={scrollRef}
            previewSwipe={!isPassive}
            onBookingClick={openLock}
            onClientProfileIntercept={openLock}
          />
        </div>

        <div
          className={`bot-marker${marker.visible ? ' is-visible' : ''}`}
          style={{ transform: `translateY(${marker.top.toFixed(1)}px)`, left: `${marker.left.toFixed(1)}px` }}
          data-bot-marker={focus.label}
          aria-hidden="true"
        >
          <span className="bot-marker__label">
            <strong>{focus.label}</strong> {focus.caption}
          </span>
        </div>

        {lockOpen && !isPassive && (
          <div className="bot-lock" role="dialog" aria-modal="true" aria-labelledby="bot-lock-title" onClick={() => setLockOpen(false)}>
            <div className="bot-lock__card" onClick={(event) => event.stopPropagation()}>
              <button
                ref={closeRef}
                type="button"
                className="bot-lock__close"
                aria-label="Close read-only message"
                onClick={() => setLockOpen(false)}
              >
                ×
              </button>
              <p id="bot-lock-title" className="bot-lock__title">
                This preview is read-only.
              </p>
              <p className="bot-lock__body">Open the admin demo to explore bookings without changing anything.</p>
              <a className="bot-lock__cta" href={ADMIN_DEMO_HREF}>
                Open the admin demo
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OnlineBookingTimelinePreview;
