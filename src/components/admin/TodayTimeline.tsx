import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatInTimeZone } from 'date-fns-tz';
import { minutesInLondonDay } from '../../lib/booking/time';
import { getEffectiveBookingStatus, getManualBookingActionOptions } from '../../lib/booking/operationalStatus';
import { getBookingPaymentChipState } from '../../lib/booking/paymentReporting';
import { getBookingStatusTone, getStatusLabel } from './bookingStatus';
import { SkeletonVerticalTimeline } from '../skeleton';
import { ArrowRight, Check, ChevronDown, Scissors, User, X } from '../lucide-react';
import ClientProfilePanel from './ClientProfilePanel';
import { adminFetchJson, ADMIN_DEMO_BLOCKED_EVENT } from './adminAuth';
import { useAdminClock } from './adminClock';
import { resolveClientIdForBooking } from '../../lib/admin/resolveClientIdForBooking';
import { scrollContainerToRow } from '../../lib/admin/timelineNowScroll';
import '../../styles/components/admin-timeline.css';

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
  /**
   * Landing showcase: move only the timeline's own scroll container to the "now" row (never
   * the page or any other ancestor), with an eased scroll the visitor can watch.
   */
  containInitialNowScroll?: boolean;
  /** Fires once when the initial scroll to "now" starts. */
  onInitialNowScroll?: () => void;
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

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return reduce;
}

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

function getCurrentLondonMinute(nowMs: number): number {
  const now = new Date(nowMs);
  const hour = Number(formatInTimeZone(now, ADMIN_TIMEZONE, 'HH'));
  const minute = Number(formatInTimeZone(now, ADMIN_TIMEZONE, 'mm'));
  return hour * 60 + minute - TIMELINE_START_HOUR * 60;
}

function getCurrentLondonTimeLabel(nowMs: number): string {
  return formatInTimeZone(new Date(nowMs), ADMIN_TIMEZONE, 'HH:mm');
}

// ─── Progress calculation ─────────────────────────────────────────────────────

