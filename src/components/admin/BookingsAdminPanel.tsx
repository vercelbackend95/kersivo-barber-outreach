import React, { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { BarberRosterOverviewGridSkeleton } from '../skeleton';
import AdminSectionHeader from './AdminSectionHeader';
import AdminBookingsOpsSearch, { type AdminBookingsOpsSearchBooking } from './AdminBookingsOpsSearch';
import AdminDesktopDashHeroSlot from './AdminDesktopDashHeroSlot';
import AdminBookingsScheduleList from './AdminBookingsScheduleList';
import HistoryBookingStatusSheet, { type HistoryStatusValue } from './HistoryBookingStatusSheet';
import AdminBookingDatePicker from './AdminBookingDatePicker';
const BookingsReportsSection = lazy(() => import('./BookingsReportsSection'));
import { addDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import TodayTimeline, { type TimelineBooking } from './TodayTimeline';
import ClientProfilePanel from './ClientProfilePanel';
import { resolveClientIdForBooking } from '@/lib/admin/resolveClientIdForBooking';
import AdminErrorBoundary from './AdminErrorBoundary';
import HistoryDateRangePicker from './HistoryDateRangePicker';
import BarbersOverview from './BarbersOverview';
import type { TeamProfileOpenMeta } from './BarbersOverview';
import AdminBarberRosterCard from './AdminBarberRosterCard';
import BarberProfile from './BarberProfile';
import { isWithinShiftNow } from '../../lib/admin/todayWorkingHours';
import {
  getBarberAvailabilityStatusForDayRange,
  getDayFillForRange,
  getNextBookingForBarber,
  getTodayLine,
} from '../../lib/admin/barberRosterPresentation';
import BarberChip from './BarberChip';
import type { Barber, ServiceOption, TimeBlock, WorkingHourRow } from './barbersTypes';
import EmptyState from '../EmptyState';
import { Clock, ListOrdered, Plus } from '../lucide-react';
import { ADMIN_BOOKING_HISTORY_PAGE_SIZE } from '../../lib/admin/bookingHistoryPageSize';
import { canShopAdminCancelByLeadTime } from '../../lib/booking/policies';
import { countBookingsByStatusTone, getBookingStatusTone, isCancelledBookingStatus } from './bookingStatus';
import { adminFetchJson, notifyAdminDemoBlocked } from './adminAuth';
import { normalizeWorkingHourRows } from '../../lib/admin/normalizeWorkingHourRows';
type Booking = {
  id: string;
  barberId: string;
  clientId?: string | null;
  clientTags?: string[];
  clientAvatarUrl?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  status: string;
  startAt: string;
  endAt: string;
   notes?: string | null;
  rescheduledAt?: string | null;
  barber: { name: string };
  service: { name: string };
};

/** Window + scrollable ancestors to minimum scroll (full header visible on mobile admin). */
function scrollDocumentAndAncestorsToTop(scrollOrigin: HTMLElement | null) {
  if (typeof window === 'undefined') return;

  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  let node: HTMLElement | null = scrollOrigin;
  while (node) {
    const { overflowY } = window.getComputedStyle(node);
    const yScrollable =
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      node.scrollHeight > node.clientHeight;
    if (yScrollable && node.scrollTop > 0) {
      node.scrollTop = 0;
    }
    node = node.parentElement;
  }
}


type AdminBookingView = 'timeline' | 'list';

const VIEW_ORDER: Record<AdminBookingView, number> = { timeline: 0, list: 1 };

const viewSlideVariants: Variants = {
  enter: (custom: { dir: number; mobile: boolean }) => ({
    x: custom.dir * (custom.mobile ? 28 : 48),
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.24, ease: [0.4, 0.0, 0.2, 1] as const },
  },
  exit: (custom: { dir: number; mobile: boolean }) => ({
    x: custom.dir * (custom.mobile ? -28 : -48),
    opacity: 0,
    transition: { duration: 0.18, ease: [0.4, 0.0, 1.0, 1] as const },
  }),
};

type WorkingHoursResponse = {
  rules?: WorkingHourRow[];
  error?: string;
};

type HistoryDateRange = {
  from?: Date;
  to?: Date;
};

const ADMIN_TIMEZONE = 'Europe/London';
const SLOT_STEP_MINUTES = 15;
const POLL_INTERVAL_MS = 120000;
const LAST_UPDATED_REFRESH_MS = 1000;

const UPDATED_ROW_HIGHLIGHT_MS = 2000;
/** Align with CSS `max-width: 48rem` (768px at 16px root). */
const MOBILE_BREAKPOINT_PX = 768;
const MOBILE_RECENT_BARBERS_COUNT = 5;
const DESKTOP_RECENT_BARBERS_COUNT = 11;
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function buildReportsBarberStub(id: string, name: string): Barber {
  return {
    id,
    name,
    isActive: true,
    active: true,
    avatarUrl: null,
    sortOrder: undefined,
    serviceIds: [],
  };
}

function getInitials(name: string): string {
  const normalized = name.trim();
  if (!normalized) return '?';

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}




const DEFAULT_ADD_BARBER_SERVICES: ServiceOption[] = [
  { id: 'svc-haircut', name: 'Haircut' },
  { id: 'svc-skin-fade', name: 'Skin Fade' },
  { id: 'svc-beard-trim', name: 'Beard Trim' },
  { id: 'svc-haircut-beard', name: 'Haircut + Beard' }
];

function clearTransientAdminViewportState() {
  if (typeof document === 'undefined') return;

  const { body, documentElement } = document;
  body.style.overflow = '';
  body.style.overscrollBehavior = '';
  body.style.position = '';
  body.style.top = '';
  body.style.left = '';
  body.style.right = '';
  body.style.width = '';
  documentElement.style.overflow = '';
}

function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked || typeof window === 'undefined') return undefined;

    const scrollY = window.scrollY;
    const { body } = document;
    const previousStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      const restoredScrollY = Number.parseInt(body.style.top || '0', 10) * -1;
      body.style.position = previousStyles.position;
      body.style.top = previousStyles.top;
      body.style.left = previousStyles.left;
      body.style.right = previousStyles.right;
      body.style.width = previousStyles.width;
      body.style.overflow = previousStyles.overflow;
      window.scrollTo(0, Number.isFinite(restoredScrollY) ? restoredScrollY : scrollY);
    };
  }, [isLocked]);
}


function getTodayLondonDate() {
  return formatInTimeZone(new Date(), ADMIN_TIMEZONE, 'yyyy-MM-dd');
}

function readInitialBookingDateFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('bookingDate');
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function readInitialBookingIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('bookingId')?.trim();
  return raw || null;
}

function clearTimelineDeepLinkParamsFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of ['bookingId', 'bookingDate'] as const) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (!changed) return;
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', next);
}

function formatTimelineDateLabel(date: string) {
  const dateAtLondonMidnight = fromZonedTime(`${date}T00:00:00.000`, ADMIN_TIMEZONE);
  return formatInTimeZone(dateAtLondonMidnight, ADMIN_TIMEZONE, 'EEE dd MMM');
}

function addOneLondonCalendarDay(isoDate: string): string {
  const anchor = fromZonedTime(`${isoDate}T12:00:00`, ADMIN_TIMEZONE);
  return formatInTimeZone(addDays(anchor, 1), ADMIN_TIMEZONE, 'yyyy-MM-dd');
}

