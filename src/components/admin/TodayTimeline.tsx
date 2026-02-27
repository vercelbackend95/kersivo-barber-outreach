import React, { memo, useEffect, useMemo, useRef } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { getServiceCode } from '../../lib/booking/serviceCode';
import { minutesInLondonDay } from '../../lib/booking/time';
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
  service: { name: string };
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
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;

  onBookingClick: (booking: TimelineBooking) => void;
};

const ADMIN_TIMEZONE = 'Europe/London';
const TIMELINE_START_HOUR = 10;
const TIMELINE_END_HOUR = 18;
const TIMELINE_TOTAL_MINUTES = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60;
const BOOKING_CARD_HEIGHT = 56;
const BOOKING_STACK_GAP = 6;
const LANE_INNER_PADDING = 8;
const NOW_INDICATOR_REFRESH_MS = 15000;
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


function getBookingTimelineStatus(booking: TimelineBooking) {
  if (booking.status.startsWith('CANCELLED')) return 'cancelled';
  if (booking.status === 'PENDING_CONFIRMATION') return 'pending';
  const hasRescheduledFlag = Boolean(booking.rescheduledAt) || booking.status.includes('RESCHEDULED');
  if (hasRescheduledFlag) return 'rescheduled';
  if (booking.status === 'CONFIRMED') return 'confirmed';
  return 'pending';
}


function buildLanes(barbers: TimelineBarber[], bookings: TimelineBooking[], timeBlocks: TimelineTimeBlock[]): LaneModel[] {
  const allBarbersById = new Map(barbers.map((barber) => [barber.id, barber]));
  const fallbackBarbers = new Map<string, TimelineBarber>();

  for (const booking of bookings) {
    const barberId = booking.barberId;
    if (!barberId || allBarbersById.has(barberId) || fallbackBarbers.has(barberId)) continue;
    fallbackBarbers.set(barberId, { id: barberId, name: booking.barber?.name ?? 'Barber' });
  }

  const mergedBarbers = [...barbers, ...fallbackBarbers.values()];

  return mergedBarbers.map((barber) => {
    const laneBookings = bookings
      .filter((booking) => booking.barberId === barber.id)
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
  const majorTicks: Array<{ minute: number; label: string }> = [];
  const minorTicks: number[] = [];

  for (let minute = 0; minute <= TIMELINE_TOTAL_MINUTES; minute += 15) {
    const isMajor = minute % 30 === 0;
    if (isMajor) {
      const hour = TIMELINE_START_HOUR + Math.floor(minute / 60);
      const min = minute % 60;
      majorTicks.push({
        minute,
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

function TodayTimeline({ barbers, bookings, timeBlocks, selectedDate, onBookingClick, scrollContainerRef }: TodayTimelineProps) {
  const lanes = useMemo(() => buildLanes(barbers, bookings, timeBlocks), [barbers, bookings, timeBlocks]);
  const ticks = useMemo(() => getTickRows(), []);



  if (lanes.length === 0) {
    return (
      <section className="admin-timeline-empty" aria-live="polite">
        <p className="muted">No barber lanes available for timeline yet.</p>
      </section>
    );
  }

  return (
    <section className="admin-timeline" aria-label={`Timeline for ${selectedDate}`}>
      <div className="admin-timeline-scroll" ref={scrollContainerRef}>
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
                className="admin-timeline-tick admin-timeline-tick--major"
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
                <button
                  type="button"
                  key={item.id}
                  className={`admin-timeline-card admin-timeline-card--booking admin-timeline-card--${getBookingTimelineStatus(item.booking)}`}
                  style={{ left: `${item.leftPct}%`, width: `${item.widthPct}%`, top: `${item.topPx}px`, height: `${item.heightPx}px` }}
                  onClick={() => onBookingClick(item.booking)}
                                    title={`${item.startLabel} · ${item.booking.service?.name ?? 'Service'} · ${item.booking.fullName}`}
                >
                  <span className="admin-timeline-card-time">{item.startLabel}</span>
                  <strong className="admin-timeline-card-service">{getServiceCode(item.booking.service?.name ?? '')}</strong>
                </button>
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