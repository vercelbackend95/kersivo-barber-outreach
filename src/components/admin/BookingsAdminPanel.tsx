import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarberRosterOverviewGridSkeleton, SkeletonKPICards } from '../skeleton';
import AdminSectionHeader from './AdminSectionHeader';
import AdminBookingsOpsSearch from './AdminBookingsOpsSearch';
import AdminBookingsOpsDashHero from './AdminBookingsOpsDashHero';
import AdminBookingsScheduleList from './AdminBookingsScheduleList';
import AdminLineChart from './charts/AdminLineChart';
import { addDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import TodayTimeline, { type TimelineBooking } from './TodayTimeline';
import AdminErrorBoundary from './AdminErrorBoundary';
import HistoryDateRangePicker from './HistoryDateRangePicker';
import BarbersOverview from './BarbersOverview';
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
import AdminLeaderboard from './AdminLeaderboard';
import type { Barber, ServiceOption, TimeBlock, WorkingHourRow } from './barbersTypes';
import { formatDelta } from './reportsFormatting';
import EmptyState from '../EmptyState';
import { Ban, X } from '../lucide-react';
import { useAdminTodayBookingsLive } from './useAdminTodayBookingsLive';
import { canShopAdminCancelByLeadTime } from '../../lib/booking/policies';
import { countBookingsByStatusTone, getBookingStatusTone, isCancelledBookingStatus } from './bookingStatus';
type Booking = {
  id: string;
  barberId: string;
  clientId?: string | null;
  fullName: string;
  email: string;
  status: string;
  startAt: string;
  endAt: string;
   notes?: string | null;
  rescheduledAt?: string | null;
  barber: { name: string };
  service: { name: string };
};


type ClientProfile = {
  id: string;
  fullName?: string | null;
  email: string;
  phone?: string | null;
  notes?: string | null;
};

type ClientProfileStats = {
  totalBookings: number;
  lastBookingAt?: string | null;
  cancelledCount: number;
};

type ClientProfilePayload = {
  client: ClientProfile;
  stats: ClientProfileStats;
  recentBookings: Booking[];
};


type AdminBookingView = 'timeline' | 'list';
type HistoryDateRange = {
  from?: Date;
  to?: Date;
};

type ReportBookingRow = {
  id: string;
  startAt: string;
  barberId: string;
  barberName: string;
  serviceName: string;
  status: string;
  clientName: string | null;
  clientEmail: string | null;
  computedValueGbp: number | null;
};




type ReportsPayload = {
  range: ReportsRange;
  rangeBoundaries: {
        from: string;
    to: string;
    tz: string;
  };
  previousRangeBoundaries: {


    from: string;
    to: string;
    tz: string;
  };
  bookingsCount: number;
  cancelledRate: number;
    noShowExpiredRate: number;
  revenue: number;
  avgBookingValue: number;
  revenueCount: number;
  usedDemoPricing: boolean;
  breakdown: {
    completed: number;
    cancelledByClient: number;
    cancelledByShop: number;
    noShowExpired: number;
  };
  peakDay: string | null;
  peakHour: string | null;
  bookedMinutes: number;
  availableMinutes: number;
  utilizationPct: number | null;
    revenueSeries: Array<{ label: string; value: number }>;
  trends: {
    bookingsPct: number | null;
    cancelledRatePp: number;
    revenuePct: number | null;
    revenueDelta: number;
        avgBookingValueDelta: number;
    noShowExpiredCountDelta: number;
    noShowExpiredRatePp: number;

    utilizationPp: number | null;
  };
  recentBarbers: Array<{ id: string; name: string; avatarUrl: string | null }>;

  selectedBarber: { id: string; name: string; avatarUrl: string | null } | null;
  previousMetrics: {
    bookingsCount: number;
    cancelledRate: number;
    revenue: number;
    avgBookingValue: number;
    utilizationPct: number | null;
    noShowExpiredCount: number;
    noShowExpiredRate: number;
  };

  mostPopularService: { name: string; count: number } | null;
  busiestBarber: { name: string; count: number } | null;
  reportBookings: ReportBookingRow[];

};
type ReportsRange = 'week' | '7d' | '30d' | '90d' | '1y';


const ADMIN_TIMEZONE = 'Europe/London';
const SLOT_STEP_MINUTES = 15;
const POLL_INTERVAL_MS = 15000;
const LAST_UPDATED_REFRESH_MS = 1000;

const UPDATED_ROW_HIGHLIGHT_MS = 2000;
/** Align with CSS `max-width: 48rem` (768px at 16px root). */
const MOBILE_BREAKPOINT_PX = 768;
const MOBILE_RECENT_BARBERS_COUNT = 5;
const DESKTOP_RECENT_BARBERS_COUNT = 11;
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const REPORTS_RANGE_OPTIONS: Array<{ value: ReportsRange; label: string }> = [
  { value: 'week', label: 'This week' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last 1 year' }
];


function formatCurrencyGbp(value: number): string {
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 100) / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: Math.abs(rounded) >= 100 ? 0 : 2,
    maximumFractionDigits: Math.abs(rounded) >= 100 ? 0 : 2
  }).format(rounded);
}

function formatDurationMinutes(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
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
  if (booking.status === 'CONFIRMED' && booking.rescheduledAt) return 'CONFIRMED · RESCHEDULED';
  return booking.status;
}

function getStatusA11yLabel(statusLabel: string) {
  if (statusLabel === 'CONFIRMED') return 'Confirmed';
  if (statusLabel === 'EXPIRED') return 'Expired';
  if (statusLabel === 'CANCELLED_BY_CLIENT') return 'Cancelled by client';
  if (statusLabel === 'CANCELLED_BY_SHOP') return 'Cancelled by shop';
  if (statusLabel === 'CONFIRMED · RESCHEDULED') return 'Confirmed and rescheduled';
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
  return endMs > nowMs && (booking.status === 'CONFIRMED' || booking.status === 'PENDING_CONFIRMATION');
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
  blocks: 'BARBERS',
  reports: 'REPORTS',
  history: 'HISTORY',
};

const BOOKINGS_SECTION_HEADER: Record<BookingsAdminMode, { title: string; description: string }> = {
  dashboard: { title: 'Bookings', description: "Manage today's appointments and upcoming schedule" },
  blocks: { title: 'Barbers', description: 'Configure your barber roster, schedules, and services' },
  reports: { title: 'Reports', description: 'Business performance analytics' },
  history: { title: 'History', description: 'Complete booking history with filters' },
};


type BookingsAdminPanelProps = {
  isActive: boolean;
    mode: BookingsAdminMode;
  onBackToDashboard?: () => void;

};

