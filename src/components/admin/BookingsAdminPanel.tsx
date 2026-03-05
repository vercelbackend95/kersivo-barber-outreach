import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import TodayTimeline from './TodayTimeline';
import AdminErrorBoundary from './AdminErrorBoundary';
import HistoryDateRangePicker from './HistoryDateRangePicker';
import { getBookingStatusTone, getStatusTextColorClass } from './bookingStatus';
import BarbersOverview from './BarbersOverview';
import BarberProfile from './BarberProfile';
import type { Barber, ServiceOption, TimeBlock, WorkingHourRow } from './barbersTypes';
import { formatDelta } from './reportsFormatting';
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
  recentBarbers: Array<{ id: string; name: string }>;

  selectedBarber: { id: string; name: string } | null;
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
  barberRanking: Array<{
    barberId: string;
    barberName: string;
    bookings: number;
    revenue: number;
    cancelledRate: number;
    utilizationPct: number | null;
  }>;
  selectedBarberRank: {
    rank: number;
    total: number;
    bookingSharePct: number;
    revenueSharePct: number;
  } | null;

};
type ReportsRange = 'week' | '7d' | '30d' | '90d' | '1y';


const ADMIN_TIMEZONE = 'Europe/London';
const SLOT_STEP_MINUTES = 15;
const POLL_INTERVAL_MS = 15000;
const LAST_UPDATED_REFRESH_MS = 1000;
const LIVE_THRESHOLD_MS = 20000;
const CONNECTING_GRACE_MS = 2000;

const UPDATED_ROW_HIGHLIGHT_MS = 2000;
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

function RevenueSparkline({
  series,
  emptyLabel,
  tone = 'revenue'
}: {
  series: Array<{ label: string; value: number }>;
  emptyLabel: string;
  tone?: 'revenue' | 'warning';
}) {

  const safeSeries = series.length ? series : [{ label: 'n/a', value: 0 }];
  const chartWidth = 320;
  const chartHeight = 88;
  const padding = 8;
  const values = safeSeries.map((item) => item.value);
  const maxValue = Math.max(0, ...values);
  const minValue = Math.min(0, ...values);
  const effectiveRange = Math.max(1, maxValue - minValue);
  const isEmptyRevenue = values.every((value) => value === 0);
  const points = safeSeries.map((item, index) => {
    const x = padding + (index * (chartWidth - padding * 2)) / Math.max(1, safeSeries.length - 1);
    const y = chartHeight - padding - ((item.value - minValue) / effectiveRange) * (chartHeight - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const baselineY = chartHeight - padding;
  const areaPoints = `${padding},${baselineY} ${points} ${chartWidth - padding},${baselineY}`;


  return (
    <div className="admin-revenue-chart" role="img" aria-label="Trend over selected period">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" aria-hidden="true">
        <line x1={padding} y1={baselineY} x2={chartWidth - padding} y2={baselineY} className="admin-revenue-chart-axis" />
        {isEmptyRevenue ? <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="admin-revenue-chart-empty">{emptyLabel}</text> : (
          <>
            <polygon points={areaPoints} className={`admin-revenue-chart-area ${tone === 'warning' ? 'is-warning' : ''}`} />
            <polyline points={points} className={`admin-revenue-chart-line ${tone === 'warning' ? 'is-warning' : ''}`} />

          </>
        )}

      </svg>
    </div>
  );

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


const MOBILE_HISTORY_SERVICE_SHORTCUTS: Record<string, string> = {
  haircut: 'H',
  'haircut + beard': 'H+B',
  'haircut & beard': 'H+B',
  'beard trim': 'BT',
  'skin fade': 'SF'
};

function getMobileHistoryServiceLabel(serviceName?: string | null) {
  const normalizedServiceName = (serviceName ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalizedServiceName) return '—';
  return MOBILE_HISTORY_SERVICE_SHORTCUTS[normalizedServiceName] ?? serviceName ?? '—';
}


function getTodayLondonDate() {
  return formatInTimeZone(new Date(), ADMIN_TIMEZONE, 'yyyy-MM-dd');
}
function formatTimelineDateLabel(date: string) {
  const dateAtLondonMidnight = fromZonedTime(`${date}T00:00:00.000`, ADMIN_TIMEZONE);
  return formatInTimeZone(dateAtLondonMidnight, ADMIN_TIMEZONE, 'EEE dd MMM');
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
type StatusIconProps = {
  className?: string;
  'aria-label'?: string;
  title?: string;
};
function CheckCircleIcon({ className, ...a11yProps }: StatusIconProps) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...a11yProps}><circle cx="12" cy="12" r="9" /><path d="m9 12 2 2 4-4" /></svg>;
}

function ClockIcon({ className, ...a11yProps }: StatusIconProps) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...a11yProps}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}

function UserXIcon({ className, ...a11yProps }: StatusIconProps) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...a11yProps}><circle cx="12" cy="8" r="3" /><path d="M5 20a7 7 0 0 1 14 0" /><path d="m5 5 14 14" /></svg>;
}

function BanIcon({ className, ...a11yProps }: StatusIconProps) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...a11yProps}><circle cx="12" cy="12" r="9" /><path d="M7 7l10 10" /></svg>;
}

function Repeat2Icon({ className, ...a11yProps }: StatusIconProps) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...a11yProps}><path d="M20 7h-6l2-2" /><path d="M4 17h6l-2 2" /><path d="M20 7a8 8 0 0 0-14-3" /><path d="M4 17a8 8 0 0 0 14 3" /></svg>;
}

function AlertCircleIcon({ className, ...a11yProps }: StatusIconProps) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...a11yProps}><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" /></svg>;
}

