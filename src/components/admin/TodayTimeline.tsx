import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { minutesInLondonDay } from '../../lib/booking/time';
import { getBookingStatusTone } from './bookingStatus';
type TimelineBarber = {
  id: string;
  name: string;
};

type TimelineBooking = {
  id: string;
  fullName: string;
  email: string;
  status: string;
  startAt: string;
  endAt: string;
  barberId?: string;
  notes?: string | null;
  rescheduledAt?: string | null;
  barber: { name: string };
  service: { id?: string; name: string };
};

type TimelineTimeBlock = {
  id: string;
  title: string;
  barberId?: string | null;
  startAt: string;
  endAt: string;
};

type PositionedItem = {
  id: string;
  leftPct: number;
  widthPct: number;
  topPx: number;
  heightPx: number;
  startLabel: string;
  endLabel: string;
};

type PositionedBooking = PositionedItem & {
  type: 'booking';
  booking: TimelineBooking;
};

type PositionedBlock = PositionedItem & {
  type: 'timeBlock';
  timeBlock: TimelineTimeBlock;
};

type LaneModel = {
  barber: TimelineBarber;
  bookings: PositionedBooking[];
  timeBlocks: PositionedBlock[];
  laneHeight: number;
};

type TodayTimelineProps = {
  barbers: TimelineBarber[];
  bookings: TimelineBooking[];
  timeBlocks: TimelineTimeBlock[];
  selectedDate: string;
  isSearchActive?: boolean;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;

  onBookingClick: (booking: TimelineBooking) => void;
};

const ADMIN_TIMEZONE = 'Europe/London';
const TIMELINE_START_HOUR = 8;
const TIMELINE_END_HOUR = 24;
const TIMELINE_SLOT_INTERVAL_MINUTES = 30;
const TIMELINE_SLOT_WIDTH_REM = 3.15;
const MOBILE_TIMELINE_HOUR_SPACING_MULTIPLIER = 1;
const TIMELINE_TOTAL_MINUTES = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60;
const TIMELINE_TOTAL_SLOTS = TIMELINE_TOTAL_MINUTES / TIMELINE_SLOT_INTERVAL_MINUTES;
const TIMELINE_CANVAS_MIN_WIDTH_REM = TIMELINE_TOTAL_SLOTS * TIMELINE_SLOT_WIDTH_REM;
const TIMELINE_MOBILE_CANVAS_MIN_WIDTH_REM = TIMELINE_CANVAS_MIN_WIDTH_REM * MOBILE_TIMELINE_HOUR_SPACING_MULTIPLIER;
const BOOKING_CARD_HEIGHT = 56;
const BOOKING_STACK_GAP = 6;
const LANE_INNER_PADDING = 8;
const NOW_INDICATOR_REFRESH_MS = 15000;
const INITIAL_NOW_SCROLL_OFFSET_RATIO = 0.38;
const INITIAL_NOW_SCROLL_RETRY_COUNT = 6;

let hasLoggedInvalidTimelineDate = false;

function getMinuteOfDay(input: Date | string): number {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    if (import.meta.env.DEV && !hasLoggedInvalidTimelineDate) {
      console.warn('[TodayTimeline] Invalid date provided to getMinuteOfDay.', input);
      hasLoggedInvalidTimelineDate = true;
    }
    return 0;
  }

  return minutesInLondonDay(date);
}

function getTimelinePosition(startAt: Date | string, endAt: Date | string) {
  const timelineStartMinute = TIMELINE_START_HOUR * 60;
  const rawStart = getMinuteOfDay(startAt) - timelineStartMinute;
  const rawEnd = getMinuteOfDay(endAt) - timelineStartMinute;
  const clampedStart = Math.max(0, Math.min(rawStart, TIMELINE_TOTAL_MINUTES));
  const clampedEnd = Math.max(clampedStart, Math.min(rawEnd, TIMELINE_TOTAL_MINUTES));
  const widthMinutes = clampedEnd - clampedStart;

  return {
    leftPct: (clampedStart / TIMELINE_TOTAL_MINUTES) * 100,
    widthPct: (widthMinutes / TIMELINE_TOTAL_MINUTES) * 100
  };
}

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'NA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}


