import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { formatInTimeZone } from 'date-fns-tz';
import { minutesInLondonDay } from '../../lib/booking/time';
import { getEffectiveBookingStatus, getManualBookingActionOptions } from '../../lib/booking/operationalStatus';
import { getBookingPaymentChipState } from '../../lib/booking/paymentReporting';
import { getBookingStatusTone, getStatusLabel } from './bookingStatus';
import { SkeletonVerticalTimeline } from '../skeleton';
import { ArrowRight, ListOrdered, MessageCircle, Plus, User, X } from '../lucide-react';
import ClientProfilePanel from './ClientProfilePanel';
import { adminFetchJson, ADMIN_DEMO_BLOCKED_EVENT } from './adminAuth';
import { resolveClientIdForBooking } from '../../lib/admin/resolveClientIdForBooking';

type TimelineBarber = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

export type TimelineBooking = {
  id: string;
  fullName: string;
  /** Null when the viewer is not allowed to see the client's email. */
  email: string | null;
  phone?: string | null;
  clientTags?: string[];
  clientAvatarUrl?: string | null;
  status: string;
  startAt: string;
  endAt: string;
  barberId?: string;
  clientId?: string | null;
  notes?: string | null;
  rescheduledAt?: string | null;
  barber: { name: string };
  service: { id?: string; name: string };
  paymentRequired?: boolean;
  depositAmountPence?: number | null;
  paymentStatus?: string | null;
  totalPricePence?: number | null;
  servicePricePenceAtBooking?: number | null;
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
  /**
   * Preview/landing embeds: when provided, tapping a client profile routes to
   * this handler instead of opening the real ClientProfilePanel (and skips the
   * client-lookup fetch). Admin usage leaves this undefined for normal behavior.
   */
  onClientProfileIntercept?: (booking: TimelineBooking) => void;
  /**
   * Preview/landing embeds: force the mobile-style swipe interaction on every
   * viewport, enabling mouse-drag + wheel navigation of the expansion panels
   * and a one-time animated swipe hint. Real admin leaves this undefined.
   */
  previewSwipe?: boolean;
  /** Deep-link: expand the slot and scroll to this booking once present. */
  focusBookingId?: string | null;
  onFocusBookingHandled?: (bookingId: string) => void;
  /** Linked roster id for BARBER; null for Owner/Manager. */
  sessionBarberId?: string | null;
  /** When true, actor can change service and use shop cancel/reschedule. */
  canManageBookings?: boolean;
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

type SwipeState = 'closed' | 'left' | 'right';

type ServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
  pricePence: number;
};

type BookingExpansionCardProps = {
  booking: TimelineBooking;
  barber: TimelineBarber;
  toneClass: string;
  onExpand: () => void;
  onStatusChange?: (bookingId: string, newStatus: string) => void;
  onClientProfile?: (booking: TimelineBooking) => void;
  isClientProfileLoading?: boolean;
  /** Preview embeds: enable mouse-drag + wheel swipe navigation. */
  previewSwipe?: boolean;
  /** Preview embeds: show the one-time animated swipe hint on this card. */
  showSwipeHint?: boolean;
  /** Can mutate this booking (own seat or shop manager). */
  canMutateBooking?: boolean;
  /** Can replace service (Owner/Manager with bookings.manage). */
  canChangeService?: boolean;
  /** Status menu scope: barber day-of only, or full shop actions. */
  actionRoleScope?: 'barber' | 'shop';
};

const CLIENT_PANEL_W = 120;
const ACTIONS_PANEL_W = 200;

const SWIPE_THRESHOLD = 60;

// Step one panel at a time relative to the current state so the center ("Main")
// card stays reachable from either side. Panel order (left→right of revealed
// content): client panel ('left') · main ('closed') · actions ('right').
function stepSwipe(current: SwipeState, delta: number): SwipeState {
  const order: SwipeState[] = ['left', 'closed', 'right'];
  const idx = order.indexOf(current);
  if (delta >= SWIPE_THRESHOLD) return order[Math.max(0, idx - 1)];
  if (delta <= -SWIPE_THRESHOLD) return order[Math.min(order.length - 1, idx + 1)];
  return current;
}
function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

type StatusMenuItem = {
  value: 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED_BY_SHOP' | 'RESCHEDULE';
  label: string;
  enabled: boolean;
  reason: string;
};