function getStatusIconMeta(booking: Booking, statusLabel: string): { Icon: (props: StatusIconProps) => JSX.Element; className: string; label: string } {
  if (statusLabel === 'CONFIRMED') return { Icon: CheckCircleIcon, className: getStatusTextColorClass(getBookingStatusTone(booking)), label: getStatusA11yLabel(statusLabel) };
  if (statusLabel === 'EXPIRED') return { Icon: ClockIcon, className: getStatusTextColorClass(getBookingStatusTone(booking)), label: getStatusA11yLabel(statusLabel) };
  if (statusLabel === 'CANCELLED_BY_CLIENT') return { Icon: UserXIcon, className: getStatusTextColorClass(getBookingStatusTone(booking)), label: getStatusA11yLabel(statusLabel) };
  if (statusLabel === 'CANCELLED_BY_SHOP') return { Icon: BanIcon, className: getStatusTextColorClass(getBookingStatusTone(booking)), label: getStatusA11yLabel(statusLabel) };
  if (statusLabel === 'CONFIRMED · RESCHEDULED') return { Icon: Repeat2Icon, className: getStatusTextColorClass(getBookingStatusTone(booking)), label: getStatusA11yLabel(statusLabel) };
  return { Icon: AlertCircleIcon, className: getStatusTextColorClass(getBookingStatusTone(booking)), label: getStatusA11yLabel(statusLabel) };


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

function formatStartTimeMobile(startAt: string) {
  const parsedDate = parseBookingStartAt(startAt);
  if (!parsedDate) return '—';
  return formatInTimeZone(parsedDate, ADMIN_TIMEZONE, 'HH:mm');
}

function shortEmail(email: string) {
  const clean = (email || '').trim();
  if (clean.length <= 3) return `${clean}...`;
  return `${clean.slice(0, 3)}...`;
}


function getUpcomingBookings(bookings: Booking[]) {
  const nowMs = Date.now();
  return bookings.filter((b) => b.status === 'CONFIRMED').filter((b) => new Date(b.endAt).getTime() > nowMs).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}
function isTodayInLondon(value: string, todayLondonDate: string) {
  return formatInTimeZone(new Date(value), ADMIN_TIMEZONE, 'yyyy-MM-dd') === todayLondonDate;
}


function formatLastUpdated(lastSuccessAt: number | null, nowMs: number) {
  if (!lastSuccessAt) return 'never';
  const diffSec = Math.floor((nowMs - lastSuccessAt) / 1000);

  if (diffSec <= 4) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  return `${Math.floor(diffSec / 60)}m ago`;
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
const canBeCancelledByShop = (booking: Booking) => booking.status === 'CONFIRMED';


function getBookingSearchScore(booking: Booking, normalizedQuery: string) {
  const email = normalizeSearchValue(booking.email ?? '');
  const fullName = normalizeSearchValue(booking.fullName ?? '');
  if (email === normalizedQuery) return 6;
  if (email.startsWith(normalizedQuery)) return 5;
  if (email.includes(normalizedQuery)) return 4;
  if (fullName === normalizedQuery) return 3;
  if (fullName.startsWith(normalizedQuery)) return 2;
  if (fullName.includes(normalizedQuery)) return 1;
  return 0;
}
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('') || '?';
}
function normalizeBarberStatus(barber: Barber) {
  if (typeof barber.isActive === 'boolean') return barber.isActive;
    if (typeof barber.active === 'boolean') return barber.active;
  return true;
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


type BookingsAdminPanelProps = {
  isActive: boolean;
    mode: BookingsAdminMode;
  onBackToDashboard?: () => void;

};

export default function BookingsAdminPanel({ isActive, mode, onBackToDashboard }: BookingsAdminPanelProps) {
  const [secret, setSecret] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barbersFilter, setBarbersFilter] = useState<'active' | 'all'>('active');
  const [barberNameDraft, setBarberNameDraft] = useState('');
  const [barberAvatarFile, setBarberAvatarFile] = useState<File | null>(null);
  const [barberSaveMessage, setBarberSaveMessage] = useState('');
  const [barberSaveError, setBarberSaveError] = useState('');
  const [barberSaving, setBarberSaving] = useState(false);
  const [barberReordering, setBarberReordering] = useState(false);
  const [barberAvatarPreviewUrl, setBarberAvatarPreviewUrl] = useState<string | null>(null);
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
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isSearchDebouncing, setIsSearchDebouncing] = useState(false);
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(-1);
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
  const [reportsError, setReportsError] = useState('');
    const [reportsRange, setReportsRange] = useState<ReportsRange>('week');
  const [reportsBarberId, setReportsBarberId] = useState<string | null>(null);
  const [insightsExpanded, setInsightsExpanded] = useState(false);
  const [chartMetric, setChartMetric] = useState<'revenue' | 'bookings' | 'cancelRate'>('revenue');
  const [rankingSort, setRankingSort] = useState<'bookings' | 'revenue' | 'cancelRate' | 'utilization'>('bookings');
  const [expandedRankingMobileId, setExpandedRankingMobileId] = useState<string | null>(null);
  const [openDrilldown, setOpenDrilldown] = useState<'bookings' | 'cancelled' | 'revenue' | 'service' | null>(null);
  const [drilldownSearch, setDrilldownSearch] = useState('');

  const [cancelSuccessMessage, setCancelSuccessMessage] = useState('');
  const [cancelErrorMessage, setCancelErrorMessage] = useState('');
  const [cancelLoadingBookingId, setCancelLoadingBookingId] = useState<string | null>(null);
  const [blockScopeBarberId, setBlockScopeBarberId] = useState<string>('all');
  const [selectedBarberStatsCount, setSelectedBarberStatsCount] = useState(0);

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
  const updatedRowsTimeoutRef = useRef<number | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchResultsRef = useRef<HTMLDivElement | null>(null);

  const timelineScrollRestoreRef = useRef<{ left: number; top: number } | null>(null);
  const timelineScrollRafRef = useRef<number | null>(null);
    const pendingTimelineScrollBookingIdRef = useRef<string | null>(null);
  const initialMountMsRef = useRef(Date.now());
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
      const response = await fetch(endpoint, { credentials: 'same-origin' });
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
    const response = await fetch('/api/admin/barbers', { credentials: 'same-origin' });
    if (response.ok) {
      const data = (await response.json()) as { barbers?: Barber[] };
      setBarbers(data.barbers ?? []);
    }
  }, []);
  const fetchReports = useCallback(async () => {
    if (!loggedIn) return;

    setReportsError('');
    const params = new URLSearchParams({ range: reportsRange });
    if (reportsBarberId) params.set('barberId', reportsBarberId);
    const response = await fetch(`/api/admin/reports?${params.toString()}`, { credentials: 'same-origin' });


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
  }, [loggedIn, reportsBarberId, reportsRange]);




  const fetchBookings = useCallback(async (appendHistory = false) => {
    if (!loggedIn || !isActive || pollingStoppedRef.current || inFlightRef.current) return;
    if (mode === 'history' && !appendHistory) setHistoryCursor(null);

    inFlightRef.current = true;
        const requestId = ++bookingsRequestIdRef.current;

    try {
      const endpoint = (() => {
          if (mode === 'history') {
          const params = new URLSearchParams({ view: 'history', barberId: 'all', limit: '50' });
          if (historyDateRange?.from && historyDateRange?.to) {
            params.set('from', formatInTimeZone(historyDateRange.from, ADMIN_TIMEZONE, 'yyyy-MM-dd'));
            params.set('to', formatInTimeZone(historyDateRange.to, ADMIN_TIMEZONE, 'yyyy-MM-dd'));
          }

          if (appendHistory && historyCursor) params.set('cursor', historyCursor);
          return `/api/admin/bookings?${params.toString()}`;
        }
        return `/api/admin/bookings?date=${encodeURIComponent(selectedDate)}&mode=day`;
      })();

      const response = await fetch(endpoint, { credentials: 'same-origin' });

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
      const changedIds = mergedBookings.filter((b) => previousSignaturesRef.current.get(b.id) !== nextSignatures.get(b.id)).map((b) => b.id);
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
      setLastSuccessAt(Date.now());

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
      }

      setHistoryLoadingMore(false);
    }
  }, [activeView, bookings, captureTimelineScroll, historyCursor, historyDateRange, isActive, loggedIn, mode, restoreTimelineScroll, selectedDate]);
  const loadMoreHistory = useCallback(async () => {
    if (!historyHasMore || historyLoadingMore || mode !== 'history') return;
    setHistoryLoadingMore(true);
    await fetchBookings(true);
  }, [fetchBookings, historyHasMore, historyLoadingMore, mode]);


  useEffect(() => { void (async () => { try { const response = await fetch('/api/admin/session', { credentials: 'same-origin' }); setLoggedIn(response.ok); } finally { setIsCheckingSession(false); } })(); }, []);
  useEffect(() => { if (!loggedIn || !isActive) return; if (mode !== 'history') void fetchBookings(); void fetchBarbers(); void fetchTimeBlocks(); void fetchReports(); const id = window.setInterval(() => { if (mode !== 'history') void fetchBookings(); void fetchTimeBlocks(); void fetchReports(); }, POLL_INTERVAL_MS); return () => window.clearInterval(id); }, [activeView, fetchBookings, fetchBarbers, fetchReports, fetchTimeBlocks, isActive, loggedIn, mode]);
  useEffect(() => { if (!loggedIn || !isActive) return; const id = window.setInterval(() => setNowMs(Date.now()), LAST_UPDATED_REFRESH_MS); return () => window.clearInterval(id); }, [isActive, loggedIn]);
  useEffect(() => {
    if (!loggedIn || !isActive || mode !== 'history') return;
    const timeoutId = window.setTimeout(() => { void fetchBookings(); }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [fetchBookings, historyDateRange, isActive, loggedIn, mode]);

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



  const todayLondonDate = useMemo(() => getTodayLondonDate(), [nowMs]);
    const hasRecentConnectionAttempt = nowMs - initialMountMsRef.current > CONNECTING_GRACE_MS;
  const isLive = lastSuccessAt ? nowMs - lastSuccessAt <= LIVE_THRESHOLD_MS : false;
  const connectionStateLabel = !lastSuccessAt && !hasRecentConnectionAttempt ? 'CONNECTING…' : isLive ? 'LIVE' : 'OFFLINE';
  const hasLivePulse = connectionStateLabel === 'LIVE';
  const freshnessLabel = lastSuccessAt ? `Updated ${formatLastUpdated(lastSuccessAt, nowMs)}` : 'Waiting for successful refresh';

  const todayBookings = useMemo(() => bookings.filter((booking) => isTodayInLondon(booking.startAt, todayLondonDate)), [bookings, todayLondonDate]);
  const upcomingBookings = useMemo(() => getUpcomingBookings(todayBookings), [todayBookings]);

  const nextBooking = upcomingBookings[0] ?? null;
  const filteredBookings = useMemo(() => {
    if (mode !== 'history') return bookings;
    return [...bookings]
      .filter((booking) => historyBarberId === 'all' || booking.barberId === historyBarberId)
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }, [bookings, historyBarberId, mode]);

  const allBarbersSorted = useMemo(() => [...barbers].sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'en')), [barbers]);
  const activeBarbers = useMemo(() => allBarbersSorted.filter((barber) => normalizeBarberStatus(barber)), [allBarbersSorted]);
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
      bookings.map((booking) => [booking.barberId, { id: booking.barberId, name: booking.barber?.name ?? 'Barber', isActive: false } as Barber])
    );


    return visibleRecentBarberIds
      .map((barberId) => byId.get(barberId) ?? fallbackById.get(barberId))
      .filter((barber): barber is Barber => Boolean(barber))
      .sort((a, b) => Number(normalizeBarberStatus(b)) - Number(normalizeBarberStatus(a)));
  }, [barbers, bookings, visibleRecentBarberIds]);


  const reportRecentBarbers = useMemo(() => {
    const byId = new Map(barbers.map((barber) => [barber.id, barber]));
    return (reports?.recentBarbers ?? []).map((entry) => ({
      id: entry.id,
      name: byId.get(entry.id)?.name ?? entry.name
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
  const revenueDelta = formatDelta({
    value: reports?.trends.revenueDelta ?? null,
    type: 'currency',
    tone: 'higher_better',
    currentValue: reports?.revenue,
    previousValue: reports?.previousMetrics.revenue
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
    const confidence = useMemo(() => {
    const n = reports?.bookingsCount ?? 0;
    if (n < 10) return { label: 'LOW DATA', className: 'is-low' };
    if (n < 30) return { label: 'OK', className: 'is-ok' };
    return { label: 'STRONG', className: 'is-strong' };
  }, [reports?.bookingsCount]);

  const isSmallSample = (reports?.bookingsCount ?? 0) > 0 && (reports?.bookingsCount ?? 0) < 10;

  const insights = useMemo(() => {
    if (!reports) return ['Stable period — no major spikes.'];
    const lines: string[] = [];
    const scoped = reportsBarberId ? ' for this barber' : '';
    const noShowCount = reports.breakdown.noShowExpired;
    const cancelledClientShare = reports.bookingsCount > 0 ? (reports.breakdown.cancelledByClient / reports.bookingsCount) * 100 : 0;
    const noShowShare = reports.bookingsCount > 0 ? (noShowCount / reports.bookingsCount) * 100 : 0;

    if (noShowShare > 30) lines.push(`High no-show/expired rate${scoped} (${noShowCount}/${reports.bookingsCount}). Consider confirmations.`);
    if (cancelledClientShare > 20) lines.push(`Client cancellations are elevated${scoped}. Consider deposits or reminder texts.`);
    if ((reports.utilizationPct ?? 0) < 20 && reports.availableMinutes > 600) lines.push(`Low utilization${scoped} (${(reports.utilizationPct ?? 0).toFixed(1)}%). Consider promos during peak gaps.`);
    if (reports.peakHour) lines.push(`Peak hour${scoped} is ${reports.peakHour}. Ensure coverage.`);
    if (reports.mostPopularService && reports.bookingsCount > 0 && ((reports.mostPopularService.count / reports.bookingsCount) * 100) > 50) {
      lines.push(`${reports.mostPopularService.name} drives most bookings${scoped}. Promote add-ons.`);

    }
    if ((reports.trends.revenueDelta ?? 0) > 0 && (reports.trends.bookingsPct ?? 0) < 0) {
      lines.push(`Fewer bookings${scoped}, higher value — consider premium slots.`);

    }
    if (!lines.length) lines.push(`Stable period${scoped} — no major spikes.`);
    return lines.slice(0, 3);
  }, [reports, reportsBarberId]);

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

  const rankingRows = useMemo(() => {
    const rows = [...(reports?.barberRanking ?? [])];
    if (rankingSort === 'bookings') return rows.sort((a, b) => b.bookings - a.bookings);
    if (rankingSort === 'revenue') return rows.sort((a, b) => b.revenue - a.revenue);
    if (rankingSort === 'utilization') return rows.sort((a, b) => (b.utilizationPct ?? 0) - (a.utilizationPct ?? 0));
    return rows.sort((a, b) => a.cancelledRate - b.cancelledRate);
  }, [rankingSort, reports?.barberRanking]);

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

  const copySummary = useCallback(async () => {
    if (!reports) return;
    const cancelWord = (reports.trends.cancelledRatePp ?? 0) <= 0 ? 'improved' : 'worsened';
    const summary = `Reports (${REPORTS_RANGE_OPTIONS.find((option) => option.value === reportsRange)?.label ?? reportsRange}, ${reportsBarberId ? reportsSelectedBarberName : 'All barbers'}):
Bookings: ${reports.bookingsCount} (${bookingsDelta.text})
Revenue: ${formatCurrencyGbp(reports.revenue)} (${revenueDelta.text}${reports.usedDemoPricing ? ', estimated' : ''})
Cancelled rate: ${reports.cancelledRate.toFixed(1)}% (${cancelWord})
Peak: ${reports.peakDay ?? '—'} ${reports.peakHour ?? ''}
Utilization: ${reports.utilizationPct == null ? '—' : `${reports.utilizationPct.toFixed(1)}%`} (${utilizationDelta.text})`;
    await navigator.clipboard.writeText(summary);
  }, [bookingsDelta.text, reports, reportsBarberId, reportsRange, reportsSelectedBarberName, revenueDelta.text, utilizationDelta.text]);

  const exportCsvRows = useCallback((rows: ReportBookingRow[], fileName: string) => {
    const header = ['date/time', 'barber', 'service', 'status', 'computedValueGBP', 'client', 'email'];
    const body = rows.map((row) => [
      formatInTimeZone(new Date(row.startAt), ADMIN_TIMEZONE, 'yyyy-MM-dd HH:mm'),
      row.barberName,
      row.serviceName,
      row.status,
      row.computedValueGbp == null ? '' : row.computedValueGbp.toFixed(2),
      row.clientName ?? '',
      row.clientEmail ?? ''
    ]);
    const csv = [header, ...body].map((line) => line.map((item) => `"${String(item).replaceAll('\"', '\"\"')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportMainCsv = useCallback(() => {
    exportCsvRows(reports?.reportBookings ?? [], `reports-${reportsRange}-${reportsBarberId ?? 'all'}.csv`);
  }, [exportCsvRows, reports?.reportBookings, reportsBarberId, reportsRange]);




  const visibleBookings = useMemo(() => {
    if (!normalizedClientSearchQuery) return filteredBookings;
    return filteredBookings.map((booking, index) => ({ booking, score: getBookingSearchScore(booking, normalizedClientSearchQuery), index })).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score).map((entry) => entry.booking);

  }, [filteredBookings, normalizedClientSearchQuery]);
    const searchResultsLabel = useMemo(() => {
    if (isSearchDebouncing) return 'Searching...';
    if (!normalizedClientSearchQuery) return '';
    if (visibleBookings.length === 0) return 'No matches';
    return `${visibleBookings.length} matches`;
  }, [isSearchDebouncing, normalizedClientSearchQuery, visibleBookings.length]);

  const highlightMatch = useCallback((value: string) => {
    if (!normalizedClientSearchQuery) return value;
    const pattern = new RegExp(`(${escapeRegExp(normalizedClientSearchQuery)})`, 'ig');
    const parts = value.split(pattern);
    return parts.map((part, index) => {
      const isMatch = part.toLowerCase() === normalizedClientSearchQuery;
      if (!isMatch) return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
      return <mark key={`${part}-${index}`} className="admin-search-highlight">{part}</mark>;
    });
  }, [normalizedClientSearchQuery]);
  const searchDropdownBookings = useMemo(() => {
    if (!normalizedClientSearchQuery || isSearchDebouncing) return [] as Booking[];
    return visibleBookings.slice(0, 8);
  }, [isSearchDebouncing, normalizedClientSearchQuery, visibleBookings]);


  const isMobileDashboard = mode === 'dashboard' && isMobileViewport;
  useBodyScrollLock(isAddBarberSheetOpen || (openDrilldown !== null && isMobileViewport));
  const isTimelineView = mode === 'dashboard' && activeView === 'timeline';
  const selectedDateLabel = useMemo(() => formatTimelineDateLabel(selectedDate), [selectedDate]);



  async function openClientProfile(clientId?: string | null) {
    if (!clientId) return;
    setSelectedClientId(clientId);
    setIsClientLoading(true);
    setClientError('');
    const response = await fetch(`/api/admin/clients/${clientId}`, { credentials: 'same-origin' });
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
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ notes: notesDraft })
    });
    if (response.ok && clientProfile) {
      setClientProfile({ ...clientProfile, client: { ...clientProfile.client, notes: notesDraft } });
    }
    setNotesSaving(false);

  }
  const openTimelineBooking = useCallback((booking: Booking) => {
    setSelectedTimelineBooking(booking);
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

  const jumpToTimelineBooking = useCallback((booking: Booking) => {
    if (mode !== 'dashboard' || activeView !== 'timeline') {
      pendingTimelineScrollBookingIdRef.current = booking.id;
      setActiveView('timeline');
    } else if (!scrollToTimelineBooking(booking.id)) {
      pendingTimelineScrollBookingIdRef.current = booking.id;
    }

    openTimelineBooking(booking);
    setClientSearchQuery('');
    setDebouncedSearchQuery('');
    setActiveSearchResultIndex(-1);
    searchInputRef.current?.blur();
  }, [activeView, mode, openTimelineBooking, scrollToTimelineBooking]);

  useEffect(() => {
    const pendingBookingId = pendingTimelineScrollBookingIdRef.current;
    if (!pendingBookingId || activeView !== 'timeline') return;
    if (scrollToTimelineBooking(pendingBookingId)) {
      pendingTimelineScrollBookingIdRef.current = null;
    }
  }, [activeView, scrollToTimelineBooking, visibleBookings]);


  async function saveTimelineBookingNotes() {
    if (!selectedTimelineBooking) return;
    setTimelineNotesSaving(true);
    setTimelineNotesMessage('');

    const response = await fetch(`/api/admin/bookings/${selectedTimelineBooking.id}/notes`, {
      method: 'PATCH',
      credentials: 'same-origin',
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
    if (addBarberServiceOptions.length === 0) return;
    setAddBarberSelectedServiceIds((current) => {
      if (current.length > 0) return current;
      return addBarberServiceOptions.map((service) => service.id);
    });
  }, [addBarberServiceOptions]);



  const fetchServices = useCallback(async () => {
    const response = await fetch('/api/admin/services', { credentials: 'same-origin' });
    if (!response.ok) return;
    const data = (await response.json()) as { services?: ServiceOption[] };
    setServices((data.services ?? []).filter((service) => service.active !== false));
  }, []);

  const fetchWorkingHours = useCallback(async (barberId: string) => {
    if (!barberId) return;
    setWorkingHoursLoading(true);
    const response = await fetch(`/api/admin/barbers/${barberId}/rules`, { credentials: 'same-origin' });
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
    const response = await fetch(`/api/admin/bookings?${params.toString()}`, { credentials: 'same-origin' });
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
      credentials: 'same-origin',
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
      credentials: 'same-origin',
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

  async function login() { const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ secret }) }); setLoggedIn(res.ok); if (!res.ok) setError('Invalid secret'); }



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
      setCancelErrorMessage('Could not cancel booking right now.');
    }
    setCancelLoadingBookingId(null);
}

  async function createTimeBlock(title: string, startAt: Date, endAt: Date) {
    setBlockErrorMessage('');
    setBlockSuccessMessage('');
    const response = await fetch('/api/admin/timeblocks/create', {
      method: 'POST',
      credentials: 'same-origin',
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
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id })
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
      credentials: 'same-origin',
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

  async function updateBarberStatus(barberId: string, isActive: boolean) {
    setBarberSaveMessage('');
    setBarberSaveError('');
    const response = await fetch('/api/admin/barbers', {
      method: 'POST',
      credentials: 'same-origin',
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
  async function saveBarberOrder(orderedIds: string[]) {
    setBarberReordering(true);
    setBarberSaveMessage('');
    setBarberSaveError('');

    try {
      const response = await fetch('/api/admin/barbers/reorder', {
        method: 'POST',
        credentials: 'same-origin',
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



  if (!isActive) return null;
  if (isCheckingSession) return <section className="surface booking-shell"><h1>Admin</h1><p className="muted">Checking session...</p></section>;
  if (!loggedIn) return <section className="surface booking-shell"><h1>Admin</h1><label>Admin secret</label><input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} /><button className="btn btn--primary" onClick={login}>Login</button>{error && <p>{error}</p>}</section>;


  return (
    <section className="surface booking-shell">
      <h1>BOOKINGS</h1>
            <p className="admin-shop-kicker muted">{BOOKINGS_HEADER_KICKER[mode]}</p>
      <div className={`admin-next-block ${isMobileViewport ? 'admin-next-block--mobile-sticky' : ''}`}><div className="admin-next-header"><div className="admin-next-header-copy"><p className="admin-next-primary">Today: {todayBookings.length} bookings</p>{nextBooking && <p className="admin-next-secondary">Next: {nextBooking.barber?.name} — {nextBooking.service?.name} — {formatStartTime(nextBooking.startAt)} ({formatRelativeTime(nextBooking.startAt, nextBooking.endAt)})</p>}</div><div className={`admin-live-status admin-live-status--${connectionStateLabel === 'LIVE' ? 'live' : connectionStateLabel === 'OFFLINE' ? 'offline' : 'connecting'}`} role="status" aria-live="polite"><span className={`admin-live-status-dot ${hasLivePulse ? 'admin-live-status-dot--pulse' : ''}`} aria-hidden="true" /><span className="admin-live-status-label">{connectionStateLabel}</span></div></div><p className="muted admin-next-updated">{freshnessLabel}</p></div>

      {cancelSuccessMessage && <p className="admin-inline-success">{cancelSuccessMessage}</p>}
      {cancelErrorMessage && <p className="admin-inline-error">{cancelErrorMessage}</p>}
      {mode !== 'reports' && (
        <>

          {mode === 'blocks' ? (
            selectedBarber ? (
              <BarberProfile
                barber={selectedBarber}
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
                onToggleActive={() => void updateBarberStatus(selectedBarber.id, !normalizeBarberStatus(selectedBarber))}
                onToggleService={(serviceId, enabled) => void toggleServiceForBarber(serviceId, enabled)}
                onChangeWorkingHour={(dayOfWeek, field, value) => updateWorkingHour(dayOfWeek, { [field]: value })}
                barberSaveError={barberSaveError}
                onSetWorkingHours={setWorkingHours}
                onSaveWorkingHours={saveWorkingHours}
                onCreateBlock={(payload) => void createProfileBlock(payload)}
                onDeleteBlock={(blockId) => void deleteTimeBlock(blockId)}
              />
            ) : (
              <BarbersOverview
                barbers={visibleBarbersForManagement}
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
                getInitials={getInitials}
                onBarberNameChange={setBarberNameDraft}
                onBarberAvatarChange={setBarberAvatarFile}
                                onSelectedServiceIdsChange={setAddBarberSelectedServiceIds}
                onSubmitAddBarber={(event) => void saveBarber(event)}
                onBarbersFilterChange={setBarbersFilter}
                onOpenBarber={setSelectedBarberId}
                onMoveBarber={(index, direction) => void moveBarber(index, direction)}
                                onOpenAddBarberSheet={() => {
                  setBarberSaveError('');
                  setBarberSaveMessage('');
                  setIsAddBarberSheetOpen(true);
                }}
                onCloseAddBarberSheet={() => {
                  setIsAddBarberSheetOpen(false);
                }}

                formatBlockRange={formatBlockRange}
              />
            )
          ) : (
      <>

      {mode === 'dashboard' && (
        <>
          <div className={`admin-view-tabs admin-view-tabs--two ${isMobileDashboard ? 'admin-chip-row' : ''}`} role="tablist" aria-label="Admin views">
            {(['timeline', 'list'] as const).map((view) => {
              const isActiveTab = activeView === view;
              const tabLabel = `${view === 'timeline' ? 'Timeline' : 'List'} · ${selectedDateLabel}`;
              return (
                <div key={view} className={`admin-filter-tab admin-filter-tab--split ${isActiveTab ? 'admin-filter-tab--active' : ''}`}>
                  <button
                    type="button"
                    className="admin-filter-tab-main"
                    role="tab"
                    aria-selected={isActiveTab}
                    onClick={() => setActiveView(view)}
                  >
                    {tabLabel}
                  </button>
                    <label
                    className="admin-filter-tab-calendar"
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                    aria-label={`Choose ${view} date`}
                  >
                                        <input
                      type="date"
                      className="admin-filter-tab-calendar-input"
                      value={selectedDate}
                      onChange={(event) => setSelectedDate(event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label="Select date"
                    />

                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm13 8H4v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8ZM5 6a1 1 0 0 0-1 1v1h16V7a1 1 0 0 0-1-1H5Z" />
                    </svg>
                                      </label>
                </div>
              );
            })}

          </div>
        </>
      )}
      {mode === 'history' && (

        <section className="admin-history-filters">
          <div className="admin-history-row">
            <label>Recent barbers</label>
            <div className="admin-history-barber-controls">
              <div className="admin-history-recent-scroll">
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
                    const initials = getInitials(barber.name);
                    const isActive = historyBarberId === barber.id;

                    return (
                      <button
                        key={barber.id}
                        type="button"
                        className={`admin-history-avatar admin-history-avatar--tone-${hashIndex} ${isActive ? 'is-active' : ''}`}
                        onClick={() => setHistoryBarberId(barber.id)}
                        aria-pressed={isActive}
                        aria-label={`Filter by ${barber.name}`}
                        title={barber.name}
                      >
                        <span>{initials}</span>
                      </button>
                    );
                  })}
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

      <div className="admin-search-row">
        <div className={`admin-search-field ${clientSearchQuery ? 'admin-search-field--has-clear' : ''} ${searchResultsLabel ? 'admin-search-field--has-feedback' : ''}`}>
          <span className="admin-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path d="M10.5 3a7.5 7.5 0 0 1 5.975 12.034l4.245 4.246a1 1 0 1 1-1.414 1.414l-4.246-4.245A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" fill="currentColor" />
            </svg>
          </span>
          <input
            ref={searchInputRef}
            type="search"
            value={clientSearchQuery}
            onChange={(event) => setClientSearchQuery(event.target.value)}
                        onKeyDown={(event) => {
              if (searchDropdownBookings.length === 0) return;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveSearchResultIndex((current) => (current + 1) % searchDropdownBookings.length);
                return;
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveSearchResultIndex((current) => {
                  if (current <= 0) return searchDropdownBookings.length - 1;
                  return current - 1;
                });
                return;
              }
              if (event.key === 'Enter' && activeSearchResultIndex >= 0) {
                event.preventDefault();
                const selectedBooking = searchDropdownBookings[activeSearchResultIndex];
                if (selectedBooking) jumpToTimelineBooking(selectedBooking);
              }
            }}

            placeholder="Search client or email…"
            aria-label="Search client or email"
                        aria-controls="admin-booking-search-results"
            aria-expanded={searchDropdownBookings.length > 0}
            aria-activedescendant={activeSearchResultIndex >= 0 ? `admin-search-result-${searchDropdownBookings[activeSearchResultIndex]?.id}` : undefined}

          />
          {searchResultsLabel ? <span className="admin-search-feedback" aria-live="polite">{searchResultsLabel}</span> : null}
          {clientSearchQuery ? (
            <button
              type="button"
              className="admin-search-clear"
              onClick={() => {
                setClientSearchQuery('');
                setDebouncedSearchQuery('');
                                setActiveSearchResultIndex(-1);
                searchInputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          ) : null}
                    {searchDropdownBookings.length > 0 ? (
            <div className="admin-search-results" id="admin-booking-search-results" role="listbox" ref={searchResultsRef}>
              {searchDropdownBookings.map((booking, index) => (
                <button
                  type="button"
                  key={booking.id}
                  id={`admin-search-result-${booking.id}`}
                  data-search-result-index={index}
                  role="option"
                  aria-selected={activeSearchResultIndex === index}
                  className={`admin-search-result-item ${activeSearchResultIndex === index ? 'is-active' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => jumpToTimelineBooking(booking)}
                >
                  <span className="admin-search-result-main">{highlightMatch(booking.fullName)}</span>
                  <span className="admin-search-result-meta">{highlightMatch(booking.email)} · {booking.barber?.name} · {formatStartTime(booking.startAt)}</span>
                </button>
              ))}
            </div>
          ) : null}

        </div>
      </div>


      {mode !== 'history' && activeView === 'timeline' ? (
        <AdminErrorBoundary>
          <TodayTimeline
            barbers={activeBarbers}
            bookings={visibleBookings}
            timeBlocks={timeBlocks}
            selectedDate={selectedDate}
            isSearchActive={Boolean(normalizedClientSearchQuery)}
            scrollContainerRef={timelineScrollRef}
            onBookingClick={openTimelineBooking}
          />
        </AdminErrorBoundary>
      ) : isMobileDashboard && mode !== 'history' ? (

        <div className="admin-booking-cards" aria-live="polite">
          {visibleBookings.map((booking) => (
            <article className={`admin-booking-card ${updatedBookingIds.includes(booking.id) ? 'admin-booking-card--updated' : ''}`} key={booking.id}>
              <div className="admin-booking-card-top">
                <p><strong>{formatStartTime(booking.startAt)}</strong> · {booking.service?.name}</p>
                <span className="admin-booking-card-status">{booking.status === 'CONFIRMED' && booking.rescheduledAt ? 'CONFIRMED · RESCHEDULED' : booking.status}</span>
              </div>
              <p className="admin-booking-card-barber">Barber: {booking.barber?.name}</p>
              <button type="button" className="admin-link-button" onClick={() => void openClientProfile(booking.clientId)}>{highlightMatch(booking.fullName)}</button>
              <p className="admin-booking-card-email">{highlightMatch(booking.email)}</p>

              {canBeCancelledByShop(booking) ? <button type="button" className="btn btn--secondary" onClick={() => void cancelBookingByShop(booking)} disabled={cancelLoadingBookingId === booking.id}>{cancelLoadingBookingId === booking.id ? 'Cancelling...' : 'Cancel'}</button> : null}
            </article>
          ))}
        </div>

      ) : (
        <div className="listTableWrap">
          <table className="admin-table admin-bookings-table">
            <thead><tr><th>Client</th><th className={mode === 'history' ? '' : 'hidden md:table-cell'}>Email</th><th>Service</th><th>Barber</th><th><span className="admin-status-heading-desktop">Status</span><span className="admin-status-heading-mobile">St.</span></th><th>Start</th>{mode !== 'history' ? <th>Actions</th> : null}</tr></thead>
            <tbody>
              {visibleBookings.map((booking) => {
                const bookingStatusLabel = getBookingStatusLabel(booking);
                const statusIconMeta = getStatusIconMeta(booking, bookingStatusLabel);
                                const StatusIcon = statusIconMeta.Icon;
                const fullEmail = booking.email ?? '';
                const short = shortEmail(fullEmail);



                return (
                  <tr className={updatedBookingIds.includes(booking.id) ? 'admin-row--updated' : ''} key={booking.id}>
                    <td><button type="button" className="admin-link-button" onClick={() => void openClientProfile(booking.clientId)}>{highlightMatch(booking.fullName)}</button></td>
                    <td className={`admin-table-col-email ${mode === 'history' ? '' : 'hidden md:table-cell'}`}><button type="button" className="admin-link-button" onClick={() => void openClientProfile(booking.clientId)}><span className="admin-email-mobile" title={fullEmail} aria-label={fullEmail}>{short}</span><span className="admin-email-desktop">{fullEmail}</span></button></td>

                    <td className="admin-table-col-service"><span className="admin-service-desktop">{booking.service?.name}</span><span className="admin-service-mobile">{mode === 'history' ? getMobileHistoryServiceLabel(booking.service?.name) : booking.service?.name}</span></td><td>{booking.barber?.name}</td><td className={mode === 'history' ? 'admin-table-col-status admin-table-col-status--history' : 'admin-table-col-status'}>{mode === 'history' ? <span className="admin-status-icon-wrap"><StatusIcon className={`admin-status-icon ${statusIconMeta.className}`} aria-label={statusIconMeta.label} title={statusIconMeta.label} /></span> : <><span className="admin-status-label-desktop">{bookingStatusLabel}</span><span className="admin-status-icon-wrap admin-status-icon-wrap--mobile"><StatusIcon className={`admin-status-icon ${statusIconMeta.className}`} aria-label={statusIconMeta.label} title={statusIconMeta.label} /></span></>}</td><td className="admin-table-col-start"><span className="admin-start-desktop">{formatStartDateTime(booking.startAt)}</span><span className="admin-start-mobile">{formatStartTimeMobile(booking.startAt)}</span></td>
                    {mode !== 'history' ? <td className="admin-table-col-actions">{canBeCancelledByShop(booking) ? <button type="button" className="btn btn--secondary admin-cancel-btn" onClick={() => void cancelBookingByShop(booking)} disabled={cancelLoadingBookingId === booking.id}>{cancelLoadingBookingId === booking.id ? 'Cancelling...' : 'Cancel'}</button> : null}</td> : null}

                  </tr>
                );
              })}

            </tbody>
          </table>
        </div>
      )}
      {mode === 'history' && historyHasMore && <button type="button" className="btn btn--secondary" onClick={() => void loadMoreHistory()} disabled={historyLoadingMore}>{historyLoadingMore ? 'Loading...' : 'Load more'}</button>}
    </>
  )}
</>
      )}


      {mode === 'reports' && (
        <section className="admin-reports" aria-live="polite">
          <div className="admin-reports-head">
            <h2>Reports</h2>
            <div className="admin-reports-actions">
              <button type="button" className="btn btn--ghost" onClick={exportMainCsv}>Export CSV</button>
              <button type="button" className="btn btn--ghost" onClick={() => void copySummary()}>Copy summary</button>
            </div>
          </div>

          <div className="admin-reports-confidence-row">
            <p className="admin-kpi-note">Timezone: {ADMIN_TIMEZONE}</p>
            <span className={`admin-confidence-badge ${confidence.className}`} title="Confidence is based on booking sample size in the selected range.">
              {confidence.label}
            </span>
          </div>

          <div className="admin-reports-insights-card">
            <p className="admin-kpi-label">INSIGHTS</p>
            <p className="admin-reports-insight">{insights[0]}</p>
            {insightsExpanded ? insights.slice(1).map((line) => <p className="admin-reports-insight" key={line}>{line}</p>) : null}
            {insights.length > 1 ? <button type="button" className="btn btn--ghost" onClick={() => setInsightsExpanded((prev) => !prev)}>{insightsExpanded ? 'Show less' : 'Show more'}</button> : null}
          </div>


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
            <div className="admin-history-barber-controls"><div className="admin-history-recent-scroll"><div className="admin-history-recent-barbers" role="group" aria-label="Recent barbers">
              <button type="button" className={`admin-history-avatar admin-history-avatar--all ${reportsBarberId === null ? 'is-active' : ''}`} onClick={() => setReportsBarberId(null)} aria-pressed={reportsBarberId === null}>ALL</button>
              {reportRecentBarbers.map((barber) => {
                const hashIndex = hashValue(`${barber.id}:${barber.name}`) % 6;
                const initials = getInitials(barber.name);
                const isActive = reportsBarberId === barber.id;
                return <button key={barber.id} type="button" className={`admin-history-avatar admin-history-avatar--tone-${hashIndex} ${isActive ? 'is-active' : ''}`} onClick={() => setReportsBarberId(barber.id)} aria-pressed={isActive} aria-label={`Filter by ${barber.name}`} title={barber.name}><span>{initials}</span></button>;
              })}
            </div></div></div>

          </div>


          {reportsError && <p className="admin-inline-error">{reportsError}</p>}
          <div className="admin-reports-grid">
            <article className="admin-kpi-card admin-kpi-card--hero admin-kpi-clickable" onClick={() => setOpenDrilldown('revenue')}>
              <div className="admin-kpi-row"><p className="admin-kpi-label">Revenue</p><div className="admin-chart-switcher">{(['revenue', 'bookings', 'cancelRate'] as const).map((metric) => <button type="button" key={metric} className={`admin-chart-switch ${chartMetric === metric ? 'is-active' : ''}`} onClick={(event) => { event.stopPropagation(); setChartMetric(metric); }}>{metric === 'cancelRate' ? 'Cancel rate' : metric.charAt(0).toUpperCase() + metric.slice(1)}</button>)}</div></div>
              <p className="admin-kpi-value admin-kpi-value--hero">{chartMetric === 'revenue' ? formatCurrencyGbp(reports?.revenue ?? 0) : chartMetric === 'bookings' ? `${reports?.bookingsCount ?? 0}` : `${(reports?.cancelledRate ?? 0).toFixed(1)}%`}</p>
              <p className={`admin-kpi-trend ${revenueDelta.className}`}>{revenueDelta.direction === 'up' ? '↑ ' : revenueDelta.direction === 'down' ? '↓ ' : ''}{revenueDelta.text}{isSmallSample ? <span className="admin-kpi-sample-inline">Small sample</span> : null}</p>

              {reports?.usedDemoPricing ? <p className="admin-kpi-note">Estimated (demo prices)</p> : null}
              <RevenueSparkline series={chartSeries} emptyLabel="No data for this range" tone={chartMetric === 'cancelRate' ? 'warning' : 'revenue'} />
            </article>

            <article className="admin-kpi-card admin-kpi-card--bookings admin-kpi-clickable" onClick={() => setOpenDrilldown('bookings')}><p className="admin-kpi-label">Bookings</p><p className="admin-kpi-value">{reports?.bookingsCount ?? 0}</p><p className={`admin-kpi-trend ${bookingsDelta.className}`}>{bookingsDelta.direction === 'up' ? '↑ ' : bookingsDelta.direction === 'down' ? '↓ ' : ''}{bookingsDelta.text}{isSmallSample ? <span className="admin-kpi-sample-inline">Small sample</span> : null}</p></article>

            <article className="admin-kpi-card admin-kpi-card--cancelled admin-kpi-clickable" onClick={() => setOpenDrilldown('cancelled')}>
              <p className="admin-kpi-label">Cancelled rate</p><p className="admin-kpi-value">{`${(reports?.cancelledRate ?? 0).toFixed(1)}%`}</p><p className={`admin-kpi-trend ${cancelledDelta.className}`}>{cancelledDelta.direction === 'up' ? '↑ ' : cancelledDelta.direction === 'down' ? '↓ ' : ''}{cancelledDelta.text}</p><p className="admin-kpi-note">{reportsCancelledCount} of {reports?.bookingsCount ?? 0} bookings</p>
              <div className="admin-reports-breakdown" role="list" aria-label="Completion breakdown"><div className="admin-reports-breakdown-bar" aria-hidden="true"><span style={{ width: `${reportsBreakdownTotal ? ((reports?.breakdown.completed ?? 0) / reportsBreakdownTotal) * 100 : 0}%` }} className="is-completed" /><span style={{ width: `${reportsBreakdownTotal ? ((reports?.breakdown.cancelledByClient ?? 0) / reportsBreakdownTotal) * 100 : 0}%` }} className="is-cancel-client" /><span style={{ width: `${reportsBreakdownTotal ? ((reports?.breakdown.cancelledByShop ?? 0) / reportsBreakdownTotal) * 100 : 0}%` }} className="is-cancel-shop" /><span style={{ width: `${reportsBreakdownTotal ? ((reports?.breakdown.noShowExpired ?? 0) / reportsBreakdownTotal) * 100 : 0}%` }} className="is-no-show" /></div></div>

            </article>
            <article className="admin-kpi-card admin-kpi-card--utilization"><p className="admin-kpi-label">Utilization</p><p className="admin-kpi-value">{reports?.utilizationPct == null ? '—' : `${reports.utilizationPct.toFixed(1)}%`}</p><p className={`admin-kpi-trend ${utilizationDelta.className}`}>{utilizationDelta.direction === 'up' ? '↑ ' : utilizationDelta.direction === 'down' ? '↓ ' : ''}{utilizationDelta.text}</p><p className="admin-kpi-note">{reportsBookedVsAvailableLabel}</p></article>
            <article className="admin-kpi-card"><p className="admin-kpi-label">Avg booking value</p><p className="admin-kpi-value">{formatCurrencyGbp(reports?.avgBookingValue ?? 0)}</p><p className={`admin-kpi-trend ${avgBookingValueDelta.className}`}>{avgBookingValueDelta.direction === 'up' ? '↑ ' : avgBookingValueDelta.direction === 'down' ? '↓ ' : ''}{avgBookingValueDelta.text}</p></article>
            <article className="admin-kpi-card"><p className="admin-kpi-label">No-show/expired rate</p><p className="admin-kpi-value">{`${(reports?.noShowExpiredRate ?? 0).toFixed(1)}%`}</p><p className={`admin-kpi-trend ${noShowExpiredDelta.className}`}>{noShowExpiredDelta.direction === 'up' ? '↑ ' : noShowExpiredDelta.direction === 'down' ? '↓ ' : ''}{noShowExpiredDelta.text}</p></article>



            <article className="admin-kpi-card"><p className="admin-kpi-label">Peak day</p><p className="admin-kpi-value">{reports?.peakDay ?? '—'}</p></article>
            <article className="admin-kpi-card"><p className="admin-kpi-label">Peak hour</p><p className="admin-kpi-value">{reports?.peakHour ?? '—'}</p></article>
            <article className="admin-kpi-card admin-kpi-clickable" onClick={() => setOpenDrilldown('service')}><p className="admin-kpi-label">Most popular service</p><p className="admin-kpi-value">{reports?.mostPopularService ? `${reports.mostPopularService.name} (${reports.mostPopularService.count})` : 'No confirmed bookings'}</p></article>
            <article className="admin-kpi-card"><p className="admin-kpi-label">{reportsBarberId ? 'Selected barber' : 'Busiest barber'}</p><p className="admin-kpi-value">{reportsBarberId ? reportsSelectedBarberName : reports?.busiestBarber ? `${reports.busiestBarber.name} (${reports.busiestBarber.count})` : 'No confirmed bookings'}</p></article>
          </div>
          
          {!reportsBarberId ? (
            <section className="admin-reports-compare">
              <div className="admin-kpi-row"><h3>Compare (ALL vs Barber)</h3><div className="admin-chart-switcher">{(['bookings', 'revenue', 'cancelRate', 'utilization'] as const).map((sort) => <button type="button" key={sort} className={`admin-chart-switch ${rankingSort === sort ? 'is-active' : ''}`} onClick={() => setRankingSort(sort)}>{sort === 'cancelRate' ? 'Cancel rate' : sort.charAt(0).toUpperCase() + sort.slice(1)}</button>)}</div></div>
              <div className="admin-compare-list">{rankingRows.map((row) => <div className="admin-compare-row" key={row.barberId}><p><strong>{row.barberName}</strong></p><p>{row.bookings} bookings</p><p>{formatCurrencyGbp(row.revenue)}</p><p>{row.cancelledRate.toFixed(1)}%</p><button type="button" className="btn btn--ghost" onClick={() => setExpandedRankingMobileId((prev) => prev === row.barberId ? null : row.barberId)}>More</button>{expandedRankingMobileId === row.barberId ? <p className="admin-kpi-note">Utilization: {row.utilizationPct == null ? '—' : `${row.utilizationPct.toFixed(1)}%`}</p> : null}</div>)}</div>
            </section>
          ) : (
            <section className="admin-reports-compare"><h3>Compare (this barber)</h3><p>Rank this period: #{reports?.selectedBarberRank?.rank ?? '—'} of {reports?.selectedBarberRank?.total ?? '—'}</p><p>Share of bookings: {(reports?.selectedBarberRank?.bookingSharePct ?? 0).toFixed(1)}%</p><p>Share of revenue: {(reports?.selectedBarberRank?.revenueSharePct ?? 0).toFixed(1)}%</p></section>
          )}

          {openDrilldown ? <div className="admin-client-modal-backdrop" role="presentation" onClick={() => setOpenDrilldown(null)}><div className="admin-reports-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><div className="admin-client-modal-head"><h2>Drill-down</h2><button type="button" className="btn btn--ghost" onClick={() => setOpenDrilldown(null)}>Close</button></div><input value={drilldownSearch} onChange={(event) => setDrilldownSearch(event.target.value)} placeholder="Search client/email/service" /><button type="button" className="btn btn--secondary" onClick={() => exportCsvRows(filteredDrilldownRows, `reports-drilldown-${openDrilldown}.csv`)}>Export CSV (this view)</button><div className="admin-reports-drawer-list">{filteredDrilldownRows.map((row) => <article key={row.id} className="admin-kpi-card"><p>{formatInTimeZone(new Date(row.startAt), ADMIN_TIMEZONE, 'dd MMM HH:mm')} · {row.barberName}</p><p>{row.serviceName} · {row.status}</p><p>{row.clientName ?? 'Unknown'} · {row.clientEmail ?? 'No email'}</p>{row.computedValueGbp != null ? <p>{formatCurrencyGbp(row.computedValueGbp)}</p> : null}</article>)}</div></div></div> : null}

        </section>
      )}

      {showHolidayModal && (
        <div className="admin-client-modal-backdrop" role="presentation" onClick={() => setShowHolidayModal(false)}>
          <form className="admin-client-modal" onSubmit={(event) => void submitHoliday(event)} onClick={(event) => event.stopPropagation()}>
            <div className="admin-client-modal-head"><h2>Holiday block</h2><button type="button" className="btn btn--ghost" onClick={() => setShowHolidayModal(false)}>Close</button></div>
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
        <div className="admin-client-modal-backdrop" role="presentation" onClick={() => setSelectedTimelineBooking(null)}>
          <div className="admin-client-modal" role="dialog" aria-modal="true" aria-label="Booking quick actions" onClick={(event) => event.stopPropagation()}>
            <div className="admin-client-modal-head"><h2>Booking quick actions</h2><button type="button" className="btn btn--ghost" onClick={() => setSelectedTimelineBooking(null)}>Close</button></div>
            <p><strong>{selectedTimelineBooking.fullName}</strong><br />{selectedTimelineBooking.email}</p>
            <p>{selectedTimelineBooking.service?.name} · {selectedTimelineBooking.barber?.name}</p>
            <p>{new Date(selectedTimelineBooking.startAt).toLocaleString('en-GB', { timeZone: ADMIN_TIMEZONE })} → {new Date(selectedTimelineBooking.endAt).toLocaleTimeString('en-GB', { timeZone: ADMIN_TIMEZONE, hour: '2-digit', minute: '2-digit' })}</p>
            <div className="admin-quick-actions">
              <button type="button" className="btn btn--secondary" onClick={() => void cancelBookingByShop(selectedTimelineBooking)} disabled={!canBeCancelledByShop(selectedTimelineBooking) || cancelLoadingBookingId === selectedTimelineBooking.id}>{cancelLoadingBookingId === selectedTimelineBooking.id ? 'Cancelling...' : 'Cancel'}</button>
              <button type="button" className="btn btn--ghost" disabled title="Coming next">Reschedule</button>
              <button type="button" className="btn btn--ghost" onClick={() => setTimelineNotesMessage('')}>Notes</button>
            </div>
            <label htmlFor="booking-notes">Notes</label>
            <textarea id="booking-notes" rows={4} value={timelineNotesDraft} onChange={(event) => setTimelineNotesDraft(event.target.value)} />
            {timelineNotesMessage ? <p className={timelineNotesMessage === 'Notes saved.' ? 'admin-inline-success' : 'admin-inline-error'}>{timelineNotesMessage}</p> : null}
            <button type="button" className="btn btn--primary" onClick={() => void saveTimelineBookingNotes()} disabled={timelineNotesSaving}>{timelineNotesSaving ? 'Saving...' : 'Save notes'}</button>
          </div>
        </div>
      )}



      {selectedClientId && (
        <div className="admin-client-modal-backdrop" role="presentation" onClick={() => setSelectedClientId(null)}>
          <div className="admin-client-modal" role="dialog" aria-modal="true" aria-label="Client profile" onClick={(event) => event.stopPropagation()}>
            <div className="admin-client-modal-head"><h2>Client profile</h2><button type="button" className="btn btn--ghost" onClick={() => setSelectedClientId(null)}>Close</button></div>
            {isClientLoading && <p className="muted">Loading...</p>}
            {clientError && <p className="admin-inline-error">{clientError}</p>}
            {clientProfile && (<><p><strong>{clientProfile.client.fullName || 'Unnamed client'}</strong><br />{clientProfile.client.email}<br />{clientProfile.client.phone || 'No phone'}</p><div className="admin-client-stats"><p>Total visits: {clientProfile.stats.totalBookings}</p><p>Last visit: {clientProfile.stats.lastBookingAt ? new Date(clientProfile.stats.lastBookingAt).toLocaleString('en-GB', { timeZone: ADMIN_TIMEZONE }) : '—'}</p><p>Cancelled: {clientProfile.stats.cancelledCount}</p></div><h3>Recent bookings</h3><ul className="admin-client-bookings">{clientProfile.recentBookings.map((item) => <li key={item.id}>{new Date(item.startAt).toLocaleString('en-GB', { timeZone: ADMIN_TIMEZONE })} · {item.status} · {item.service?.name} · {item.barber?.name}</li>)}</ul><label htmlFor="client-notes">Notes</label><textarea id="client-notes" value={notesDraft} onChange={(event) => setNotesDraft(event.target.value)} rows={5} /><button type="button" className="btn btn--primary" onClick={() => void saveNotes()} disabled={notesSaving}>{notesSaving ? 'Saving...' : 'Save notes'}</button></>)}          </div>

        </div>

      )}
    </section>
  );
}
