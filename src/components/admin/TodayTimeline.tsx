import React, { memo, useEffect, useMemo, useRef } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { minutesInLondonDay } from '../../lib/booking/time';
import { getBookingStatusTone } from './bookingStatus';
import { SkeletonTimelineRows } from '../skeleton';
import { ArrowRight } from '../lucide-react';
type TimelineBarber = {
  id: string;
  name: string;
};

export type TimelineBooking = {
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
  density: 'compact' | 'standard' | 'detailed';
  durationMinutes: number;
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
  isLoading?: boolean;
  isSearchActive?: boolean;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;

  onBookingClick: (booking: TimelineBooking) => void;
  /** Advance timeline to the next calendar day (London); control lives in the terminal rail beside barber rows. */
  onGoToNextDay?: () => void;
  /** Short label for the next day (e.g. "Tue 3 Apr") for aria-label / title. */
  nextDayShortLabel?: string;
};

const ADMIN_TIMEZONE = 'Europe/London';
const TIMELINE_START_HOUR = 8;
const TIMELINE_END_HOUR = 24;
const TIMELINE_SLOT_INTERVAL_MINUTES = 30;
const TIMELINE_SLOT_WIDTH_REM = 4;
const TIMELINE_TOTAL_MINUTES = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60;
const TIMELINE_TOTAL_SLOTS = TIMELINE_TOTAL_MINUTES / TIMELINE_SLOT_INTERVAL_MINUTES;
/** Fits time + service + client line at compact density */
const BOOKING_CARD_HEIGHT = 64;
const BOOKING_STACK_GAP = 6;
const LANE_INNER_PADDING = 8;
const NOW_INDICATOR_REFRESH_MS = 15000;
const INITIAL_NOW_SCROLL_OFFSET_RATIO = 0.38;
const INITIAL_NOW_SCROLL_RETRY_COUNT = 6;

const TIMELINE_MAJOR_STEP_PCT = (TIMELINE_SLOT_INTERVAL_MINUTES / TIMELINE_TOTAL_MINUTES) * 100;
const TIMELINE_MINOR_STEP_PCT = (15 / TIMELINE_TOTAL_MINUTES) * 100;

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

function getTimelinePositionFromRelativeMinutes(startMinute: number, endMinute: number) {
  const clampedStart = Math.max(0, Math.min(startMinute, TIMELINE_TOTAL_MINUTES));
  const clampedEnd = Math.max(clampedStart, Math.min(endMinute, TIMELINE_TOTAL_MINUTES));
  const widthMinutes = clampedEnd - clampedStart;
  return {
    leftPct: (clampedStart / TIMELINE_TOTAL_MINUTES) * 100,
    widthPct: (widthMinutes / TIMELINE_TOTAL_MINUTES) * 100
  };
}

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
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
      const clampedStartMinute = Math.max(TIMELINE_START_HOUR * 60, Math.min(startMinute, TIMELINE_END_HOUR * 60));
      const clampedEndMinute = Math.max(clampedStartMinute, Math.min(endMinute, TIMELINE_END_HOUR * 60));
      const durationMinutes = Math.max(0, clampedEndMinute - clampedStartMinute);
      const displayDurationRem = (durationMinutes / TIMELINE_SLOT_INTERVAL_MINUTES) * TIMELINE_SLOT_WIDTH_REM;
      const density: PositionedBooking['density'] =
        displayDurationRem < 7 ? 'compact' : displayDurationRem < 10 ? 'standard' : 'detailed';

      let level = 0;
      while (level < activeOverlapEndByLevel.length && activeOverlapEndByLevel[level] > clampedStartMinute) {
        level += 1;
      }
      activeOverlapEndByLevel[level] = clampedEndMinute;

      const position = getTimelinePositionFromRelativeMinutes(
        clampedStartMinute - TIMELINE_START_HOUR * 60,
        clampedEndMinute - TIMELINE_START_HOUR * 60
      );

      return {
        id: booking.id,
        type: 'booking',
        booking,
        density,
        durationMinutes,
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

/** Horizontal anchor on the timeline scale (0 = TIMELINE_START_HOUR, 1 = TIMELINE_END_HOUR) for initial scroll. */
function getTimelineInitialScrollRatio(selectedDate: string): number {
  const todayLondon = formatInTimeZone(new Date(), ADMIN_TIMEZONE, 'yyyy-MM-dd');
  if (selectedDate !== todayLondon) {
    return 0;
  }

  const nowMinute = getCurrentLondonTimelineMinute();
  if (nowMinute < 0) return 0;
  if (nowMinute > TIMELINE_TOTAL_MINUTES) return 1;
  return nowMinute / TIMELINE_TOTAL_MINUTES;
}

function clampScrollLeft(value: number, container: HTMLDivElement) {
  const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
  if (maxScrollLeft <= 0) return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(value, maxScrollLeft));
}