function buildLanes(barbers: TimelineBarber[], bookings: TimelineBooking[], timeBlocks: TimelineTimeBlock[]): LaneModel[] {
  const activeBarberIds = new Set(barbers.map((barber) => barber.id));

  return barbers.map((barber) => {
    const laneBookings = bookings
      .filter((booking) => booking.barberId === barber.id && activeBarberIds.has(booking.barberId))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    const laneBlocks = timeBlocks
      .filter((block) => !block.barberId || block.barberId === barber.id)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    const activeOverlapEndByLevel: number[] = [];
    const positionedBookings: PositionedBooking[] = laneBookings.map((booking) => {
      const startMinute = getMinuteOfDay(booking.startAt);
      const endMinute = getMinuteOfDay(booking.endAt);

      let level = 0;
      while (level < activeOverlapEndByLevel.length && activeOverlapEndByLevel[level] > startMinute) {
        level += 1;
      }
      activeOverlapEndByLevel[level] = endMinute;

      const position = getTimelinePosition(booking.startAt, booking.endAt);

      return {
        id: booking.id,
        type: 'booking',
        booking,
        leftPct: position.leftPct,
        widthPct: position.widthPct,
        topPx: LANE_INNER_PADDING + level * (BOOKING_CARD_HEIGHT + BOOKING_STACK_GAP),
        heightPx: BOOKING_CARD_HEIGHT,
        startLabel: formatInTimeZone(booking.startAt, ADMIN_TIMEZONE, 'HH:mm'),
        endLabel: formatInTimeZone(booking.endAt, ADMIN_TIMEZONE, 'HH:mm')
      };
    });

    const positionedBlocks: PositionedBlock[] = laneBlocks.map((timeBlock) => {
      const position = getTimelinePosition(timeBlock.startAt, timeBlock.endAt);
      return {
        id: timeBlock.id,
        type: 'timeBlock',
        timeBlock,
        leftPct: position.leftPct,
        widthPct: position.widthPct,
        topPx: 10,
        heightPx: 38,
        startLabel: formatInTimeZone(timeBlock.startAt, ADMIN_TIMEZONE, 'HH:mm'),
        endLabel: formatInTimeZone(timeBlock.endAt, ADMIN_TIMEZONE, 'HH:mm')
      };
    });

    const overlapRows = Math.max(1, activeOverlapEndByLevel.length);
    const laneHeight =
      LANE_INNER_PADDING * 2 +
      overlapRows * BOOKING_CARD_HEIGHT +
      Math.max(0, overlapRows - 1) * BOOKING_STACK_GAP;

    return {
      barber,
      bookings: positionedBookings,
      timeBlocks: positionedBlocks,
      laneHeight: Math.max(laneHeight, 96)
    };
  });
}

function getTickRows() {
  const majorTicks: Array<{ minute: number; label: string; isHalfHour: boolean }> = [];
  const minorTicks: number[] = [];

  for (let minute = 0; minute <= TIMELINE_TOTAL_MINUTES; minute += 15) {
    const isMajor = minute % TIMELINE_SLOT_INTERVAL_MINUTES === 0;
    if (isMajor) {
      const hour = TIMELINE_START_HOUR + Math.floor(minute / 60);
      const min = minute % 60;
      majorTicks.push({
        minute,
        isHalfHour: min === 30,
        label: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
      });
    } else {
      minorTicks.push(minute);
    }
  }

  return { majorTicks, minorTicks };
}

type NowIndicatorProps = {
  selectedDate: string;
};