export default function BookingsAdminPanel({ isActive, mode, onBackToDashboard }: BookingsAdminPanelProps) {
  const {
    nextBooking: liveNextBooking,
    connectionStateLabel,
    hasLivePulse,
    freshnessLabel,
    formatStartTime: liveFormatStartTime,
    formatRelativeTime: liveFormatRelativeTime,
  } = useAdminTodayBookingsLive();

  const [loggedIn, setLoggedIn] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsInitialLoading, setBookingsInitialLoading] = useState(true);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barbersInitialLoading, setBarbersInitialLoading] = useState(true);
  const [barbersFilter, setBarbersFilter] = useState<'active' | 'all'>('active');
  const [barberNameDraft, setBarberNameDraft] = useState('');
  const [barberAvatarFile, setBarberAvatarFile] = useState<File | null>(null);
  const [barberSaveMessage, setBarberSaveMessage] = useState('');
  const [barberSaveError, setBarberSaveError] = useState('');
  const [barberSaving, setBarberSaving] = useState(false);
  const [barberReordering, setBarberReordering] = useState(false);
  const [barberAvatarPreviewUrl, setBarberAvatarPreviewUrl] = useState<string | null>(null);
    const [editingBarberAvatarFile, setEditingBarberAvatarFile] = useState<File | null>(null);
  const [editingBarberAvatarPreviewUrl, setEditingBarberAvatarPreviewUrl] = useState<string | null>(null);

    const [isAddBarberSheetOpen, setIsAddBarberSheetOpen] = useState(false);
  const [addBarberSelectedServiceIds, setAddBarberSelectedServiceIds] = useState<string[]>([]);

  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);
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
  const [selectedDate, setSelectedDate] = useState(() => getTodayLondonDate());
  const [historyBarberId, setHistoryBarberId] = useState<string>('all');
  const [historyDateRange, setHistoryDateRange] = useState<HistoryDateRange | null>(null);
  const [isHistoryMoreOpen, setIsHistoryMoreOpen] = useState(false);
  const historyMoreRef = useRef<HTMLDivElement | null>(null);


  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [reports, setReports] = useState<ReportsPayload | null>(null);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');
    const [reportsRange, setReportsRange] = useState<ReportsRange>('week');
  const [reportsBarberId, setReportsBarberId] = useState<string | null>(null);
    const [isReportsMoreOpen, setIsReportsMoreOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState<'revenue' | 'bookings' | 'cancelRate'>('revenue');
  const [openDrilldown, setOpenDrilldown] = useState<'bookings' | 'cancelled' | 'revenue' | 'service' | null>(null);
  const [drilldownSearch, setDrilldownSearch] = useState('');

  const [cancelSuccessMessage, setCancelSuccessMessage] = useState('');
  const [cancelErrorMessage, setCancelErrorMessage] = useState('');
  const [cancelLoadingBookingId, setCancelLoadingBookingId] = useState<string | null>(null);
  const [blockScopeBarberId, setBlockScopeBarberId] = useState<string>('all');
  const [selectedBarberStatsCount, setSelectedBarberStatsCount] = useState(0);

  const canCancelBookingAsShop = useCallback(
    (booking: Booking) =>
      booking.status === 'CONFIRMED' && canShopAdminCancelByLeadTime(new Date(booking.startAt), nowMs),
    [nowMs]
  );

  const [blockSuccessMessage, setBlockSuccessMessage] = useState('');
  const [blockErrorMessage, setBlockErrorMessage] = useState('');
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayStartInput, setHolidayStartInput] = useState(() => formatLocalInputValue(roundUpLondon(new Date(), SLOT_STEP_MINUTES)));
  const [holidayEndInput, setHolidayEndInput] = useState(() => formatLocalInputValue(new Date(roundUpLondon(new Date(), SLOT_STEP_MINUTES).getTime() + 30 * 60000)));
  const [holidayAllDay, setHolidayAllDay] = useState(false);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfilePayload | null>(null);
  const [isClientLoading, setIsClientLoading] = useState(false);
  const [clientError, setClientError] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [selectedTimelineBooking, setSelectedTimelineBooking] = useState<Booking | null>(null);
  const [timelineNotesDraft, setTimelineNotesDraft] = useState('');
  const [timelineNotesSaving, setTimelineNotesSaving] = useState(false);
  const [timelineNotesMessage, setTimelineNotesMessage] = useState('');
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  const inFlightRef = useRef(false);
    const timeBlocksInFlightRef = useRef(false);
  const pollingStoppedRef = useRef(false);
    const bookingsRequestIdRef = useRef(0);
  const timeBlocksRequestIdRef = useRef(0);

  const previousSignaturesRef = useRef<Map<string, string>>(new Map());
    const lastBookingsQueryKeyRef = useRef<string | null>(null);
  const updatedRowsTimeoutRef = useRef<number | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const bookingShellRef = useRef<HTMLElement | null>(null);
  const nextBlockMeasureCleanupRef = useRef<(() => void) | null>(null);
  const historyRecentBarbersScrollRef = useRef<HTMLDivElement | null>(null);
  const reportsRecentBarbersScrollRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchResultsRef = useRef<HTMLDivElement | null>(null);
  const reportsMoreRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollRestoreRef = useRef<{ left: number; top: number } | null>(null);
  const timelineScrollRafRef = useRef<number | null>(null);
    const pendingTimelineScrollBookingIdRef = useRef<string | null>(null);
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
  const fetchReports = useCallback(async () => {
    if (!loggedIn) return;

    setReportsError('');
    setReportsLoading(true);
    const params = new URLSearchParams({ range: reportsRange });
    if (reportsBarberId) params.set('barberId', reportsBarberId);
    try {
      const response = await fetch(`/api/admin/reports?${params.toString()}`, { credentials: 'include' });

      if (response.status === 401) {
        pollingStoppedRef.current = true;
        setLoggedIn(false);
        setError('Session expired. Please log in again.');
        return;
      }

      if (!response.ok) {
        setReportsError('Could not load reports right now.');
        return;
      }

      const data = (await response.json()) as ReportsPayload;
      setReports(data);
      if (reportsBarberId && data.selectedBarber == null) {
        setReportsBarberId(null);
      }
    } finally {
      setReportsLoading(false);
    }
  }, [loggedIn, reportsBarberId, reportsRange]);




  const fetchBookings = useCallback(async (appendHistory = false) => {
    if (!loggedIn || !isActive || pollingStoppedRef.current || inFlightRef.current) return;
    if (mode === 'history' && !appendHistory) setHistoryCursor(null);

    inFlightRef.current = true;
    const requestId = ++bookingsRequestIdRef.current;
    const requestQueryKey = mode === 'history'
      ? ['history', historyBarberId, historyDateRange?.from ? formatInTimeZone(historyDateRange.from, ADMIN_TIMEZONE, 'yyyy-MM-dd') : '', historyDateRange?.to ? formatInTimeZone(historyDateRange.to, ADMIN_TIMEZONE, 'yyyy-MM-dd') : ''].join(':')
      : ['dashboard', selectedDate].join(':');


    try {
      const endpoint = (() => {
          if (mode === 'history') {
          const params = new URLSearchParams({ view: 'history', limit: '50' });
          params.set('barberId', historyBarberId ?? 'all');
          if (historyDateRange?.from && historyDateRange?.to) {
            params.set('from', formatInTimeZone(historyDateRange.from, ADMIN_TIMEZONE, 'yyyy-MM-dd'));
            params.set('to', formatInTimeZone(historyDateRange.to, ADMIN_TIMEZONE, 'yyyy-MM-dd'));
          }

          if (appendHistory && historyCursor) params.set('cursor', historyCursor);
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
      const mergedBookings = appendHistory ? [...bookings, ...incomingBookings] : incomingBookings;
      const nextSignatures = new Map(mergedBookings.map((b) => [b.id, bookingRefreshSignature(b)]));
      const previousQueryKey = lastBookingsQueryKeyRef.current;
      const canHighlightUpdatedRows = !appendHistory && previousSignaturesRef.current.size > 0 && previousQueryKey === requestQueryKey;
      const changedIds = canHighlightUpdatedRows
        ? mergedBookings.filter((b) => previousSignaturesRef.current.get(b.id) !== nextSignatures.get(b.id)).map((b) => b.id)
        : [];

      const shouldUpdateBookings = appendHistory || hasCollectionChanged(bookings, mergedBookings, bookingRefreshSignature);
      if (shouldUpdateBookings) {
        if (activeView === 'timeline') captureTimelineScroll();
        setBookings(mergedBookings);
        if (activeView === 'timeline') restoreTimelineScroll();
      }

      if (mode === 'history') {
        setHistoryHasMore(Boolean(data.hasMore));
        setHistoryCursor(data.cursor ?? null);
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
        inFlightRef.current = false;
        setBookingsInitialLoading(false);
      }

      setHistoryLoadingMore(false);
    }
  }, [activeView, bookings, captureTimelineScroll, historyBarberId, historyCursor, historyDateRange, isActive, loggedIn, mode, restoreTimelineScroll, selectedDate]);

  const loadMoreHistory = useCallback(async () => {
    if (!historyHasMore || historyLoadingMore || mode !== 'history') return;
    setHistoryLoadingMore(true);
    await fetchBookings(true);
  }, [fetchBookings, historyHasMore, historyLoadingMore, mode]);


  useEffect(() => { void (async () => { try { const response = await fetch('/api/admin/session', { credentials: 'include' }); setLoggedIn(response.ok); } finally { setIsCheckingSession(false); } })(); }, []);
  useEffect(() => { if (!loggedIn || !isActive) return; void fetchBookings(); void fetchBarbers(); void fetchTimeBlocks(); void fetchReports(); const id = window.setInterval(() => { void fetchBookings(); void fetchTimeBlocks(); void fetchReports(); }, POLL_INTERVAL_MS); return () => window.clearInterval(id); }, [activeView, fetchBookings, fetchBarbers, fetchReports, fetchTimeBlocks, isActive, loggedIn, mode]);
  useEffect(() => { if (!loggedIn || !isActive) return; const id = window.setInterval(() => setNowMs(Date.now()), LAST_UPDATED_REFRESH_MS); return () => window.clearInterval(id); }, [isActive, loggedIn]);
  useEffect(() => {
    if (!loggedIn || !isActive || mode !== 'history') return;
    const timeoutId = window.setTimeout(() => { void fetchBookings(); }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [fetchBookings, historyBarberId, historyDateRange, isActive, loggedIn, mode]);

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
  useEffect(() => {
    if (!isReportsMoreOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (reportsMoreRef.current?.contains(target)) return;
      setIsReportsMoreOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsReportsMoreOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isReportsMoreOpen]);


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
  const visibleBarbersForManagement = useMemo(() => barbersFilter === 'all' ? allBarbersSorted : activeBarbers, [activeBarbers, allBarbersSorted, barbersFilter]);
  const selectedBarber = useMemo(() => allBarbersSorted.find((barber) => barber.id === selectedBarberId) ?? null, [allBarbersSorted, selectedBarberId]);
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
      bookings.map((booking) => [booking.barberId, { id: booking.barberId, name: booking.barber?.name ?? 'Barber', avatarUrl: null, isActive: false } as Barber])
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
    const unbindReports = bindEdgeHint(reportsRecentBarbersScrollRef.current);

    return () => {
      unbindHistory();
      unbindReports();
    };
  }, [mode, recentBarbers]);


  const reportRecentBarbers = useMemo(() => {
    const byId = new Map(barbers.map((barber) => [barber.id, barber]));
    return (reports?.recentBarbers ?? []).map((entry) => ({
      id: entry.id,
      name: byId.get(entry.id)?.name ?? entry.name,
      avatarUrl: byId.get(entry.id)?.avatarUrl ?? entry.avatarUrl ?? null

    }));
  }, [barbers, reports]);

  const reportsSelectedBarberName = useMemo(() => {
    if (!reportsBarberId) return 'All barbers';
    const matching = reportRecentBarbers.find((barber) => barber.id === reportsBarberId);
    if (matching) return matching.name;
    return reports?.selectedBarber?.name ?? 'Selected barber';
  }, [reportRecentBarbers, reports, reportsBarberId]);

  const reportsBreakdownTotal = useMemo(() => {
    if (!reports) return 0;
    return reports.breakdown.completed + reports.breakdown.cancelledByClient + reports.breakdown.cancelledByShop + reports.breakdown.noShowExpired;
  }, [reports]);


  const reportsBookedVsAvailableLabel = useMemo(() => {
    if (!reports) return '—';
        if (reports.availableMinutes <= 0) return 'No working hours in range';
    return `Booked ${formatDurationMinutes(reports.bookedMinutes)} / Available ${formatDurationMinutes(reports.availableMinutes)}`;
  }, [reports]);

  const bookingsDelta = formatDelta({
    value: reports?.trends.bookingsPct ?? null,
    type: 'percent',
    tone: 'higher_better',
    currentValue: reports?.bookingsCount,
    previousValue: reports?.previousMetrics.bookingsCount
  });
  const utilizationDelta = formatDelta({
    value: reports?.trends.utilizationPp ?? null,
    type: 'pp',
    tone: 'higher_better',
    currentValue: reports?.utilizationPct,
    previousValue: reports?.previousMetrics.utilizationPct
  });
  const cancelledDelta = formatDelta({
    value: reports?.trends.cancelledRatePp ?? null,
    type: 'pp',
    tone: 'lower_better',
    currentValue: reports?.cancelledRate,
    previousValue: reports?.previousMetrics.cancelledRate
  });
  const avgBookingValueDelta = formatDelta({
    value: reports?.trends.avgBookingValueDelta ?? null,
    type: 'currency',
    tone: 'higher_better',
    currentValue: reports?.avgBookingValue,
    previousValue: reports?.previousMetrics.avgBookingValue
  });
  const noShowExpiredDelta = formatDelta({
    value: reports?.trends.noShowExpiredRatePp ?? null,
    type: 'pp',
    tone: 'lower_better',
    currentValue: reports?.noShowExpiredRate,
    previousValue: reports?.previousMetrics.noShowExpiredRate
  });

  const reportsCancelledCount = (reports?.breakdown.cancelledByClient ?? 0) + (reports?.breakdown.cancelledByShop ?? 0);


  const isSmallSample = (reports?.bookingsCount ?? 0) > 0 && (reports?.bookingsCount ?? 0) < 10;


  const chartSeries = useMemo(() => {
    if (!reports) return [] as Array<{ label: string; value: number }>;
    if (chartMetric === 'revenue') return reports.revenueSeries;
    const map = new Map<string, { total: number; cancelled: number }>();
    for (const row of reports.reportBookings ?? []) {
      const key = formatInTimeZone(new Date(row.startAt), ADMIN_TIMEZONE, reportsRange === '1y' ? "yyyy-'W'II" : 'yyyy-MM-dd');
      const current = map.get(key) ?? { total: 0, cancelled: 0 };
      current.total += 1;
      if (row.status === 'CANCELLED_BY_CLIENT' || row.status === 'CANCELLED_BY_SHOP' || row.status === 'CANCELLED_BY_ADMIN' || row.status === 'EXPIRED') current.cancelled += 1;
      map.set(key, current);
    }
    return reports.revenueSeries.map((point) => {
      const bucket = map.get(point.label) ?? { total: 0, cancelled: 0 };
      return {
        label: point.label,
        value: chartMetric === 'bookings' ? bucket.total : (bucket.total > 0 ? (bucket.cancelled / bucket.total) * 100 : 0)
      };
    });
  }, [chartMetric, reports, reportsRange]);

  const reportsHeroValue = formatCurrencyGbp(reports?.revenue ?? 0);

  const reportsChartSeries = useMemo(
    () => [{ key: 'main', name: chartMetric === 'cancelRate' ? 'Cancel rate' : chartMetric === 'bookings' ? 'Bookings' : 'Revenue', points: chartSeries }],
    [chartMetric, chartSeries],
  );

  const reportsLeaderboardRows = useMemo(() => {
    if (!reports) return [];
    const byBarber = new Map<string, { name: string; revenue: number; bookings: number }>();
    for (const row of reports.reportBookings ?? []) {
      const entry = byBarber.get(row.barberId) ?? { name: row.barberName, revenue: 0, bookings: 0 };
      entry.bookings += 1;
      entry.revenue += row.computedValueGbp ?? 0;
      byBarber.set(row.barberId, entry);
    }
    return Array.from(byBarber.entries())
      .map(([id, entry]) => ({
        id,
        name: entry.name,
        value: entry.revenue > 0 ? entry.revenue : entry.bookings,
        valueLabel: entry.revenue > 0 ? formatCurrencyGbp(entry.revenue) : `${entry.bookings}`,
        note: `${entry.bookings} bookings`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [reports]);

  const bookingsSparkSeries = useMemo((): Array<{ label: string; value: number }> => {
    if (!reports) return [];
    const map = new Map<string, number>();
    for (const row of reports.reportBookings ?? []) {
      const key = formatInTimeZone(new Date(row.startAt), ADMIN_TIMEZONE, reportsRange === '1y' ? "yyyy-'W'II" : 'yyyy-MM-dd');
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return reports.revenueSeries.map((p) => ({ label: p.label, value: map.get(p.label) ?? 0 }));
  }, [reports, reportsRange]);

  const cancelledSparkSeries = useMemo((): Array<{ label: string; value: number }> => {
    if (!reports) return [];
    const map = new Map<string, { total: number; cancelled: number }>();
    for (const row of reports.reportBookings ?? []) {
      const key = formatInTimeZone(new Date(row.startAt), ADMIN_TIMEZONE, reportsRange === '1y' ? "yyyy-'W'II" : 'yyyy-MM-dd');
      const c = map.get(key) ?? { total: 0, cancelled: 0 };
      c.total += 1;
      if (['CANCELLED_BY_CLIENT', 'CANCELLED_BY_SHOP', 'CANCELLED_BY_ADMIN', 'EXPIRED'].includes(row.status)) c.cancelled += 1;
      map.set(key, c);
    }
    return reports.revenueSeries.map((p) => {
      const b = map.get(p.label) ?? { total: 0, cancelled: 0 };
      return { label: p.label, value: b.total > 0 ? (b.cancelled / b.total) * 100 : 0 };
    });
  }, [reports, reportsRange]);

  const drilldownRows = useMemo(() => {
    const rows = reports?.reportBookings ?? [];
    if (openDrilldown === 'bookings') return rows;
    if (openDrilldown === 'cancelled') return rows.filter((row) => ['CANCELLED_BY_CLIENT', 'CANCELLED_BY_SHOP', 'CANCELLED_BY_ADMIN', 'EXPIRED'].includes(row.status));
    if (openDrilldown === 'revenue') return rows.filter((row) => row.computedValueGbp != null);
    if (openDrilldown === 'service') return rows.filter((row) => reports?.mostPopularService && row.serviceName === reports.mostPopularService.name);
    return [] as ReportBookingRow[];
  }, [openDrilldown, reports]);

  const filteredDrilldownRows = useMemo(() => {
    const q = drilldownSearch.trim().toLowerCase();
    if (!q) return drilldownRows;
    return drilldownRows.filter((row) => [row.clientName, row.clientEmail, row.serviceName].join(' ').toLowerCase().includes(q));
  }, [drilldownRows, drilldownSearch]);


  const visibleBookings = useMemo(() => {
    if (!effectiveClientSearchQuery) return dayFilteredBookings;
    return dayFilteredBookings
      .map((booking, index) => ({ booking, score: getBookingSearchScore(booking, effectiveClientSearchQuery), index }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.booking);
  }, [dayFilteredBookings, effectiveClientSearchQuery]);

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
    if (visibleBookings.length === 0) return 'No matches';
    return `${visibleBookings.length} matches`;
  }, [effectiveClientSearchQuery, isSearchDebouncing, visibleBookings.length]);

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
    return visibleBookings.slice(0, 8);
  }, [effectiveClientSearchQuery, isSearchDebouncing, visibleBookings]);


  const isAnyOverlayOpen = isAddBarberSheetOpen || openDrilldown !== null || showHolidayModal || selectedTimelineBooking !== null || selectedClientId !== null;
  useBodyScrollLock(isMobileViewport && isAnyOverlayOpen);

  useEffect(() => {
    if (!selectedTimelineBooking) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const active = document.activeElement;
      if (isKeyboardEditableTarget(event.target) || isKeyboardEditableTarget(active)) return;
      event.preventDefault();
      setSelectedTimelineBooking(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedTimelineBooking]);

  const isTimelineView = mode === 'dashboard' && activeView === 'timeline';
  const selectedDateLabel = useMemo(() => formatTimelineDateLabel(selectedDate), [selectedDate]);
  const timelineNextDayLabel = useMemo(
    () => formatTimelineDateLabel(addOneLondonCalendarDay(selectedDate)),
    [selectedDate],
  );
  const goToNextTimelineDay = useCallback(() => {
    setSelectedDate((d) => addOneLondonCalendarDay(d));
  }, []);



  async function openClientProfile(clientId?: string | null) {
    if (!clientId) return;
    setSelectedClientId(clientId);
    setIsClientLoading(true);
    setClientError('');
    const response = await fetch(`/api/admin/clients/${clientId}`, { credentials: 'include' });
    if (!response.ok) {
      setClientError('Could not load client profile.');
      setIsClientLoading(false);
      return;
    }
    const payload = (await response.json()) as ClientProfilePayload;
    setClientProfile(payload);
    setNotesDraft(payload.client.notes ?? '');
    setIsClientLoading(false);

  }

  async function saveNotes() {
    if (!selectedClientId) return;
    setNotesSaving(true);
    const response = await fetch(`/api/admin/clients/${selectedClientId}/notes`, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ notes: notesDraft })
    });
    if (response.ok && clientProfile) {
      setClientProfile({ ...clientProfile, client: { ...clientProfile.client, notes: notesDraft } });
    }
    setNotesSaving(false);

  }
  const openTimelineBooking = useCallback((booking: Booking | TimelineBooking) => {
    setSelectedTimelineBooking(booking as Booking);
    setTimelineNotesDraft(booking.notes ?? '');
    setTimelineNotesMessage('');
  }, []);
  const scrollToTimelineBooking = useCallback((bookingId: string) => {
    const card = document.querySelector(`[data-booking-id="${bookingId}"]`) as HTMLElement | null;
    if (!card) return false;
    card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
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

  const jumpToTimelineBooking = useCallback(
    (booking: Booking) => {
      if (mode === 'dashboard') {
        if (activeView === 'timeline') {
          if (!scrollToTimelineBooking(booking.id)) {
            pendingTimelineScrollBookingIdRef.current = booking.id;
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

      openTimelineBooking(booking);
      setClientSearchQuery('');
      setDebouncedSearchQuery('');
      setActiveSearchResultIndex(-1);
      searchInputRef.current?.blur();
    },
    [activeView, mode, openTimelineBooking, scrollToListBooking, scrollToTimelineBooking]
  );

  useEffect(() => {
    const pendingBookingId = pendingTimelineScrollBookingIdRef.current;
    if (!pendingBookingId || activeView !== 'timeline') return;
    if (scrollToTimelineBooking(pendingBookingId)) {
      pendingTimelineScrollBookingIdRef.current = null;
    }
  }, [activeView, scrollToTimelineBooking, visibleBookings]);

  useEffect(() => {
    const pendingId = pendingListScrollBookingIdRef.current;
    if (!pendingId) return;
    if (scrollToListBooking(pendingId)) {
      pendingListScrollBookingIdRef.current = null;
    }
  }, [activeView, mode, scrollToListBooking, visibleBookings]);


  async function saveTimelineBookingNotes() {
    if (!selectedTimelineBooking) return;
    setTimelineNotesSaving(true);
    setTimelineNotesMessage('');

    const response = await fetch(`/api/admin/bookings/${selectedTimelineBooking.id}/notes`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notes: timelineNotesDraft })
    });

    if (!response.ok) {
      setTimelineNotesMessage('Could not save booking notes.');
      setTimelineNotesSaving(false);
      return;
    }

    setTimelineNotesMessage('Notes saved.');
    setBookings((current) => current.map((item) => (item.id === selectedTimelineBooking.id ? { ...item, notes: timelineNotesDraft } : item)));
    setSelectedTimelineBooking((current) => (current ? { ...current, notes: timelineNotesDraft } : current));
    setTimelineNotesSaving(false);
  }


  useEffect(() => {
    if (!barberAvatarFile) {
      setBarberAvatarPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(barberAvatarFile);
    setBarberAvatarPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [barberAvatarFile]);
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

  useEffect(() => {
    if (addBarberServiceOptions.length === 0) return;
    setAddBarberSelectedServiceIds((current) => {
      if (current.length > 0) return current;
      return addBarberServiceOptions.map((service) => service.id);
    });
  }, [addBarberServiceOptions]);



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
    const payload = await response.json().catch(() => ({} as { rules?: WorkingHourRow[] }));
    if (response.ok) {
      const rules = payload.rules ?? [];
      setWorkingHours(rules.sort((a, b) => a.dayOfWeek - b.dayOfWeek));

    }
    setWorkingHoursLoading(false);
  }, []);

  useEffect(() => {
    if (!loggedIn || !isActive || mode !== 'blocks') return;
    void fetchServices();
  }, [fetchServices, isActive, loggedIn, mode]);

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
    if (!loggedIn || !isActive || mode !== 'blocks' || !selectedBarberId) return;
    void fetchWorkingHours(selectedBarberId);
  }, [fetchWorkingHours, isActive, loggedIn, mode, selectedBarberId]);
  useEffect(() => {
    if (!loggedIn || !isActive || mode !== 'blocks' || !selectedBarberId) {
      setSelectedBarberStatsCount(0);
      return;
    }
    void fetchSelectedBarberStats(selectedBarberId);
  }, [fetchSelectedBarberStats, isActive, loggedIn, mode, selectedBarberId]);


  function updateWorkingHour(dayOfWeek: number, patch: Partial<WorkingHourRow>) {
    setWorkingHours((current) => current.map((row) => row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row));
  }

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
    const payload = await response.json().catch(() => ({} as { error?: string; rules?: WorkingHourRow[] }));
    if (!response.ok) {
      setBarberSaveError(payload.error ?? 'Could not save working hours.');
      setWorkingHoursSaving(false);
      return false;
    }
        if (payload.rules) {
      setWorkingHours(payload.rules.sort((a, b) => a.dayOfWeek - b.dayOfWeek));
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

    const response = await fetch('/api/admin/bookings/cancel', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bookingId: booking.id }) });
    if (response.ok) {
      setCancelSuccessMessage('Booking cancelled successfully.');
      await fetchBookings();
      if (selectedTimelineBooking?.id === booking.id) {
        setSelectedTimelineBooking((current) => (current ? { ...current, status: 'CANCELLED_BY_SHOP' } : current));
      }
    } else {
      let message = 'Could not cancel booking right now.';
      try {
        const payload = (await response.json()) as { error?: string };
        if (typeof payload?.error === 'string' && payload.error.trim()) {
          message = payload.error.trim();
        }
      } catch {
        /* ignore */
      }
      setCancelErrorMessage(message);
    }
    setCancelLoadingBookingId(null);
}

  async function createTimeBlock(title: string, startAt: Date, endAt: Date) {
    setBlockErrorMessage('');
    setBlockSuccessMessage('');
    const response = await fetch('/api/admin/timeblocks/create', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, startAt: startAt.toISOString(), endAt: endAt.toISOString(), barberId: selectedBarberId ?? (blockScopeBarberId === 'all' ? null : blockScopeBarberId) })
    });
    if (!response.ok) {
      setBlockErrorMessage('Could not create time block.');
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
  async function saveBarber(event: React.FormEvent) {
    event.preventDefault();
    setBarberSaveMessage('');
    setBarberSaveError('');

    const trimmedName = barberNameDraft.trim();
    if (!trimmedName) {
      setBarberSaveError('Barber name is required.');
      return;
    }
    const uniqueServiceIds = Array.from(new Set(addBarberSelectedServiceIds));
    if (uniqueServiceIds.length === 0) {
      setBarberSaveError('Select at least one service.');
      return;
    }


    if (barberAvatarFile && barberAvatarFile.size > 5 * 1024 * 1024) {
      setBarberSaveError('Avatar is too large. Maximum size is 5MB.');
      return;
    }

    setBarberSaving(true);
    const formData = new FormData();
    formData.set('name', trimmedName);
    formData.set('isActive', 'true');
        formData.set('serviceIds', JSON.stringify(uniqueServiceIds));
    if (barberAvatarFile) formData.set('avatar', barberAvatarFile);

    const response = await fetch('/api/admin/barbers', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    const payload = await response.json().catch(() => ({ error: 'Could not save barber.' }));

    if (!response.ok) {
      setBarberSaveError(payload.error || 'Could not save barber.');
      setBarberSaving(false);
      return;
    }

    setBarberNameDraft('');
        setBarberAvatarFile(null);
    setBarberAvatarPreviewUrl(null);
        setAddBarberSelectedServiceIds(addBarberServiceOptions.map((service) => service.id));
    setBarberSaveMessage('Barber saved.');
    setBarberSaving(false);
        setIsAddBarberSheetOpen(false);
    await fetchBarbers();
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
      const payload = await response.json().catch(() => ({ error: 'Could not delete barber.' }));

      if (!response.ok) {
        setBarberSaveError(payload.error || 'Could not delete barber.');
        return;
      }

      setSelectedBarberId((current) => current === barberId ? null : current);
      setHistoryBarberId((current) => current === barberId ? 'all' : current);
      setReportsBarberId((current) => current === barberId ? null : current);
      setBlockScopeBarberId((current) => current === barberId ? 'all' : current);
      setSelectedBarberStatsCount(0);
      setWorkingHours([]);
      setEditingBarberAvatarFile(null);
      setEditingBarberAvatarPreviewUrl(null);
      setBarberSaveMessage('Barber deleted.');
      await Promise.all([fetchBarbers(), fetchTimeBlocks()]);
    } catch (deleteError) {
      setBarberSaveError(deleteError instanceof Error ? deleteError.message : 'Could not delete barber.');
    } finally {
      setBarberSaving(false);
    }
  }
  async function saveBarberOrder(orderedIds: string[]) {
    setBarberReordering(true);
    setBarberSaveMessage('');
    setBarberSaveError('');

    try {
      const response = await fetch('/api/admin/barbers/reorder', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderedIds, includeInactive: barbersFilter === 'all' })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setBarberSaveError((payload as { error?: string }).error ?? 'Could not reorder barbers.');
        await fetchBarbers();
        return;
      }

      if (Array.isArray((payload as { barbers?: Barber[] }).barbers)) {
        setBarbers((payload as { barbers: Barber[] }).barbers);
      }
      setBarberSaveMessage('Barber order saved.');
    } catch (orderError) {
      setBarberSaveError(orderError instanceof Error ? orderError.message : 'Could not reorder barbers.');
      await fetchBarbers();
    } finally {
      setBarberReordering(false);
    }
  }

  async function moveBarber(index: number, direction: 'up' | 'down') {
    const maxIndex = visibleBarbersForManagement.length - 1;
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || index > maxIndex || nextIndex < 0 || nextIndex > maxIndex) return;

    const orderedIds = visibleBarbersForManagement.map((barber) => barber.id);
    const [moved] = orderedIds.splice(index, 1);
    orderedIds.splice(nextIndex, 0, moved);
    await saveBarberOrder(orderedIds);
  }

  const openAddBarberSheet = useCallback(() => {
    setBarberSaveError('');
    setBarberSaveMessage('');
    setIsAddBarberSheetOpen(true);
  }, []);

  /**
   * Publish measured height of the in-flow dash-hero slot onto `.admin-main-content`
   * so `.admin-mobile-header-spacer` clears fixed chrome. The mobile Next strip is registered
   * globally via `AdminGlobalMobileNextStripHost`; this callback ref still handles desktop heroes
   * and any in-document hero wrapper.
   */
  const bindNextBlockMeasureRef = useCallback((node: HTMLDivElement | null) => {
    nextBlockMeasureCleanupRef.current?.();
    nextBlockMeasureCleanupRef.current = null;

    if (!node) {
      return;
    }

    const mainContentNode = node.closest('.admin-main-content') as HTMLElement | null;
    if (!mainContentNode) {
      return;
    }

    const HEIGHT_PUBLISH_THRESHOLD_PX = 2;
    let lastPublishedPx = -1;
    let rafId: number | null = null;

    const publishNextBlockHeight = () => {
      const nextPx = Math.round(node.getBoundingClientRect().height);
      if (lastPublishedPx < 0) {
        mainContentNode.style.setProperty('--admin-next-block-h', `${nextPx}px`);
        lastPublishedPx = nextPx;
        return;
      }
      if (Math.abs(nextPx - lastPublishedPx) >= HEIGHT_PUBLISH_THRESHOLD_PX) {
        mainContentNode.style.setProperty('--admin-next-block-h', `${nextPx}px`);
        lastPublishedPx = nextPx;
      }
    };

    const schedulePublish = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        publishNextBlockHeight();
      });
    };

    publishNextBlockHeight();
    if (node.closest('.admin-mobile-header-extension')) {
      mainContentNode.style.setProperty(
        '--admin-mobile-sheet-strip-chrome',
        'calc(0.42rem + 0.2rem + 0.55rem)',
      );
    }
    const resizeObserver = new ResizeObserver(schedulePublish);
    resizeObserver.observe(node);
    window.addEventListener('resize', schedulePublish);
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', schedulePublish);

    nextBlockMeasureCleanupRef.current = () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', schedulePublish);
      visualViewport?.removeEventListener('resize', schedulePublish);
      mainContentNode.style.removeProperty('--admin-next-block-h');
      mainContentNode.style.removeProperty('--admin-mobile-sheet-strip-chrome');
    };
  }, []);

  useEffect(
    () => () => {
      nextBlockMeasureCleanupRef.current?.();
      nextBlockMeasureCleanupRef.current = null;
    },
    [],
  );

  const bookingsDashHeroEl =
    mode === 'dashboard' ? (
      <AdminBookingsOpsDashHero
        nextBooking={liveNextBooking}
        connectionStateLabel={connectionStateLabel}
        hasLivePulse={hasLivePulse}
        freshnessLabel={freshnessLabel}
        formatStartTime={liveFormatStartTime}
        formatRelativeTime={liveFormatRelativeTime}
      />
    ) : null;

  const nonDashboardOpsDashHeroEl = (
    <AdminBookingsOpsDashHero
      nextBooking={liveNextBooking}
      connectionStateLabel={connectionStateLabel}
      hasLivePulse={hasLivePulse}
      freshnessLabel={freshnessLabel}
      formatStartTime={liveFormatStartTime}
      formatRelativeTime={liveFormatRelativeTime}
    />
  );

  const dashHeroSlotClassName = [
    'admin-next-block',
    'admin-next-block--dash-hero-slot',
    isMobileViewport ? 'admin-next-block--dash-hero-slot--mobile' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const renderOpsDashHeroSlot = (child: React.ReactNode) => (
    <div ref={bindNextBlockMeasureRef} className={dashHeroSlotClassName}>
      {child}
    </div>
  );

  if (!isActive) return null;
  if (isCheckingSession) return <section className="surface booking-shell"><h2>Admin</h2><p className="muted">Checking session...</p></section>;
  if (!loggedIn) return <section className="surface booking-shell"><h2>ADMIN</h2><p className="muted">Unauthorized. Verify your admin secret and reload this page.</p>{error && <p>{error}</p>}</section>;

  return (
    <section
      ref={bookingShellRef}
      className={`surface booking-shell${mode === 'reports' ? ' booking-shell--reports' : ''}${mode === 'blocks' ? ' admin-services-shell' : ''}`}
    >
      <AdminSectionHeader
        title={BOOKINGS_SECTION_HEADER[mode].title}
        description={BOOKINGS_SECTION_HEADER[mode].description}
        metaBadge={
          mode === 'dashboard'
            ? `${todayBookings.length} today`
            : mode === 'blocks'
              ? `${barbers.length} barbers`
              : undefined
        }
        metaBadgeVariant={mode === 'dashboard' ? 'success' : undefined}
        actions={
          mode === 'blocks' ? (
            <button type="button" className="btn btn--primary" onClick={openAddBarberSheet}>
              Add barber
            </button>
          ) : undefined
        }
      />
      {mode === 'dashboard' ? (
        <div className="admin-bookings-ops-dash-cluster">
          {!isMobileViewport && bookingsDashHeroEl ? renderOpsDashHeroSlot(bookingsDashHeroEl) : null}

          <section className="admin-bookings-ops admin-bookings-ops--dashboard" aria-label="Operations dashboard">
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
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <label className="admin-date-picker-label" aria-label={`Select date, currently ${selectedDateLabel}`}>
                        <span className="admin-date-picker-text">{selectedDateLabel}</span>
                        <input
                          type="date"
                          className="admin-filter-tab-calendar-input"
                          value={selectedDate}
                          onChange={(event) => setSelectedDate(event.target.value)}
                          aria-label="Select date"
                        />
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                          <path
                            d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm13 8H4v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8ZM5 6a1 1 0 0 0-1 1v1h16V7a1 1 0 0 0-1-1H5Z"
                            fill="currentColor"
                          />
                        </svg>
                      </label>
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
                      {onFloorBarbersNow.map((barber) => {
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
                            barberIsActive={normalizeBarberStatus(barber)}
                            nextBookingPreview={nextBookingPreview}
                            availStatus={availStatus}
                            dayFill={dayFill}
                            todayLine={todayLine}
                            getInitials={getInitials}
                            onOpenBarber={setSelectedBarberId}
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
      ) : isMobileViewport ? null : (
        renderOpsDashHeroSlot(nonDashboardOpsDashHeroEl)
      )}

      {cancelSuccessMessage && <p className="admin-inline-success">{cancelSuccessMessage}</p>}
      {cancelErrorMessage && <p className="admin-inline-error">{cancelErrorMessage}</p>}
      {mode !== 'reports' && (
        <>

          {mode === 'blocks' ? (
            selectedBarber ? (
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
                onBack={() => setSelectedBarberId(null)}
                                onBarberAvatarChange={setEditingBarberAvatarFile}
                onSaveAvatar={() => void saveSelectedBarberAvatar()}

                onToggleActive={() => void updateBarberStatus(selectedBarber.id, !normalizeBarberStatus(selectedBarber))}
                onToggleService={(serviceId, enabled) => void toggleServiceForBarber(serviceId, enabled)}
                onChangeWorkingHour={(dayOfWeek, field, value) => updateWorkingHour(dayOfWeek, { [field]: value })}
                barberSaveError={barberSaveError}
                onSetWorkingHours={setWorkingHours}
                onSaveWorkingHours={saveWorkingHours}
                onCreateBlock={(payload) => void createProfileBlock(payload)}
                onDeleteBlock={(blockId) => void deleteTimeBlock(blockId)}
                onDeleteBarber={() => void deleteBarber(selectedBarber.id)}
              />
            ) : (
              <BarbersOverview
                barbers={visibleBarbersForManagement}
                barbersLoading={barbersInitialLoading}
                                services={addBarberServiceOptions}
                barbersFilter={barbersFilter}
                barberNameDraft={barberNameDraft}
                barberAvatarPreviewUrl={barberAvatarPreviewUrl}
                                selectedServiceIds={addBarberSelectedServiceIds}
                barberSaving={barberSaving}
                barberReordering={barberReordering}
                barberSaveMessage={barberSaveMessage}
                barberSaveError={barberSaveError}
                                isAddBarberSheetOpen={isAddBarberSheetOpen}
                globalBlocks={globalBlocks}
                                bookings={bookings}
                getInitials={getInitials}
                onBarberNameChange={setBarberNameDraft}
                onBarberAvatarChange={setBarberAvatarFile}
                                onSelectedServiceIdsChange={setAddBarberSelectedServiceIds}
                onSubmitAddBarber={(event) => void saveBarber(event)}
                onBarbersFilterChange={setBarbersFilter}
                onOpenBarber={setSelectedBarberId}
                onMoveBarber={(index, direction) => void moveBarber(index, direction)}
                onCloseAddBarberSheet={() => {
                  setIsAddBarberSheetOpen(false);
                }}

                formatBlockRange={formatBlockRange}
              />
            )
          ) : (
      <>

      {mode === 'history' && (
        <div className="admin-history-operations">
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
        <section className="admin-bookings-ops admin-bookings-ops--compact" aria-label="Search booking history">
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
        </section>
        </div>
      )}

      {mode !== 'history' && activeView === 'timeline' ? (
        <AdminErrorBoundary>
          <TodayTimeline
            barbers={activeBarbers}
            bookings={visibleBookings}
            timeBlocks={timeBlocks}
            selectedDate={selectedDate}
            isLoading={bookingsInitialLoading || barbersInitialLoading}
            isSearchActive={Boolean(effectiveClientSearchQuery) || (mode === 'dashboard' && dayOpsFilter !== 'all')}
            scrollContainerRef={timelineScrollRef}
            onBookingClick={openTimelineBooking}
            onGoToNextDay={goToNextTimelineDay}
            nextDayShortLabel={timelineNextDayLabel}
          />
        </AdminErrorBoundary>
      ) : mode === 'dashboard' && activeView === 'list' ? (
        <>
          <div className="admin-bookings-list-search">
            <AdminBookingsOpsSearch
              variant="standard"
              searchInputRef={searchInputRef}
              searchResultsRef={searchResultsRef}
              clientSearchQuery={clientSearchQuery}
              onClientSearchQueryChange={setClientSearchQuery}
              searchDropdownBookings={searchDropdownBookings}
              searchResultsLabel={searchResultsLabel}
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
            onOpenClient={openClientProfile}
            onCancelBooking={cancelBookingByShop}
            cancelLoadingBookingId={cancelLoadingBookingId}
            canCancelBooking={canCancelBookingAsShop}
          />
        </>
      ) : mode === 'history' ? (
        <AdminBookingsScheduleList
          variant="history"
          heading="Booking history"
          bookings={visibleBookings}
          nowMs={nowMs}
          bookingsInitialLoading={bookingsInitialLoading}
          updatedBookingIds={updatedBookingIds}
          highlightMatch={highlightMatch}
          formatStartTime={formatStartTime}
          formatDateTime={formatStartDateTime}
          getHistoryStatusLine={(booking) => getStatusA11yLabel(getBookingStatusLabel(booking))}
          historyDateFiltered={Boolean(historyDateRange)}
          onClearHistoryDateRange={historyDateRange ? () => setHistoryDateRange(null) : undefined}
          onOpenClient={openClientProfile}
        />
      ) : null}
      {mode === 'history' && historyHasMore && <button type="button" className="btn btn--secondary" onClick={() => void loadMoreHistory()} disabled={historyLoadingMore}>{historyLoadingMore ? 'Loading...' : 'Load more'}</button>}
    </>
  )}
</>
      )}


      {mode === 'reports' && (
        <section className="admin-reports" aria-live="polite">
          <div className="admin-reports-filter-bar">
          <p className="admin-kpi-note">Timezone: {ADMIN_TIMEZONE}</p>
          <div className="admin-reports-range-scroll">
            <div className="admin-reports-range-tabs" role="tablist" aria-label="Report range">
              {REPORTS_RANGE_OPTIONS.map((option) => {
                const isActive = reportsRange === option.value;
                return (
                  <button key={option.value} type="button" role="tab" aria-selected={isActive} className={`admin-reports-range-tab ${isActive ? 'is-active' : ''}`} onClick={() => setReportsRange(option.value)}>{option.label}</button>
                );
              })}
            </div>
          </div>

          <div className="admin-history-row">
            <label>Recent barbers</label>
            <div className="admin-history-barber-controls">
              <div className="admin-filter-scroll-wrap">
                <div ref={reportsRecentBarbersScrollRef} className="admin-history-recent-scroll">
                <div className="admin-history-recent-barbers" role="group" aria-label="Recent barbers">
                  <button type="button" className={`admin-history-avatar admin-history-avatar--all ${reportsBarberId === null ? 'is-active' : ''}`} onClick={() => setReportsBarberId(null)} aria-pressed={reportsBarberId === null}>ALL</button>
                  {reportRecentBarbers.map((barber) => {
                    const hashIndex = hashValue(`${barber.id}:${barber.name}`) % 6;
                    const isActive = reportsBarberId === barber.id;
                    return <BarberChip key={barber.id} barber={barber} toneIndex={hashIndex} isSelected={isActive} onClick={() => setReportsBarberId(barber.id)} ariaLabel={`Filter by ${barber.name}`} />;
                  })}
                </div>
                </div>
              </div>

              <div className="admin-history-control-actions">
                <div className="admin-history-more" ref={reportsMoreRef}>
                  <button
                    type="button"
                    className={`admin-history-icon-button ${isReportsMoreOpen ? 'is-active' : ''}`}
                    onClick={() => setIsReportsMoreOpen((current) => !current)}
                    aria-haspopup="menu"
                    aria-expanded={isReportsMoreOpen}
                    aria-label="Show all barbers"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v1A1.5 1.5 0 0 1 18.5 9h-13A1.5 1.5 0 0 1 4 7.5v-1Zm0 5A1.5 1.5 0 0 1 5.5 10h13a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 12.5v-1Zm1.5 3.5A1.5 1.5 0 0 0 4 16.5v1A1.5 1.5 0 0 0 5.5 19h13a1.5 1.5 0 0 0 1.5-1.5v-1a1.5 1.5 0 0 0-1.5-1.5h-13Z" fill="currentColor" />
                    </svg>
                  </button>

                  {isReportsMoreOpen ? (
                    <div className="admin-history-more-menu" role="menu" aria-label="All barbers">
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={reportsBarberId === null}
                        className={`admin-history-more-item ${reportsBarberId === null ? 'is-active' : ''}`}
                        onClick={() => {
                          setReportsBarberId(null);
                          setIsReportsMoreOpen(false);
                        }}
                      >
                        All barbers
                      </button>
                      {allBarbersSorted.map((barber) => (
                        <button
                          key={barber.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={reportsBarberId === barber.id}
                          className={`admin-history-more-item ${reportsBarberId === barber.id ? 'is-active' : ''}`}
                          onClick={() => {
                            setReportsBarberId(barber.id);
                            setIsReportsMoreOpen(false);
                          }}
                        >
                          {barber.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          </div>


          <div className="admin-reports-hero admin-kpi-clickable" onClick={() => setOpenDrilldown('revenue')}>
            <span className="admin-reports-hero-value">{reportsHeroValue}</span>
            <p className="admin-reports-hero-label">Revenue in selected period</p>
          </div>

          <div className="admin-sales-chart-wrap">
            <div className="admin-kpi-row">
              <p className="admin-kpi-label">Trend</p>
              <div className="admin-chart-switcher">
                {(['revenue', 'bookings', 'cancelRate'] as const).map((metric) => (
                  <button type="button" key={metric} className={`admin-chart-switch ${chartMetric === metric ? 'is-active' : ''}`} onClick={() => setChartMetric(metric)}>
                    {metric === 'cancelRate' ? 'Cancel rate' : metric.charAt(0).toUpperCase() + metric.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <AdminLineChart
              series={reportsChartSeries}
              metric={chartMetric === 'revenue' ? 'currency' : 'number'}
              getColor={() => (chartMetric === 'cancelRate' ? 'var(--accent)' : 'var(--fg)')}
              formatValue={(v) => (chartMetric === 'revenue' ? formatCurrencyGbp(v) : chartMetric === 'cancelRate' ? `${v.toFixed(1)}%` : `${Math.round(v)}`)}
              responsive
              emptyLabel="No data for this range"
            />
          </div>

          {reportsError && <p className="admin-inline-error">{reportsError}</p>}
          {reportsLoading && reports === null ? (
            <div className="admin-reports-grid" aria-busy="true" aria-hidden="true">
              <SkeletonKPICards count={8} />
            </div>
          ) : null}
          <div className={`admin-reports-grid${reportsLoading && reports === null ? ' admin-reports-grid--hidden' : ''}`}>

            <article className={`admin-kpi-card admin-kpi-card--bookings admin-kpi-clickable${bookingsDelta.className === 'admin-kpi-trend--up' ? ' admin-kpi-card--trend-up' : bookingsDelta.className === 'admin-kpi-trend--down' ? ' admin-kpi-card--trend-down' : ''}`} onClick={() => setOpenDrilldown('bookings')}>
              <p className="admin-kpi-label">Bookings</p>
              <p className="admin-kpi-value">{reports?.bookingsCount ?? 0}</p>
              <p className={`admin-kpi-trend ${bookingsDelta.className}`}>{bookingsDelta.direction === 'up' ? <svg aria-hidden="true" className="admin-kpi-trend-icon" viewBox="0 0 8 8" fill="currentColor"><path d="M4 0L8 8H0Z"/></svg> : bookingsDelta.direction === 'down' ? <svg aria-hidden="true" className="admin-kpi-trend-icon" viewBox="0 0 8 8" fill="currentColor"><path d="M4 8L0 0H8Z"/></svg> : null}{bookingsDelta.text}{isSmallSample ? <span className="admin-kpi-sample-inline">Small sample</span> : null}</p>
              <div className="admin-kpi-sparkline" aria-hidden="true">
                <AdminLineChart variant="sparkline" responsive series={[{ key: 'bookings', name: 'Bookings', points: bookingsSparkSeries }]} getColor={() => 'var(--fg)'} emptyLabel="" />
              </div>
            </article>

            <article className={`admin-kpi-card admin-kpi-card--cancelled admin-kpi-clickable${cancelledDelta.className === 'admin-kpi-trend--up' ? ' admin-kpi-card--trend-up' : cancelledDelta.className === 'admin-kpi-trend--down' ? ' admin-kpi-card--trend-down' : ''}`} onClick={() => setOpenDrilldown('cancelled')}>
              <p className="admin-kpi-label">Cancelled rate</p>
              <p className="admin-kpi-value">{`${(reports?.cancelledRate ?? 0).toFixed(1)}%`}</p>
              <p className={`admin-kpi-trend ${cancelledDelta.className}`}>{cancelledDelta.direction === 'up' ? <svg aria-hidden="true" className="admin-kpi-trend-icon" viewBox="0 0 8 8" fill="currentColor"><path d="M4 0L8 8H0Z"/></svg> : cancelledDelta.direction === 'down' ? <svg aria-hidden="true" className="admin-kpi-trend-icon" viewBox="0 0 8 8" fill="currentColor"><path d="M4 8L0 0H8Z"/></svg> : null}{cancelledDelta.text}</p>
              <p className="admin-kpi-note">{reportsCancelledCount} of {reports?.bookingsCount ?? 0} bookings</p>
              <div className="admin-reports-breakdown" role="list" aria-label="Completion breakdown"><div className="admin-reports-breakdown-bar" aria-hidden="true"><span style={{ width: `${reportsBreakdownTotal ? ((reports?.breakdown.completed ?? 0) / reportsBreakdownTotal) * 100 : 0}%` }} className="is-completed" /><span style={{ width: `${reportsBreakdownTotal ? ((reports?.breakdown.cancelledByClient ?? 0) / reportsBreakdownTotal) * 100 : 0}%` }} className="is-cancel-client" /><span style={{ width: `${reportsBreakdownTotal ? ((reports?.breakdown.cancelledByShop ?? 0) / reportsBreakdownTotal) * 100 : 0}%` }} className="is-cancel-shop" /><span style={{ width: `${reportsBreakdownTotal ? ((reports?.breakdown.noShowExpired ?? 0) / reportsBreakdownTotal) * 100 : 0}%` }} className="is-no-show" /></div></div>
              <div className="admin-kpi-sparkline" aria-hidden="true">
                <AdminLineChart variant="sparkline" responsive series={[{ key: 'cancelled', name: 'Cancel rate', points: cancelledSparkSeries }]} getColor={() => 'var(--accent)'} getPathClassName={() => 'is-warning'} emptyLabel="" />
              </div>
            </article>
            <article className={`admin-kpi-card admin-kpi-card--utilization${utilizationDelta.className === 'admin-kpi-trend--up' ? ' admin-kpi-card--trend-up' : utilizationDelta.className === 'admin-kpi-trend--down' ? ' admin-kpi-card--trend-down' : ''}`}>
              <p className="admin-kpi-label">Utilization</p>
              <p className="admin-kpi-value">{reports?.utilizationPct == null ? '—' : `${reports.utilizationPct.toFixed(1)}%`}</p>
              <p className={`admin-kpi-trend ${utilizationDelta.className}`}>{utilizationDelta.direction === 'up' ? <svg aria-hidden="true" className="admin-kpi-trend-icon" viewBox="0 0 8 8" fill="currentColor"><path d="M4 0L8 8H0Z"/></svg> : utilizationDelta.direction === 'down' ? <svg aria-hidden="true" className="admin-kpi-trend-icon" viewBox="0 0 8 8" fill="currentColor"><path d="M4 8L0 0H8Z"/></svg> : null}{utilizationDelta.text}</p>
              <p className="admin-kpi-note">{reportsBookedVsAvailableLabel}</p>
            </article>
            <article className={`admin-kpi-card${avgBookingValueDelta.className === 'admin-kpi-trend--up' ? ' admin-kpi-card--trend-up' : avgBookingValueDelta.className === 'admin-kpi-trend--down' ? ' admin-kpi-card--trend-down' : ''}`}>
              <p className="admin-kpi-label">Avg booking value</p>
              <p className="admin-kpi-value">{formatCurrencyGbp(reports?.avgBookingValue ?? 0)}</p>
              <p className={`admin-kpi-trend ${avgBookingValueDelta.className}`}>{avgBookingValueDelta.direction === 'up' ? <svg aria-hidden="true" className="admin-kpi-trend-icon" viewBox="0 0 8 8" fill="currentColor"><path d="M4 0L8 8H0Z"/></svg> : avgBookingValueDelta.direction === 'down' ? <svg aria-hidden="true" className="admin-kpi-trend-icon" viewBox="0 0 8 8" fill="currentColor"><path d="M4 8L0 0H8Z"/></svg> : null}{avgBookingValueDelta.text}</p>
            </article>
            <article className={`admin-kpi-card${noShowExpiredDelta.className === 'admin-kpi-trend--up' ? ' admin-kpi-card--trend-up' : noShowExpiredDelta.className === 'admin-kpi-trend--down' ? ' admin-kpi-card--trend-down' : ''}`}>
              <p className="admin-kpi-label">No-show/expired rate</p>
              <p className="admin-kpi-value">{`${(reports?.noShowExpiredRate ?? 0).toFixed(1)}%`}</p>
              <p className={`admin-kpi-trend ${noShowExpiredDelta.className}`}>{noShowExpiredDelta.direction === 'up' ? <svg aria-hidden="true" className="admin-kpi-trend-icon" viewBox="0 0 8 8" fill="currentColor"><path d="M4 0L8 8H0Z"/></svg> : noShowExpiredDelta.direction === 'down' ? <svg aria-hidden="true" className="admin-kpi-trend-icon" viewBox="0 0 8 8" fill="currentColor"><path d="M4 8L0 0H8Z"/></svg> : null}{noShowExpiredDelta.text}</p>
            </article>

            <article className="admin-kpi-card"><p className="admin-kpi-label">Peak day</p><p className="admin-kpi-value admin-kpi-value--text">{reports?.peakDay ?? '—'}</p></article>
            <article className="admin-kpi-card"><p className="admin-kpi-label">Peak hour</p><p className="admin-kpi-value admin-kpi-value--text">{reports?.peakHour ?? '—'}</p></article>
            <article className="admin-kpi-card admin-kpi-clickable" onClick={() => setOpenDrilldown('service')}><p className="admin-kpi-label">Most popular service</p><p className="admin-kpi-value admin-kpi-value--text">{reports?.mostPopularService ? `${reports.mostPopularService.name} (${reports.mostPopularService.count})` : 'No confirmed bookings'}</p></article>
            <article className="admin-kpi-card"><p className="admin-kpi-label">{reportsBarberId ? 'Selected barber' : 'Busiest barber'}</p><p className="admin-kpi-value admin-kpi-value--text">{reportsBarberId ? reportsSelectedBarberName : reports?.busiestBarber ? `${reports.busiestBarber.name} (${reports.busiestBarber.count})` : 'No confirmed bookings'}</p></article>
          </div>
          <AdminLeaderboard
            title="Barber leaderboard"
            emptyLabel="No bookings in this range."
            rows={reportsLeaderboardRows}
          />
          {openDrilldown ? <div className="admin-client-modal-backdrop admin-client-modal-backdrop--centered" role="presentation" onClick={() => setOpenDrilldown(null)}><div className="admin-reports-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><div className="admin-client-modal-head"><h3>Drill-down</h3><button type="button" className="btn btn--ghost" onClick={() => setOpenDrilldown(null)}>Close</button></div><input value={drilldownSearch} onChange={(event) => setDrilldownSearch(event.target.value)} placeholder="Search client/email/service" /><div className="admin-reports-drawer-list">{filteredDrilldownRows.map((row) => <article key={row.id} className="admin-kpi-card"><p>{formatInTimeZone(new Date(row.startAt), ADMIN_TIMEZONE, 'dd MMM HH:mm')} · {row.barberName}</p><p>{row.serviceName} · {row.status}</p><p>{row.clientName ?? 'Unknown'} · {row.clientEmail ?? 'No email'}</p>{row.computedValueGbp != null ? <p>{formatCurrencyGbp(row.computedValueGbp)}</p> : null}</article>)}</div></div></div> : null}
        </section>
      )}

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

      {selectedTimelineBooking && (
        <div
          className="admin-client-modal-backdrop admin-client-modal-backdrop--sheet"
          role="presentation"
          onClick={() => setSelectedTimelineBooking(null)}
        >
          <div
            className="admin-client-modal admin-booking-quick-actions-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Booking quick actions"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="admin-client-modal-head admin-booking-quick-actions-head">
              <div className="admin-booking-quick-actions-head-copy">
                <p className="admin-booking-quick-actions-eyebrow">Appointment</p>
                <h2 className="admin-booking-quick-actions-title">Quick actions</h2>
                <p className="admin-booking-quick-actions-kicker">
                  {new Date(selectedTimelineBooking.startAt).toLocaleString('en-GB', {
                    timeZone: ADMIN_TIMEZONE,
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · {selectedTimelineBooking.service?.name || 'Service'} · {selectedTimelineBooking.status}
                </p>
                <p className="admin-booking-quick-actions-subtitle admin-booking-quick-actions-subtitle--collapse">
                  Review details, run admin actions, and update internal notes.
                </p>
              </div>
            </header>

            <div className="admin-booking-quick-actions-body">
              <section className="admin-booking-quick-section admin-booking-quick-section--summary" aria-labelledby="booking-summary-heading">
                <div className="admin-booking-quick-section-summary-top">
                  <div className="admin-booking-quick-section-head">
                    <h3 id="booking-summary-heading">Summary</h3>
                    <p className="admin-booking-quick-section-copy admin-booking-quick-section-copy--collapse">
                      Client, service, and timing at a glance.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="admin-booking-quick-actions-dismiss"
                    onClick={() => setSelectedTimelineBooking(null)}
                    aria-label="Close booking quick actions"
                  >
                    <X width={18} height={18} aria-hidden="true" />
                  </button>
                </div>
                <div className="admin-booking-summary-card">
                  <div className="admin-booking-summary-identity">
                    <p className="admin-booking-summary-name">{selectedTimelineBooking.fullName}</p>
                    <p className="admin-booking-summary-email">{selectedTimelineBooking.email}</p>
                  </div>
                  <dl className="admin-booking-summary-grid">
                    <div className="admin-booking-summary-item">
                      <dt>Service</dt>
                      <dd>{selectedTimelineBooking.service?.name || '—'}</dd>
                    </div>
                    <div className="admin-booking-summary-item">
                      <dt>Barber</dt>
                      <dd>{selectedTimelineBooking.barber?.name || '—'}</dd>
                    </div>
                    <div className="admin-booking-summary-item admin-booking-summary-item--wide">
                      <dt>Date &amp; time</dt>
                      <dd>
                        {new Date(selectedTimelineBooking.startAt).toLocaleString('en-GB', { timeZone: ADMIN_TIMEZONE })} →{' '}
                        {new Date(selectedTimelineBooking.endAt).toLocaleTimeString('en-GB', {
                          timeZone: ADMIN_TIMEZONE,
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>

              <section className="admin-booking-quick-section admin-booking-quick-section--actions" aria-labelledby="booking-actions-heading">
                <div className="admin-booking-quick-section-head">
                  <h3 id="booking-actions-heading">Actions</h3>
                  <p className="admin-booking-quick-section-copy admin-booking-quick-section-copy--collapse">
                    Administrative controls for this booking.
                  </p>
                </div>
                <div className="admin-booking-quick-actions-rows" role="list">
                  <div className="admin-booking-quick-action-row admin-booking-quick-action-row--danger" role="listitem">
                    <div className="admin-booking-quick-action-row__icon" aria-hidden="true">
                      <Ban width={18} height={18} />
                    </div>
                    <div className="admin-booking-quick-action-row__copy">
                      <p className="admin-booking-quick-action-row__title">Cancel booking</p>
                      <p className="admin-booking-quick-action-row__description">
                        {selectedTimelineBooking.status === 'CONFIRMED' &&
                        !canShopAdminCancelByLeadTime(new Date(selectedTimelineBooking.startAt), nowMs)
                          ? 'Cancellations are only possible more than 30 minutes before the start time.'
                          : 'Remove this appointment from the schedule.'}
                      </p>
                    </div>
                    <div className="admin-booking-quick-action-row__meta">
                      <span className={`badge ${canCancelBookingAsShop(selectedTimelineBooking) ? 'badge--confirmed' : 'badge--neutral'}`}>
                        {canCancelBookingAsShop(selectedTimelineBooking) ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                    <div className="admin-booking-quick-action-row__cta">
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={() => void cancelBookingByShop(selectedTimelineBooking)}
                        disabled={!canCancelBookingAsShop(selectedTimelineBooking) || cancelLoadingBookingId === selectedTimelineBooking.id}
                      >
                        {cancelLoadingBookingId === selectedTimelineBooking.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="admin-booking-quick-section" aria-labelledby="booking-notes-heading">
                <div className="admin-booking-quick-section-head">
                  <h3 id="booking-notes-heading">Internal notes</h3>
                  <p className="admin-booking-quick-section-copy admin-booking-quick-section-copy--collapse">
                    Visible only to your team; not shown to clients.
                  </p>
                </div>
                <div className="admin-booking-notes-card">
                  <textarea
                    id="booking-notes"
                    rows={4}
                    value={timelineNotesDraft}
                    onChange={(event) => setTimelineNotesDraft(event.target.value)}
                    aria-labelledby="booking-notes-heading"
                  />
                  {timelineNotesMessage ? (
                    <div className="admin-booking-notes-status">
                      <p className={timelineNotesMessage === 'Notes saved.' ? 'admin-inline-success' : 'admin-inline-error'}>{timelineNotesMessage}</p>
                      <button type="button" className="btn btn--ghost admin-booking-notes-status-clear" onClick={() => setTimelineNotesMessage('')}>
                        Dismiss message
                      </button>
                    </div>
                  ) : null}
                  <div className="admin-booking-notes-actions">
                    <button type="button" className="btn btn--primary" onClick={() => void saveTimelineBookingNotes()} disabled={timelineNotesSaving}>
                      {timelineNotesSaving ? 'Saving...' : 'Save notes'}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}



      {selectedClientId && (
        <div className="admin-client-modal-backdrop admin-client-modal-backdrop--centered" role="presentation" onClick={() => setSelectedClientId(null)}>
          <div
            className="admin-client-modal admin-client-modal--profile"
            role="dialog"
            aria-modal="true"
            aria-label="Client profile"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-client-modal-head">
              <h3>Client profile</h3>
              <button type="button" className="btn btn--ghost admin-client-modal-close" onClick={() => setSelectedClientId(null)} aria-label="Close client profile">
                <X width={16} height={16} aria-hidden="true" />
              </button>
            </div>
            {isClientLoading && <p className="muted">Loading...</p>}
            {clientError && <p className="admin-inline-error">{clientError}</p>}
            {clientProfile && (
              <>
                <section className="admin-client-modal__section" aria-label="Client identity">
                  <p className="admin-client-modal__identity">
                    <strong>{clientProfile.client.fullName || 'Unnamed client'}</strong>
                    <br />
                    {clientProfile.client.email}
                    <br />
                    {clientProfile.client.phone || 'No phone'}
                  </p>
                </section>
                <section className="admin-client-modal__section" aria-label="Visit statistics">
                  <h4 className="admin-client-modal__section-title">Stats</h4>
                  <div className="admin-client-stats">
                    <p>Total visits: {clientProfile.stats.totalBookings}</p>
                    <p>
                      Last visit:{' '}
                      {clientProfile.stats.lastBookingAt
                        ? new Date(clientProfile.stats.lastBookingAt).toLocaleString('en-GB', { timeZone: ADMIN_TIMEZONE })
                        : '—'}
                    </p>
                    <p>Cancelled: {clientProfile.stats.cancelledCount}</p>
                  </div>
                </section>
                <section className="admin-client-modal__section" aria-labelledby="client-recent-bookings">
                  <h4 className="admin-client-modal__section-title" id="client-recent-bookings">
                    Recent bookings
                  </h4>
                  <ul className="admin-client-bookings">
                    {clientProfile.recentBookings.map((item) => (
                      <li key={item.id}>
                        {new Date(item.startAt).toLocaleString('en-GB', { timeZone: ADMIN_TIMEZONE })} · {item.status} · {item.service?.name} ·{' '}
                        {item.barber?.name}
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="admin-client-modal__section" aria-labelledby="client-notes-heading">
                  <h4 className="admin-client-modal__section-title" id="client-notes-heading">
                    Notes
                  </h4>
                  <textarea
                    id="client-notes"
                    value={notesDraft}
                    onChange={(event) => setNotesDraft(event.target.value)}
                    rows={5}
                    aria-labelledby="client-notes-heading"
                  />
                  <button type="button" className="btn btn--primary" onClick={() => void saveNotes()} disabled={notesSaving}>
                    {notesSaving ? 'Saving...' : 'Save notes'}
                  </button>
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
