/**
 * InsideSystemLiveWidget — live admin timeline preview for the landing page.
 *
 * Embeds the real admin `TodayTimeline` 1:1 (pulsing "now" line, animated
 * avatars, expandable slots) fed by believable demo data anchored to today.
 * Deep actions (client profile, status/service edits) are gated: they open a
 * preview lock with Build My Preview + View Admin Demo instead of mutating anything.
 *
 * Rendered as a client-only island (time/timezone dependent), so it ships as an
 * interactive React component with no SSR hydration mismatch.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import TodayTimeline from '@/components/admin/TodayTimeline';
import '@/styles/components/admin-demo.css';
import '@/styles/components/booking.css';
import '@/styles/components/insideSystemLiveWidget.css';
import '@/styles/components/skeleton.css';
import {
  ADMIN_DEMO_BLOCKED_EVENT,
  installAdminFetchInterceptor,
  setPublicAdminDemoMode,
} from '@/components/admin/adminAuth';
import { getLandingTimelineData, type LandingBarber } from '@/lib/landing/liveTimelineData';
import {
  LANDING_TIMELINE_SCROLL_FOCUS,
  pickClosestTimeLabel,
} from '@/lib/landing/liveTimelineScroll';
import { adminDemoHref } from '@/lib/admin/demoConfig';

const ADMIN_DEMO_HREF = adminDemoHref('timeline');

export function InsideSystemLiveWidget({
  barbers,
}: {
  barbers?: LandingBarber[];
} = {}) {
  const [lockOpen, setLockOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const data = useMemo(() => getLandingTimelineData(barbers), [barbers]);

  useEffect(() => {
    // Route every /api/admin write to a blocked 403 + toast event, so no deep
    // action ever mutates real data from the public landing page.
    setPublicAdminDemoMode(true);
    installAdminFetchInterceptor();

    const openLock = () => setLockOpen(true);
    window.addEventListener(ADMIN_DEMO_BLOCKED_EVENT, openLock);
    return () => window.removeEventListener(ADMIN_DEMO_BLOCKED_EVENT, openLock);
  }, []);

  useEffect(() => {
    // Center mid-afternoon demo activity inside the widget's own scroll container —
    // never scrollIntoView (which would jump the whole landing page here).
    // Evening visitors would otherwise land on an empty "now" row (~22:00).
    const container = scrollRef.current;
    if (!container) return undefined;

    let done = false;
    const centerFocusTime = () => {
      const timeNodes = Array.from(
        container.querySelectorAll<HTMLElement>('[data-vtl-time]'),
      );
      const labels = timeNodes.map((node) => node.getAttribute('data-vtl-time') ?? '');
      const targetLabel = pickClosestTimeLabel(labels, LANDING_TIMELINE_SCROLL_FOCUS);
      if (!targetLabel) return;
      const target = timeNodes.find(
        (node) => node.getAttribute('data-vtl-time') === targetLabel,
      );
      if (!target) return;
      // Prefer the slot/now row wrapper when available so centering uses full row height.
      const row =
        target.closest<HTMLElement>('.admin-vtl-slot, .admin-vtl-now-row') ?? target;
      container.scrollTop = Math.max(
        0,
        row.offsetTop - container.clientHeight / 2 + row.offsetHeight / 2,
      );
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (done || !entries.some((entry) => entry.isIntersecting)) return;
        done = true;
        observer.disconnect();
        // rAF x2 so layout (and any expansion) is settled before measuring.
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(centerFocusTime),
        );
      },
      { threshold: 0.25 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!lockOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLockOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lockOpen]);

  return (
    <div className={`isw${lockOpen ? ' is-dimmed' : ''}`}>
      <div className="isw__stage">
        <div aria-hidden={lockOpen ? 'true' : undefined}>
          <TodayTimeline
            barbers={data.barbers}
            bookings={data.bookings}
            timeBlocks={data.timeBlocks}
            selectedDate={data.selectedDate}
            allowInitialNowScroll={false}
            scrollContainerRef={scrollRef}
            previewSwipe
            onBookingClick={() => setLockOpen(true)}
            onClientProfileIntercept={() => setLockOpen(true)}
          />
        </div>

        {lockOpen && (
          <div
            className="isw-lock"
            role="dialog"
            aria-modal="true"
            aria-labelledby="isw-lock-title"
            onClick={() => setLockOpen(false)}
          >
            <div className="isw-lock__card" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="isw-lock__close"
                aria-label="Close preview message"
                onClick={() => setLockOpen(false)}
              >
                ×
              </button>
              <p className="isw-lock__eyebrow">Live preview</p>
              <p id="isw-lock-title" className="isw-lock__title">
                This is just a preview.
              </p>
              <p className="isw-lock__body">
                This compact timeline is a teaser of the real admin. Build My Preview to start your
                own shop, or open the full admin demo without signing up.
              </p>
              <div className="isw-lock__actions">
                <a
                  href="/admin/onboarding"
                  className="btn btn--primary isw-lock__cta"
                  data-track="plan_my_setup_click"
                >
                  Build My Preview
                </a>
                <a
                  href={ADMIN_DEMO_HREF}
                  className="btn btn--ghost isw-lock__cta isw-lock__cta--ghost"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Admin Demo
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default InsideSystemLiveWidget;