function updateNowIndicatorPosition(indicator: HTMLSpanElement, selectedDate: string) {
  const currentMs = Date.now();
  const currentLondonMinute = (() => {
    const now = new Date(currentMs);

    const hour = Number(formatInTimeZone(now, ADMIN_TIMEZONE, 'HH'));
    const minute = Number(formatInTimeZone(now, ADMIN_TIMEZONE, 'mm'));
    return hour * 60 + minute - TIMELINE_START_HOUR * 60;
  })();

  const todayLondon = formatInTimeZone(new Date(currentMs), ADMIN_TIMEZONE, 'yyyy-MM-dd');
  const shouldShow = selectedDate === todayLondon && currentLondonMinute >= 0 && currentLondonMinute <= TIMELINE_TOTAL_MINUTES;

  indicator.style.display = shouldShow ? 'block' : 'none';
  if (!shouldShow) return;

  indicator.style.left = `${(currentLondonMinute / TIMELINE_TOTAL_MINUTES) * 100}%`;
}
function getCurrentLondonTimelineMinute() {
  const now = new Date();
  const hour = Number(formatInTimeZone(now, ADMIN_TIMEZONE, 'HH'));
  const minute = Number(formatInTimeZone(now, ADMIN_TIMEZONE, 'mm'));

  return hour * 60 + minute - TIMELINE_START_HOUR * 60;
}

function clampScrollLeft(value: number, container: HTMLDivElement) {
  const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
  if (maxScrollLeft <= 0) return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(value, maxScrollLeft));
}

const DESKTOP_TIMELINE_MEDIA_QUERY = '(min-width: 769px)';
const TIMELINE_TEXT_FIT_EPSILON = 0.1;
let timelineTextMeasureCanvas: HTMLCanvasElement | null = null;

function measureTextWidth(text: string, fontSizePx: number, fontWeight: string, fontFamily: string, letterSpacingPx: number) {
  if (typeof document === 'undefined') return text.length * fontSizePx * 0.6;

  const canvas = timelineTextMeasureCanvas ??= document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return text.length * fontSizePx * 0.6;

  context.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;
  const baseWidth = context.measureText(text).width;
  const trackingWidth = Math.max(0, text.length - 1) * letterSpacingPx;
  return baseWidth + trackingWidth;
}

function getFittedFontSize({
  text,
  widthPx,
  maxFontSizePx,
  minFontSizePx,
  fontWeight,
  fontFamily,
  letterSpacingPx
}: {
  text: string;
  widthPx: number;
  maxFontSizePx: number;
  minFontSizePx: number;
  fontWeight: string;
  fontFamily: string;
  letterSpacingPx: number;
}) {
  if (!text.trim()) return maxFontSizePx;
  if (widthPx <= 0) return minFontSizePx;

  let low = minFontSizePx;
  let high = maxFontSizePx;
  let best = minFontSizePx;

  while (high - low > TIMELINE_TEXT_FIT_EPSILON) {
    const mid = (low + high) / 2;
    const measuredWidth = measureTextWidth(text, mid, fontWeight, fontFamily, letterSpacingPx);

    if (measuredWidth <= widthPx) {
      best = mid;
      low = mid;
    } else {
      high = mid;
    }
  }

  return Math.max(minFontSizePx, Math.min(maxFontSizePx, best));
}