function formatEndTime(endAt: string): string {
  return formatInTimeZone(new Date(endAt), ADMIN_TIMEZONE, 'HH:mm');
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
    const nowDayMinute = nowMinute + TIMELINE_START_HOUR * 60;
    const nowItem: ListItem = {
      kind: 'now',
      relativeMinute: nowMinute,
      timeLabel: `${String(Math.floor(nowDayMinute / 60)).padStart(2, '0')}:${String(nowDayMinute % 60).padStart(2, '0')}`,
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

// ─── Booking ticket (inline expansion) ────────────────────────────────────────

type ServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
  pricePence: number;
  bufferMinutes?: number;
  isActive?: boolean;
  barberServices?: Array<{ barber: { id: string; name?: string; active?: boolean } }>;
};

const SERVICE_EDITABLE_STATUSES = new Set(['BOOKED', 'ARRIVED', 'IN_PROGRESS']);

type TimeState = 'idle' | 'future' | 'live' | 'past';

function getTimeState(booking: TimelineBooking, nowMs: number | null): TimeState {
  if (nowMs === null) return 'idle';
  const startMs = new Date(booking.startAt).getTime();
  const endMs = new Date(booking.endAt).getTime();
  if (nowMs >= endMs) return 'past';
  if (nowMs >= startMs) return 'live';
  return 'future';
}

function getBookingProgress(booking: TimelineBooking, nowMs: number | null): number {
  if (nowMs === null) return 0;
  const startMs = new Date(booking.startAt).getTime();
  const endMs = new Date(booking.endAt).getTime();
  if (endMs <= startMs || nowMs >= endMs) return 1;
  if (nowMs <= startMs) return 0;
  return (nowMs - startMs) / (endMs - startMs);
}

function formatMinutesShort(totalMinutes: number): string {
  const mins = Math.max(1, Math.round(totalMinutes));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function getTimingLabel(booking: TimelineBooking, nowMs: number | null, cancelled: boolean): string | null {
  if (nowMs === null || cancelled) return null;
  const startMs = new Date(booking.startAt).getTime();
  const endMs = new Date(booking.endAt).getTime();
  if (nowMs >= endMs) return `Ended ${formatEndTime(booking.endAt)}`;
  if (nowMs >= startMs) return `${formatMinutesShort((endMs - nowMs) / 60000)} left`;
  const until = (startMs - nowMs) / 60000;
  return until > 12 * 60 ? null : `Starts in ${formatMinutesShort(until)}`;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? fullName;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
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

type PopoverPosition = { left: number; maxHeight: number; top?: number; bottom?: number };

type BookingTicketProps = {
  booking: TimelineBooking;
  barber: TimelineBarber;
  index: number;
  nowMs: number | null;
  onExpand: () => void;
  onStatusChange?: (bookingId: string, newStatus: string) => void;
  onClientProfile?: (booking: TimelineBooking) => void;
  isClientProfileLoading?: boolean;
  /** Preview embeds: actions show the demo lock instead of mutating. */
  isPreview?: boolean;
  /** Can mutate this booking (own seat or shop manager). */
  canMutateBooking?: boolean;
  /** Can replace service (Owner/Manager with bookings.manage). */
  canChangeService?: boolean;
  /** Status menu scope: barber day-of only, or full shop actions. */
  actionRoleScope?: 'barber' | 'shop';
};

const BookingTicket = memo(function BookingTicket({
  booking,
  barber,
  index,
  nowMs,
  onExpand,
  onStatusChange,
  onClientProfile,
  isClientProfileLoading = false,
  isPreview = false,
  canMutateBooking = true,
  canChangeService = true,
  actionRoleScope = 'shop',
}: BookingTicketProps) {
  const clock = useAdminClock();
  const timeRange = formatTimeRange(booking.startAt, booking.endAt);
  const duration = formatDuration(booking.startAt, booking.endAt);
  const [barberImgError, setBarberImgError] = useState(false);
  const [clientImgError, setClientImgError] = useState(false);
  const hasClientAvatar = Boolean(booking.clientAvatarUrl?.trim()) && !clientImgError;
  const clientTags = (booking.clientTags ?? []).map((tag) => tag.trim()).filter(Boolean);

  const rootRef = useRef<HTMLElement>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // ── Optimistic status ─────────────────────────────────────────────────────────
  const [localStatus, setLocalStatus] = useState(booking.status);
  const [isMobileView, setIsMobileView] = useState(false);
  const [isStatusSheetOpen, setIsStatusSheetOpen] = useState(false);
  const [isServiceSheetOpen, setIsServiceSheetOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [serviceError, setServiceError] = useState('');
  const [popoverPos, setPopoverPos] = useState<PopoverPosition | null>(null);

  // ── Service picker ────────────────────────────────────────────────────────────
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [pendingService, setPendingService] = useState<ServiceOption | null>(null);
  const [serviceReplaceLoading, setServiceReplaceLoading] = useState(false);

  const isMenuOpen = isStatusSheetOpen || isServiceSheetOpen;

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

  useEffect(() => {
    if (!isMobileView || !isMenuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileView, isMenuOpen]);

  const updatePopoverPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const margin = 8;
    const gap = 6;
    const width = Math.min(19 * 16, window.innerWidth - margin * 2);
    const preferred = Math.min(window.innerHeight * 0.52, 22 * 16);
    const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    if (spaceBelow >= Math.min(preferred, 220) || spaceBelow >= spaceAbove) {
      setPopoverPos({ left, top: rect.bottom + gap, maxHeight: Math.max(160, Math.min(preferred, spaceBelow)) });
    } else {
      setPopoverPos({
        left,
        bottom: window.innerHeight - rect.top + gap,
        maxHeight: Math.max(160, Math.min(preferred, spaceAbove)),
      });
    }
  }, []);

  useEffect(() => {
    if (isMobileView || !isMenuOpen) {
      setPopoverPos(null);
      return undefined;
    }
    updatePopoverPosition();
    const scrollRoot = rootRef.current?.closest('.admin-vtl-scroll');
    const onReposition = () => updatePopoverPosition();
    scrollRoot?.addEventListener('scroll', onReposition, { passive: true });
    window.addEventListener('resize', onReposition);
    return () => {
      scrollRoot?.removeEventListener('scroll', onReposition);
      window.removeEventListener('resize', onReposition);
    };
  }, [isMobileView, isMenuOpen, updatePopoverPosition]);

  // Move focus into the menu when it opens; hand it back to the trigger when it closes.
  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const id = window.requestAnimationFrame(() => {
      const host = isMobileView ? sheetRef.current : popoverRef.current;
      const target =
        host?.querySelector<HTMLElement>('.admin-vtl-bottom-sheet-content button:not([disabled])') ??
        host?.querySelector<HTMLElement>('button:not([disabled])');
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [isMenuOpen, isMobileView, popoverPos === null]);

  const closeActionSheets = useCallback(() => {
    const host = isMobileView ? sheetRef.current : popoverRef.current;
    const hadFocus = Boolean(host && host.contains(document.activeElement));
    setIsStatusSheetOpen(false);
    setIsServiceSheetOpen(false);
    setPendingService(null);
    setServiceError('');
    if (hadFocus) anchorRef.current?.focus({ preventScroll: true });
  }, [isMobileView]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      if (pendingService) {
        setPendingService(null);
        setServiceError('');
        return;
      }
      closeActionSheets();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isMenuOpen, pendingService, closeActionSheets]);

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
        closeActionSheets();
      } catch (error) {
        setLocalStatus(prev);
        setActionError(error instanceof Error ? error.message : 'Could not update booking status.');
      }
    },
    [booking.id, localStatus, onStatusChange, closeActionSheets],
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
        onStatusChange?.(booking.id, localStatus);
        closeActionSheets();
      } catch (error) {
        setServiceError(error instanceof Error ? error.message : 'Could not update booking service.');
      } finally {
        setServiceReplaceLoading(false);
      }
    },
    [booking.id, localStatus, onStatusChange, closeActionSheets],
  );

  const confirmServiceReplace = useCallback(() => {
    if (!pendingService || serviceReplaceLoading) return;
    void handleServiceReplace(pendingService.id);
  }, [pendingService, serviceReplaceLoading, handleServiceReplace]);

  const handleServiceOptionSelect = useCallback(
    (svc: ServiceOption) => {
      setServiceError('');
      if (isSameBookingService(svc)) {
        closeActionSheets();
        return;
      }
      setPendingService(svc);
    },
    [isSameBookingService, closeActionSheets],
  );

  // ── Derived status flags ──────────────────────────────────────────────────────
  const clockNowMs = clock.nowMs();
  const effectiveStatus = getEffectiveBookingStatus({
    status: localStatus,
    startAt: booking.startAt,
    endAt: booking.endAt,
    nowMs: clockNowMs,
  });
  const statusLabel = getStatusLabel(effectiveStatus, booking.rescheduledAt);
  const isCancelled = effectiveStatus.startsWith('CANCELLED') || effectiveStatus === 'NO_SHOW';
  const isCompleted = effectiveStatus === 'COMPLETED';
  const showServiceChange =
    canChangeService && SERVICE_EDITABLE_STATUSES.has(localStatus) && effectiveStatus !== 'COMPLETED';
  const assignedBarberId = booking.barberId ?? barber.id;
  const eligibleServices = services.filter(
    (svc) =>
      svc.isActive !== false &&
      (svc.barberServices ?? []).some((link) => link.barber.id === assignedBarberId),
  );
  const pendingServiceEndLabel = pendingService
    ? formatEndTime(
        new Date(
          new Date(booking.startAt).getTime() +
            (pendingService.durationMinutes + (pendingService.bufferMinutes || 0)) * 60 * 1000,
        ).toISOString(),
      )
    : null;
  const statusMenuItems: StatusMenuItem[] = canMutateBooking
    ? (getManualBookingActionOptions(
        { startAt: booking.startAt, endAt: booking.endAt, nowMs: clockNowMs },
        actionRoleScope,
      ) as StatusMenuItem[])
    : [];
  const localTone = getBookingStatusTone({
    status: effectiveStatus,
    rescheduledAt: booking.rescheduledAt ?? null,
  });
  const timeState = getTimeState(booking, nowMs);
  const timingLabel = getTimingLabel(booking, nowMs, isCancelled);

  const openStatusActions = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      if (!canMutateBooking) return;
      if (isPreview) {
        window.dispatchEvent(new CustomEvent(ADMIN_DEMO_BLOCKED_EVENT));
        return;
      }
      anchorRef.current = e.currentTarget;
      if (isStatusSheetOpen) {
        closeActionSheets();
        return;
      }
      setActionError('');
      setPendingService(null);
      setIsServiceSheetOpen(false);
      setIsStatusSheetOpen(true);
    },
    [isPreview, canMutateBooking, isStatusSheetOpen, closeActionSheets],
  );

  const openServiceActions = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      if (!showServiceChange) return;
      if (isPreview) {
        window.dispatchEvent(new CustomEvent(ADMIN_DEMO_BLOCKED_EVENT));
        return;
      }
      anchorRef.current = e.currentTarget;
      if (isServiceSheetOpen) {
        closeActionSheets();
        return;
      }
      setServiceError('');
      setPendingService(null);
      setIsStatusSheetOpen(false);
      setIsServiceSheetOpen(true);
      void openServicePicker();
    },
    [openServicePicker, isPreview, showServiceChange, isServiceSheetOpen, closeActionSheets],
  );

  const statusActionsContent = (
    <div className="admin-vtl-bottom-sheet-content admin-vtl-action-sheet-content tl-menu">
      {actionError ? <p className="admin-vtl-message-chooser-error" role="alert">{actionError}</p> : null}
      {statusMenuItems.map((item) => {
        const isReschedule = item.value === 'RESCHEDULE';
        const tone = isReschedule
          ? 'rescheduled'
          : getBookingStatusTone({ status: item.value, rescheduledAt: booking.rescheduledAt ?? null });
        const isUnavailableFromState =
          (item.value === 'CANCELLED_BY_SHOP' || item.value === 'RESCHEDULE') && (isCancelled || isCompleted);
        const enabled = item.enabled && !isUnavailableFromState;
        const reason = isUnavailableFromState
          ? `Unavailable: booking is ${statusLabel.toLowerCase()}.`
          : item.reason;
        const label = isReschedule ? item.label : getStatusLabel(item.value, booking.rescheduledAt);
        const isCurrent = !isReschedule && item.value === effectiveStatus;
        return (
          <button
            key={item.value}
            type="button"
            className={`tl-menu-item tl-menu-item--${tone}${isCurrent ? ' tl-menu-item--current' : ''}`}
            disabled={!enabled}
            aria-current={isCurrent ? 'true' : undefined}
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
            <span className="tl-menu-dot" aria-hidden="true" />
            <span className="tl-menu-text">
              <span className="tl-menu-label">{label}</span>
              <span className="tl-menu-reason">{reason}</span>
            </span>
            {isCurrent ? <Check className="tl-menu-check" width={14} height={14} aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );

  const serviceActionsContent = (
    <div className="admin-vtl-bottom-sheet-content admin-vtl-action-sheet-content tl-menu">
      {pendingService ? (
        <div className="tl-confirm">
          <p className="tl-confirm-title">Change service?</p>
          <p className="tl-confirm-copy">
            <strong>{booking.service.name}</strong>
            <ArrowRight className="tl-confirm-arrow" width={13} height={13} aria-hidden />
            <strong>{pendingService.name}</strong>
          </p>
          <dl className="tl-confirm-facts">
            <div>
              <dt>New price</dt>
              <dd>{formatPence(pendingService.pricePence)}</dd>
            </div>
            {pendingServiceEndLabel ? (
              <div>
                <dt>New end time</dt>
                <dd>{pendingServiceEndLabel}</dd>
              </div>
            ) : null}
          </dl>
          {serviceError ? <p className="admin-vtl-message-chooser-error" role="alert">{serviceError}</p> : null}
          <div className="tl-confirm-actions">
            <button
              type="button"
              className="tl-btn"
              disabled={serviceReplaceLoading}
              onClick={() => {
                setPendingService(null);
                setServiceError('');
              }}
            >
              Back
            </button>
            <button
              type="button"
              className="tl-btn tl-btn--primary"
              disabled={serviceReplaceLoading}
              onClick={confirmServiceReplace}
            >
              {serviceReplaceLoading ? 'Saving…' : 'Change service'}
            </button>
          </div>
        </div>
      ) : serviceLoading ? (
        <p className="tl-menu-note">Loading services…</p>
      ) : serviceError && eligibleServices.length === 0 ? (
        <p className="admin-vtl-message-chooser-error" role="alert">{serviceError}</p>
      ) : !serviceError && eligibleServices.length === 0 ? (
        <p className="tl-menu-note">No services available for this barber.</p>
      ) : (
        <>
          {serviceError ? <p className="admin-vtl-message-chooser-error" role="alert">{serviceError}</p> : null}
          {eligibleServices.map((svc) => {
            const isCurrent = isSameBookingService(svc);
            return (
              <button
                key={svc.id}
                type="button"
                className={`tl-menu-item tl-menu-item--service${isCurrent ? ' tl-menu-item--current' : ''}`}
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => handleServiceOptionSelect(svc)}
              >
                <span className="tl-menu-text">
                  <span className="tl-menu-label">{svc.name}</span>
                  <span className="tl-menu-reason">{formatMinutesShort(svc.durationMinutes)}</span>
                </span>
                <span className="tl-menu-price">{formatPence(svc.pricePence)}</span>
              </button>
            );
          })}
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
  const menuTitle = isStatusSheetOpen ? 'Update status' : 'Change service';

  const bottomSheetPortal =
    isMobileView && isMenuOpen
      ? createPortal(
          <div
            className="admin-vtl-bottom-sheet-backdrop tl-sheet-backdrop"
            onClick={(e) => {
              e.stopPropagation();
              closeActionSheets();
            }}
          >
            <div
              ref={sheetRef}
              className="admin-vtl-bottom-sheet tl-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`tl-sheet-title-${booking.id}`}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="tl-sheet-grip" aria-hidden="true" />
              <div className="tl-menu-header">
                <div>
                  <p id={`tl-sheet-title-${booking.id}`} className="tl-menu-title">{menuTitle}</p>
                  <p className="tl-menu-sub">{`${booking.fullName} · ${timeRange}`}</p>
                </div>
                <button type="button" className="tl-icon-btn" onClick={closeActionSheets} aria-label="Close">
                  <X width={16} height={16} aria-hidden />
                </button>
              </div>
              {isStatusSheetOpen ? statusActionsContent : serviceActionsContent}
            </div>
          </div>,
          document.body,
        )
      : null;

  const desktopActionPopover =
    !isMobileView && isMenuOpen && popoverPos
      ? createPortal(
          <>
            <div
              className="admin-vtl-action-popover-backdrop"
              aria-hidden="true"
              onClick={(e) => {
                e.stopPropagation();
                closeActionSheets();
              }}
            />
            <div
              ref={popoverRef}
              className="admin-vtl-action-popover admin-vtl-action-popover--portal tl-popover"
              role="dialog"
              aria-labelledby={`tl-popover-title-${booking.id}`}
              style={{
                top: popoverPos.top ?? 'auto',
                bottom: popoverPos.bottom ?? 'auto',
                left: popoverPos.left,
                maxHeight: popoverPos.maxHeight,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="tl-menu-header">
                <div>
                  <p id={`tl-popover-title-${booking.id}`} className="tl-menu-title">{menuTitle}</p>
                  <p className="tl-menu-sub">{`${booking.fullName} · ${timeRange}`}</p>
                </div>
                <button type="button" className="tl-icon-btn" onClick={closeActionSheets} aria-label="Close">
                  <X width={16} height={16} aria-hidden />
                </button>
              </div>
              {isStatusSheetOpen ? statusActionsContent : serviceActionsContent}
            </div>
          </>,
          document.body,
        )
      : null;

  const clientProfileDisabled = isClientProfileLoading || !onClientProfile;

  return (
    <article
      ref={rootRef}
      className={`tl-ticket tl-ticket--${localTone} tl-ticket--${timeState}`}
      data-booking-id={booking.id}
      tabIndex={-1}
      style={{ '--tl-i': index } as React.CSSProperties}
      aria-label={`${booking.fullName}, ${booking.service.name}, ${timeRange}, ${statusLabel}`}
    >
      <div className="tl-ticket-head">
        <div className="tl-ticket-avatars" aria-hidden="true">
          <span className="tl-ava tl-ava--barber admin-vtl-expansion-avatar--barber">
            {barber.avatarUrl && !barberImgError ? (
              <img
                src={barber.avatarUrl}
                alt=""
                className="admin-vtl-expansion-avatar-img"
                loading="lazy"
                width={40}
                height={40}
                onError={() => setBarberImgError(true)}
              />
            ) : (
              <span className="tl-ava-initials">{getInitials(barber.name)}</span>
            )}
          </span>
          <span
            className={`tl-ava tl-ava--client ${hasClientAvatar ? 'admin-vtl-expansion-avatar--client' : 'admin-vtl-expansion-avatar--client-placeholder'}`}
          >
            {hasClientAvatar ? (
              <img
                src={booking.clientAvatarUrl ?? undefined}
                alt=""
                className="admin-vtl-expansion-avatar-img"
                loading="lazy"
                width={24}
                height={24}
                onError={() => setClientImgError(true)}
              />
            ) : (
              <span className="tl-ava-initials">{getInitials(booking.fullName)}</span>
            )}
          </span>
        </div>

        <div className="tl-ticket-id">
          <p className="tl-ticket-client">{booking.fullName}</p>
          <p className="tl-ticket-service">{booking.service.name}</p>
        </div>

        <div className="tl-ticket-amount">
          <span className="tl-ticket-price">{displayAmount ?? '—'}</span>
          <span className={`tl-ticket-pay tl-ticket-pay--${isPaid ? 'paid' : 'unpaid'}`}>
            {isPaid ? 'Paid' : 'Unpaid'}
            <span className="tl-ticket-pay-method">{` · ${paymentMethod}`}</span>
          </span>
        </div>
      </div>

      <p className="tl-ticket-meta">
        <span className="tl-ticket-time">{timeRange}</span>
        <span className="tl-sep" aria-hidden="true" />
        <span>{duration}</span>
        <span className="tl-sep" aria-hidden="true" />
        <span>{`with ${firstName(barber.name)}`}</span>
        {timingLabel ? (
          <span className={`tl-ticket-timing tl-ticket-timing--${timeState}`}>{timingLabel}</span>
        ) : null}
      </p>

      {clientTags.length > 0 ? (
        <ul className="tl-ticket-tags" aria-label="Client tags">
          {clientTags.map((tag, tagIndex) => (
            <li key={`${booking.id}-${tag}-${tagIndex}`} className="tl-ticket-tag">
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="tl-ticket-actions">
        {canMutateBooking ? (
          <button
            type="button"
            className={`tl-btn tl-btn--status tl-btn--tone-${localTone}${isStatusSheetOpen ? ' is-open' : ''}`}
            onClick={openStatusActions}
            aria-haspopup="dialog"
            aria-expanded={isStatusSheetOpen}
            aria-label={`Status: ${statusLabel}. Update status for ${booking.fullName}`}
          >
            <span className="tl-status-dot" aria-hidden="true" />
            <span className="tl-btn-label">{statusLabel}</span>
            <ChevronDown className="tl-btn-chevron" width={14} height={14} aria-hidden />
          </button>
        ) : (
          <span className={`tl-status-static tl-btn--tone-${localTone}`}>
            <span className="tl-status-dot" aria-hidden="true" />
            {statusLabel}
          </span>
        )}
        <button
          type="button"
          className="tl-btn"
          onClick={(e) => {
            e.stopPropagation();
            onClientProfile?.(booking);
          }}
          disabled={clientProfileDisabled}
          aria-busy={isClientProfileLoading || undefined}
          aria-label={`Open client profile for ${booking.fullName}`}
        >
          <User className="tl-btn-icon" width={15} height={15} aria-hidden />
          <span className="tl-btn-label">{isClientProfileLoading ? 'Opening…' : 'Client profile'}</span>
        </button>
        {showServiceChange ? (
          <button
            type="button"
            className={`tl-btn${isServiceSheetOpen ? ' is-open' : ''}`}
            onClick={openServiceActions}
            aria-haspopup="dialog"
            aria-expanded={isServiceSheetOpen}
            aria-label={`Change service for ${booking.fullName}`}
          >
            <Scissors className="tl-btn-icon" width={15} height={15} aria-hidden />
            <span className="tl-btn-label">Change service</span>
          </button>
        ) : null}
        {!canMutateBooking ? <span className="tl-ticket-readonly">View only</span> : null}
      </div>

      {bottomSheetPortal}
      {desktopActionPopover}
    </article>
  );
});

// ─── Progress stripe ─────────────────────────────────────────────────────────
// Position is a CSS custom property (--p, 0–1). The stripe re-renders on the
// 15 s clock tick and a linear transform transition bridges the gap, so the
// avatar glides on the compositor with no per-frame JavaScript.

type ProgressPinProps = {
  barber: TimelineBarber;
  booking: TimelineBooking;
  nowMs: number | null;
  index: number;
  isActive: boolean;
  isSearchActive: boolean;
  onAvatarClick: (booking: TimelineBooking) => void;
};

const ProgressPin = memo(function ProgressPin({
  barber,
  booking,
  nowMs,
  index,
  isActive,
  isSearchActive,
  onAvatarClick,
}: ProgressPinProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [barber.avatarUrl]);

  const tone = getBookingStatusTone(booking);
  const timeState = getTimeState(booking, nowMs);
  const progress = getBookingProgress(booking, nowMs);
  const style = {
    '--p': progress.toFixed(4),
    '--stack': index,
    zIndex: isActive ? MAX_VISIBLE_AVATARS + 1 : MAX_VISIBLE_AVATARS - index,
  } as React.CSSProperties;
  const label = `${barber.name} — ${booking.service.name} — ${booking.fullName}`;

  return (
    <>
      <span className={`tl-fill tl-fill--${tone} tl-fill--${timeState}`} style={style} aria-hidden="true" />
      <span className="tl-pin-frame" style={style}>
        <button
          type="button"
          className={[
            'tl-pin',
            `tl-pin--${tone}`,
            `tl-pin--${timeState}`,
            isSearchActive ? 'tl-pin--search' : '',
            isActive ? 'tl-pin--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={(e) => {
            e.stopPropagation();
            onAvatarClick(booking);
          }}
          aria-expanded={isActive}
          aria-label={label}
          title={label}
        >
          {barber.avatarUrl && !imgError ? (
            <img
              src={barber.avatarUrl}
              alt=""
              className="admin-vtl-avatar-img"
              width={PROGRESS_AVATAR_SIZE}
              height={PROGRESS_AVATAR_SIZE}
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="tl-pin-initials" aria-hidden="true">
              {getInitials(barber.name)}
            </span>
          )}
        </button>
      </span>
    </>
  );
});

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
  const visible = items.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = items.length - MAX_VISIBLE_AVATARS;
  return (
    <div
      className="tl-track"
      data-count={visible.length}
      style={{ '--stack-n': visible.length } as React.CSSProperties}
    >
      <span className="tl-rail" aria-hidden="true" />
      {visible.map(({ booking, barber }, index) => (
        <ProgressPin
          key={booking.id}
          barber={barber}
          booking={booking}
          nowMs={nowMs}
          index={index}
          isActive={booking.id === activeBookingId}
          isSearchActive={isSearchActive}
          onAvatarClick={onAvatarClick}
        />
      ))}
      {overflow > 0 ? (
        <span className="tl-overflow" aria-label={`${overflow} more booking${overflow === 1 ? '' : 's'}`}>
          +{overflow}
        </span>
      ) : null}
    </div>
  );
});

// ─── Now row ──────────────────────────────────────────────────────────────────

type NowRowProps = { timeLabel: string };

const NowRow = memo(function NowRow({ timeLabel }: NowRowProps) {
  return (
    <div className="admin-vtl-now-row tl-now" aria-hidden="true">
      <span className="tl-now-time">{timeLabel}</span>
      <span className="tl-now-line">
        <span className="tl-now-dot" />
      </span>
    </div>
  );
});

// ─── Slot row (stripe + inline tickets) ──────────────────────────────────────

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

function getSlotState(slot: SlotModel, nowMs: number | null): TimeState | 'empty' {
  if (slot.bookings.length === 0) return 'empty';
  const states = slot.bookings
    .filter(({ booking }) => getBookingStatusTone(booking) !== 'cancelled')
    .map(({ booking }) => getTimeState(booking, nowMs));
  if (states.includes('live')) return 'live';
  if (states.length > 0 && states.every((state) => state === 'past')) return 'past';
  if (states.length === 0) return 'past';
  return states.includes('future') ? 'future' : 'idle';
}

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
  const isHour = slot.timeLabel.endsWith(':00');
  const expansionId = `admin-vtl-expansion-${slotKey.replace(/[^a-z0-9_-]/gi, '-')}`;
  const slotState = getSlotState(slot, nowMs);

  const handleSlotToggle = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      if (!hasBookings) return;
      onSlotToggle(slotKey);
    },
    [hasBookings, onSlotToggle, slotKey],
  );

  const handleSlotKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!hasBookings || e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSlotToggle(e);
      }
    },
    [handleSlotToggle, hasBookings],
  );

  const handleSlotAvatarClick = useCallback(
    (booking: TimelineBooking) => {
      onAvatarClick(slotKey, booking);
    },
    [onAvatarClick, slotKey],
  );

  const latestEnd = useMemo(() => {
    if (!hasBookings) return '';
    return slot.bookings.reduce(
      (latest, { booking }) =>
        new Date(booking.endAt).getTime() > new Date(latest).getTime() ? booking.endAt : latest,
      slot.bookings[0].booking.endAt,
    );
  }, [hasBookings, slot.bookings]);

  const first = hasBookings ? slot.bookings[0] : null;
  const laneTitle = first
    ? slot.bookings.length === 1
      ? first.booking.service.name
      : `${slot.bookings.length} bookings`
    : '';
  const laneSub = first
    ? slot.bookings.length === 1
      ? `${shortName(first.booking.fullName)} · ${firstName(first.barber.name)}`
      : slot.bookings.map(({ booking }) => firstName(booking.fullName)).join(', ')
    : '';

  const groupLabel = `${slot.timeLabel}${hasBookings ? ` — ${slot.bookings.length} booking${slot.bookings.length === 1 ? '' : 's'}` : ''}${hasBlocks ? ` — ${slot.timeBlocks.length} block${slot.timeBlocks.length === 1 ? '' : 's'}` : ''}`;

  return (
    <div
      className={`admin-vtl-slot-group tl-slot tl-slot--${slotState}${isHour ? ' tl-slot--hour' : ''}${hasBlocks && !hasBookings ? ' tl-slot--blocked' : ''}`}
      data-vtl-slot={slotKey}
      data-expanded={isExpanded ? 'true' : undefined}
      aria-label={groupLabel}
      role="group"
    >
      <div
        className={`tl-row${hasBookings ? ' admin-vtl-slot--interactive tl-row--booked' : ''}`}
        role={hasBookings ? 'button' : undefined}
        tabIndex={hasBookings ? 0 : undefined}
        aria-expanded={hasBookings ? isExpanded : undefined}
        aria-controls={hasBookings && isExpanded ? expansionId : undefined}
        onClick={handleSlotToggle}
        onKeyDown={handleSlotKeyDown}
      >
        <time className="tl-time" dateTime={slot.timeLabel}>
          {slot.timeLabel}
        </time>
        <div className="tl-lane">
          {hasBookings ? (
            <>
              <p className="tl-lane-meta">
                <span className="tl-lane-title">{laneTitle}</span>
                <span className="tl-lane-sub">{laneSub}</span>
              </p>
              <ProgressTrack
                items={slot.bookings}
                nowMs={nowMs}
                activeBookingId={activeBookingId}
                isSearchActive={isSearchActive}
                onAvatarClick={handleSlotAvatarClick}
              />
            </>
          ) : hasBlocks ? (
            <div className="tl-blocks">
              {slot.timeBlocks.map((block) => (
                <span key={block.id} className="tl-block-chip" title={block.title}>
                  {block.title}
                </span>
              ))}
              <span className="tl-hair tl-hair--block" aria-hidden="true" />
            </div>
          ) : (
            <span className="tl-hair" aria-hidden="true" />
          )}
        </div>
        {hasBookings ? (
          <>
            <time className="tl-end" dateTime={latestEnd || undefined}>
              {latestEnd ? formatEndTime(latestEnd) : ''}
            </time>
            <ChevronDown className="tl-chevron" width={16} height={16} aria-hidden />
          </>
        ) : null}
      </div>

      {isExpanded && hasBookings ? (
        <div id={expansionId} className="tl-expansion" onClick={(e) => e.stopPropagation()}>
          {slot.bookings.map(({ booking, barber }, bookingIdx) => {
            const canMutateBooking =
              canManageBookings || Boolean(sessionBarberId && booking.barberId === sessionBarberId);
            return (
              <BookingTicket
                key={booking.id}
                booking={booking}
                barber={barber}
                index={bookingIdx}
                nowMs={nowMs}
                onExpand={() => onExpand(booking)}
                onClientProfile={onClientProfile}
                isClientProfileLoading={clientProfileLoadingBookingId === booking.id}
                isPreview={previewSwipe}
                canMutateBooking={canMutateBooking}
                canChangeService={canManageBookings && canMutateBooking}
                actionRoleScope={canManageBookings ? 'shop' : 'barber'}
              />
            );
          })}
        </div>
      ) : null}
    </div>
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
  containInitialNowScroll = false,
  onInitialNowScroll,
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
  const containedNowScrollRef = useRef<(() => void) | null>(null);
  const handledFocusBookingIdRef = useRef<string | null>(null);
  const reduceMotion = usePrefersReducedMotion();
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;
  const onInitialNowScrollRef = useRef(onInitialNowScroll);
  onInitialNowScrollRef.current = onInitialNowScroll;

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

    let attempts = 0;
    const timeoutId = window.setTimeout(function revealFocusedCard() {
      const card = document.querySelector(`[data-booking-id="${focusBookingId}"]`) as HTMLElement | null;
      if (!card && attempts < 20) {
        attempts += 1;
        window.setTimeout(revealFocusedCard, 150);
        return;
      }
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        card.classList.add('admin-booking-hit-flash');
        window.setTimeout(() => card.classList.remove('admin-booking-hit-flash'), 2200);
        window.setTimeout(() => {
          card.focus?.({ preventScroll: true });
        }, 220);
        onFocusBookingHandled?.(focusBookingId);
        return;
      }
      handledFocusBookingIdRef.current = null;
    }, 280);

    return () => window.clearTimeout(timeoutId);
  }, [bookings, focusBookingId, isLoading, onFocusBookingHandled]);

  useEffect(() => {
    if (!focusBookingId) {
      handledFocusBookingIdRef.current = null;
    }
  }, [focusBookingId]);

  const clock = useAdminClock();
  const todayLondon = formatInTimeZone(new Date(clock.nowMs()), ADMIN_TIMEZONE, 'yyyy-MM-dd');
  const isToday = selectedDate === todayLondon;

  const [nowMinute, setNowMinute] = useState<number | null>(() =>
    isToday ? getCurrentLondonMinute(clock.nowMs()) : null
  );
  const [nowTimeLabel, setNowTimeLabel] = useState<string>(() =>
    isToday ? getCurrentLondonTimeLabel(clock.nowMs()) : ''
  );

  useEffect(() => {
    if (!isToday) {
      setNowMinute(null);
      setNowTimeLabel('');
      return;
    }
    const tick = () => {
      setNowMinute(getCurrentLondonMinute(clock.nowMs()));
      setNowTimeLabel(getCurrentLondonTimeLabel(clock.nowMs()));
    };
    tick();
    if (clock.frozen) return;
    const id = window.setInterval(tick, NOW_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [clock, isToday, selectedDate]);

  // nowMs drives the progress animation in BarberAvatarPin. It is recomputed
  // every 15 s when nowMinute updates so Framer Motion gets fresh remaining-
  // duration values and continues each avatar's linear animation smoothly —
  // no requestAnimationFrame loop required between ticks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nowMs = useMemo(() => (isToday ? clock.nowMs() : null), [clock, nowMinute, isToday]);

  const items = useMemo(
    () => buildSlotList(barbers, bookings, timeBlocks, nowMinute),
    [barbers, bookings, timeBlocks, nowMinute]
  );

  useEffect(() => {
    if (!isToday || !allowInitialNowScroll || hasScrolledToNow.current || focusBookingId) return;
    const el = nowRowRef.current;
    if (!el) return;
    hasScrolledToNow.current = true;
    if (containInitialNowScroll) {
      scrollToNowRafRefs.current.first = window.requestAnimationFrame(() => {
        scrollToNowRafRefs.current.first = null;
        scrollToNowRafRefs.current.second = window.requestAnimationFrame(() => {
          scrollToNowRafRefs.current.second = null;
          const container = activeScrollRef.current;
          if (!container) return;
          onInitialNowScrollRef.current?.();
          containedNowScrollRef.current?.();
          containedNowScrollRef.current = scrollContainerToRow(container, el, reduceMotionRef.current);
        });
      });
      return () => {
        const pending = scrollToNowRafRefs.current.first !== null || scrollToNowRafRefs.current.second !== null;
        if (scrollToNowRafRefs.current.first !== null) window.cancelAnimationFrame(scrollToNowRafRefs.current.first);
        if (scrollToNowRafRefs.current.second !== null) window.cancelAnimationFrame(scrollToNowRafRefs.current.second);
        scrollToNowRafRefs.current = { first: null, second: null };
        if (pending) hasScrolledToNow.current = false;
      };
    }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowInitialNowScroll, containInitialNowScroll, focusBookingId, isToday, items]);

  useEffect(() => () => containedNowScrollRef.current?.(), []);

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
    <section
      className="admin-vtl tl"
      aria-label={`Timeline for ${selectedDate}`}
      data-tl-motion={reduceMotion || clock.frozen ? undefined : 'on'}
    >
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
          onErased={() => setClientPanelId(null)}
        />
      )}
    </section>
  );
}

export default memo(TodayTimeline);