function bookingCardPropsEqual(
  prev: { item: PositionedBooking; isSearchActive: boolean; onBookingClick: (booking: TimelineBooking) => void },
  next: { item: PositionedBooking; isSearchActive: boolean; onBookingClick: (booking: TimelineBooking) => void }
): boolean {
  if (prev.isSearchActive !== next.isSearchActive) return false;
  if (prev.onBookingClick !== next.onBookingClick) return false;
  const a = prev.item;
  const b = next.item;
  if (a.id !== b.id) return false;
  if (a.density !== b.density || a.durationMinutes !== b.durationMinutes) return false;
  if (a.leftPct !== b.leftPct || a.widthPct !== b.widthPct || a.topPx !== b.topPx || a.heightPx !== b.heightPx) return false;
  if (a.startLabel !== b.startLabel || a.endLabel !== b.endLabel) return false;
  const ab = a.booking;
  const bb = b.booking;
  return (
    ab.status === bb.status &&
    ab.rescheduledAt === bb.rescheduledAt &&
    ab.fullName === bb.fullName &&
    (ab.service?.name ?? '') === (bb.service?.name ?? '')
  );
}

const TimelineBookingCard = memo(function TimelineBookingCard({
  item,
  isSearchActive,
  onBookingClick
}: {
  item: PositionedBooking;
  isSearchActive: boolean;
  onBookingClick: (booking: TimelineBooking) => void;
}) {
  const initials = getInitials(item.booking.fullName);
  const tone = getBookingStatusTone(item.booking);

  return (
    <button
      type="button"
      data-booking-id={item.booking.id}
      className={`admin-timeline-card admin-timeline-card--booking admin-timeline-card--${tone} admin-timeline-card--${item.density} ${isSearchActive ? 'admin-timeline-card--search-match' : ''}`}
      data-density={item.density}
      style={{
        left: `${item.leftPct}%`,
        width: `${item.widthPct}%`,
        top: `${item.topPx}px`,
        height: `${item.heightPx}px`
      }}
      onClick={() => onBookingClick(item.booking)}
      title={`${item.startLabel}–${item.endLabel} · ${item.booking.service?.name ?? 'Service'} · ${item.booking.fullName}`}
    >
      <span className="admin-timeline-card-time">{`${item.startLabel}–${item.endLabel}`}</span>
      <strong className="admin-timeline-card-service">{item.booking.service?.name ?? 'Service'}</strong>
      <span className="admin-timeline-card-client-row">
        <span className="admin-timeline-card-initials" aria-hidden="true">
          {initials}
        </span>
        <span className="admin-timeline-card-client">{item.booking.fullName}</span>
      </span>
      <span className="admin-timeline-card-duration" aria-hidden="true">
        {`${Math.max(1, Math.round(item.durationMinutes))} min`}
      </span>
    </button>
  );
}, bookingCardPropsEqual);


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

