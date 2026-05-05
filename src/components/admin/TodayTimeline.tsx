import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { formatInTimeZone } from 'date-fns-tz';
import { minutesInLondonDay } from '../../lib/booking/time';
import { getBookingStatusTone } from './bookingStatus';
import { SkeletonVerticalTimeline } from '../skeleton';
import { ArrowRight, MessageCircle, NotebookPen, User, X } from '../lucide-react';

type TimelineBarber = {
  id: string;
  name: string;
  avatarUrl?: string | null;
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

type TodayTimelineProps = {
  barbers: TimelineBarber[];
  bookings: TimelineBooking[];
  timeBlocks: TimelineTimeBlock[];
  selectedDate: string;
  isLoading?: boolean;
  isSearchActive?: boolean;
  allowInitialNowScroll?: boolean;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  onBookingClick: (booking: TimelineBooking) => void;
  onGoToNextDay?: () => void;
  nextDayShortLabel?: string;
  floatingTopRight?: React.ReactNode;
};

const ADMIN_TIMEZONE = 'Europe/London';
const TIMELINE_START_HOUR = 8;
const TIMELINE_END_HOUR = 24;
const TIMELINE_SLOT_INTERVAL_MINUTES = 30;
const TIMELINE_TOTAL_MINUTES = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60;
const NOW_REFRESH_MS = 15000;
const MAX_VISIBLE_AVATARS = 3;

// ─── Progress track constants ─────────────────────────────────────────────────
const PROGRESS_AVATAR_SIZE = 28; // px — must match --admin-vtl-avatar-size
const AVATAR_LANE_OFFSETS = [0, -8, 8] as const;

// ─── Utility formatters ───────────────────────────────────────────────────────

function formatTimeRange(startAt: string, endAt: string): string {
  const start = formatInTimeZone(new Date(startAt), ADMIN_TIMEZONE, 'HH:mm');
  const end = formatInTimeZone(new Date(endAt), ADMIN_TIMEZONE, 'HH:mm');
  return `${start} – ${end}`;
}

function formatDuration(startAt: string, endAt: string): string {
  const mins = Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function getLondonMinuteOfDay(input: Date | string): number {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return 0;
  return minutesInLondonDay(date);
}

function getLondonRelativeMinute(input: Date | string): number {
  return getLondonMinuteOfDay(input) - TIMELINE_START_HOUR * 60;
}

function getCurrentLondonMinute(): number {
  const now = new Date();
  const hour = Number(formatInTimeZone(now, ADMIN_TIMEZONE, 'HH'));
  const minute = Number(formatInTimeZone(now, ADMIN_TIMEZONE, 'mm'));
  return hour * 60 + minute - TIMELINE_START_HOUR * 60;
}

function getCurrentLondonTimeLabel(): string {
  const now = new Date();
  return formatInTimeZone(now, ADMIN_TIMEZONE, 'HH:mm');
}

// ─── Progress calculation ─────────────────────────────────────────────────────

function formatEndTime(endAt: string): string {
  return formatInTimeZone(new Date(endAt), ADMIN_TIMEZONE, 'HH:mm');
}

function computeBookingProgress(
  booking: TimelineBooking,
  nowMs: number | null,
  trackMaxX: number
): {
  initialX: number;
  targetX: number;
  delaySeconds: number;
  durationSeconds: number;
} {
  if (!nowMs) {
    return { initialX: 0, targetX: 0, delaySeconds: 0, durationSeconds: 0 };
  }

  const startMs = new Date(booking.startAt).getTime();
  const endMs   = new Date(booking.endAt).getTime();
  const durMs   = endMs - startMs;

  if (durMs <= 0 || nowMs >= endMs)
    return {
      initialX: trackMaxX,
      targetX: trackMaxX,
      delaySeconds: 0,
      durationSeconds: 0,
    };

  if (nowMs < startMs) {
    return {
      initialX: 0,
      targetX: trackMaxX,
      delaySeconds: (startMs - nowMs) / 1000,
      durationSeconds: (endMs - startMs) / 1000,
    };
  }

  const progress         = (nowMs - startMs) / durMs;
  const initialX         = progress * trackMaxX;
  const remainingSeconds = (endMs - nowMs) / 1000;
  return {
    initialX,
    targetX: trackMaxX,
    delaySeconds: 0,
    durationSeconds: remainingSeconds,
  };
}

// ─── Data model ──────────────────────────────────────────────────────────────

type BookingAtSlot = {
  booking: TimelineBooking;
  barber: TimelineBarber;
};

type SlotModel = {
  timeLabel: string;
  relativeMinute: number;
  bookings: BookingAtSlot[];
  timeBlocks: TimelineTimeBlock[];
};

type ListItem =
  | { kind: 'slot'; slot: SlotModel }
  | { kind: 'now'; relativeMinute: number; timeLabel: string };

function buildSlotList(
  barbers: TimelineBarber[],
  bookings: TimelineBooking[],
  timeBlocks: TimelineTimeBlock[],
  nowMinute: number | null
): ListItem[] {
  const barberMap = new Map(barbers.map((b) => [b.id, b]));

  // Seed the day timeline so the structure is always visible, even with no data.
  const slotMap = new Map<string, SlotModel>();
  for (let minute = 0; minute <= TIMELINE_TOTAL_MINUTES; minute += TIMELINE_SLOT_INTERVAL_MINUTES) {
    const hour = TIMELINE_START_HOUR + Math.floor(minute / 60);
    const min = minute % 60;
    const timeLabel = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    slotMap.set(timeLabel, { timeLabel, relativeMinute: minute, bookings: [], timeBlocks: [] });
  }

  for (const booking of bookings) {
    const relMin = getLondonRelativeMinute(booking.startAt);
    if (relMin < 0 || relMin > TIMELINE_TOTAL_MINUTES) continue;
    const timeLabel = formatInTimeZone(booking.startAt, ADMIN_TIMEZONE, 'HH:mm');
    if (!slotMap.has(timeLabel)) {
      slotMap.set(timeLabel, { timeLabel, relativeMinute: relMin, bookings: [], timeBlocks: [] });
    }
    const barber = booking.barberId
      ? (barberMap.get(booking.barberId) ?? { id: booking.barberId, name: booking.barber.name })
      : { id: '', name: booking.barber.name };
    slotMap.get(timeLabel)!.bookings.push({ booking, barber });
  }

  for (const block of timeBlocks) {
    const relMin = getLondonRelativeMinute(block.startAt);
    if (relMin < 0 || relMin > TIMELINE_TOTAL_MINUTES) continue;
    const timeLabel = formatInTimeZone(block.startAt, ADMIN_TIMEZONE, 'HH:mm');
    if (!slotMap.has(timeLabel)) {
      slotMap.set(timeLabel, { timeLabel, relativeMinute: relMin, bookings: [], timeBlocks: [] });
    }
    slotMap.get(timeLabel)!.timeBlocks.push(block);
  }

  const slots: ListItem[] = Array.from(slotMap.values())
    .sort((a, b) => a.relativeMinute - b.relativeMinute)
    .map((slot) => ({ kind: 'slot', slot }));

  if (nowMinute !== null && nowMinute >= 0 && nowMinute <= TIMELINE_TOTAL_MINUTES) {
    const nowItem: ListItem = {
      kind: 'now',
      relativeMinute: nowMinute,
      timeLabel: getCurrentLondonTimeLabel(),
    };
    const insertIdx = slots.findIndex(
      (item) => item.kind === 'slot' && item.slot.relativeMinute > nowMinute
    );
    if (insertIdx === -1) {
      slots.push(nowItem);
    } else {
      slots.splice(insertIdx, 0, nowItem);
    }
  }

  return slots;
}

// ─── Booking expansion card ───────────────────────────────────────────────────

type BookingExpansionCardProps = {
  booking: TimelineBooking;
  barber: TimelineBarber;
  toneClass: string;
  onExpand: () => void;
};

const BookingExpansionCard = memo(function BookingExpansionCard({
  booking,
  barber,
  toneClass,
  onExpand,
}: BookingExpansionCardProps) {
  const timeRange = formatTimeRange(booking.startAt, booking.endAt);
  const duration = formatDuration(booking.startAt, booking.endAt);
  const [barberImgError, setBarberImgError] = useState(false);
  const barberInitials = getInitials(barber.name);

  useEffect(() => {
    setBarberImgError(false);
  }, [barber.avatarUrl]);

  const handleQuickActionClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      className={`admin-vtl-expansion-card admin-vtl-expansion-card--${toneClass}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="admin-vtl-expansion-layout">
        <div className="admin-vtl-expansion-avatars" aria-hidden="true">
          <div className="admin-vtl-expansion-avatar admin-vtl-expansion-avatar--barber">
            {barber.avatarUrl && !barberImgError ? (
              <img
                src={barber.avatarUrl}
                alt={barber.name}
                className="admin-vtl-expansion-avatar-img"
                loading="lazy"
                onError={() => setBarberImgError(true)}
              />
            ) : (
              <span className="admin-vtl-expansion-avatar-initials">{barberInitials}</span>
            )}
          </div>
          <div className="admin-vtl-expansion-avatar admin-vtl-expansion-avatar--client-placeholder">
            <User className="admin-vtl-expansion-avatar-placeholder-icon" aria-hidden />
          </div>
        </div>

        <div className="admin-vtl-expansion-main">
          <p className="admin-vtl-expansion-time">{timeRange}</p>
          <p className="admin-vtl-expansion-service">{booking.service.name}</p>
          <p className="admin-vtl-expansion-client">{booking.fullName}</p>
        </div>

        <div className="admin-vtl-expansion-actions">
          <button
            type="button"
            className="admin-vtl-expansion-action-btn admin-vtl-expansion-action-btn--cancel"
            onClick={handleQuickActionClick}
            aria-label={`Cancel booking for ${booking.fullName}`}
            title="Cancel booking"
          >
            <X className="admin-vtl-expansion-action-icon" aria-hidden />
          </button>
          <button
            type="button"
            className="admin-vtl-expansion-action-btn admin-vtl-expansion-action-btn--notes"
            onClick={handleQuickActionClick}
            aria-label={`Open notes for ${booking.fullName}`}
            title="Notes"
          >
            <NotebookPen className="admin-vtl-expansion-action-icon" aria-hidden />
          </button>
          <button
            type="button"
            className="admin-vtl-expansion-action-btn admin-vtl-expansion-action-btn--message"
            onClick={handleQuickActionClick}
            aria-label={`Message ${booking.fullName}`}
            title="Message"
          >
            <MessageCircle className="admin-vtl-expansion-action-icon" aria-hidden />
          </button>
        </div>
      </div>

      <div className="admin-vtl-expansion-footer">
        <span className="admin-vtl-expansion-duration">{duration}</span>
        <button
          type="button"
          className="admin-vtl-expansion-more"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          aria-label={`Open full details for ${booking.fullName}`}
        >
          <span>See more</span>
          <ArrowRight className="admin-vtl-expansion-more-icon" aria-hidden />
        </button>
      </div>
    </div>
  );
});

// ─── Avatar pin (progress-track version) ─────────────────────────────────────

type BarberAvatarPinProps = {
  barber: TimelineBarber;
  booking: TimelineBooking;
  onAvatarClick: (booking: TimelineBooking) => void;
  isSearchActive: boolean;
  toneClass: string;
  isActive: boolean;
  initialX: number;
  targetX: number;
  delaySeconds: number;
  durationSeconds: number;
  baseZIndex: number;
  laneOffsetY: number;
};

const BarberAvatarPin = memo(function BarberAvatarPin({
  barber,
  booking,
  onAvatarClick,
  isSearchActive,
  toneClass,
  isActive,
  initialX,
  targetX,
  delaySeconds,
  durationSeconds,
  baseZIndex,
  laneOffsetY,
}: BarberAvatarPinProps) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(barber.name);
  const reduceMotion = useReducedMotion();

  // Initialise the MotionValue imperatively so the avatar starts at the correct
  // progress point regardless of any parent AnimatePresence initial={false}.
  const x = useMotionValue(initialX);
  const RESYNC_EPSILON_PX = 6;

  useEffect(() => {
    setImgError(false);
  }, [barber.avatarUrl]);

  useEffect(() => {
    const currentX = x.get();
    if (!Number.isFinite(currentX) || Math.abs(currentX - initialX) > RESYNC_EPSILON_PX) {
      x.set(initialX);
    }
  }, [initialX, x]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onAvatarClick(booking);
    },
    [onAvatarClick, booking]
  );

  const label = `${barber.name} — ${booking.service.name} — ${booking.fullName}`;

  // Linear progress animation; re-renders every 15 s (nowMinute tick) update
  // duration/delay so Framer Motion continues from the current visual position
  // without a jump. With reduceMotion, position snaps immediately.
  const xTransition = reduceMotion || durationSeconds <= 0
    ? { duration: 0 }
    : { delay: delaySeconds, duration: durationSeconds, ease: 'linear' as const };

  // For reduced motion users, keep the avatar at the correct position *at now*,
  // rather than jumping to targetX.
  const animateX = reduceMotion ? initialX : targetX;

  return (
    <motion.button
      type="button"
      className={[
        'admin-vtl-avatar',
        `admin-vtl-avatar--${toneClass}`,
        isSearchActive ? 'admin-vtl-avatar--search' : '',
        isActive ? 'admin-vtl-avatar--active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        position: 'absolute',
        top: '50%',
        marginTop: `-${PROGRESS_AVATAR_SIZE / 2}px`,
        zIndex: isActive ? MAX_VISIBLE_AVATARS + 1 : baseZIndex,
        x,
        y: laneOffsetY,
      }}
      animate={{ x: animateX, scale: isActive ? 1.08 : 1 }}
      transition={{
        x: xTransition,
        scale: { duration: 0.12, ease: [0.4, 0, 0.2, 1] },
      }}
      whileHover={{ scale: isActive ? 1.1 : 1.07 }}
      whileTap={{ scale: 0.97 }}
      onClick={handleClick}
      aria-expanded={isActive}
      aria-label={label}
      title={label}
    >
      {barber.avatarUrl && !imgError ? (
        <img
          src={barber.avatarUrl}
          alt={barber.name}
          className="admin-vtl-avatar-img"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="admin-vtl-avatar-initials" aria-hidden="true">
          {initials}
        </span>
      )}
    </motion.button>
  );
});

// ─── Progress track (replaces cluster + slot-line for booking slots) ──────────

type ProgressTrackProps = {
  items: BookingAtSlot[];
  nowMs: number | null;
  activeBookingId: string | null;
  isSearchActive: boolean;
  onAvatarClick: (booking: TimelineBooking) => void;
};

const ProgressTrack = memo(function ProgressTrack({
  items,
  nowMs,
  activeBookingId,
  isSearchActive,
  onAvatarClick,
}: ProgressTrackProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const visible  = items.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = items.length - MAX_VISIBLE_AVATARS;
  const trackMaxX = Math.max(trackWidth - PROGRESS_AVATAR_SIZE, 0);
  const latestVisibleEndTime = useMemo(() => {
    if (visible.length === 0) return '';
    return visible.reduce((latest, item) => {
      return new Date(item.booking.endAt).getTime() > new Date(latest.endAt).getTime()
        ? item.booking
        : latest;
    }, visible[0].booking).endAt;
  }, [visible]);

  useEffect(() => {
    const element = trackRef.current;
    if (!element) return;

    const updateWidth = () => {
      setTrackWidth((prev) => {
        const next = Math.round(element.getBoundingClientRect().width);
        return prev === next ? prev : next;
      });
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="admin-vtl-progress-lane">
        {overflow > 0 && (
          <span
            className="admin-vtl-avatar-overflow"
            aria-label={`${overflow} more booking${overflow === 1 ? '' : 's'}`}
          >
            +{overflow}
          </span>
        )}
        <div ref={trackRef} className="admin-vtl-progress-track">
          <div className="admin-vtl-slot-line" aria-hidden="true" />
          {visible.map(({ booking, barber }, index) => {
            const tone = getBookingStatusTone(booking);
            const { initialX, targetX, delaySeconds, durationSeconds } = computeBookingProgress(
              booking,
              nowMs,
              trackMaxX
            );
            return (
              <BarberAvatarPin
                key={booking.id}
                barber={barber}
                booking={booking}
                toneClass={tone}
                isActive={booking.id === activeBookingId}
                isSearchActive={isSearchActive}
                onAvatarClick={onAvatarClick}
                initialX={initialX}
                targetX={targetX}
                delaySeconds={delaySeconds}
                durationSeconds={durationSeconds}
                baseZIndex={MAX_VISIBLE_AVATARS - index}
                laneOffsetY={AVATAR_LANE_OFFSETS[index] ?? 0}
              />
            );
          })}
        </div>
      </div>
      <time className="admin-vtl-slot-end-time" dateTime={latestVisibleEndTime || undefined}>
        {latestVisibleEndTime ? formatEndTime(latestVisibleEndTime) : ''}
      </time>
    </>
  );
});

// ─── Now row ──────────────────────────────────────────────────────────────────

type NowRowProps = { timeLabel: string };

const NowRow = memo(function NowRow({ timeLabel }: NowRowProps) {
  return (
    <div className="admin-vtl-now-row" aria-hidden="true">
      <span className="admin-vtl-now-time">{timeLabel}</span>
      <div className="admin-vtl-now-track">
        <span className="admin-vtl-now-dot" />
        <div className="admin-vtl-now-line" />
      </div>
    </div>
  );
});

// ─── Slot row (with inline expansion) ────────────────────────────────────────

type SlotRowProps = {
  slotKey: string;
  slot: SlotModel;
  nowMs: number | null;
  isExpanded: boolean;
  activeBookingId: string | null;
  onAvatarClick: (slotKey: string, booking: TimelineBooking) => void;
  onSlotToggle: (slotKey: string) => void;
  onExpand: (booking: TimelineBooking) => void;
  isSearchActive: boolean;
};

const SlotRow = memo(function SlotRow({
  slotKey,
  slot,
  nowMs,
  isExpanded,
  activeBookingId,
  onAvatarClick,
  onSlotToggle,
  onExpand,
  isSearchActive,
}: SlotRowProps) {
  const hasBookings = slot.bookings.length > 0;
  const hasBlocks = slot.timeBlocks.length > 0;
  const expansionId = `admin-vtl-expansion-${slotKey.replace(/[^a-z0-9_-]/gi, '-')}`;

  const handleSlotToggle = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      if (!hasBookings) return;
      onSlotToggle(slotKey);
    },
    [hasBookings, onSlotToggle, slotKey]
  );

  const handleSlotKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!hasBookings) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSlotToggle(e);
      }
    },
    [handleSlotToggle, hasBookings]
  );

  const handleSlotAvatarClick = useCallback(
    (booking: TimelineBooking) => {
      onAvatarClick(slotKey, booking);
    },
    [onAvatarClick, slotKey]
  );

  return (
    <motion.div
      layout="position"
      className="admin-vtl-slot-group"
      aria-label={`${slot.timeLabel}${hasBookings ? ` — ${slot.bookings.length} booking${slot.bookings.length === 1 ? '' : 's'}` : ''}${hasBlocks ? ` — ${slot.timeBlocks.length} block${slot.timeBlocks.length === 1 ? '' : 's'}` : ''}`}
      role="group"
    >
      <div
        className={`admin-vtl-slot${hasBookings ? ' admin-vtl-slot--interactive' : ''}`}
        role={hasBookings ? 'button' : undefined}
        tabIndex={hasBookings ? 0 : undefined}
        aria-expanded={hasBookings ? isExpanded : undefined}
        aria-controls={hasBookings ? expansionId : undefined}
        onClick={handleSlotToggle}
        onKeyDown={handleSlotKeyDown}
      >
        <time className="admin-vtl-slot-time" dateTime={slot.timeLabel}>
          {slot.timeLabel}
        </time>
        <div className="admin-vtl-slot-body">
          {hasBookings ? (
            <ProgressTrack
              items={slot.bookings}
              nowMs={nowMs}
              activeBookingId={activeBookingId}
              isSearchActive={isSearchActive}
              onAvatarClick={handleSlotAvatarClick}
            />
          ) : (
            <>
              {hasBlocks && (
                <div className="admin-vtl-blocks">
                  {slot.timeBlocks.map((block) => (
                    <span key={block.id} className="admin-vtl-block-chip" title={block.title}>
                      {block.title}
                    </span>
                  ))}
                </div>
              )}
              <div
                className={`admin-vtl-slot-line${
                  hasBlocks
                    ? ' admin-vtl-slot-line--block'
                    : ' admin-vtl-slot-line--empty'
                }`}
                aria-hidden="true"
              />
            </>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && hasBookings && (
          <motion.div
            key={slotKey}
            id={expansionId}
            className="admin-vtl-expansion"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-vtl-expansion-list">
              {slot.bookings.map(({ booking, barber }) => (
                <BookingExpansionCard
                  key={booking.id}
                  booking={booking}
                  barber={barber}
                  toneClass={getBookingStatusTone(booking)}
                  onExpand={() => onExpand(booking)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

function TodayTimeline({
  barbers,
  bookings,
  timeBlocks,
  selectedDate,
  isLoading = false,
  isSearchActive = false,
  allowInitialNowScroll = true,
  onBookingClick,
  scrollContainerRef,
  onGoToNextDay,
  nextDayShortLabel,
  floatingTopRight,
}: TodayTimelineProps) {
  const localScrollRef = useRef<HTMLDivElement | null>(null);
  const activeScrollRef = scrollContainerRef ?? localScrollRef;
  const nowRowRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledToNow = useRef(false);
  const scrollToNowRafRefs = useRef<{ first: number | null; second: number | null }>({ first: null, second: null });

  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [expandedSlotKey, setExpandedSlotKey] = useState<string | null>(null);

  const handleAvatarClick = useCallback((slotKey: string, booking: TimelineBooking) => {
    setExpandedSlotKey(slotKey);
    setActiveBookingId((prev) => (prev === booking.id ? null : booking.id));
  }, []);

  const handleSlotToggle = useCallback((slotKey: string) => {
    setExpandedSlotKey((prev) => (prev === slotKey ? null : slotKey));
  }, []);

  const handleExpand = useCallback(
    (booking: TimelineBooking) => {
      onBookingClick(booking);
      setExpandedSlotKey(null);
      setActiveBookingId(null);
    },
    [onBookingClick]
  );

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpandedSlotKey(null);
        setActiveBookingId(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const todayLondon = formatInTimeZone(new Date(), ADMIN_TIMEZONE, 'yyyy-MM-dd');
  const isToday = selectedDate === todayLondon;

  const [nowMinute, setNowMinute] = useState<number | null>(() =>
    isToday ? getCurrentLondonMinute() : null
  );
  const [nowTimeLabel, setNowTimeLabel] = useState<string>(() =>
    isToday ? getCurrentLondonTimeLabel() : ''
  );

  useEffect(() => {
    if (!isToday) {
      setNowMinute(null);
      setNowTimeLabel('');
      return;
    }
    const tick = () => {
      setNowMinute(getCurrentLondonMinute());
      setNowTimeLabel(getCurrentLondonTimeLabel());
    };
    tick();
    const id = window.setInterval(tick, NOW_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [isToday, selectedDate]);

  // nowMs drives the progress animation in BarberAvatarPin. It is recomputed
  // every 15 s when nowMinute updates so Framer Motion gets fresh remaining-
  // duration values and continues each avatar's linear animation smoothly —
  // no requestAnimationFrame loop required between ticks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nowMs = useMemo(() => (isToday ? Date.now() : null), [nowMinute, isToday]);

  const items = useMemo(
    () => buildSlotList(barbers, bookings, timeBlocks, nowMinute),
    [barbers, bookings, timeBlocks, nowMinute]
  );

  useEffect(() => {
    if (!isToday || !allowInitialNowScroll || hasScrolledToNow.current) return;
    const el = nowRowRef.current;
    if (!el) return;
    hasScrolledToNow.current = true;
    scrollToNowRafRefs.current.first = window.requestAnimationFrame(() => {
      scrollToNowRafRefs.current.first = null;
      scrollToNowRafRefs.current.second = window.requestAnimationFrame(() => {
        scrollToNowRafRefs.current.second = null;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    return () => {
      if (scrollToNowRafRefs.current.first !== null) {
        window.cancelAnimationFrame(scrollToNowRafRefs.current.first);
        scrollToNowRafRefs.current.first = null;
      }
      if (scrollToNowRafRefs.current.second !== null) {
        window.cancelAnimationFrame(scrollToNowRafRefs.current.second);
        scrollToNowRafRefs.current.second = null;
      }
    };
  }, [allowInitialNowScroll, isToday, items]);

  useEffect(() => {
    hasScrolledToNow.current = false;
  }, [selectedDate]);

  // Close expansion when clicking the empty scroll area
  const handleScrollClick = useCallback(() => {
    setExpandedSlotKey(null);
    setActiveBookingId(null);
  }, []);

  if (isLoading) {
    return <SkeletonVerticalTimeline />;
  }

  const hasAnyBookings = bookings.length > 0;
  const nextDayA11y = nextDayShortLabel ? `Next day — ${nextDayShortLabel}` : 'Next day';

  return (
    <section className="admin-vtl" aria-label={`Timeline for ${selectedDate}`}>
      {floatingTopRight ? (
        <div className="admin-vtl-floating-slot">{floatingTopRight}</div>
      ) : null}
      <div className="admin-vtl-scroll" ref={activeScrollRef} onClick={handleScrollClick}>
        {!hasAnyBookings ? (
          <div className="admin-vtl-empty-overlay" aria-live="polite">
            <p>This day is completely free</p>
          </div>
        ) : null}
        {items.map((item, idx) => {
          if (item.kind === 'now') {
            return (
              <div key="now-indicator" ref={nowRowRef}>
                <NowRow timeLabel={nowTimeLabel || item.timeLabel} />
              </div>
            );
          }
          return (
            <SlotRow
              key={item.slot.timeLabel + idx}
              slotKey={item.slot.timeLabel}
              slot={item.slot}
              nowMs={nowMs}
              isExpanded={expandedSlotKey === item.slot.timeLabel}
              activeBookingId={activeBookingId}
              onAvatarClick={handleAvatarClick}
              onSlotToggle={handleSlotToggle}
              onExpand={handleExpand}
              isSearchActive={isSearchActive}
            />
          );
        })}
      </div>

      {onGoToNextDay && (
        <button
          type="button"
          className="admin-vtl-next-day-btn"
          onClick={onGoToNextDay}
          aria-label={nextDayA11y}
          title={nextDayShortLabel ? `Next day — ${nextDayShortLabel}` : 'Next day'}
        >
          <span>{nextDayShortLabel ?? 'Next day'}</span>
          <ArrowRight className="admin-vtl-next-day-icon" aria-hidden />
        </button>
      )}
    </section>
  );
}

export default memo(TodayTimeline);