function TimelineBookingCard({
  item,
  isSearchActive,
  onBookingClick
}: {
  item: PositionedBooking;
  isSearchActive: boolean;
  onBookingClick: (booking: TimelineBooking) => void;
}) {
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const [fontSizes, setFontSizes] = useState<{ time: number; service: number } | null>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || typeof window === 'undefined') return;

    let frameId = 0;
    let observer: ResizeObserver | null = null;

    const updateTextFit = () => {
      const isDesktopViewport = window.matchMedia(DESKTOP_TIMELINE_MEDIA_QUERY).matches;
      if (!isDesktopViewport) {
        setFontSizes((current) => (current === null ? current : null));
        return;
      }

      const computedStyle = window.getComputedStyle(card);
      const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0;
      const availableWidth = Math.max(0, card.clientWidth - paddingLeft - paddingRight);

      const timeSize = getFittedFontSize({
        text: `${item.startLabel}-${item.endLabel}`,
        widthPx: availableWidth,
        maxFontSizePx: 14,
        minFontSizePx: 5,
        fontWeight: '700',
        fontFamily: 'Inter, sans-serif',
        letterSpacingPx: -0.2
      });

      const serviceSize = getFittedFontSize({
        text: item.booking.service?.name ?? 'Service',
        widthPx: availableWidth,
        maxFontSizePx: 12,
        minFontSizePx: 5,
        fontWeight: '700',
        fontFamily: 'Inter, sans-serif',
        letterSpacingPx: -0.08
      });

      setFontSizes((current) => {
        if (current && Math.abs(current.time - timeSize) < 0.2 && Math.abs(current.service - serviceSize) < 0.2) {
          return current;
        }

        return { time: timeSize, service: serviceSize };
      });
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateTextFit);
    };

    const mediaQuery = window.matchMedia(DESKTOP_TIMELINE_MEDIA_QUERY);
    const fontReady = document.fonts?.ready;

    scheduleUpdate();
    if (fontReady) void fontReady.then(scheduleUpdate);

    observer = new ResizeObserver(() => {
      scheduleUpdate();
    });
    observer.observe(card);

    const handleViewportChange = () => scheduleUpdate();
    mediaQuery.addEventListener('change', handleViewportChange);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
      mediaQuery.removeEventListener('change', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [item.booking.service?.name, item.endLabel, item.startLabel]);

  return (
    <button
      ref={cardRef}
      type="button"
      data-booking-id={item.booking.id}
      className={`admin-timeline-card admin-timeline-card--booking admin-timeline-card--${getBookingStatusTone(item.booking)} ${isSearchActive ? 'admin-timeline-card--search-match' : ''}`}
      style={{
        left: `${item.leftPct}%`,
        width: `${item.widthPct}%`,
        top: `${item.topPx}px`,
        height: `${item.heightPx}px`,
        ...(fontSizes ? ({
          '--timeline-card-time-font-size': `${fontSizes.time}px`,
          '--timeline-card-service-font-size': `${fontSizes.service}px`
        } as React.CSSProperties) : null)
      }}
      onClick={() => onBookingClick(item.booking)}
      title={`${item.startLabel}-${item.endLabel} · ${item.booking.service?.name ?? 'Service'} · ${item.booking.fullName}`}
    >
      <span className="admin-timeline-card-time">{`${item.startLabel}-${item.endLabel}`}</span>
      <strong className="admin-timeline-card-service">{item.booking.service?.name ?? 'Service'}</strong>
    </button>
  );
}


const NowIndicator = memo(function NowIndicator({ selectedDate }: NowIndicatorProps) {
  const indicatorRef = useRef<HTMLSpanElement | null>(null);


  useEffect(() => {
    const indicator = indicatorRef.current;
    if (!indicator) return;
    const refreshMs = typeof NOW_INDICATOR_REFRESH_MS === 'number' ? NOW_INDICATOR_REFRESH_MS : 15000;
    updateNowIndicatorPosition(indicator, selectedDate);
    const intervalId = window.setInterval(() => {
      updateNowIndicatorPosition(indicator, selectedDate);
    }, refreshMs);

    return () => window.clearInterval(intervalId);
  }, [selectedDate]);

  return <span ref={indicatorRef} className="admin-timeline-now-indicator" aria-hidden="true" />;
});