const BookingExpansionCard = memo(function BookingExpansionCard({
  booking,
  barber,
  toneClass,
  onExpand,
  onStatusChange,
  onClientProfile,
  isClientProfileLoading = false,
  previewSwipe = false,
  showSwipeHint = false,
  canMutateBooking = true,
  canChangeService = true,
  actionRoleScope = 'shop',
}: BookingExpansionCardProps) {
  const timeRange = formatTimeRange(booking.startAt, booking.endAt);
  const duration = formatDuration(booking.startAt, booking.endAt);
  const [barberImgError, setBarberImgError] = useState(false);
  const [clientImgError, setClientImgError] = useState(false);
  const barberInitials = getInitials(barber.name);
  const clientInitials = getInitials(booking.fullName);
  const hasClientAvatar = Boolean(booking.clientAvatarUrl?.trim()) && !clientImgError;
  const clientTags = (booking.clientTags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean);

  // ── Swipe tri-state ───────────────────────────────────────────────────────────
  const [swipeState, setSwipeState] = useState<SwipeState>('closed');
  const swipeStateRef = useRef<SwipeState>('closed');
  const trackRef = useRef<HTMLDivElement>(null);
  const swipeRootRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swipeAxis = useRef<'undecided' | 'h' | 'v'>('undecided');
  const isDragging = useRef(false);
  const didDragRef = useRef(false);
  const wheelCooldownRef = useRef(0);
  const [hintVisible, setHintVisible] = useState(showSwipeHint);

  useEffect(() => {
    swipeStateRef.current = swipeState;
  }, [swipeState]);

  // ── Optimistic status ─────────────────────────────────────────────────────────
  const [localStatus, setLocalStatus] = useState(booking.status);
  const [isMobileView, setIsMobileView] = useState(false);
  const [isStatusSheetOpen, setIsStatusSheetOpen] = useState(false);
  const [isServiceSheetOpen, setIsServiceSheetOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [serviceError, setServiceError] = useState('');

  // ── Service picker ────────────────────────────────────────────────────────────
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [pendingService, setPendingService] = useState<ServiceOption | null>(null);
  const [serviceReplaceLoading, setServiceReplaceLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const sync = () => setIsMobileView(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    setBarberImgError(false);
  }, [barber.avatarUrl]);

  useEffect(() => {
    setClientImgError(false);
  }, [booking.clientAvatarUrl]);

  useEffect(() => {
    setLocalStatus(booking.status);
  }, [booking.status]);

  // Sync CSS class when swipeState changes — clear inline transform
  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = '';
    }
    if (swipeState !== 'right') {
      setIsStatusSheetOpen(false);
      setIsServiceSheetOpen(false);
      setPendingService(null);
    }
  }, [swipeState]);

  useEffect(() => {
    if (!isMobileView) return undefined;
    if (!(isStatusSheetOpen || isServiceSheetOpen)) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileView, isStatusSheetOpen, isServiceSheetOpen]);

  useEffect(() => {
    if (!(isStatusSheetOpen || isServiceSheetOpen)) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (pendingService) {
        setPendingService(null);
        setServiceError('');
        return;
      }
      setIsStatusSheetOpen(false);
      setIsServiceSheetOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isStatusSheetOpen, isServiceSheetOpen, pendingService]);

  // ── Status mutation ───────────────────────────────────────────────────────────
  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      const prev = localStatus;
      setLocalStatus(newStatus);
      setActionError('');
      try {
        await adminFetchJson(`/api/admin/bookings/${booking.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
          errorMessage: 'Could not update booking status.',
        });
        onStatusChange?.(booking.id, newStatus);
        setIsStatusSheetOpen(false);
      } catch (error) {
        setLocalStatus(prev);
        setActionError(error instanceof Error ? error.message : 'Could not update booking status.');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [booking.id, localStatus, onStatusChange],
  );

  // ── Service picker helpers ────────────────────────────────────────────────────
  const openServicePicker = useCallback(async () => {
    setServiceLoading(true);
    setServiceError('');
    try {
      const data = await adminFetchJson<{ services?: ServiceOption[] }>('/api/admin/services', {
        errorMessage: 'Could not load services.',
      });
      setServices(data.services ?? []);
    } catch (error) {
      setServices([]);
      setServiceError(error instanceof Error ? error.message : 'Could not load services.');
    } finally {
      setServiceLoading(false);
    }
  }, []);

  const isSameBookingService = useCallback(
    (svc: ServiceOption) => {
      if (booking.service.id && svc.id === booking.service.id) return true;
      return svc.name === booking.service.name;
    },
    [booking.service.id, booking.service.name],
  );

  const handleServiceReplace = useCallback(
    async (serviceId: string) => {
      setServiceError('');
      setServiceReplaceLoading(true);
      try {
        await adminFetchJson(`/api/admin/bookings/${booking.id}/service`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceId }),
          errorMessage: 'Could not update booking service.',
        });
        setPendingService(null);
        setIsServiceSheetOpen(false);
        onStatusChange?.(booking.id, localStatus);
      } catch (error) {
        setServiceError(error instanceof Error ? error.message : 'Could not update booking service.');
      } finally {
        setServiceReplaceLoading(false);
      }
    },
    [booking.id, localStatus, onStatusChange],
  );

  const confirmServiceReplace = useCallback(() => {
    if (!pendingService || serviceReplaceLoading) return;
    void handleServiceReplace(pendingService.id);
  }, [pendingService, serviceReplaceLoading, handleServiceReplace]);

  const handleServiceOptionSelect = useCallback(
    (svc: ServiceOption) => {
      setServiceError('');
      if (isSameBookingService(svc)) {
        setPendingService(null);
        setIsServiceSheetOpen(false);
        return;
      }
      setPendingService(svc);
    },
    [isSameBookingService],
  );

  // ── Touch / swipe handlers ────────────────────────────────────────────────────
  const handleQuickActionClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const applyTrackTransform = useCallback((offsetX: number) => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(${offsetX}px)`;
    }
  }, []);

  const snapForState = useCallback(
    (state: SwipeState) =>
      state === 'left'
        ? 0
        : state === 'right'
          ? -(CLIENT_PANEL_W + ACTIONS_PANEL_W)
          : -CLIENT_PANEL_W,
    [],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swipeAxis.current = 'undecided';
    isDragging.current = true;
    didDragRef.current = false;
    trackRef.current?.classList.add('admin-vtl-swipe-track--dragging');
  }, []);

  // Native non-passive touchmove so preventDefault works for horizontal swipes.
  // React's onTouchMove is often passive and cannot block vertical scroll steal.
  useEffect(() => {
    const root = swipeRootRef.current;
    if (!root) return undefined;

    const AXIS_LOCK_PX = 8;

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      const touch = e.touches[0];
      if (!touch) return;

      const dx = touch.clientX - touchStartX.current;
      const dy = touch.clientY - touchStartY.current;

      if (swipeAxis.current === 'undecided') {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
        swipeAxis.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
        if (swipeAxis.current === 'v') {
          trackRef.current?.classList.remove('admin-vtl-swipe-track--dragging');
          return;
        }
      }

      if (swipeAxis.current === 'v') return;

      e.preventDefault();
      if (Math.abs(dx) > 6) didDragRef.current = true;
      const base = snapForState(swipeStateRef.current);
      const clamped = Math.min(0, Math.max(-(CLIENT_PANEL_W + ACTIONS_PANEL_W), base + dx));
      applyTrackTransform(clamped);
    };

    root.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => root.removeEventListener('touchmove', onTouchMove);
  }, [applyTrackTransform, snapForState]);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      trackRef.current?.classList.remove('admin-vtl-swipe-track--dragging');

      const axis = swipeAxis.current;
      swipeAxis.current = 'undecided';

      // Vertical scroll or undecided tap — leave swipe state alone.
      if (axis !== 'h') {
        applyTrackTransform(snapForState(swipeState));
        return;
      }

      const delta = e.changedTouches[0].clientX - touchStartX.current;
      const next = stepSwipe(swipeState, delta);
      if (next === swipeState) {
        applyTrackTransform(snapForState(swipeState));
      } else {
        setSwipeState(next);
      }
    },
    [swipeState, applyTrackTransform, snapForState],
  );

  // ── Mouse / wheel swipe (preview embeds only) ─────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!previewSwipe || e.pointerType === 'touch') return;
      // Don't capture pointer on controls — otherwise setPointerCapture on the
      // swipe root suppresses the button's click (desktop/tablet lock overlay).
      const interactive = (e.target as Element | null)?.closest?.(
        'button, a, input, select, textarea, [role="button"]',
      );
      if (interactive) return;
      touchStartX.current = e.clientX;
      isDragging.current = true;
      didDragRef.current = false;
      trackRef.current?.classList.add('admin-vtl-swipe-track--dragging');
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* no-op */
      }
    },
    [previewSwipe],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!previewSwipe || !isDragging.current || e.pointerType === 'touch') return;
      const delta = e.clientX - touchStartX.current;
      if (Math.abs(delta) > 6) didDragRef.current = true;
      const clamped = Math.min(
        0,
        Math.max(-(CLIENT_PANEL_W + ACTIONS_PANEL_W), snapForState(swipeState) + delta),
      );
      applyTrackTransform(clamped);
    },
    [previewSwipe, swipeState, applyTrackTransform, snapForState],
  );

  const finishPointerDrag = useCallback(
    (clientX: number) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const delta = clientX - touchStartX.current;
      trackRef.current?.classList.remove('admin-vtl-swipe-track--dragging');
      const next = stepSwipe(swipeState, delta);
      if (next === swipeState) applyTrackTransform(snapForState(swipeState));
      else setSwipeState(next);
    },
    [swipeState, applyTrackTransform, snapForState],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!previewSwipe || e.pointerType === 'touch') return;
      finishPointerDrag(e.clientX);
    },
    [previewSwipe, finishPointerDrag],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!previewSwipe) return;
      const horizontal =
        Math.abs(e.deltaX) > Math.abs(e.deltaY)
          ? e.deltaX
          : e.shiftKey
            ? e.deltaY
            : 0;
      if (Math.abs(horizontal) < 16) return;
      const now = Date.now();
      if (now < wheelCooldownRef.current) return;
      wheelCooldownRef.current = now + 380;
      const order: SwipeState[] = ['left', 'closed', 'right'];
      const idx = order.indexOf(swipeState);
      const nextIdx = horizontal > 0 ? Math.min(order.length - 1, idx + 1) : Math.max(0, idx - 1);
      if (nextIdx !== idx) setSwipeState(order[nextIdx]);
    },
    [previewSwipe, swipeState],
  );

  // Dismiss the swipe hint on first interaction, and auto-clear after its fade.
  useEffect(() => {
    if (!showSwipeHint) return undefined;
    if (swipeState !== 'closed') {
      setHintVisible(false);
      return undefined;
    }
    const id = window.setTimeout(() => setHintVisible(false), 3200);
    return () => window.clearTimeout(id);
  }, [showSwipeHint, swipeState]);

  // ── Derived status flags ──────────────────────────────────────────────────────
  const effectiveStatus = getEffectiveBookingStatus({
    status: localStatus,
    startAt: booking.startAt,
    endAt: booking.endAt,
  });
  const isCancelled = effectiveStatus.startsWith('CANCELLED');
  const isCompleted = effectiveStatus === 'COMPLETED';
  const statusMenuItems: StatusMenuItem[] = canMutateBooking
    ? (getManualBookingActionOptions(
        {
          startAt: booking.startAt,
          endAt: booking.endAt,
        },
        actionRoleScope,
      ) as StatusMenuItem[])
    : [];
  const localTone = getBookingStatusTone({
    status: effectiveStatus,
    rescheduledAt: booking.rescheduledAt ?? null,
  });

  const closeActionSheets = useCallback(() => {
    setIsStatusSheetOpen(false);
    setIsServiceSheetOpen(false);
    setPendingService(null);
    setServiceError('');
  }, []);

  const openStatusActions = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canMutateBooking) return;
      if (previewSwipe) {
        window.dispatchEvent(new CustomEvent(ADMIN_DEMO_BLOCKED_EVENT));
        return;
      }
      setActionError('');
      setPendingService(null);
      setIsServiceSheetOpen(false);
      setIsStatusSheetOpen(true);
    },
    [previewSwipe, canMutateBooking],
  );

  const setPanelState = useCallback((next: SwipeState) => {
    setSwipeState(next);
  }, []);

  const openServiceActions = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canChangeService) return;
      if (previewSwipe) {
        window.dispatchEvent(new CustomEvent(ADMIN_DEMO_BLOCKED_EVENT));
        return;
      }
      setServiceError('');
      setPendingService(null);
      setIsStatusSheetOpen(false);
      setIsServiceSheetOpen(true);
      void openServicePicker();
    },
    [openServicePicker, previewSwipe, canChangeService],
  );

  const statusActionsContent = (
    <div className="admin-vtl-bottom-sheet-content admin-vtl-action-sheet-content">
      {actionError ? <p className="admin-vtl-message-chooser-error" role="alert">{actionError}</p> : null}
      {statusMenuItems.map((item) => {
        const isReschedule = item.value === 'RESCHEDULE';
        const tone = isReschedule
          ? 'rescheduled'
          : getBookingStatusTone({ status: item.value, rescheduledAt: booking.rescheduledAt ?? null });
        const isUnavailableFromState =
          (item.value === 'CANCELLED_BY_SHOP' || item.value === 'RESCHEDULE')
          && (isCancelled || isCompleted);
        const enabled = item.enabled && !isUnavailableFromState;
        const reason = isUnavailableFromState
          ? `Unavailable: booking is ${getStatusLabel(effectiveStatus, booking.rescheduledAt).toLowerCase()}.`
          : item.reason;
        const label = isReschedule ? item.label : getStatusLabel(item.value, booking.rescheduledAt);
        return (
          <button
            key={item.value}
            type="button"
            className={`admin-vtl-bottom-sheet-pill admin-vtl-bottom-sheet-pill--${tone}${enabled ? '' : ' admin-vtl-bottom-sheet-pill--disabled'}`}
            disabled={!enabled}
            onClick={() => {
              if (!enabled) return;
              if (isReschedule) {
                closeActionSheets();
                onExpand();
              } else if (item.value !== effectiveStatus) {
                void handleStatusChange(item.value);
              } else {
                closeActionSheets();
              }
            }}
          >
            <span className="admin-vtl-bottom-sheet-pill-label">{label}</span>
            <span className="admin-vtl-bottom-sheet-pill-reason">{reason}</span>
          </button>
        );
      })}
    </div>
  );

  const serviceActionsContent = (
    <div className="admin-vtl-bottom-sheet-content admin-vtl-action-sheet-content">
      {pendingService ? (
        <div className="admin-vtl-service-confirm">
          <p className="admin-vtl-service-confirm-title">Change service?</p>
          <p className="admin-vtl-service-confirm-copy">
            Change <strong>{booking.fullName}</strong> from the current service to the one below.
          </p>
          <div className="admin-vtl-service-confirm-services">
            <span>
              <strong>{booking.service.name}</strong>
              {' → '}
              <strong>{pendingService.name}</strong>
            </span>
          </div>
          <p className="admin-vtl-service-confirm-price">New price: {formatPence(pendingService.pricePence)}</p>
          {serviceError ? <p className="admin-vtl-message-chooser-error" role="alert">{serviceError}</p> : null}
          <div className="admin-vtl-service-confirm-actions">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={serviceReplaceLoading}
              onClick={() => {
                setPendingService(null);
                setServiceError('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={serviceReplaceLoading}
              onClick={confirmServiceReplace}
            >
              {serviceReplaceLoading ? 'Saving…' : 'Change service'}
            </button>
          </div>
        </div>
      ) : serviceLoading ? (
        <p className="admin-vtl-ap-service-loading">Loading…</p>
      ) : serviceError && services.length === 0 ? (
        <p className="admin-vtl-message-chooser-error" role="alert">{serviceError}</p>
      ) : !serviceError && services.length === 0 ? (
        <p className="admin-vtl-ap-service-loading">No services available.</p>
      ) : (
        <>
          {serviceError ? <p className="admin-vtl-message-chooser-error" role="alert">{serviceError}</p> : null}
          {services.map((svc) => (
            <button
              key={svc.id}
              type="button"
              className="admin-vtl-ap-service-option"
              onClick={() => handleServiceOptionSelect(svc)}
            >
              <span className="admin-vtl-ap-service-option-name">{svc.name}</span>
              <span className="admin-vtl-ap-service-option-price">{formatPence(svc.pricePence)}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );

  // ── Payment helpers ───────────────────────────────────────────────────────────
  const displayAmount =
    booking.totalPricePence != null
      ? formatPence(booking.totalPricePence)
      : booking.servicePricePenceAtBooking != null
        ? formatPence(booking.servicePricePenceAtBooking)
        : null;
  const paymentMethod = booking.paymentRequired ? 'Deposit' : 'Cash';
  const paymentChipState = getBookingPaymentChipState({
    status: effectiveStatus,
    startAt: booking.startAt,
    endAt: booking.endAt,
    paymentStatus: booking.paymentStatus ?? null,
  });
  const isPaid = paymentChipState === 'paid';

  // ── Track class ───────────────────────────────────────────────────────────────
  const trackClass = [
    'admin-vtl-swipe-track',
    swipeState === 'left' ? 'admin-vtl-swipe-track--open' : '',
    swipeState === 'right' ? 'admin-vtl-swipe-track--right' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const bottomSheetPortal =
    isMobileView && (isStatusSheetOpen || isServiceSheetOpen)
      ? createPortal(
          <div
            className="admin-vtl-bottom-sheet-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-vtl-bottom-sheet-title"
            onClick={(e) => {
              e.stopPropagation();
              closeActionSheets();
            }}
          >
            <div className="admin-vtl-bottom-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="admin-vtl-bottom-sheet-header">
                <p id="admin-vtl-bottom-sheet-title" className="admin-vtl-bottom-sheet-title">
                  {isStatusSheetOpen ? 'Status' : 'Service'}
                </p>
                <button
                  type="button"
                  className="admin-vtl-bottom-sheet-close"
                  onClick={closeActionSheets}
                  aria-label="Close bottom sheet"
                >
                  <X className="admin-vtl-bottom-sheet-close-icon" aria-hidden />
                </button>
              </div>

              {isStatusSheetOpen ? statusActionsContent : serviceActionsContent}
            </div>
          </div>,
          document.body,
        )
      : null;

  const desktopActionPopover =
    !isMobileView && (isStatusSheetOpen || isServiceSheetOpen) ? (
      <div
        className="admin-vtl-action-popover"
        role="dialog"
        aria-labelledby={`admin-vtl-action-popover-title-${booking.id}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-vtl-action-popover-header">
          <p id={`admin-vtl-action-popover-title-${booking.id}`} className="admin-vtl-action-popover-title">
            {isStatusSheetOpen ? 'Status' : 'Service'}
          </p>
          <button
            type="button"
            className="admin-vtl-action-popover-close"
            onClick={closeActionSheets}
            aria-label="Close actions menu"
          >
            <X className="admin-vtl-action-popover-close-icon" aria-hidden />
          </button>
        </div>
        {isStatusSheetOpen ? statusActionsContent : serviceActionsContent}
      </div>
    ) : null;

  return (
    <div className="admin-vtl-swipe-shell" data-booking-id={booking.id} tabIndex={-1}>
      <div className="admin-vtl-panel-segmented" role="group" aria-label="Reveal booking panels">
        <button
          type="button"
          className={`admin-vtl-panel-segmented-btn${swipeState === 'left' ? ' is-active' : ''}`}
          onClick={() => setPanelState('left')}
          aria-pressed={swipeState === 'left'}
        >
          Left
        </button>
        <button
          type="button"
          className={`admin-vtl-panel-segmented-btn${swipeState === 'closed' ? ' is-active' : ''}`}
          onClick={() => setPanelState('closed')}
          aria-pressed={swipeState === 'closed'}
        >
          Main
        </button>
        <button
          type="button"
          className={`admin-vtl-panel-segmented-btn${swipeState === 'right' ? ' is-active' : ''}`}
          onClick={() => setPanelState('right')}
          aria-pressed={swipeState === 'right'}
        >
          Right
        </button>
      </div>

      <div
        ref={swipeRootRef}
        className="admin-vtl-swipe-root"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onPointerDown={previewSwipe ? handlePointerDown : undefined}
        onPointerMove={previewSwipe ? handlePointerMove : undefined}
        onPointerUp={previewSwipe ? handlePointerUp : undefined}
        onPointerCancel={previewSwipe ? handlePointerUp : undefined}
        onWheel={previewSwipe ? handleWheel : undefined}
      >
        <div ref={trackRef} className={trackClass}>
        {/* ── Left: client panel ── */}
        <div className="admin-vtl-client-panel" aria-hidden={swipeState !== 'left'}>
          <button
            type="button"
            className="admin-vtl-client-panel-avatar admin-vtl-client-panel-avatar--btn"
            onClick={(e) => {
              e.stopPropagation();
              onClientProfile?.(booking);
            }}
            disabled={isClientProfileLoading || !onClientProfile}
            tabIndex={swipeState === 'left' ? 0 : -1}
            aria-label={`View profile for ${booking.fullName}`}
            aria-busy={isClientProfileLoading}
            title="View client profile"
          >
            {hasClientAvatar ? (
              <img
                src={booking.clientAvatarUrl ?? undefined}
                alt={booking.fullName}
                className="admin-vtl-client-panel-avatar-img"
                loading="lazy"
                onError={() => setClientImgError(true)}
              />
            ) : (
              <span className="admin-vtl-client-panel-avatar-initials">{clientInitials}</span>
            )}
            <span className="admin-vtl-client-panel-avatar-badge" aria-hidden="true">
              <MessageCircle className="admin-vtl-client-panel-avatar-badge-icon" aria-hidden />
            </span>
          </button>
          <p className="admin-vtl-client-panel-name">{booking.fullName.split(' ')[0]}</p>
        </div>

        {/* ── Center: main card ── */}
        <div
          className={`admin-vtl-expansion-card admin-vtl-expansion-card--${toneClass}`}
          onClick={(e) => {
            e.stopPropagation();
            if (didDragRef.current) {
              didDragRef.current = false;
              return;
            }
            closeActionSheets();
            if (swipeState !== 'closed') setSwipeState('closed');
          }}
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
              <div
                className={
                  hasClientAvatar
                    ? 'admin-vtl-expansion-avatar admin-vtl-expansion-avatar--client'
                    : 'admin-vtl-expansion-avatar admin-vtl-expansion-avatar--client-placeholder'
                }
              >
                {hasClientAvatar ? (
                  <img
                    src={booking.clientAvatarUrl ?? undefined}
                    alt={booking.fullName}
                    className="admin-vtl-expansion-avatar-img"
                    loading="lazy"
                    onError={() => setClientImgError(true)}
                  />
                ) : (
                  <User className="admin-vtl-expansion-avatar-placeholder-icon" aria-hidden />
                )}
              </div>
            </div>
            <div className="admin-vtl-expansion-main">
              <p className="admin-vtl-expansion-time">{`${timeRange} ~ ${duration}`}</p>
              <p className="admin-vtl-expansion-service">{booking.service.name}</p>
              <p className="admin-vtl-expansion-client">{booking.fullName}</p>
            </div>
            <div className="admin-vtl-expansion-status-wrap">
              <span
                className={`admin-vtl-expansion-status-pill admin-vtl-expansion-status-pill--${localTone}`}
                aria-label={`Status ${getStatusLabel(effectiveStatus, booking.rescheduledAt)}`}
              >
                {getStatusLabel(effectiveStatus, booking.rescheduledAt)}
              </span>
            </div>
            <div className="admin-vtl-expansion-payments">
              <p className="admin-vtl-expansion-payment-amount">{displayAmount ?? '—'}</p>
              <p className="admin-vtl-expansion-payment-meta">{paymentMethod}</p>
              <span
                className={`admin-vtl-expansion-payment-chip admin-vtl-expansion-payment-chip--${isPaid ? 'paid' : 'unpaid'}`}
              >
                {isPaid ? 'Paid' : 'Unpaid'}
              </span>
            </div>
          </div>
          {clientTags.length > 0 ? (
            <div className="admin-vtl-expansion-footer">
              <div className="admin-vtl-expansion-client-tags" aria-label="Client tags">
                {clientTags.map((tag, index) => (
                  <span key={`${booking.id}-${tag}-${index}`} className="admin-vtl-expansion-client-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Right: booking actions panel ── */}
        <div className="admin-vtl-actions-panel" aria-hidden={swipeState !== 'right'}>
          {canMutateBooking ? (
            <button
              type="button"
              className={`admin-vtl-ap-circle-btn admin-vtl-ap-circle-btn--status${isStatusSheetOpen ? ' is-active' : ''}`}
              onClick={openStatusActions}
              tabIndex={swipeState === 'right' ? 0 : -1}
              aria-label={`Change status for ${booking.fullName}`}
              aria-expanded={isStatusSheetOpen}
            >
              <span className="admin-vtl-ap-circle-icon-wrap">
                <ListOrdered className="admin-vtl-ap-circle-icon" aria-hidden />
              </span>
              <span className="admin-vtl-ap-circle-label">Status</span>
            </button>
          ) : (
            <p className="admin-vtl-ap-readonly muted">View only</p>
          )}
          {canChangeService ? (
            <button
              type="button"
              className={`admin-vtl-ap-circle-btn admin-vtl-ap-circle-btn--service${isServiceSheetOpen ? ' is-active' : ''}`}
              onClick={openServiceActions}
              tabIndex={swipeState === 'right' ? 0 : -1}
              aria-label={`Change service for ${booking.fullName}`}
              aria-expanded={isServiceSheetOpen}
            >
              <span className="admin-vtl-ap-circle-icon-wrap">
                <Plus className="admin-vtl-ap-circle-icon" aria-hidden />
              </span>
              <span className="admin-vtl-ap-circle-label">Service</span>
            </button>
          ) : null}

          {desktopActionPopover}
        </div>

          {bottomSheetPortal}
        </div>

        <div className="admin-vtl-swipe-nav">
          {hintVisible && (
            <div className="admin-vtl-swipe-hint" role="status">
              <span className="admin-vtl-swipe-hint-arrows" aria-hidden="true">
                ‹ ›
              </span>
              Swipe
            </div>
          )}
          <div className="admin-vtl-swipe-dots" data-active={swipeState} aria-hidden="true">
            <span className="admin-vtl-swipe-dot" />
            <span className="admin-vtl-swipe-dot" />
            <span className="admin-vtl-swipe-dot" />
          </div>
        </div>
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
      <span className="admin-vtl-now-time" data-vtl-time>{timeLabel}</span>
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
  onClientProfile: (booking: TimelineBooking) => void;
  clientProfileLoadingBookingId: string | null;
  isSearchActive: boolean;
  previewSwipe?: boolean;
  sessionBarberId?: string | null;
  canManageBookings?: boolean;
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
  onClientProfile,
  clientProfileLoadingBookingId,
  isSearchActive,
  previewSwipe = false,
  sessionBarberId = null,
  canManageBookings = true,
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
      data-vtl-slot={slotKey}
      data-expanded={isExpanded ? 'true' : undefined}
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
        <time className="admin-vtl-slot-time" dateTime={slot.timeLabel} data-vtl-time>
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
              {slot.bookings.map(({ booking, barber }, bookingIdx) => {
                const canMutateBooking =
                  canManageBookings || Boolean(sessionBarberId && booking.barberId === sessionBarberId);
                return (
                <BookingExpansionCard
                  key={booking.id}
                  booking={booking}
                  barber={barber}
                  toneClass={getBookingStatusTone(booking)}
                  onExpand={() => onExpand(booking)}
                  onClientProfile={onClientProfile}
                  isClientProfileLoading={clientProfileLoadingBookingId === booking.id}
                  previewSwipe={previewSwipe}
                  showSwipeHint={previewSwipe && bookingIdx === 0}
                  canMutateBooking={canMutateBooking}
                  canChangeService={canManageBookings && canMutateBooking}
                  actionRoleScope={canManageBookings ? 'shop' : 'barber'}
                />
                );
              })}
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
  onClientProfileIntercept,
  previewSwipe = false,
  focusBookingId = null,
  onFocusBookingHandled,
  sessionBarberId = null,
  canManageBookings = true,
}: TodayTimelineProps) {
  const localScrollRef = useRef<HTMLDivElement | null>(null);
  const activeScrollRef = scrollContainerRef ?? localScrollRef;
  const nowRowRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledToNow = useRef(false);
  const scrollToNowRafRefs = useRef<{ first: number | null; second: number | null }>({ first: null, second: null });
  const handledFocusBookingIdRef = useRef<string | null>(null);
  const reduceMotion = useReducedMotion();

  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [expandedSlotKey, setExpandedSlotKey] = useState<string | null>(null);
  const [clientPanelId, setClientPanelId] = useState<string | null>(null);
  const [clientProfileLoadingBookingId, setClientProfileLoadingBookingId] = useState<string | null>(null);

  const handleClientProfile = useCallback(async (booking: TimelineBooking) => {
    if (onClientProfileIntercept) {
      onClientProfileIntercept(booking);
      return;
    }
    setClientProfileLoadingBookingId(booking.id);
    try {
      const clientId = await resolveClientIdForBooking(booking);
      if (clientId) setClientPanelId(clientId);
    } finally {
      setClientProfileLoadingBookingId(null);
    }
  }, [onClientProfileIntercept]);

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

  // Deep-link: expand the hour slot and scroll to the booking card.
  useEffect(() => {
    if (!focusBookingId || isLoading) return;
    if (handledFocusBookingIdRef.current === focusBookingId) return;

    const booking = bookings.find((entry) => entry.id === focusBookingId);
    if (!booking) return;

    const slotKey = formatInTimeZone(new Date(booking.startAt), ADMIN_TIMEZONE, 'HH:mm');
    handledFocusBookingIdRef.current = focusBookingId;
    hasScrolledToNow.current = true;
    setExpandedSlotKey(slotKey);
    setActiveBookingId(focusBookingId);

    const slotEl = document.querySelector(`[data-vtl-slot="${slotKey}"]`) as HTMLElement | null;
    slotEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const timeoutId = window.setTimeout(() => {
      const card = document.querySelector(`[data-booking-id="${focusBookingId}"]`) as HTMLElement | null;
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        card.classList.add('admin-booking-hit-flash');
        window.setTimeout(() => card.classList.remove('admin-booking-hit-flash'), 2200);
        window.setTimeout(() => {
          card.focus?.({ preventScroll: true });
        }, 220);
      }
      onFocusBookingHandled?.(focusBookingId);
    }, 280);

    return () => window.clearTimeout(timeoutId);
  }, [bookings, focusBookingId, isLoading, onFocusBookingHandled]);

  useEffect(() => {
    if (!focusBookingId) {
      handledFocusBookingIdRef.current = null;
    }
  }, [focusBookingId]);

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
    if (!isToday || !allowInitialNowScroll || hasScrolledToNow.current || focusBookingId) return;
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
  }, [allowInitialNowScroll, focusBookingId, isToday, items]);

  useEffect(() => {
    hasScrolledToNow.current = false;
  }, [selectedDate]);

  // ── Odometer effect: scale/fade time labels by distance from viewport center ──
  useEffect(() => {
    const container = activeScrollRef.current;
    if (!container) return undefined;

    const nodes = () =>
      container.querySelectorAll<HTMLElement>('[data-vtl-time]');

    if (reduceMotion) {
      nodes().forEach((el) => {
        el.style.transform = '';
        el.style.opacity = '';
      });
      return undefined;
    }

    const SIGMA = 96;
    const SCALE_MAX = 1.42;
    const SCALE_MIN = 0.86;
    const OPACITY_MIN = 0.5;

    let rafId: number | null = null;

    const update = () => {
      rafId = null;
      const rect = container.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      nodes().forEach((el) => {
        const r = el.getBoundingClientRect();
        const d = r.top + r.height / 2 - centerY;
        const t = Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
        const scale = SCALE_MIN + (SCALE_MAX - SCALE_MIN) * t;
        const opacity = OPACITY_MIN + (1 - OPACITY_MIN) * t;
        el.style.transform = `scale(${scale.toFixed(3)})`;
        el.style.opacity = opacity.toFixed(3);
      });
    };

    const schedule = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(update);
    };

    schedule();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [activeScrollRef, reduceMotion, items, expandedSlotKey]);

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
              onClientProfile={handleClientProfile}
              clientProfileLoadingBookingId={clientProfileLoadingBookingId}
              isSearchActive={isSearchActive}
              previewSwipe={previewSwipe}
              sessionBarberId={sessionBarberId}
              canManageBookings={canManageBookings}
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

      {clientPanelId && (
        <ClientProfilePanel
          clientId={clientPanelId}
          onClose={() => setClientPanelId(null)}
        />
      )}
    </section>
  );
}

export default memo(TodayTimeline);