function TodayTimeline({
  barbers,
  bookings,
  timeBlocks,
  selectedDate,
  isLoading = false,
  isSearchActive = false,
  onBookingClick,
  scrollContainerRef,
  onGoToNextDay,
  nextDayShortLabel
}: TodayTimelineProps) {
  const localScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollContainerRef = scrollContainerRef ?? localScrollContainerRef;
  const autoPositionedDateRef = useRef<string | null>(null);
  const prevLaneCountRef = useRef(0);
  const lanes = useMemo(() => buildLanes(barbers, bookings, timeBlocks), [barbers, bookings, timeBlocks]);
  const ticks = useMemo(() => getTickRows(), []);
  const timelineLayoutStyle = useMemo(
    () =>
      ({
        '--admin-timeline-major-step-pct': `${TIMELINE_MAJOR_STEP_PCT}`,
        '--admin-timeline-minor-step-pct': `${TIMELINE_MINOR_STEP_PCT}`
      }) as React.CSSProperties,

    []
  );
  useEffect(() => {
    if (lanes.length === 0) {
      prevLaneCountRef.current = 0;
      return;
    }

    const previousLaneCount = prevLaneCountRef.current;
    prevLaneCountRef.current = lanes.length;
    const becameReady = previousLaneCount === 0 && lanes.length > 0;

    if (!becameReady && autoPositionedDateRef.current === selectedDate) {
      return;
    }

    let cancelled = false;
    let rafId = 0;
    let timeoutId = 0;

    const applyInitialHorizontalScroll = (attempt: number) => {
      if (cancelled) return;

      const container = timelineScrollContainerRef.current;
      if (!container) {
        if (attempt < INITIAL_NOW_SCROLL_RETRY_COUNT) {
          timeoutId = window.setTimeout(() => {
            rafId = window.requestAnimationFrame(() => applyInitialHorizontalScroll(attempt + 1));
          }, 32);
        }
        return;
      }

      const hasOverflow = container.scrollWidth > container.clientWidth + 1;
      if (!hasOverflow) {
        if (attempt < INITIAL_NOW_SCROLL_RETRY_COUNT) {
          timeoutId = window.setTimeout(() => {
            rafId = window.requestAnimationFrame(() => applyInitialHorizontalScroll(attempt + 1));
          }, 32);
        } else {
          autoPositionedDateRef.current = selectedDate;
        }
        return;
      }

      const ratio = getTimelineInitialScrollRatio(selectedDate);
      const anchorPixel = ratio * container.scrollWidth;
      const targetLeft = anchorPixel - container.clientWidth * INITIAL_NOW_SCROLL_OFFSET_RATIO;
      container.scrollLeft = clampScrollLeft(targetLeft, container);
      autoPositionedDateRef.current = selectedDate;
    };

    rafId = window.requestAnimationFrame(() => applyInitialHorizontalScroll(0));

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [lanes.length, selectedDate]);



  /*
   * Touch / pen: rely on CSS `touch-action: pan-x pinch-zoom` + native overflow-x scrolling only.
   * Custom pointer handlers with passive:false + preventDefault() caused intermittent “dead” vertical
   * scroll when the browser delivered pointer events to the timeline strip (lock / gesture races).
   *
   * Mouse: optional drag-to-pan horizontally (primary button).
   */
  useEffect(() => {
    const container = timelineScrollContainerRef.current;
    if (!container) return;

    let startX = 0;
    let initialScrollLeft = 0;
    let isMouseDragging = false;
    let activePointerId: number | null = null;

    const resetMouse = () => {
      isMouseDragging = false;
      activePointerId = null;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      isMouseDragging = true;
      activePointerId = event.pointerId;
      startX = event.clientX;
      initialScrollLeft = container.scrollLeft;
      try {
        container.setPointerCapture(event.pointerId);
      } catch {
        /* setPointerCapture unsupported or rejected */
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isMouseDragging || event.pointerType !== 'mouse' || activePointerId !== event.pointerId) return;
      event.preventDefault();
      container.scrollLeft = initialScrollLeft + (startX - event.clientX);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || activePointerId !== event.pointerId) return;
      try {
        container.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      resetMouse();
    };

    container.addEventListener('pointerdown', onPointerDown, { passive: true });
    container.addEventListener('pointermove', onPointerMove, { passive: false });
    container.addEventListener('pointerup', onPointerUp, { passive: true });
    container.addEventListener('pointercancel', onPointerUp, { passive: true });
    container.addEventListener('lostpointercapture', resetMouse, { passive: true });

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
      container.removeEventListener('lostpointercapture', resetMouse);
    };
  }, [timelineScrollContainerRef]);


  if (isLoading) {
    return <SkeletonTimelineRows lanes={Math.max(barbers.length, 3)} />;
  }

  if (lanes.length === 0) {
    return (
      <section className="admin-timeline-empty" aria-live="polite">
        <p className="muted">No barber lanes available for timeline yet.</p>
      </section>
    );
  }

  const showTerminalRail = Boolean(onGoToNextDay);
  const nextDayA11y = nextDayShortLabel ? `Next day, ${nextDayShortLabel}` : 'Next day';

  return (
    <section className="admin-timeline" aria-label={`Timeline for ${selectedDate}`} style={timelineLayoutStyle}>
      <div className="admin-timeline-scroll" ref={timelineScrollContainerRef}>
        <div
          className={`admin-timeline-matrix${showTerminalRail ? ' admin-timeline-matrix--terminal' : ''}`}
        >
          <div className="admin-timeline-barber-header" style={{ gridColumn: 1, gridRow: 1 }}>
            Barber
          </div>
          <div className="admin-timeline-scale" role="presentation" style={{ gridColumn: 2, gridRow: 1 }}>
            {ticks.minorTicks.map((minute) => (
              <span
                key={`minor-${minute}`}
                className="admin-timeline-tick admin-timeline-tick--minor"
                style={{ left: `${(minute / TIMELINE_TOTAL_MINUTES) * 100}%` }}
              />
            ))}
            {ticks.majorTicks.map((tick) => {
              const isDayEnd = tick.minute === TIMELINE_TOTAL_MINUTES;
              return (
                <span
                  key={`major-${tick.minute}`}
                  className={`admin-timeline-tick admin-timeline-tick--major ${tick.isHalfHour ? 'admin-timeline-tick--half-hour' : ''}${isDayEnd ? ' admin-timeline-tick--day-end' : ''}`}
                  style={{ left: `${(tick.minute / TIMELINE_TOTAL_MINUTES) * 100}%` }}
                >
                  <em>{tick.label}</em>
                </span>
              );
            })}
            <NowIndicator selectedDate={selectedDate} />
          </div>
          {showTerminalRail ? (
            <div className="admin-timeline-terminal-header" aria-hidden="true" style={{ gridColumn: 3, gridRow: 1 }} />
          ) : null}

          {lanes.map((lane, laneIndex) => {
            const laneRow = laneIndex + 2;
            const stripe = laneIndex % 2 === 0;
            return (
              <React.Fragment key={lane.barber.id}>
                <div
                  className={`admin-timeline-lane-label${stripe ? ' admin-timeline-lane-label--alt' : ''}`}
                  style={{ gridColumn: 1, gridRow: laneRow }}
                >
                  {lane.barber.name}
                </div>
                <div
                  className={`admin-timeline-lane-canvas${stripe ? ' admin-timeline-lane-canvas--alt' : ''}`}
                  style={{ gridColumn: 2, gridRow: laneRow, minHeight: `${lane.laneHeight}px` }}
                >
                  <div className="admin-timeline-lane-grid" aria-hidden="true">
                    {ticks.minorTicks.map((minute) => (
                      <span
                        key={`lane-minor-${lane.barber.id}-${minute}`}
                        className="admin-timeline-grid-line admin-timeline-grid-line--minor"
                        style={{ left: `${(minute / TIMELINE_TOTAL_MINUTES) * 100}%` }}
                      />
                    ))}
                    {ticks.majorTicks.map((tick) => (
                      <span
                        key={`lane-major-${lane.barber.id}-${tick.minute}`}
                        className={`admin-timeline-grid-line admin-timeline-grid-line--major ${tick.isHalfHour ? 'admin-timeline-grid-line--half-hour' : ''}`}
                        style={{ left: `${(tick.minute / TIMELINE_TOTAL_MINUTES) * 100}%` }}
                      />
                    ))}
                  </div>

                  {lane.timeBlocks.map((item) => (
                    <article
                      key={item.id}
                      className="admin-timeline-card admin-timeline-card--block"
                      style={{ left: `${item.leftPct}%`, width: `${item.widthPct}%`, top: `${item.topPx}px`, height: `${item.heightPx}px` }}
                      title={`${item.timeBlock.title} (${item.startLabel}–${item.endLabel})`}
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
              </React.Fragment>
            );
          })}

          {showTerminalRail ? (
            <div
              className="admin-timeline-terminal-rail"
              style={{ gridColumn: 3, gridRow: `2 / ${2 + lanes.length}` }}
            >
              <button
                type="button"
                className="admin-timeline-next-day-rail"
                onClick={onGoToNextDay}
                aria-label={nextDayA11y}
                title={nextDayShortLabel ? `Next day — ${nextDayShortLabel}` : 'Next day'}
              >
                <ArrowRight className="admin-timeline-next-day-rail-icon" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}


export default memo(TodayTimeline);