function TodayTimeline({ barbers, bookings, timeBlocks, selectedDate, isSearchActive = false, onBookingClick, scrollContainerRef }: TodayTimelineProps) {
  const localScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollContainerRef = scrollContainerRef ?? localScrollContainerRef;
  const autoPositionedDateRef = useRef<string | null>(null);
  const lanes = useMemo(() => buildLanes(barbers, bookings, timeBlocks), [barbers, bookings, timeBlocks]);
  const ticks = useMemo(() => getTickRows(), []);
  const timelineLayoutStyle = useMemo(
    () => ({
      '--admin-timeline-canvas-width': `${TIMELINE_CANVAS_MIN_WIDTH_REM}rem`,
      '--admin-timeline-mobile-canvas-width': `${TIMELINE_MOBILE_CANVAS_MIN_WIDTH_REM}rem`
    }) as React.CSSProperties,

    []
  );
  useEffect(() => {
    if (autoPositionedDateRef.current === selectedDate) return;

    const todayLondon = formatInTimeZone(new Date(), ADMIN_TIMEZONE, 'yyyy-MM-dd');
    if (selectedDate !== todayLondon) {
      autoPositionedDateRef.current = selectedDate;
      return;
    }

    let cancelled = false;
    let rafId = 0;
    let timeoutId = 0;

    const positionToNow = (attempt: number) => {
      if (cancelled) return;

      const container = timelineScrollContainerRef.current;
      if (!container) {
        if (attempt < INITIAL_NOW_SCROLL_RETRY_COUNT) {
          timeoutId = window.setTimeout(() => {
            rafId = window.requestAnimationFrame(() => positionToNow(attempt + 1));
          }, 32);
        }
        return;
      }

      const hasOverflow = container.scrollWidth > container.clientWidth + 1;
      if (!hasOverflow) {
        if (attempt < INITIAL_NOW_SCROLL_RETRY_COUNT) {
          timeoutId = window.setTimeout(() => {
            rafId = window.requestAnimationFrame(() => positionToNow(attempt + 1));
          }, 32);
        }
        return;
      }

      const nowMinute = getCurrentLondonTimelineMinute();
      if (nowMinute < 0 || nowMinute > TIMELINE_TOTAL_MINUTES) {
        autoPositionedDateRef.current = selectedDate;
        return;
      }

      const nowRatio = nowMinute / TIMELINE_TOTAL_MINUTES;
      const nowPixel = nowRatio * container.scrollWidth;
      const targetLeft = nowPixel - container.clientWidth * INITIAL_NOW_SCROLL_OFFSET_RATIO;
      container.scrollLeft = clampScrollLeft(targetLeft, container);
      autoPositionedDateRef.current = selectedDate;
    };

    rafId = window.requestAnimationFrame(() => positionToNow(0));

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [selectedDate, timelineScrollContainerRef]);



  useEffect(() => {
    const container = timelineScrollContainerRef.current;
    if (!container) return;

    let startX = 0;
    let startY = 0;
    let lock: 'horizontal' | 'vertical' | null = null;
    let isTracking = false;
    let initialScrollLeft = 0;
    const threshold = 8;

    const resetGesture = () => {
      lock = null;
      isTracking = false;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      isTracking = true;
      lock = null;
      startX = event.clientX;
      startY = event.clientY;
      initialScrollLeft = container.scrollLeft;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isTracking || event.pointerType !== 'touch') return;

      const dx = Math.abs(event.clientX - startX);
      const dy = Math.abs(event.clientY - startY);

      if (lock === null) {
        if (dx > dy && dx > threshold) lock = 'horizontal';
        else if (dy > dx && dy > threshold) lock = 'vertical';
      }

      if (lock === 'horizontal') {
        event.preventDefault();
        container.scrollLeft = initialScrollLeft + (startX - event.clientX);
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      isTracking = true;
      lock = null;
      startX = touch.clientX;
      startY = touch.clientY;
      initialScrollLeft = container.scrollLeft;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!isTracking || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = Math.abs(touch.clientX - startX);
      const dy = Math.abs(touch.clientY - startY);

      if (lock === null) {
        if (dx > dy && dx > threshold) lock = 'horizontal';
        else if (dy > dx && dy > threshold) lock = 'vertical';
      }

      if (lock === 'horizontal') {
        event.preventDefault();
        container.scrollLeft = initialScrollLeft + (startX - touch.clientX);
      }
    };

    if (window.PointerEvent) {
      container.addEventListener('pointerdown', onPointerDown, { passive: true });
      container.addEventListener('pointermove', onPointerMove, { passive: false });
      container.addEventListener('pointerup', resetGesture, { passive: true });
      container.addEventListener('pointercancel', resetGesture, { passive: true });

      return () => {
        container.removeEventListener('pointerdown', onPointerDown);
        container.removeEventListener('pointermove', onPointerMove);
        container.removeEventListener('pointerup', resetGesture);
        container.removeEventListener('pointercancel', resetGesture);
      };
    }

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', resetGesture, { passive: true });
    container.addEventListener('touchcancel', resetGesture, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', resetGesture);
      container.removeEventListener('touchcancel', resetGesture);
    };
  }, [timelineScrollContainerRef]);


  if (lanes.length === 0) {
    return (
      <section className="admin-timeline-empty" aria-live="polite">
        <p className="muted">No barber lanes available for timeline yet.</p>
      </section>
    );
  }

  return (
    <section className="admin-timeline" aria-label={`Timeline for ${selectedDate}`} style={timelineLayoutStyle}>
      <div className="admin-timeline-scroll" ref={timelineScrollContainerRef}>
        <div className="admin-timeline-scale-row">
          <div className="admin-timeline-barber-header">Barber</div>
          <div className="admin-timeline-scale" role="presentation">
            {ticks.minorTicks.map((minute) => (
              <span
                key={`minor-${minute}`}
                className="admin-timeline-tick admin-timeline-tick--minor"
                style={{ left: `${(minute / TIMELINE_TOTAL_MINUTES) * 100}%` }}
              />
            ))}
            {ticks.majorTicks.map((tick) => (
              <span
                key={`major-${tick.minute}`}
                className={`admin-timeline-tick admin-timeline-tick--major ${tick.isHalfHour ? 'admin-timeline-tick--half-hour' : ''}`}
                style={{ left: `${(tick.minute / TIMELINE_TOTAL_MINUTES) * 100}%` }}
              >
                <em>{tick.label}</em>
              </span>
            ))}
            <NowIndicator selectedDate={selectedDate} />
          </div>
        </div>

        {lanes.map((lane) => (
          <div className="admin-timeline-lane-row" key={lane.barber.id}>
            <div className="admin-timeline-lane-label">{lane.barber.name}</div>
            <div className="admin-timeline-lane-canvas" style={{ minHeight: `${lane.laneHeight}px` }}>
              {ticks.majorTicks.map((tick) => (
                <span
                  key={`grid-${lane.barber.id}-${tick.minute}`}
                  className="admin-timeline-grid-line"
                  style={{ left: `${(tick.minute / TIMELINE_TOTAL_MINUTES) * 100}%` }}
                />
              ))}

              {lane.timeBlocks.map((item) => (
                <article
                  key={item.id}
                  className="admin-timeline-card admin-timeline-card--block"
                  style={{ left: `${item.leftPct}%`, width: `${item.widthPct}%`, top: `${item.topPx}px`, height: `${item.heightPx}px` }}
                  title={`${item.timeBlock.title} (${item.startLabel}-${item.endLabel})`}
                >
                  <p>{item.timeBlock.title}</p>
                </article>
              ))}

              {lane.bookings.map((item) => (
                <TimelineBookingCard
                  key={item.id}
                  item={item}
                  isSearchActive={isSearchActive}
                  onBookingClick={onBookingClick}
                />

              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="admin-timeline-legend" aria-label="Timeline status legend">
        <span className="admin-timeline-legend-item"><i className="admin-timeline-legend-swatch admin-timeline-legend-swatch--confirmed" aria-hidden="true" />Confirmed</span>
        <span className="admin-timeline-legend-item"><i className="admin-timeline-legend-swatch admin-timeline-legend-swatch--pending" aria-hidden="true" />Pending</span>
        <span className="admin-timeline-legend-item"><i className="admin-timeline-legend-swatch admin-timeline-legend-swatch--cancelled" aria-hidden="true" />Cancelled</span>
        <span className="admin-timeline-legend-item"><i className="admin-timeline-legend-swatch admin-timeline-legend-swatch--rescheduled" aria-hidden="true" />Rescheduled</span>
      </div>
    </section>
  );
}


export default memo(TodayTimeline);