function formatRelativeTime(startAt: string, endAt: string) {
  const nowMs = Date.now();
  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();

  if (nowMs >= startMs && nowMs < endMs) return 'now';
  const diffMs = startMs - nowMs;
  if (diffMs <= 0) return 'now';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `in ${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return mins ? `in ${hours}h ${mins}m` : `in ${hours}h`;
}

function formatStartTime(startAt: string) {
return new Date(startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: ADMIN_TIMEZONE });
}
function getBookingStatusLabel(booking: Booking) {
  if (booking.status === 'BOOKED' && booking.rescheduledAt) return 'BOOKED · RESCHEDULED';
  return booking.status;
}

function getStatusA11yLabel(statusLabel: string) {
  if (statusLabel === 'BOOKED') return 'Booked';
  if (statusLabel === 'EXPIRED') return 'Expired';
  if (statusLabel === 'CANCELLED_BY_CLIENT') return 'Cancelled by client';
  if (statusLabel === 'CANCELLED_BY_SHOP') return 'Cancelled by shop';
  if (statusLabel === 'BOOKED · RESCHEDULED') return 'Booked and rescheduled';
  return statusLabel.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

type DayOpsFilter = 'all' | 'cancelled' | 'rescheduled' | 'upcoming';

type DaySummaryBarProps = {
  bookings: Booking[];
  staffOnFloorCount: number;
  nowMs: number;
  dayOpsFilter: DayOpsFilter;
  onDayOpsFilterChange: (next: DayOpsFilter) => void;
  staffPanelOpen: boolean;
  onStaffToggle: () => void;
};

function isUpcomingDayStatBooking(booking: Booking, nowMs: number) {
  const endMs = new Date(booking.endAt).getTime();
  return endMs > nowMs && booking.status === 'BOOKED';
}

function isRescheduledDayOpsBooking(booking: Booking): boolean {
  return getBookingStatusTone({ status: booking.status, rescheduledAt: booking.rescheduledAt ?? null }) === 'rescheduled';
}

function DaySummaryBar({
  bookings,
  staffOnFloorCount,
  nowMs,
  dayOpsFilter,
  onDayOpsFilterChange,
  staffPanelOpen,
  onStaffToggle,
}: DaySummaryBarProps) {
  const totalCount = bookings.length;
  const upcomingCount = bookings.filter((b) => isUpcomingDayStatBooking(b, nowMs)).length;
  const toneCounts = useMemo(() => countBookingsByStatusTone(bookings), [bookings]);
  const cancelledCount = toneCounts.cancelled;
  const rescheduledCount = toneCounts.rescheduled;

  return (
    <div className="admin-day-summary-bar" role="group" aria-label="Day metrics and quick filters">
      <button
        type="button"
        className={`admin-day-summary-stat admin-day-summary-stat--action ${dayOpsFilter === 'all' && !staffPanelOpen ? 'is-active' : ''}`}
        onClick={() => onDayOpsFilterChange('all')}
        aria-pressed={dayOpsFilter === 'all'}
        aria-label={`${totalCount} bookings today${dayOpsFilter === 'all' ? ', filter active' : ''}`}
      >
        <svg className="admin-day-summary-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M8 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm11 7H5v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8ZM6 6a1 1 0 0 0-1 1v1h14V7a1 1 0 0 0-1-1H6Z" fill="currentColor" />
        </svg>
        <span className="admin-day-summary-value" aria-hidden="true">
          {totalCount}
        </span>
        <span className="admin-day-summary-label" aria-hidden="true">
          Bookings today
        </span>
        <span className="admin-day-summary-label-short" aria-hidden="true">
          Today
        </span>
      </button>
      <div className="admin-day-summary-divider" aria-hidden="true" />
      <button
        type="button"
        className={`admin-day-summary-stat admin-day-summary-stat--action ${dayOpsFilter === 'upcoming' ? 'is-active' : ''}`}
        onClick={() => onDayOpsFilterChange(dayOpsFilter === 'upcoming' ? 'all' : 'upcoming')}
        aria-pressed={dayOpsFilter === 'upcoming'}
        aria-label={`${upcomingCount} still to come${dayOpsFilter === 'upcoming' ? ', filter active' : ''}`}
      >
        <svg className="admin-day-summary-icon admin-day-summary-icon--upcoming" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 6v6l4 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span className="admin-day-summary-value" aria-hidden="true">
          {upcomingCount}
        </span>
        <span className="admin-day-summary-label" aria-hidden="true">
          Still to come
        </span>
        <span className="admin-day-summary-label-short" aria-hidden="true">
          Soon
        </span>
      </button>
      <div className="admin-day-summary-divider" aria-hidden="true" />
      <button
        type="button"
        className={`admin-day-summary-stat admin-day-summary-stat--action ${dayOpsFilter === 'rescheduled' ? 'is-active' : ''}`}
        onClick={() => onDayOpsFilterChange(dayOpsFilter === 'rescheduled' ? 'all' : 'rescheduled')}
        aria-pressed={dayOpsFilter === 'rescheduled'}
        aria-label={`${rescheduledCount} rescheduled${dayOpsFilter === 'rescheduled' ? ', filter active' : ''}`}
      >
        <svg className="admin-day-summary-icon admin-day-summary-icon--rescheduled" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8 3v4M16 3v4M4 11h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path
            d="M12 18v-4M9.5 16.5L12 19l2.5-2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="admin-day-summary-value" aria-hidden="true">
          {rescheduledCount}
        </span>
        <span className="admin-day-summary-label" aria-hidden="true">
          Rescheduled
        </span>
        <span className="admin-day-summary-label-short" aria-hidden="true">
          Resched
        </span>
      </button>
      <div className="admin-day-summary-divider" aria-hidden="true" />
      <button
        type="button"
        className={`admin-day-summary-stat admin-day-summary-stat--action ${dayOpsFilter === 'cancelled' ? 'is-active' : ''}`}
        onClick={() => onDayOpsFilterChange(dayOpsFilter === 'cancelled' ? 'all' : 'cancelled')}
        aria-pressed={dayOpsFilter === 'cancelled'}
        aria-label={`${cancelledCount} cancelled${dayOpsFilter === 'cancelled' ? ', filter active' : ''}`}
      >
        <svg className="admin-day-summary-icon admin-day-summary-icon--cancelled" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M9 9l6 6M15 9l-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="admin-day-summary-value" aria-hidden="true">
          {cancelledCount}
        </span>
        <span className="admin-day-summary-label" aria-hidden="true">
          Cancelled
        </span>
        <span className="admin-day-summary-label-short" aria-hidden="true">
          Cancelled
        </span>
      </button>
      <div className="admin-day-summary-divider" aria-hidden="true" />
      <button
        type="button"
        className={`admin-day-summary-stat admin-day-summary-stat--action ${staffPanelOpen ? 'is-active' : ''}`}
        onClick={onStaffToggle}
        aria-pressed={staffPanelOpen}
        aria-label={`${staffOnFloorCount} barbers on shift now${staffPanelOpen ? ', roster expanded' : ''}`}
      >
        <svg className="admin-day-summary-icon admin-day-summary-icon--barbers" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="9" cy="7" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M3 20a6 6 0 0 1 12 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="18" cy="7" r="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M21 20a3 3 0 0 0-5.12-2.12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="admin-day-summary-value" aria-hidden="true">
          {staffOnFloorCount}
        </span>
        <span className="admin-day-summary-label" aria-hidden="true">
          On shift now
        </span>
        <span className="admin-day-summary-label-short" aria-hidden="true">
          Staff
        </span>
      </button>
    </div>
  );
}

function parseBookingStartAt(startAt: string) {
  const parsedDate = new Date(startAt);
  if (!Number.isNaN(parsedDate.getTime())) return parsedDate;

  const localizedMatch = startAt.match(/^(\d{2})\/(\d{2})\/(\d{4}),\s?(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (localizedMatch) {
    const [, day, month, year, hour, minute, second = '00'] = localizedMatch;
    return fromZonedTime(`${year}-${month}-${day}T${hour}:${minute}:${second}`, ADMIN_TIMEZONE);
  }

  return null;
}

function formatStartDateTime(startAt: string) {
  const parsedDate = parseBookingStartAt(startAt);
  if (parsedDate) return formatInTimeZone(parsedDate, ADMIN_TIMEZONE, 'dd/MM/yyyy, HH:mm');

  if (startAt.includes(',')) {
    const [datePart, timePartRaw = ''] = startAt.split(',');
    const hhmm = timePartRaw.trim().slice(0, 5);
    if (datePart.trim() && /^\d{2}:\d{2}$/.test(hhmm)) return `${datePart.trim()}, ${hhmm}`;

  }

  return String(startAt);

}

function isTodayInLondon(value: string, todayLondonDate: string) {
  return formatInTimeZone(new Date(value), ADMIN_TIMEZONE, 'yyyy-MM-dd') === todayLondonDate;
}

function bookingRefreshSignature(booking: Booking) {
  return [
    booking.id,
    booking.status,
    booking.startAt,
    booking.endAt,
    booking.barberId,
    booking.rescheduledAt ?? ''
  ].join('|');
}

function timeBlockRefreshSignature(block: TimeBlock) {
  return [block.id, block.title, block.startAt, block.endAt, block.barberId ?? 'all'].join('|');
}

function hasCollectionChanged<T>(prev: T[], next: T[], getSignature: (item: T) => string) {
  if (prev.length !== next.length) return true;
  const previousById = new Map(prev.map((item) => [getSignature(item), true]));
  for (const item of next) {
    if (!previousById.has(getSignature(item))) return true;
  }
  return false;
}


const normalizeSearchValue = (value: string) => value.trim().toLowerCase();

function getBookingSearchScore(booking: Booking, normalizedQuery: string) {
  if (!normalizedQuery) return 0;

  const takeMax = (a: number, b: number) => Math.max(a, b);

  const email = normalizeSearchValue(booking.email ?? '');
  const fullName = normalizeSearchValue(booking.fullName ?? '');
  const barber = normalizeSearchValue(booking.barber?.name ?? '');
  const service = normalizeSearchValue(booking.service?.name ?? '');
  const idLower = booking.id.toLowerCase();
  const timeLabel = normalizeSearchValue(formatStartTime(booking.startAt));
  const timeCompact = timeLabel.replace(':', '');

  let score = 0;

  if (email === normalizedQuery) score = takeMax(score, 6);
  else if (email.startsWith(normalizedQuery)) score = takeMax(score, 5);
  else if (email.includes(normalizedQuery)) score = takeMax(score, 4);

  if (fullName === normalizedQuery) score = takeMax(score, 6);
  else if (fullName.startsWith(normalizedQuery)) score = takeMax(score, 5);
  else if (fullName.includes(normalizedQuery)) score = takeMax(score, 4);

  if (idLower === normalizedQuery) score = takeMax(score, 6);
  else if (normalizedQuery.length >= 4 && idLower.startsWith(normalizedQuery)) score = takeMax(score, 5);
  else if (normalizedQuery.length >= 6 && idLower.includes(normalizedQuery)) score = takeMax(score, 3);

  if (barber) {
    if (barber === normalizedQuery) score = takeMax(score, 5);
    else if (barber.startsWith(normalizedQuery)) score = takeMax(score, 4);
    else if (barber.includes(normalizedQuery)) score = takeMax(score, 3);
  }

  if (service) {
    if (service === normalizedQuery) score = takeMax(score, 5);
    else if (service.startsWith(normalizedQuery)) score = takeMax(score, 4);
    else if (service.includes(normalizedQuery)) score = takeMax(score, 3);
  }

  if (timeLabel) {
    if (timeLabel === normalizedQuery) score = takeMax(score, 5);
    else if (timeLabel.startsWith(normalizedQuery)) score = takeMax(score, 4);
    const qDigits = normalizedQuery.replace(':', '');
    if (qDigits.length >= 3 && /^\d+$/.test(qDigits) && timeCompact.startsWith(qDigits)) score = takeMax(score, 4);
  }

  const statusLower = booking.status.toLowerCase();
  if (normalizedQuery === 'pending' && statusLower.includes('pending')) score = takeMax(score, 2);
  if (normalizedQuery === 'confirmed' && statusLower === 'confirmed') score = takeMax(score, 2);
  if (normalizedQuery === 'cancelled' && statusLower.includes('cancelled')) score = takeMax(score, 2);
  if (normalizedQuery === 'expired' && statusLower.includes('expired')) score = takeMax(score, 2);

  return score;
}
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** Single source of truth for barber activity. Reads the canonical `isActive` field. */
function normalizeBarberStatus(barber: Barber) {
  return barber.isActive;
}


function hashValue(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}


function isKeyboardEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
  return target.isContentEditable;
}


function roundUpLondon(now: Date, stepMinutes = SLOT_STEP_MINUTES) {
  const zoned = toZonedTime(now, ADMIN_TIMEZONE);
  const year = zoned.getFullYear();
  const month = zoned.getMonth();
  const day = zoned.getDate();
  const hours = zoned.getHours();
  const minutes = zoned.getMinutes();
  const rounded = Math.ceil(minutes / stepMinutes) * stepMinutes;
  return fromZonedTime(new Date(year, month, day, hours, rounded, 0, 0), ADMIN_TIMEZONE);
}
function formatLocalInputValue(date: Date) {
  return formatInTimeZone(date, ADMIN_TIMEZONE, "yyyy-MM-dd'T'HH:mm");
}

function formatBlockRange(startAt: string, endAt: string) {
  return `${new Date(startAt).toLocaleString('en-GB', { timeZone: ADMIN_TIMEZONE })} → ${new Date(endAt).toLocaleString('en-GB', { timeZone: ADMIN_TIMEZONE })}`;

}
function nextLunchWindow(now: Date) {
  const zonedNow = toZonedTime(now, ADMIN_TIMEZONE);
  const noon = fromZonedTime(new Date(zonedNow.getFullYear(), zonedNow.getMonth(), zonedNow.getDate(), 12, 0, 0, 0), ADMIN_TIMEZONE);
  if (now < noon) return { startAt: noon, endAt: new Date(noon.getTime() + 30 * 60000) };
  const startAt = roundUpLondon(now, SLOT_STEP_MINUTES);
  return { startAt, endAt: new Date(startAt.getTime() + 30 * 60000) };
}
type BookingsAdminMode = 'dashboard' | 'blocks' | 'reports' | 'history';

const BOOKINGS_HEADER_KICKER: Record<BookingsAdminMode, string> = {
  dashboard: 'SCHEDULE & CALENDAR',
  blocks: 'TEAM',
  reports: 'REPORTS',
  history: 'HISTORY',
};

const BOOKINGS_SECTION_HEADER: Record<BookingsAdminMode, { title: string; description: string }> = {
  dashboard: { title: 'Bookings', description: "Manage today's appointments and upcoming schedule" },
  blocks: { title: 'Team', description: 'Invite people, set roles, schedules, and who accepts online bookings' },
  reports: { title: 'Reports', description: 'Business performance analytics' },
  history: { title: 'History', description: 'Complete booking history with filters' },
};


type BookingsAdminPanelProps = {
  isActive: boolean;
  mode: BookingsAdminMode;
  onBackToDashboard?: () => void;
  isPublicDemo?: boolean;
};

export default function BookingsAdminPanel({ isActive, mode, onBackToDashboard, isPublicDemo = false }: BookingsAdminPanelProps) {
  /* Parent AdminPanel already gated session; avoid a second blocking "Checking session…" flash. */
  const [loggedIn, setLoggedIn] = useState(true);
  const [sessionBarberId, setSessionBarberId] = useState<string | null>(null);
  const [canManageBookings, setCanManageBookings] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsInitialLoading, setBookingsInitialLoading] = useState(true);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barbersInitialLoading, setBarbersInitialLoading] = useState(true);
  const [showInactiveBarbers, setShowInactiveBarbers] = useState(false);
  const [barberSaveMessage, setBarberSaveMessage] = useState('');
  const [barberSaveError, setBarberSaveError] = useState('');
  const [barberSaving, setBarberSaving] = useState(false);
  const [editingBarberAvatarFile, setEditingBarberAvatarFile] = useState<File | null>(null);
  const [editingBarberAvatarPreviewUrl, setEditingBarberAvatarPreviewUrl] = useState<string | null>(null);

  const [isAddBarberSheetOpen, setIsAddBarberSheetOpen] = useState(false);

  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);
  const [barberProfileSource, setBarberProfileSource] = useState<'ops' | 'team' | 'reports' | null>(null);
  const [profileMemberMeta, setProfileMemberMeta] = useState<TeamProfileOpenMeta | null>(null);
  const [reportsProfileBarberMeta, setReportsProfileBarberMeta] = useState<{ id: string; name: string } | null>(null);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHourRow[]>([]);
  const [workingHoursLoading, setWorkingHoursLoading] = useState(false);
  const [workingHoursSaving, setWorkingHoursSaving] = useState(false);
  const [servicesSaving, setServicesSaving] = useState(false);

  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [error, setError] = useState('');
  const [updatedBookingIds, setUpdatedBookingIds] = useState<string[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isSearchDebouncing, setIsSearchDebouncing] = useState(false);
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(-1);
  const [dayOpsFilter, setDayOpsFilter] = useState<DayOpsFilter>('all');
  const [staffRosterOpen, setStaffRosterOpen] = useState(false);

  const applyDayOpsFilter = useCallback((next: DayOpsFilter) => {
    setStaffRosterOpen(false);
    setDayOpsFilter(next);
  }, []);
  const [searchShortcutHint, setSearchShortcutHint] = useState('Ctrl+K');
  const [showSearchKbdHint, setShowSearchKbdHint] = useState(false);
  const [activeView, setActiveView] = useState<AdminBookingView>('timeline');
  const prevViewRef = useRef<AdminBookingView>('timeline');
  const [slideDirection, setSlideDirection] = useState(0);
  const [isTimelineEnterComplete, setIsTimelineEnterComplete] = useState(activeView !== 'timeline');
  const [selectedDate, setSelectedDate] = useState(() => readInitialBookingDateFromUrl() ?? getTodayLondonDate());
  const [timelineFocusBookingId, setTimelineFocusBookingId] = useState<string | null>(() => readInitialBookingIdFromUrl());
  const deepLinkBookingIdRef = useRef<string | null>(readInitialBookingIdFromUrl());
  const [historyBarberId, setHistoryBarberId] = useState<string>('all');
  const [historyDateRange, setHistoryDateRange] = useState<HistoryDateRange | null>(null);
  const [isHistoryMoreOpen, setIsHistoryMoreOpen] = useState(false);
  const [historyStatusBooking, setHistoryStatusBooking] = useState<Booking | null>(null);
  const historyMoreRef = useRef<HTMLDivElement | null>(null);


  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historySearchLoading, setHistorySearchLoading] = useState(false);

  const [cancelSuccessMessage, setCancelSuccessMessage] = useState('');
  const [cancelErrorMessage, setCancelErrorMessage] = useState('');
  const [cancelLoadingBookingId, setCancelLoadingBookingId] = useState<string | null>(null);
  const [blockScopeBarberId, setBlockScopeBarberId] = useState<string>('all');
  const [selectedBarberStatsCount, setSelectedBarberStatsCount] = useState(0);

  const canCancelBookingAsShop = useCallback(
    (booking: Booking) =>
      booking.status === 'BOOKED' && canShopAdminCancelByLeadTime(new Date(booking.startAt), nowMs),
    [nowMs]
  );

  const [blockSuccessMessage, setBlockSuccessMessage] = useState('');
  const [blockErrorMessage, setBlockErrorMessage] = useState('');
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayStartInput, setHolidayStartInput] = useState(() => formatLocalInputValue(roundUpLondon(new Date(), SLOT_STEP_MINUTES)));
  const [holidayEndInput, setHolidayEndInput] = useState(() => formatLocalInputValue(new Date(roundUpLondon(new Date(), SLOT_STEP_MINUTES).getTime() + 30 * 60000)));
  const [holidayAllDay, setHolidayAllDay] = useState(false);

  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  const inFlightRef = useRef(false);
  /** History "Load more" uses its own lock so it is not blocked by the main bookings fetch / polling. */
  const historyAppendInFlightRef = useRef(false);
  const bookingsRef = useRef<Booking[]>([]);
  const historyCursorRef = useRef<string | null>(null);
    const timeBlocksInFlightRef = useRef(false);
  const pollingStoppedRef = useRef(false);
    const bookingsRequestIdRef = useRef(0);
  const timeBlocksRequestIdRef = useRef(0);

  const previousSignaturesRef = useRef<Map<string, string>>(new Map());
    const lastBookingsQueryKeyRef = useRef<string | null>(null);
  const updatedRowsTimeoutRef = useRef<number | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const bookingShellRef = useRef<HTMLElement | null>(null);
  const historyRecentBarbersScrollRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchResultsRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollRestoreRef = useRef<{ left: number; top: number } | null>(null);
  const timelineScrollRafRef = useRef<number | null>(null);
    const pendingTimelineScrollBookingIdRef = useRef<string | null>(deepLinkBookingIdRef.current);
  const pendingListScrollBookingIdRef = useRef<string | null>(null);
  const captureTimelineScroll = useCallback(() => {
    const container = timelineScrollRef.current;
    if (!container) return;
    timelineScrollRestoreRef.current = {
      left: container.scrollLeft,
      top: container.scrollTop
    };
  }, []);

  const restoreTimelineScroll = useCallback(() => {
    if (timelineScrollRafRef.current) {
      window.cancelAnimationFrame(timelineScrollRafRef.current);
    }
    timelineScrollRafRef.current = window.requestAnimationFrame(() => {
      const container = timelineScrollRef.current;
      const savedPosition = timelineScrollRestoreRef.current;
      if (!container || !savedPosition) return;
      container.scrollLeft = savedPosition.left;
      container.scrollTop = savedPosition.top;
      timelineScrollRestoreRef.current = null;
    });
  }, []);

  useEffect(() => {
    bookingsRef.current = bookings;
  }, [bookings]);

  useEffect(() => {
    historyCursorRef.current = historyCursor;
  }, [historyCursor]);

  useEffect(() => {
    if (prevViewRef.current !== activeView) {
      setSlideDirection(VIEW_ORDER[activeView] > VIEW_ORDER[prevViewRef.current] ? 1 : -1);
      prevViewRef.current = activeView;
    }
    if (activeView === 'timeline') {
      setIsTimelineEnterComplete(false);
    }
  }, [activeView]);

  const fetchTimeBlocks = useCallback(async () => {
    if (timeBlocksInFlightRef.current) return;
    timeBlocksInFlightRef.current = true;
    const requestId = ++timeBlocksRequestIdRef.current;


    try {
      const endpoint = mode === 'dashboard'
        ? `/api/admin/timeblocks?date=${encodeURIComponent(selectedDate)}`

        : '/api/admin/timeblocks?range=today';
      const response = await fetch(endpoint, { credentials: 'include' });
      if (!response.ok) return;

      const data = (await response.json()) as { timeBlocks?: TimeBlock[] };
      if (requestId !== timeBlocksRequestIdRef.current) return;

      const incomingBlocks = data.timeBlocks ?? [];
      const changed = hasCollectionChanged(timeBlocks, incomingBlocks, timeBlockRefreshSignature);
      if (!changed) return;

      if (activeView === 'timeline') captureTimelineScroll();
      setTimeBlocks(incomingBlocks);
      if (activeView === 'timeline') restoreTimelineScroll();
    } finally {
      if (requestId === timeBlocksRequestIdRef.current) {
        timeBlocksInFlightRef.current = false;
      }

    }
 }, [activeView, captureTimelineScroll, mode, restoreTimelineScroll, selectedDate, timeBlocks]);

  const fetchBarbers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/barbers', { credentials: 'include' });
      if (response.ok) {
        const data = (await response.json()) as { barbers?: Barber[] };
        setBarbers(data.barbers ?? []);
      }
    } finally {
      setBarbersInitialLoading(false);
    }
  }, []);
  const fetchBookings = useCallback(async (appendHistory = false) => {
    const isHistoryAppend = mode === 'history' && appendHistory;

    if (!loggedIn || !isActive || pollingStoppedRef.current) {
      if (isHistoryAppend) setHistoryLoadingMore(false);
      return;
    }

    if (isHistoryAppend) {
      if (historyAppendInFlightRef.current) {
        setHistoryLoadingMore(false);
        return;
      }
      if (inFlightRef.current) {
        setHistoryLoadingMore(false);
        return;
      }
      historyAppendInFlightRef.current = true;
    } else {
      if (inFlightRef.current) return;
      if (historyAppendInFlightRef.current) return;
      inFlightRef.current = true;
    }

    if (mode === 'history' && !appendHistory) {
      setHistoryCursor(null);
      historyCursorRef.current = null;
    }

    const requestId = ++bookingsRequestIdRef.current;
    const requestQueryKey = mode === 'history'
      ? ['history', historyBarberId, historyDateRange?.from ? formatInTimeZone(historyDateRange.from, ADMIN_TIMEZONE, 'yyyy-MM-dd') : '', historyDateRange?.to ? formatInTimeZone(historyDateRange.to, ADMIN_TIMEZONE, 'yyyy-MM-dd') : '', normalizeSearchValue(debouncedSearchQuery)].join(':')
      : ['dashboard', selectedDate].join(':');


    try {
      const endpoint = (() => {
          if (mode === 'history') {
          const params = new URLSearchParams({
            view: 'history',
            limit: String(ADMIN_BOOKING_HISTORY_PAGE_SIZE),
          });
          params.set('barberId', historyBarberId ?? 'all');
          if (historyDateRange?.from && historyDateRange?.to) {
            params.set('from', formatInTimeZone(historyDateRange.from, ADMIN_TIMEZONE, 'yyyy-MM-dd'));
            params.set('to', formatInTimeZone(historyDateRange.to, ADMIN_TIMEZONE, 'yyyy-MM-dd'));
          }

          if (appendHistory && historyCursorRef.current) params.set('cursor', historyCursorRef.current);
          const historySearchQ = normalizeSearchValue(debouncedSearchQuery);
          if (historySearchQ) params.set('q', historySearchQ);
          return `/api/admin/bookings?${params.toString()}`;
        }
        return `/api/admin/bookings?date=${encodeURIComponent(selectedDate)}&mode=day`;
      })();

      const response = await fetch(endpoint, { credentials: 'include' });

      if (response.status === 401) {
        pollingStoppedRef.current = true;
        setLoggedIn(false);
        setError('Session expired. Please log in again.');
        return;
      }
      if (!response.ok) throw new Error('Fetch failed');

      const data = (await response.json()) as { bookings?: Booking[]; hasMore?: boolean; cursor?: string | null };
            if (requestId !== bookingsRequestIdRef.current) return;
      const incomingBookings = data.bookings ?? [];
      const prevList = bookingsRef.current;
      const mergedBookings = appendHistory ? [...prevList, ...incomingBookings] : incomingBookings;
      const nextSignatures = new Map(mergedBookings.map((b) => [b.id, bookingRefreshSignature(b)]));
      const previousQueryKey = lastBookingsQueryKeyRef.current;
      const canHighlightUpdatedRows = !appendHistory && previousSignaturesRef.current.size > 0 && previousQueryKey === requestQueryKey;
      const changedIds = canHighlightUpdatedRows
        ? mergedBookings.filter((b) => previousSignaturesRef.current.get(b.id) !== nextSignatures.get(b.id)).map((b) => b.id)
        : [];

      const shouldUpdateBookings = appendHistory || hasCollectionChanged(prevList, mergedBookings, bookingRefreshSignature);
      if (shouldUpdateBookings) {
        if (activeView === 'timeline') captureTimelineScroll();
        setBookings(mergedBookings);
        if (activeView === 'timeline') restoreTimelineScroll();
      }

      if (mode === 'history') {
        setHistoryHasMore(Boolean(data.hasMore));
        const nextCursor = data.cursor ?? null;
        setHistoryCursor(nextCursor);
        historyCursorRef.current = nextCursor;
      }

      previousSignaturesRef.current = nextSignatures;
            lastBookingsQueryKeyRef.current = requestQueryKey;

      if (shouldUpdateBookings && changedIds.length) {
        setUpdatedBookingIds(changedIds);
        if (updatedRowsTimeoutRef.current) window.clearTimeout(updatedRowsTimeoutRef.current);
        updatedRowsTimeoutRef.current = window.setTimeout(() => setUpdatedBookingIds([]), UPDATED_ROW_HIGHLIGHT_MS);
      }

    } catch {
      setError('Could not refresh bookings right now.');
    } finally {
      if (requestId === bookingsRequestIdRef.current) {
        if (isHistoryAppend) {
          historyAppendInFlightRef.current = false;
        } else {
          inFlightRef.current = false;
        }
        setBookingsInitialLoading(false);
        if (mode === 'history' && !isHistoryAppend) {
          setHistorySearchLoading(false);
        }
      }

      setHistoryLoadingMore(false);
    }
  }, [activeView, captureTimelineScroll, debouncedSearchQuery, historyBarberId, historyDateRange, isActive, loggedIn, mode, restoreTimelineScroll, selectedDate]);

  const loadMoreHistory = useCallback(async () => {
    if (!historyHasMore || historyLoadingMore || mode !== 'history') return;
    setHistoryLoadingMore(true);
    await fetchBookings(true);
  }, [fetchBookings, historyHasMore, historyLoadingMore, mode]);


  useEffect(() => {
    if (isPublicDemo) return;
    void (async () => {
      try {
        const response = await fetch('/api/admin/session', { credentials: 'include' });
        if (!response.ok) {
          setLoggedIn(false);
          return;
        }
        const payload = (await response.json()) as {
          barberId?: string | null;
          permissions?: string[];
          role?: string;
        };
        setSessionBarberId(payload.barberId ?? null);
        const perms = payload.permissions ?? [];
        setCanManageBookings(perms.includes('bookings.manage') || payload.role === 'OWNER' || payload.role === 'MANAGER');
      } catch {
        setLoggedIn(false);
      }
    })();
  }, [isPublicDemo]);
  useEffect(() => {
    if (!loggedIn || !isActive) return;

    void fetchBarbers();

    if (mode !== 'reports') {
      void fetchBookings();
      void fetchTimeBlocks();
    } else {
      setBookingsInitialLoading(false);
    }

    if (mode === 'history' || mode === 'reports') return;

    const id = window.setInterval(() => {
      void fetchBookings();
      void fetchTimeBlocks();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [fetchBookings, fetchBarbers, fetchTimeBlocks, isActive, loggedIn, mode]);

  useEffect(() => { if (!loggedIn || !isActive) return; const id = window.setInterval(() => setNowMs(Date.now()), LAST_UPDATED_REFRESH_MS); return () => window.clearInterval(id); }, [isActive, loggedIn]);
  useEffect(() => {
    if (!loggedIn || !isActive || mode !== 'history') return;
    const q = normalizeSearchValue(debouncedSearchQuery);
    if (q) {
      setHistorySearchLoading(true);
    } else {
      setHistorySearchLoading(false);
    }
    const timeoutId = window.setTimeout(() => { void fetchBookings(); }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [fetchBookings, debouncedSearchQuery, historyBarberId, historyDateRange, isActive, loggedIn, mode]);

  useEffect(() => {
    if (mode !== 'history') {
      setHistorySearchLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!isHistoryMoreOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (historyMoreRef.current?.contains(target)) return;
      setIsHistoryMoreOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsHistoryMoreOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isHistoryMoreOpen]);


    useEffect(() => () => {
    if (timelineScrollRafRef.current) {
      window.cancelAnimationFrame(timelineScrollRafRef.current);
    }
  }, []);


  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
    const update = () => setIsMobileViewport(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const platform = navigator.platform ?? '';
    const isApple = /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS/.test(navigator.userAgent);
    setSearchShortcutHint(isApple ? '⌘K' : 'Ctrl+K');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px) and (pointer: fine)');
    const sync = () => setShowSearchKbdHint(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    applyDayOpsFilter('all');
  }, [selectedDate, applyDayOpsFilter]);

  useEffect(() => {
    if (mode !== 'dashboard') applyDayOpsFilter('all');
  }, [mode, applyDayOpsFilter]);

  useEffect(() => {
    if (barberProfileSource === 'ops' && mode !== 'dashboard') {
      setSelectedBarberId(null);
      setBarberProfileSource(null);
      setProfileMemberMeta(null);
    }
    if (barberProfileSource === 'team' && mode !== 'blocks') {
      setSelectedBarberId(null);
      setBarberProfileSource(null);
      setProfileMemberMeta(null);
    }
    if (barberProfileSource === 'reports' && mode !== 'reports') {
      setSelectedBarberId(null);
      setBarberProfileSource(null);
      setProfileMemberMeta(null);
      setReportsProfileBarberMeta(null);
    }
  }, [barberProfileSource, mode]);

  useEffect(() => {
    if (!staffRosterOpen) return;
    setDayOpsFilter('all');
  }, [staffRosterOpen]);

  useEffect(() => {
    setIsSearchDebouncing(clientSearchQuery !== debouncedSearchQuery);
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(clientSearchQuery);
      setIsSearchDebouncing(false);
    }, 150);
    return () => window.clearTimeout(timeoutId);
  }, [clientSearchQuery, debouncedSearchQuery]);

  useEffect(() => {
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isSearchFocused = activeElement === searchInputRef.current;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        if (isKeyboardEditableTarget(event.target) || isKeyboardEditableTarget(activeElement)) return;
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key !== 'Escape') return;

      if (isSearchFocused) {
        if (clientSearchQuery) {
          event.preventDefault();
          setClientSearchQuery('');
          setDebouncedSearchQuery('');
                    setActiveSearchResultIndex(-1);
        } else {
          searchInputRef.current?.blur();
        }
        return;
      }

      if (isKeyboardEditableTarget(event.target) || isKeyboardEditableTarget(activeElement)) return;
      if (!clientSearchQuery) return;
      event.preventDefault();
      setClientSearchQuery('');
      setDebouncedSearchQuery('');
            setActiveSearchResultIndex(-1);
    };

    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [clientSearchQuery]);
  useEffect(() => {
    setActiveSearchResultIndex(-1);
  }, [debouncedSearchQuery]);

  useEffect(() => {
    if (activeSearchResultIndex < 0) return;
    const container = searchResultsRef.current;
    const activeElement = container?.querySelector(`[data-search-result-index="${activeSearchResultIndex}"]`) as HTMLElement | null;
    activeElement?.scrollIntoView({ block: 'nearest' });
  }, [activeSearchResultIndex]);


  const normalizedClientSearchQuery = useMemo(() => normalizeSearchValue(debouncedSearchQuery), [debouncedSearchQuery]);
  const shouldApplyBookingSearch = mode !== 'dashboard' || activeView === 'list';
  const effectiveClientSearchQuery = shouldApplyBookingSearch ? normalizedClientSearchQuery : '';



  const todayLondonDate = useMemo(() => getTodayLondonDate(), [nowMs]);

  const todayBookings = useMemo(() => bookings.filter((booking) => isTodayInLondon(booking.startAt, todayLondonDate)), [bookings, todayLondonDate]);
  const filteredBookings = useMemo(() => {
    if (mode !== 'history') return bookings;
    return [...bookings]
      .filter((booking) => historyBarberId === 'all' || booking.barberId === historyBarberId)
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }, [bookings, historyBarberId, mode]);

  const dayFilteredBookings = useMemo(() => {
    if (mode !== 'dashboard') return filteredBookings;
    if (dayOpsFilter === 'all') return filteredBookings;
    if (dayOpsFilter === 'cancelled') {
      return filteredBookings.filter((b) => isCancelledBookingStatus(b.status));
    }
    if (dayOpsFilter === 'rescheduled') {
      return filteredBookings.filter((b) => isRescheduledDayOpsBooking(b));
    }
    return filteredBookings.filter((b) => isUpcomingDayStatBooking(b, nowMs));
  }, [filteredBookings, mode, dayOpsFilter, nowMs]);

  const allBarbersSorted = useMemo(() => [...barbers].sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'en')), [barbers]);
  const activeBarbers = useMemo(() => allBarbersSorted.filter((barber) => normalizeBarberStatus(barber)), [allBarbersSorted]);
  const selectedDayBoundsLondon = useMemo(() => {
    const start = fromZonedTime(`${selectedDate}T00:00:00`, ADMIN_TIMEZONE);
    const end = fromZonedTime(`${selectedDate}T23:59:59.999`, ADMIN_TIMEZONE);
    return { startMs: start.getTime(), endMs: end.getTime() };
  }, [selectedDate]);

  const onFloorBarbersNow = useMemo(() => {
    const now = new Date(nowMs);
    return activeBarbers.filter((barber) => isWithinShiftNow(now, barber.todayShiftWindow ?? null));
  }, [activeBarbers, nowMs]);

  const onStaffToggle = useCallback(() => {
    setStaffRosterOpen((open) => !open);
  }, []);

  const openBarberFromOpsRoster = useCallback((barberId: string) => {
    setSelectedBarberId(barberId);
    setProfileMemberMeta(null);
    setStaffRosterOpen(false);
    setBarberProfileSource('ops');
  }, []);

  const openBarberFromReports = useCallback((barberId: string, meta: { name: string }) => {
    setReportsProfileBarberMeta({ id: barberId, name: meta.name });
    setSelectedBarberId(barberId);
    setProfileMemberMeta(null);
    setBarberProfileSource('reports');
  }, []);

  const handleBarberProfileBack = useCallback(() => {
    setSelectedBarberId(null);
    setBarberProfileSource(null);
    setReportsProfileBarberMeta(null);
    setProfileMemberMeta(null);
  }, []);

  const handleProfileToggleBookable = useCallback(
    async (next: boolean) => {
      if (!profileMemberMeta?.memberId) return;
      setBarberSaving(true);
      setBarberSaveError('');
      try {
        const res = await fetch(
          `/api/admin/team/members/${encodeURIComponent(profileMemberMeta.memberId)}/bookable`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookable: next }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setBarberSaveError(data.error || 'Could not update online bookings.');
          return;
        }
        setProfileMemberMeta((current) =>
          current ? { ...current, bookable: next } : current,
        );
        await fetchBarbers();
      } finally {
        setBarberSaving(false);
      }
    },
    [profileMemberMeta?.memberId, fetchBarbers],
  );

  const selectedBarber = useMemo(() => {
    const found = allBarbersSorted.find((barber) => barber.id === selectedBarberId);
    if (found) return found;
    if (selectedBarberId && profileMemberMeta) {
      return {
        id: selectedBarberId,
        name: profileMemberMeta.name,
        isActive: profileMemberMeta.isActive,
        active: profileMemberMeta.isActive,
        avatarUrl: profileMemberMeta.avatarUrl,
        sortOrder: undefined,
        serviceIds: profileMemberMeta.serviceIds,
        email: profileMemberMeta.email ?? undefined,
      } satisfies Barber;
    }
    if (profileMemberMeta?.memberOnly && barberProfileSource === 'team') {
      return {
        id: '',
        name: profileMemberMeta.name,
        isActive: false,
        active: false,
        avatarUrl: profileMemberMeta.avatarUrl,
        sortOrder: undefined,
        serviceIds: [],
        email: profileMemberMeta.email ?? undefined,
      } satisfies Barber;
    }
    if (barberProfileSource === 'reports' && reportsProfileBarberMeta?.id === selectedBarberId) {
      return buildReportsBarberStub(reportsProfileBarberMeta.id, reportsProfileBarberMeta.name);
    }
    return null;
  }, [allBarbersSorted, selectedBarberId, barberProfileSource, reportsProfileBarberMeta, profileMemberMeta]);
  const barberProfileContextActive =
    (Boolean(selectedBarberId) || Boolean(profileMemberMeta?.memberOnly)) &&
    (mode === 'blocks' ||
      mode === 'reports' ||
      barberProfileSource === 'ops' ||
      barberProfileSource === 'team');
  const enabledServiceIds = useMemo(() => new Set(selectedBarber?.serviceIds ?? []), [selectedBarber]);
  const selectedBarberBlocks = useMemo(() => timeBlocks.filter((block) => block.barberId === selectedBarberId), [selectedBarberId, timeBlocks]);
  const globalBlocks = useMemo(() => timeBlocks.filter((block) => !block.barberId), [timeBlocks]);



  const addBarberServiceOptions = useMemo(() => (services.length > 0 ? services : DEFAULT_ADD_BARBER_SERVICES), [services]);



  const visibleRecentBarberIds = useMemo(() => {
    if (mode !== 'history') return [] as string[];
    const latestByBarber = new Map<string, number>();

    for (const booking of bookings) {
      const current = latestByBarber.get(booking.barberId) ?? Number.NEGATIVE_INFINITY;
      const startAtMs = new Date(booking.startAt).getTime();
      if (startAtMs > current) latestByBarber.set(booking.barberId, startAtMs);
    }

    return [...latestByBarber.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, isMobileViewport ? MOBILE_RECENT_BARBERS_COUNT : DESKTOP_RECENT_BARBERS_COUNT)
      .map(([barberId]) => barberId);

  }, [bookings, isMobileViewport, mode]);
  const recentBarbers = useMemo(() => {
    const byId = new Map(barbers.map((barber) => [barber.id, barber]));
    const fallbackById = new Map(
      bookings.map((booking) => [
        booking.barberId,
        {
          id: booking.barberId,
          name: booking.barber?.name ?? 'Barber',
          avatarUrl: byId.get(booking.barberId)?.avatarUrl ?? null,
          isActive: false,
        } as Barber,
      ]),
    );


    return visibleRecentBarberIds
      .map((barberId) => byId.get(barberId) ?? fallbackById.get(barberId))
      .filter((barber): barber is Barber => Boolean(barber))
      .sort((a, b) => Number(normalizeBarberStatus(b)) - Number(normalizeBarberStatus(a)));
  }, [barbers, bookings, visibleRecentBarberIds]);

  useEffect(() => {
    const bindEdgeHint = (node: HTMLDivElement | null) => {
      if (!node) return () => undefined;

      const updateEdgeHint = () => {
        const isAtEnd = node.scrollLeft + node.clientWidth >= node.scrollWidth - 2;
        node.parentElement?.classList.toggle('admin-filter-scroll-wrap--at-end', isAtEnd);
      };

      updateEdgeHint();
      node.addEventListener('scroll', updateEdgeHint, { passive: true });
      window.addEventListener('resize', updateEdgeHint);

      return () => {
        node.removeEventListener('scroll', updateEdgeHint);
        window.removeEventListener('resize', updateEdgeHint);
      };
    };

    const unbindHistory = bindEdgeHint(historyRecentBarbersScrollRef.current);

    return () => {
      unbindHistory();
    };
  }, [mode, recentBarbers]);

  const visibleBookings = useMemo(() => {
    if (!effectiveClientSearchQuery) return dayFilteredBookings;
    if (mode === 'history' && historySearchLoading) {
      return [];
    }
    const ranked = dayFilteredBookings
      .map((booking, index) => ({ booking, score: getBookingSearchScore(booking, effectiveClientSearchQuery), index }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    if (ranked.length > 0) return ranked.map((entry) => entry.booking);
    if (mode === 'history') {
      return [];
    }
    return [];
  }, [dayFilteredBookings, effectiveClientSearchQuery, historySearchLoading, mode]);

  const opsFilteredViewActive =
    Boolean(effectiveClientSearchQuery) || (mode === 'dashboard' && dayOpsFilter !== 'all');

  const opsFilteredViewSummary = useMemo(() => {
    if (!opsFilteredViewActive) return '';
    const total = filteredBookings.length;
    const shown = visibleBookings.length;
    return `Showing ${shown} of ${total}`;
  }, [filteredBookings.length, opsFilteredViewActive, visibleBookings.length]);

  const opsActiveFilterLabels = useMemo(() => {
    if (!opsFilteredViewActive) return [] as string[];
    const parts: string[] = [];
    if (mode === 'dashboard' && dayOpsFilter === 'cancelled') parts.push('Cancelled');
    if (mode === 'dashboard' && dayOpsFilter === 'rescheduled') parts.push('Rescheduled');
    if (mode === 'dashboard' && dayOpsFilter === 'upcoming') parts.push('Still to come');
    if (effectiveClientSearchQuery) parts.push('Search');
    return parts;
  }, [dayOpsFilter, mode, effectiveClientSearchQuery, opsFilteredViewActive]);

  const clearSearchField = useCallback(() => {
    setClientSearchQuery('');
    setDebouncedSearchQuery('');
    setActiveSearchResultIndex(-1);
    searchInputRef.current?.focus();
  }, []);
  const searchResultsLabel = useMemo(() => {
    if (isSearchDebouncing) return 'Searching...';
    if (!effectiveClientSearchQuery) return '';
    if (mode === 'history' && historySearchLoading) return 'Loading...';
    if (visibleBookings.length === 0) return 'No matches';
    return `${visibleBookings.length} matches`;
  }, [effectiveClientSearchQuery, historySearchLoading, isSearchDebouncing, mode, visibleBookings.length]);

  const highlightMatch = useCallback((value: string) => {
    if (!effectiveClientSearchQuery) return value;
    const pattern = new RegExp(`(${escapeRegExp(effectiveClientSearchQuery)})`, 'ig');
    const parts = value.split(pattern);
    return parts.map((part, index) => {
      const isMatch = part.toLowerCase() === effectiveClientSearchQuery;
      if (!isMatch) return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
      return <mark key={`${part}-${index}`} className="admin-search-highlight">{part}</mark>;
    });
  }, [effectiveClientSearchQuery]);
  const searchDropdownBookings = useMemo(() => {
    if (!effectiveClientSearchQuery || isSearchDebouncing) return [] as Booking[];
    if (mode === 'history' && historySearchLoading) return [] as Booking[];
    return visibleBookings.slice(0, 8);
  }, [effectiveClientSearchQuery, historySearchLoading, isSearchDebouncing, mode, visibleBookings]);

  const historySearchResultsLoading = mode === 'history' && Boolean(effectiveClientSearchQuery) && historySearchLoading;


  const isAnyOverlayOpen =
    isAddBarberSheetOpen ||
    showHolidayModal ||
    openClientId !== null ||
    (barberProfileContextActive && (selectedBarberId !== null || Boolean(profileMemberMeta?.memberOnly)));
  useBodyScrollLock(isMobileViewport && isAnyOverlayOpen);

  const isTimelineView = mode === 'dashboard' && activeView === 'timeline';
  const selectedDateLabel = useMemo(() => formatTimelineDateLabel(selectedDate), [selectedDate]);
  const timelineNextDayLabel = useMemo(
    () => formatTimelineDateLabel(addOneLondonCalendarDay(selectedDate)),
    [selectedDate],
  );
  const goToNextTimelineDay = useCallback(() => {
    setSelectedDate((d) => addOneLondonCalendarDay(d));
  }, []);

  const handleReportsUnauthorized = useCallback(() => {
    pollingStoppedRef.current = true;
    setLoggedIn(false);
    setError('Session expired. Please log in again.');
  }, []);

  useEffect(() => {
    clearTransientAdminViewportState();
    return () => {
      clearTransientAdminViewportState();
    };
  }, []);



  const openClientProfileForBooking = useCallback(
    async (booking: Pick<Booking, 'clientId' | 'email' | 'fullName' | 'phone'>) => {
      try {
        const clientId = await resolveClientIdForBooking(booking);
        if (!clientId) {
          setError('Could not open client profile.');
          return;
        }
        setOpenClientId(clientId);
      } catch {
        setError('Could not open client profile.');
      }
    },
    [],
  );

  const scrollToTimelineBooking = useCallback((bookingId: string) => {
    const card = document.querySelector(`[data-booking-id="${bookingId}"]`) as HTMLElement | null;
    if (!card) return false;
    card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    card.classList.add('admin-booking-hit-flash');
    window.setTimeout(() => card.classList.remove('admin-booking-hit-flash'), 2200);
    window.setTimeout(() => {
      card.focus({ preventScroll: true });
    }, 220);
    return true;
  }, []);

  const scrollToListBooking = useCallback((bookingId: string) => {
    const el = document.querySelector(`[data-booking-id="${bookingId}"]`) as HTMLElement | null;
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('admin-booking-hit-flash');
    window.setTimeout(() => el.classList.remove('admin-booking-hit-flash'), 2200);
    return true;
  }, []);

  useEffect(() => {
    const deepLinkId = deepLinkBookingIdRef.current;
    if (!deepLinkId || mode !== 'dashboard') return;
    setActiveView('timeline');
    setTimelineFocusBookingId(deepLinkId);
    pendingTimelineScrollBookingIdRef.current = deepLinkId;
  }, [mode]);

  const handleTimelineFocusBookingHandled = useCallback((bookingId: string) => {
    if (deepLinkBookingIdRef.current === bookingId) {
      deepLinkBookingIdRef.current = null;
      clearTimelineDeepLinkParamsFromUrl();
    }
    pendingTimelineScrollBookingIdRef.current = null;
    setTimelineFocusBookingId((current) => (current === bookingId ? null : current));
  }, []);

  const jumpToTimelineBooking = useCallback(
    (booking: AdminBookingsOpsSearchBooking) => {
      if (mode === 'dashboard') {
        if (activeView === 'timeline') {
          setTimelineFocusBookingId(booking.id);
          pendingTimelineScrollBookingIdRef.current = booking.id;
          if (!scrollToTimelineBooking(booking.id)) {
            // Expansion/scroll handled via focusBookingId once the slot opens.
          }
        } else {
          pendingListScrollBookingIdRef.current = booking.id;
          if (scrollToListBooking(booking.id)) {
            pendingListScrollBookingIdRef.current = null;
          }
        }
      } else if (mode === 'history') {
        pendingListScrollBookingIdRef.current = booking.id;
        if (scrollToListBooking(booking.id)) {
          pendingListScrollBookingIdRef.current = null;
        }
      }

      void openClientProfileForBooking(booking);
      setClientSearchQuery('');
      setDebouncedSearchQuery('');
      setActiveSearchResultIndex(-1);
      searchInputRef.current?.blur();
    },
    [activeView, mode, openClientProfileForBooking, scrollToListBooking, scrollToTimelineBooking]
  );

  const handleTimelineBookingClick = useCallback(
    (booking: TimelineBooking) => {
      void openClientProfileForBooking(booking);
    },
    [openClientProfileForBooking]
  );

  useEffect(() => {
    const pendingBookingId = pendingTimelineScrollBookingIdRef.current;
    if (!pendingBookingId || activeView !== 'timeline') return;
    if (scrollToTimelineBooking(pendingBookingId)) {
      pendingTimelineScrollBookingIdRef.current = null;
      if (deepLinkBookingIdRef.current === pendingBookingId) {
        deepLinkBookingIdRef.current = null;
        clearTimelineDeepLinkParamsFromUrl();
      }
      setTimelineFocusBookingId((current) => (current === pendingBookingId ? null : current));
    }
  }, [activeView, scrollToTimelineBooking, visibleBookings]);

  useEffect(() => {
    const pendingId = pendingListScrollBookingIdRef.current;
    if (!pendingId) return;
    if (scrollToListBooking(pendingId)) {
      pendingListScrollBookingIdRef.current = null;
    }
  }, [activeView, mode, scrollToListBooking, visibleBookings]);

  useEffect(() => {
    if (!editingBarberAvatarFile) {
      setEditingBarberAvatarPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(editingBarberAvatarFile);
    setEditingBarberAvatarPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [editingBarberAvatarFile]);

  useEffect(() => {
    setEditingBarberAvatarFile(null);
    setEditingBarberAvatarPreviewUrl(null);
  }, [selectedBarberId]);

  useLayoutEffect(() => {
    if (!barberProfileContextActive || !selectedBarber) return;
    const el = bookingShellRef.current;
    if (!el) return;

    const run = () => scrollDocumentAndAncestorsToTop(el);
    run();
    const raf = requestAnimationFrame(run);
    const t = window.setTimeout(run, 0);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [barberProfileContextActive, selectedBarberId, selectedBarber]);

  const fetchServices = useCallback(async () => {
    const response = await fetch('/api/admin/services', { credentials: 'include' });
    if (!response.ok) return;
    const data = (await response.json()) as { services?: ServiceOption[] };
    setServices((data.services ?? []).filter((service) => service.isActive !== false));
  }, []);

  const fetchWorkingHours = useCallback(async (barberId: string) => {
    if (!barberId) return;
    setWorkingHoursLoading(true);
    const response = await fetch(`/api/admin/barbers/${barberId}/rules`, { credentials: 'include' });
    const payload: WorkingHoursResponse = await response.json().catch(() => ({}));
    if (response.ok) {
      setWorkingHours(normalizeWorkingHourRows(payload.rules));
    }
    setWorkingHoursLoading(false);
  }, []);

  useEffect(() => {
    if (!loggedIn || !isActive) return;
    if (!barberProfileContextActive) return;
    void fetchServices();
  }, [barberProfileContextActive, fetchServices, isActive, loggedIn]);

  const fetchSelectedBarberStats = useCallback(async (barberId: string) => {
    if (!barberId) {
      setSelectedBarberStatsCount(0);
      return;
    }
    const params = new URLSearchParams({ barberId, view: 'stats' });
    const response = await fetch(`/api/admin/bookings?${params.toString()}`, { credentials: 'include' });
    if (!response.ok) {
      setSelectedBarberStatsCount(0);
      return;
    }
    const payload = await response.json().catch(() => ({ totalBookingsServed: 0 }));
    setSelectedBarberStatsCount(Number(payload.totalBookingsServed ?? 0));
  }, []);


  useEffect(() => {
    if (!loggedIn || !isActive || !barberProfileContextActive || !selectedBarberId) return;
    void fetchWorkingHours(selectedBarberId);
  }, [barberProfileContextActive, fetchWorkingHours, isActive, loggedIn, selectedBarberId]);
  useEffect(() => {
    if (!loggedIn || !isActive || !barberProfileContextActive || !selectedBarberId) {
      setSelectedBarberStatsCount(0);
      return;
    }
    void fetchSelectedBarberStats(selectedBarberId);
  }, [barberProfileContextActive, fetchSelectedBarberStats, isActive, loggedIn, selectedBarberId]);


  async function saveWorkingHours(nextRules?: WorkingHourRow[]) {
    if (!selectedBarberId) return false;
    const rulesToSave = (nextRules ?? workingHours).slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    setWorkingHoursSaving(true);
    setBarberSaveMessage('');
    setBarberSaveError('');
    const response = await fetch(`/api/admin/barbers/${selectedBarberId}/rules`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rules: rulesToSave })
    });
    const payload: WorkingHoursResponse = await response.json().catch(() => ({}));
    if (!response.ok) {
      setBarberSaveError(payload.error ?? 'Could not save working hours.');
      setWorkingHoursSaving(false);
      return false;
    }
        if (payload.rules) {
      setWorkingHours(normalizeWorkingHourRows(payload.rules));
    }

    setBarberSaveMessage('Working hours saved.');
    setWorkingHoursSaving(false);
        return true;
  }


  async function saveServiceIds(serviceIds: string[]) {
    if (!selectedBarberId) return;
    setServicesSaving(true);
    setBarberSaveMessage('');
    setBarberSaveError('');
    const response = await fetch(`/api/admin/barbers/${selectedBarberId}/services`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ serviceIds })
    });
    const payload = await response.json().catch(() => ({} as { error?: string; serviceIds?: string[] }));
    if (!response.ok) {
      setBarberSaveError(payload.error ?? 'Could not save barber services.');
      setServicesSaving(false);
      return;
    }

    const nextServiceIds = payload.serviceIds ?? serviceIds;
    setBarbers((current) => current.map((barber) => barber.id === selectedBarberId ? { ...barber, serviceIds: nextServiceIds } : barber));
    setBarberSaveMessage('Services updated.');
    setServicesSaving(false);
  }

  async function toggleServiceForBarber(serviceId: string, enabled: boolean) {
    const current = new Set(selectedBarber?.serviceIds ?? []);
    if (enabled) current.add(serviceId);
    else current.delete(serviceId);
    await saveServiceIds(Array.from(current));
  }




  async function cancelBookingByShop(booking: Booking) {
    setCancelLoadingBookingId(booking.id);
    setCancelErrorMessage('');
    try {
      await adminFetchJson('/api/admin/bookings/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id }),
        errorMessage: 'Could not cancel booking right now.',
      });
      setCancelSuccessMessage('Booking cancelled successfully.');
      await fetchBookings();
    } catch (cancelError) {
      setCancelErrorMessage(cancelError instanceof Error ? cancelError.message : 'Could not cancel booking right now.');
    } finally {
      setCancelLoadingBookingId(null);
    }
}

  async function createTimeBlock(title: string, startAt: Date, endAt: Date) {
    setBlockErrorMessage('');
    setBlockSuccessMessage('');
    try {
      await adminFetchJson('/api/admin/timeblocks/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, startAt: startAt.toISOString(), endAt: endAt.toISOString(), barberId: selectedBarberId ?? (blockScopeBarberId === 'all' ? null : blockScopeBarberId) }),
        errorMessage: 'Could not create time block.',
      });
    } catch (blockError) {
      setBlockErrorMessage(blockError instanceof Error ? blockError.message : 'Could not create time block.');
      return;
    }
    setBlockSuccessMessage('Time block created.');
    await Promise.all([fetchBookings(), fetchTimeBlocks()]);
  }
  async function createProfileBlock(payload: {
    type: 'BREAK' | 'HOLIDAY';
    startAtInput: string;
    endAtInput: string;
    allDay?: boolean;
  }) {
    const startAt = payload.allDay
      ? fromZonedTime(new Date(`${payload.startAtInput.slice(0, 10)}T00:00:00`), ADMIN_TIMEZONE)
      : fromZonedTime(new Date(payload.startAtInput), ADMIN_TIMEZONE);
    const endAt = payload.allDay
      ? fromZonedTime(new Date(`${payload.endAtInput.slice(0, 10)}T23:59:00`), ADMIN_TIMEZONE)
      : fromZonedTime(new Date(payload.endAtInput), ADMIN_TIMEZONE);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      setBlockErrorMessage('Please provide a valid date range.');
      setBlockSuccessMessage('');
      return;
    }

    if (endAt <= startAt) {
      setBlockErrorMessage(payload.type === 'HOLIDAY'
        ? 'Vacation end must be after start.'
        : 'Break end must be after start.');
      setBlockSuccessMessage('');
      return;
    }

    await createTimeBlock(payload.type, startAt, endAt);
  }


  async function handleQuickBlock30() {
    const startAt = roundUpLondon(new Date(), SLOT_STEP_MINUTES);
    const endAt = new Date(startAt.getTime() + 30 * 60000);
    await createTimeBlock('Blocked', startAt, endAt);
  }

  async function handleQuickLunch() {
    const { startAt, endAt } = nextLunchWindow(new Date());
    await createTimeBlock('Lunch', startAt, endAt);
  }

  async function submitHoliday(event: React.FormEvent) {
    event.preventDefault();
    const startAt = holidayAllDay
      ? fromZonedTime(new Date(`${holidayStartInput.slice(0, 10)}T00:00:00`), ADMIN_TIMEZONE)
      : fromZonedTime(new Date(holidayStartInput), ADMIN_TIMEZONE);
    const endAt = holidayAllDay
      ? fromZonedTime(new Date(`${holidayEndInput.slice(0, 10)}T23:59:00`), ADMIN_TIMEZONE)
      : fromZonedTime(new Date(holidayEndInput), ADMIN_TIMEZONE);
    await createTimeBlock('Holiday', startAt, endAt);
    setShowHolidayModal(false);
  }

  async function deleteTimeBlock(id: string) {
    setBlockErrorMessage('');
    setBlockSuccessMessage('');
    const response = await fetch('/api/admin/timeblocks/delete', {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id })
    });
    if (!response.ok) {
      setBlockErrorMessage('Could not remove time block.');
      return;
    }
    setBlockSuccessMessage('Time block removed.');
    await Promise.all([fetchBookings(), fetchTimeBlocks()]);

  }
  async function saveSelectedBarberIdentity(payload: { name: string; email: string }) {
    if (!selectedBarberId) return false;

    setBarberSaveMessage('');
    setBarberSaveError('');
    setBarberSaving(true);

    try {
      const response = await fetch('/api/admin/barbers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: selectedBarberId,
          name: payload.name,
          email: payload.email,
        }),
      });
      const data = await response.json().catch(() => ({ error: 'Could not save profile details.' }));

      if (!response.ok) {
        setBarberSaveError(
          typeof data.error === 'string' ? data.error : 'Could not save profile details.',
        );
        return false;
      }

      setBarberSaveMessage('Profile details updated.');
      await fetchBarbers();
      return true;
    } finally {
      setBarberSaving(false);
    }
  }

  async function saveSelectedBarberAvatar() {
    if (!selectedBarberId || !selectedBarber || !editingBarberAvatarFile) return;

    setBarberSaveMessage('');
    setBarberSaveError('');

    if (editingBarberAvatarFile.size > 5 * 1024 * 1024) {
      setBarberSaveError('Avatar is too large. Maximum size is 5MB.');
      return;
    }

    const serviceIds = Array.from(new Set(selectedBarber.serviceIds ?? []));
    if (serviceIds.length === 0) {
      setBarberSaveError('Select at least one service before saving the avatar.');
      return;
    }

    setBarberSaving(true);
    const formData = new FormData();
    formData.set('id', selectedBarberId);
    formData.set('name', selectedBarber.name);
    formData.set('isActive', String(normalizeBarberStatus(selectedBarber)));
    formData.set('serviceIds', JSON.stringify(serviceIds));
    formData.set('avatar', editingBarberAvatarFile);

    const response = await fetch('/api/admin/barbers', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    const payload = await response.json().catch(() => ({ error: 'Could not save avatar.' }));

    if (!response.ok) {
      setBarberSaveError(payload.error || 'Could not save avatar.');
      setBarberSaving(false);
      return;
    }

    setEditingBarberAvatarFile(null);
    setEditingBarberAvatarPreviewUrl(null);
    setBarberSaveMessage('Avatar updated.');
    setBarberSaving(false);
    await fetchBarbers();
  }


  async function updateBarberStatus(barberId: string, isActive: boolean) {
    setBarberSaveMessage('');
    setBarberSaveError('');
    const response = await fetch('/api/admin/barbers', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: barberId, isActive })
    });

    if (!response.ok) {
      setBarberSaveError(isActive ? 'Could not reactivate barber.' : 'Could not deactivate barber.');
      return;
    }

    setBarberSaveMessage(isActive ? 'Barber reactivated.' : 'Barber deactivated.');
    await fetchBarbers();
  }
  async function deleteBarber(barberId: string) {
    setBarberSaveMessage('');
    setBarberSaveError('');
    setBarberSaving(true);

    try {
      const response = await fetch('/api/admin/barbers/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: barberId })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: unknown };
      const errorFromPayload =
        typeof payload.error === 'string' ? payload.error : 'Could not delete barber.';
      const treatAsSuccess =
        response.ok ||
        response.status === 404 ||
        (!response.ok && errorFromPayload === 'Barber not found.');

      if (!treatAsSuccess) {
        setBarberSaveError(errorFromPayload);
        return;
      }

      setSelectedBarberId((current) => current === barberId ? null : current);
      setProfileMemberMeta(null);
      setHistoryBarberId((current) => current === barberId ? 'all' : current);
      setReportsProfileBarberMeta((current) => (current?.id === barberId ? null : current));
      setBlockScopeBarberId((current) => current === barberId ? 'all' : current);
      setSelectedBarberStatsCount(0);
      setWorkingHours([]);
      setEditingBarberAvatarFile(null);
      setEditingBarberAvatarPreviewUrl(null);
      setBarberSaveMessage('Barber removed successfully.');
      await Promise.all([fetchBarbers(), fetchTimeBlocks()]);
    } catch (deleteError) {
      setBarberSaveError(deleteError instanceof Error ? deleteError.message : 'Could not delete barber.');
    } finally {
      setBarberSaving(false);
    }
  }

  const openAddBarberSheet = useCallback(() => {
    if (isPublicDemo) {
      notifyAdminDemoBlocked();
      return;
    }
    setBarberSaveError('');
    setBarberSaveMessage('');
    setIsAddBarberSheetOpen(true);
  }, [isPublicDemo]);


  const dashboardOpsDashCluster =
    mode === 'dashboard' ? (
      <div className="admin-bookings-ops-dash-cluster">
        {!isMobileViewport ? <AdminDesktopDashHeroSlot /> : null}

        <section
          className={`admin-bookings-ops admin-bookings-ops--dashboard${staffRosterOpen ? ' admin-bookings-ops--staff-roster-open' : ''}`}
          aria-label="Operations dashboard"
        >
          <div className="admin-bookings-ops-dash-controls-stack" role="region" aria-label="Dashboard view controls">
            <div className="admin-bookings-ops-dash-control-deck">
              <div className="admin-bookings-ops-toolbar">
                <div className="admin-bookings-ops-controls">
                  <div className="admin-dashboard-controls admin-dashboard-controls--ops-dash">
                    <div className="admin-view-toggle" role="tablist" aria-label="Booking view">
                      {(['timeline', 'list'] as const).map((view) => {
                        const isActiveTab = activeView === view;
                        const label = view === 'timeline' ? 'Timeline' : 'List';
                        return (
                          <button
                            key={view}
                            type="button"
                            role="tab"
                            aria-selected={isActiveTab}
                            className={isActiveTab ? 'active' : ''}
                            onClick={() => setActiveView(view)}
                          >
                            {view === 'timeline' ? (
                              <Clock className="admin-view-toggle-icon" aria-hidden />
                            ) : (
                              <ListOrdered className="admin-view-toggle-icon" aria-hidden />
                            )}
                            <span className="admin-view-toggle-label">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <AdminBookingDatePicker
                      value={selectedDate}
                      label={selectedDateLabel}
                      onChange={setSelectedDate}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="admin-bookings-ops-operations-stack">
            {!bookingsInitialLoading ? (
              <DaySummaryBar
                bookings={bookings}
                staffOnFloorCount={onFloorBarbersNow.length}
                nowMs={nowMs}
                dayOpsFilter={dayOpsFilter}
                onDayOpsFilterChange={applyDayOpsFilter}
                staffPanelOpen={staffRosterOpen}
                onStaffToggle={onStaffToggle}
              />
            ) : null}
          </div>

          {opsFilteredViewActive ? (
            <div className="admin-bookings-ops-filter-bar" aria-live="polite">
              <div className="admin-bookings-ops-filter-bar-main">
                <span className="admin-bookings-ops-filter-summary">{opsFilteredViewSummary}</span>
                {opsActiveFilterLabels.length > 0 ? (
                  <span className="admin-bookings-ops-filter-chips">
                    {opsActiveFilterLabels.map((label) => (
                      <span key={label} className="admin-bookings-ops-filter-chip">
                        {label}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {staffRosterOpen ? (
            <div className="admin-bookings-ops-staff-roster">
              {selectedDate !== todayLondonDate ? (
                <p className="muted admin-bookings-ops-staff-roster-note">
                  On-floor staff reflects today (London time), not the selected calendar date.
                </p>
              ) : null}
              {onFloorBarbersNow.length === 0 ? (
                barbersInitialLoading ? (
                  <BarberRosterOverviewGridSkeleton ariaLabel="Loading barbers on shift" />
                ) : (
                  <p className="muted admin-bookings-ops-staff-roster-empty">No barbers on shift right now.</p>
                )
              ) : (
                <div className="admin-barber-list-wrap admin-barbers-overview-list-wrap">
                  <ul className="admin-barber-grid admin-barbers-overview-grid" aria-label="Barbers on shift now">
                    {onFloorBarbersNow.map((barber, orderIndex) => {
                      const now = new Date(nowMs);
                      const nextBookingPreview = getNextBookingForBarber(bookings, barber.id, now);
                      const availStatus = getBarberAvailabilityStatusForDayRange(
                        barber,
                        bookings,
                        now,
                        selectedDayBoundsLondon.startMs,
                        selectedDayBoundsLondon.endMs
                      );
                      const dayFill = getDayFillForRange(bookings, barber.id, selectedDayBoundsLondon.startMs, selectedDayBoundsLondon.endMs);
                      const todayLine = getTodayLine(barber);
                      return (
                        <AdminBarberRosterCard
                          key={barber.id}
                          barber={barber}
                          orderIndex={orderIndex}
                          barberIsActive={normalizeBarberStatus(barber)}
                          nextBookingPreview={nextBookingPreview}
                          availStatus={availStatus}
                          dayFill={dayFill}
                          todayLine={todayLine}
                          getInitials={getInitials}
                          onOpenBarber={openBarberFromOpsRoster}
                          bookingsLength={bookings.length}
                          variant="ops"
                        />
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>
    ) : null;

  const barberProfileView = selectedBarber ? (
    <BarberProfile
      barber={selectedBarber}
      barberAvatarPreviewUrl={editingBarberAvatarPreviewUrl}
      barberSaving={barberSaving}
      weekDays={WEEK_DAYS}
      isActive={normalizeBarberStatus(selectedBarber)}
      totalBookingsServed={selectedBarberStatsCount}
      services={services}
      enabledServiceIds={enabledServiceIds}
      servicesSaving={servicesSaving}
      workingHours={workingHours}
      workingHoursLoading={workingHoursLoading}
      workingHoursSaving={workingHoursSaving}
      blocks={selectedBarberBlocks}
      blockSuccessMessage={blockSuccessMessage}
      blockErrorMessage={blockErrorMessage}
      getInitials={getInitials}
      onClose={handleBarberProfileBack}
      onBarberUpdated={async () => {
        await Promise.all([
          fetchBarbers(),
          selectedBarberId ? fetchWorkingHours(selectedBarberId) : Promise.resolve(),
        ]);
      }}
      onBarberAvatarChange={setEditingBarberAvatarFile}
      onSaveAvatar={() => void saveSelectedBarberAvatar()}
      onToggleActive={() => void updateBarberStatus(selectedBarber.id, !normalizeBarberStatus(selectedBarber))}
      onToggleService={(serviceId, enabled) => void toggleServiceForBarber(serviceId, enabled)}
      barberSaveMessage={barberSaveMessage}
      barberSaveError={barberSaveError}
      onSetWorkingHours={setWorkingHours}
      onSaveWorkingHours={saveWorkingHours}
      onCreateBlock={(payload) => void createProfileBlock(payload)}
      onDeleteBlock={(blockId) => void deleteTimeBlock(blockId)}
      onDeleteBarber={() => void deleteBarber(selectedBarber.id)}
      canToggleBookable={Boolean(profileMemberMeta?.canToggleBookable) && !profileMemberMeta?.memberOnly}
      bookable={profileMemberMeta?.bookable ?? normalizeBarberStatus(selectedBarber)}
      role={profileMemberMeta?.role}
      accountAccess={profileMemberMeta?.accountAccess}
      memberOnly={Boolean(profileMemberMeta?.memberOnly)}
      onSaveIdentity={
        profileMemberMeta?.memberOnly ? undefined : (payload) => saveSelectedBarberIdentity(payload)
      }
      onToggleBookable={
        profileMemberMeta?.canToggleBookable && !profileMemberMeta?.memberOnly
          ? (next) => void handleProfileToggleBookable(next)
          : undefined
      }
    />
  ) : null;

  if (!isActive) return null;
  if (!isPublicDemo && !loggedIn) return <section className="surface booking-shell"><h2>ADMIN</h2><p className="muted">Unauthorized. Verify your admin secret and reload this page.</p>{error && <p>{error}</p>}</section>;

  return (
    <section
      ref={bookingShellRef}
      className={`surface booking-shell${mode === 'reports' ? ' booking-shell--reports' : ''}${mode === 'blocks' ? ' admin-services-shell' : ''}`}
    >
      {mode === 'dashboard' ? (
        <div data-feature261-booking-overview-shot="">
          <AdminSectionHeader
            title={BOOKINGS_SECTION_HEADER.dashboard.title}
            description={BOOKINGS_SECTION_HEADER.dashboard.description}
            metaBadge={`${todayBookings.length} today`}
            metaBadgeVariant="success"
            actions={undefined}
          />
          {dashboardOpsDashCluster}
          <div className="admin-view-transition-container">
            <AnimatePresence initial={false} custom={{ dir: slideDirection, mobile: isMobileViewport }} mode="wait">
              {activeView === 'timeline' ? (
                <motion.div
                  key="timeline"
                  className="admin-view-motion-wrap admin-view-motion-wrap--timeline"
                  custom={{ dir: slideDirection, mobile: isMobileViewport }}
                  variants={viewSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  onAnimationComplete={() => setIsTimelineEnterComplete(true)}
                  style={{ width: '100%' }}
                >
                  <AdminErrorBoundary>
                    <TodayTimeline
                      barbers={activeBarbers}
                      bookings={visibleBookings}
                      timeBlocks={timeBlocks}
                      selectedDate={selectedDate}
                      isLoading={bookingsInitialLoading || barbersInitialLoading}
                      isSearchActive={Boolean(effectiveClientSearchQuery) || dayOpsFilter !== 'all'}
                      scrollContainerRef={timelineScrollRef}
                      onBookingClick={handleTimelineBookingClick}
                      onGoToNextDay={goToNextTimelineDay}
                      nextDayShortLabel={timelineNextDayLabel}
                      allowInitialNowScroll={isTimelineEnterComplete && !timelineFocusBookingId}
                      focusBookingId={timelineFocusBookingId}
                      onFocusBookingHandled={handleTimelineFocusBookingHandled}
                      sessionBarberId={sessionBarberId}
                      canManageBookings={canManageBookings}
                      floatingTopRight={
                        isMobileViewport ? (
                          <AdminBookingDatePicker
                            value={selectedDate}
                            label={selectedDateLabel}
                            onChange={setSelectedDate}
                            className="admin-date-picker-label--floating"
                            showIcon={false}
                          />
                        ) : null
                      }
                    />
                  </AdminErrorBoundary>
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  className="admin-view-motion-wrap admin-view-motion-wrap--list"
                  custom={{ dir: slideDirection, mobile: isMobileViewport }}
                  variants={viewSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  style={{ width: '100%' }}
                >
                  <div className="admin-bookings-list-search">
                    <AdminBookingsOpsSearch
                      variant="standard"
                      searchInputRef={searchInputRef}
                      searchResultsRef={searchResultsRef}
                      clientSearchQuery={clientSearchQuery}
                      onClientSearchQueryChange={setClientSearchQuery}
                      searchDropdownBookings={searchDropdownBookings}
                      searchResultsLabel={searchResultsLabel}
                      searchResultsLoading={historySearchResultsLoading}
                      activeSearchResultIndex={activeSearchResultIndex}
                      onActiveSearchResultIndexChange={setActiveSearchResultIndex}
                      highlightMatch={highlightMatch}
                      formatStartTime={formatStartTime}
                      onSelectBooking={jumpToTimelineBooking}
                      onClearSearch={clearSearchField}
                      showKbdHint={showSearchKbdHint}
                      searchShortcutHint={searchShortcutHint}
                    />
                  </div>
                  <AdminBookingsScheduleList
                    bookings={visibleBookings}
                    nowMs={nowMs}
                    selectedDate={selectedDate}
                    todayLondonDate={todayLondonDate}
                    selectedDateLabel={selectedDateLabel}
                    bookingsInitialLoading={bookingsInitialLoading}
                    updatedBookingIds={updatedBookingIds}
                    highlightMatch={highlightMatch}
                    formatStartTime={formatStartTime}
                    onOpenClient={openClientProfileForBooking}
                    onCancelBooking={cancelBookingByShop}
                    cancelLoadingBookingId={cancelLoadingBookingId}
                    canCancelBooking={canCancelBookingAsShop}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <>
          <AdminSectionHeader
            title={BOOKINGS_SECTION_HEADER[mode].title}
            description={BOOKINGS_SECTION_HEADER[mode].description}
            metaBadge={
              mode === 'blocks'
                ? `${barbers.length} people`
                : undefined
            }
            metaBadgeVariant={undefined}
            actions={
              mode === 'blocks' ? (
                <button
                  type="button"
                  className="btn btn--primary btn--icon"
                  aria-label="Add team member"
                  title="Add team member"
                  onClick={openAddBarberSheet}
                >
                  <Plus aria-hidden />
                </button>
              ) : undefined
            }
          />
          {!isMobileViewport ? <AdminDesktopDashHeroSlot /> : null}
        </>
      )}

      {cancelSuccessMessage && <p className="admin-inline-success">{cancelSuccessMessage}</p>}
      {cancelErrorMessage && <p className="admin-inline-error">{cancelErrorMessage}</p>}
      {mode !== 'reports' && (
        <>

          {mode === 'blocks' ? (
              <BarbersOverview
                barbers={allBarbersSorted}
                barbersLoading={barbersInitialLoading}
                services={addBarberServiceOptions}
                showInactiveBarbers={showInactiveBarbers}
                barberSaveMessage={barberSaveMessage}
                barberSaveError={barberSaveError}
                isAddBarberSheetOpen={isAddBarberSheetOpen}
                globalBlocks={globalBlocks}
                bookings={bookings}
                getInitials={getInitials}
                onShowInactiveChange={setShowInactiveBarbers}
                onOpenBarber={(barberId, meta) => {
                  setSelectedBarberId(barberId);
                  setProfileMemberMeta(meta ?? null);
                  setBarberProfileSource('team');
                }}
                onCloseAddBarberSheet={() => {
                  setIsAddBarberSheetOpen(false);
                }}
                onBarberSaved={async () => {
                  await fetchBarbers();
                }}
                formatBlockRange={formatBlockRange}
              />
          ) : (
      <>

      {mode === 'history' ? (
        <AdminBookingsScheduleList
          variant="history"
          heading="Booking history"
          bookings={visibleBookings}
          nowMs={nowMs}
          bookingsInitialLoading={bookingsInitialLoading || historySearchLoading}
          updatedBookingIds={updatedBookingIds}
          highlightMatch={highlightMatch}
          formatStartTime={formatStartTime}
          formatDateTime={formatStartDateTime}
          getHistoryStatusLine={(booking) => getStatusA11yLabel(getBookingStatusLabel(booking))}
          historyDateFiltered={Boolean(historyDateRange)}
          onClearHistoryDateRange={historyDateRange ? () => setHistoryDateRange(null) : undefined}
          onOpenClient={openClientProfileForBooking}
          onEditHistoryStatus={setHistoryStatusBooking}
          statusEditorBookingId={historyStatusBooking?.id ?? null}
          onClientAvatarChange={(clientId, nextUrl) => {
            setBookings((previous) => previous.map((booking) => (
              booking.clientId === clientId
                ? { ...booking, clientAvatarUrl: nextUrl }
                : booking
            )));
          }}
          historyFilters={(
            <section className="admin-history-filters">
              <div className="admin-history-row">
                <label>Recent barbers</label>
                <div className="admin-history-barber-controls">
                  <div className="admin-filter-scroll-wrap">
                    <div ref={historyRecentBarbersScrollRef} className="admin-history-recent-scroll">
                      <div className="admin-history-recent-barbers" role="group" aria-label="Recent barbers">
                        <button
                          type="button"
                          className={`admin-history-avatar admin-history-avatar--all ${historyBarberId === 'all' ? 'is-active' : ''}`}
                          onClick={() => setHistoryBarberId('all')}
                          aria-pressed={historyBarberId === 'all'}
                        >
                          ALL
                        </button>
                        {recentBarbers.map((barber) => {
                          const hashIndex = hashValue(`${barber.id}:${barber.name}`) % 6;
                          const isActive = historyBarberId === barber.id;

                          return (
                            <BarberChip
                              key={barber.id}
                              barber={barber}
                              toneIndex={hashIndex}
                              isSelected={isActive}
                              onClick={() => setHistoryBarberId(barber.id)}
                              ariaLabel={`Filter by ${barber.name}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="admin-history-control-actions">
                    <div className="admin-history-more" ref={historyMoreRef}>
                      <button
                        type="button"
                        className={`admin-history-icon-button ${isHistoryMoreOpen ? 'is-active' : ''}`}
                        onClick={() => setIsHistoryMoreOpen((current) => !current)}
                        aria-haspopup="menu"
                        aria-expanded={isHistoryMoreOpen}
                        aria-label="Show all barbers"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                          <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v1A1.5 1.5 0 0 1 18.5 9h-13A1.5 1.5 0 0 1 4 7.5v-1Zm0 5A1.5 1.5 0 0 1 5.5 10h13a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 12.5v-1Zm1.5 3.5A1.5 1.5 0 0 0 4 16.5v1A1.5 1.5 0 0 0 5.5 19h13a1.5 1.5 0 0 0 1.5-1.5v-1a1.5 1.5 0 0 0-1.5-1.5h-13Z" fill="currentColor" />
                        </svg>
                      </button>

                      {isHistoryMoreOpen ? (
                        <div className="admin-history-more-menu" role="menu" aria-label="All barbers">
                          <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={historyBarberId === 'all'}
                            className={`admin-history-more-item ${historyBarberId === 'all' ? 'is-active' : ''}`}
                            onClick={() => {
                              setHistoryBarberId('all');
                              setIsHistoryMoreOpen(false);
                            }}
                          >
                            All barbers
                          </button>
                          {allBarbersSorted.map((barber) => (
                            <button
                              key={barber.id}
                              type="button"
                              role="menuitemradio"
                              aria-checked={historyBarberId === barber.id}
                              className={`admin-history-more-item ${historyBarberId === barber.id ? 'is-active' : ''}`}
                              onClick={() => {
                                setHistoryBarberId(barber.id);
                                setIsHistoryMoreOpen(false);
                              }}
                            >
                              {barber.name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <HistoryDateRangePicker
                      dateRange={historyDateRange}
                      isMobileViewport={isMobileViewport}
                      timezone={ADMIN_TIMEZONE}
                      onChangeRange={setHistoryDateRange}
                      onClear={() => setHistoryDateRange(null)}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}
          historyToolbar={(
            <div className="admin-bookings-history-search-toolbar">
              {opsFilteredViewActive ? (
                <div className="admin-bookings-ops-filter-bar admin-bookings-ops-filter-bar--compact" aria-live="polite">
                  <div className="admin-bookings-ops-filter-bar-main">
                    <span className="admin-bookings-ops-filter-summary">{opsFilteredViewSummary}</span>
                    {opsActiveFilterLabels.length > 0 ? (
                      <span className="admin-bookings-ops-filter-chips">
                        {opsActiveFilterLabels.map((label) => (
                          <span key={label} className="admin-bookings-ops-filter-chip">
                            {label}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className="admin-bookings-ops-toolbar admin-bookings-ops-toolbar--compact">
                <AdminBookingsOpsSearch
                  variant="compact"
                  searchInputRef={searchInputRef}
                  searchResultsRef={searchResultsRef}
                  clientSearchQuery={clientSearchQuery}
                  onClientSearchQueryChange={setClientSearchQuery}
                  searchDropdownBookings={searchDropdownBookings}
                  searchResultsLabel={searchResultsLabel}
                  searchResultsLoading={historySearchResultsLoading}
                  activeSearchResultIndex={activeSearchResultIndex}
                  onActiveSearchResultIndexChange={setActiveSearchResultIndex}
                  highlightMatch={highlightMatch}
                  formatStartTime={formatStartTime}
                  onSelectBooking={jumpToTimelineBooking}
                  onClearSearch={clearSearchField}
                  showKbdHint={showSearchKbdHint}
                  searchShortcutHint={searchShortcutHint}
                />
              </div>
            </div>
          )}
        />
      ) : null}
      {mode === 'history' && historyHasMore && <button type="button" className="btn btn--secondary" onClick={() => void loadMoreHistory()} disabled={historyLoadingMore}>{historyLoadingMore ? 'Loading...' : 'Load more'}</button>}
    </>
  )}
</>
      )}


      {mode === 'reports' ? (
          <Suspense fallback={<p className="muted" aria-busy="true">Loading reports…</p>}>
            <BookingsReportsSection
              isActive={isActive}
              loggedIn={loggedIn}
              barbers={barbers}
              onUnauthorized={handleReportsUnauthorized}
              onOpenBarber={openBarberFromReports}
            />
          </Suspense>
      ) : null}

      {showHolidayModal && (
        <div className="admin-client-modal-backdrop admin-client-modal-backdrop--centered" role="presentation" onClick={() => setShowHolidayModal(false)}>
          <form className="admin-client-modal" onSubmit={(event) => void submitHoliday(event)} onClick={(event) => event.stopPropagation()}>
            <div className="admin-client-modal-head"><h3>Holiday block</h3><button type="button" className="btn btn--ghost" onClick={() => setShowHolidayModal(false)}>Close</button></div>
            <label htmlFor="holiday-start">Start</label>
            <input id="holiday-start" type="datetime-local" value={holidayStartInput} onChange={(event) => setHolidayStartInput(event.target.value)} required />
            <label htmlFor="holiday-end">End</label>
            <input id="holiday-end" type="datetime-local" value={holidayEndInput} onChange={(event) => setHolidayEndInput(event.target.value)} required />
            <label><input type="checkbox" checked={holidayAllDay} onChange={(event) => setHolidayAllDay(event.target.checked)} /> All day</label>
            <button type="submit" className="btn btn--primary">Create holiday block</button>
          </form>
        </div>
      )}

      {openClientId && (
        <ClientProfilePanel
          clientId={openClientId}
          onClose={() => setOpenClientId(null)}
        />
      )}

      {barberProfileView ? (
        <AdminErrorBoundary
          key={selectedBarberId ?? 'barber-profile'}
          label="Barber profile"
          onDismiss={handleBarberProfileBack}
          dismissLabel="Close profile"
        >
          {barberProfileView}
        </AdminErrorBoundary>
      ) : null}

      <HistoryBookingStatusSheet
        booking={historyStatusBooking}
        onClose={() => setHistoryStatusBooking(null)}
        actionRoleScope={canManageBookings ? 'shop' : 'barber'}
        canEdit={
          Boolean(historyStatusBooking) &&
          (canManageBookings ||
            Boolean(sessionBarberId && historyStatusBooking?.barberId === sessionBarberId))
        }
        onSaved={async (bookingId: string, status: HistoryStatusValue) => {
          setBookings((previous) => previous.map((booking) => (
            booking.id === bookingId ? { ...booking, status } : booking
          )));
          setUpdatedBookingIds([bookingId]);
          await fetchBookings();
        }}
      />
    </section>
  );
}
