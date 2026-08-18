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
import TapHandHint from '@/components/TapHandHint';
import { positionTapHand, waitForScrollSettled, type TapHandPosition } from '@/lib/ui/tapHandHint';
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
  computeCenteredScrollTop,
  pickClosestTimeLabel,
  prefersReducedMotion,
} from '@/lib/landing/liveTimelineScroll';
import { adminDemoHref } from '@/lib/admin/demoConfig';

const ADMIN_DEMO_HREF = adminDemoHref('timeline');
const SCROLL_END_FALLBACK_MS = 700;

function readTimeLabel(node: HTMLElement): string {
  const fromData = node.getAttribute('data-vtl-time')?.trim();
  if (fromData) return fromData;
  const fromDateTime = node.getAttribute('dateTime')?.trim() || node.getAttribute('datetime')?.trim();
  if (fromDateTime) return fromDateTime;
  return (node.textContent ?? '').trim();
}

export function InsideSystemLiveWidget({
  barbers,
}: {
  barbers?: LandingBarber[];
} = {}) {
  const [lockOpen, setLockOpen] = useState(false);
  const [tapHintVisible, setTapHintVisible] = useState(false);
  const [tapHintPos, setTapHintPos] = useState<TapHandPosition | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const tapHintShownRef = useRef(false);
  const tapHintDismissedRef = useRef(false);

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
    // Animate to mid-afternoon only when the widget enters the viewport —
    // never scrollIntoView (which would jump the whole landing page).
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root) return undefined;

    let done = false;
    let scrollEndCleanup: (() => void) | undefined;
    let retryTimer: number | undefined;

    const dismissTapHint = () => {
      if (tapHintDismissedRef.current) return;
      tapHintDismissedRef.current = true;
      setTapHintVisible(false);
    };

    const getScrollContainer = () => scrollRef.current;

    const positionTapHint = () => {
      const container = getScrollContainer();
      if (!stage || !container || tapHintDismissedRef.current || tapHintShownRef.current) return;

      const timeNodes = Array.from(container.querySelectorAll<HTMLElement>('[data-vtl-time]'));
      const timeNode = timeNodes.find(
        (node) => readTimeLabel(node) === LANDING_TIMELINE_SCROLL_FOCUS,
      );
      if (!timeNode) return;

      const slot =
        timeNode.closest<HTMLElement>('.admin-vtl-slot, .admin-vtl-now-row') ?? timeNode;
      const line =
        slot.querySelector<HTMLElement>('.admin-vtl-progress-track .admin-vtl-slot-line') ??
        slot.querySelector<HTMLElement>('.admin-vtl-slot-line');
      const anchor = line ?? slot;

      // Anchor = tip of the finger sits just above the slot line center.
      setTapHintPos(positionTapHand(stage, anchor));
      tapHintShownRef.current = true;
      setTapHintVisible(true);
    };

    const afterScrollSettled = (container: HTMLElement) => {
      scrollEndCleanup?.();
      const show = () => {
        window.requestAnimationFrame(positionTapHint);
      };
      scrollEndCleanup = waitForScrollSettled(container, show, {
        reducedMotion: prefersReducedMotion(),
        fallbackMs: SCROLL_END_FALLBACK_MS,
      });
    };

    const centerFocusTime = (attempt = 0) => {
      const container = getScrollContainer();
      if (!container) {
        if (attempt < 8) {
          retryTimer = window.setTimeout(() => centerFocusTime(attempt + 1), 50);
        }
        return;
      }

      const timeNodes = Array.from(
        container.querySelectorAll<HTMLElement>('[data-vtl-time]'),
      );
      if (timeNodes.length === 0) {
        if (attempt < 8) {
          retryTimer = window.setTimeout(() => centerFocusTime(attempt + 1), 50);
        }
        return;
      }

      const labels = timeNodes.map((node) => readTimeLabel(node));
      const targetLabel =
        pickClosestTimeLabel(labels, LANDING_TIMELINE_SCROLL_FOCUS) ??
        LANDING_TIMELINE_SCROLL_FOCUS;
      const target = timeNodes.find((node) => readTimeLabel(node) === targetLabel);
      if (!target) return;

      const row =
        target.closest<HTMLElement>('.admin-vtl-slot, .admin-vtl-now-row') ?? target;

      // Prefer rect math so nesting/offsetParent quirks don't miss the slot.
      const containerRect = container.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const rowOffsetTop = rowRect.top - containerRect.top + container.scrollTop;
      const top = computeCenteredScrollTop(
        container.clientHeight,
        rowOffsetTop,
        rowRect.height,
      );
      const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
      container.scrollTo({ top, behavior });
      afterScrollSettled(container);
    };

    const onFocusSlotClick = (event: Event) => {
      const target = event.target as Element | null;
      const slot = target?.closest?.('.admin-vtl-slot--interactive');
      if (!slot) return;
      const timeNode = slot.querySelector<HTMLElement>('[data-vtl-time]');
      if (!timeNode || readTimeLabel(timeNode) !== LANDING_TIMELINE_SCROLL_FOCUS) return;
      dismissTapHint();
    };
    root.addEventListener('click', onFocusSlotClick);

    const observer = new IntersectionObserver(
      (entries) => {
        if (done || !entries.some((entry) => entry.isIntersecting)) return;
        done = true;
        observer.disconnect();
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => centerFocusTime(0)),
        );
      },
      { threshold: 0.2, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(root);

    return () => {
      observer.disconnect();
      root.removeEventListener('click', onFocusSlotClick);
      scrollEndCleanup?.();
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
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
    <div ref={rootRef} className={`isw${lockOpen ? ' is-dimmed' : ''}`}>
      <div className="isw__stage" ref={stageRef}>
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

        <TapHandHint visible={tapHintVisible} position={tapHintPos} />

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
