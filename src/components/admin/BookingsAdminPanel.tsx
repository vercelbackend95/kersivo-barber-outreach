import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import TodayTimeline from './TodayTimeline';

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

type Barber = {
  id: string;
  name: string;
};

type TimeBlock = {
  id: string;
  title: string;
  barberId?: string | null;
  startAt: string;
  endAt: string;
  barber?: { id: string; name: string } | null;
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
type HistoryPreset = 'last7' | 'last30' | 'overall' | 'custom';


type ReportsPayload = {
  range: {
    from: string;
    to: string;
    tz: string;
  };
  bookingsThisWeek: number;
  cancelledRate: number;
  mostPopularService: { name: string; count: number } | null;
  busiestBarber: { name: string; count: number } | null;
};

const ADMIN_TIMEZONE = 'Europe/London';
const SLOT_STEP_MINUTES = 15;
const POLL_INTERVAL_MS = 15000;
const LAST_UPDATED_REFRESH_MS = 1000;
const UPDATED_ROW_HIGHLIGHT_MS = 2000;
const MOBILE_BREAKPOINT_PX = 768;

function getTodayLondonDate() {
  return formatInTimeZone(new Date(), ADMIN_TIMEZONE, 'yyyy-MM-dd');
}
function formatTimelineDateLabel(date: string) {
  const dateAtLondonMidnight = fromZonedTime(`${date}T00:00:00.000`, ADMIN_TIMEZONE);
  return formatInTimeZone(dateAtLondonMidnight, ADMIN_TIMEZONE, 'EEE dd MMM');
}


function shiftLondonDate(date: string, days: number) {
  const atMidnight = fromZonedTime(`${date}T00:00:00.000`, ADMIN_TIMEZONE);
  return formatInTimeZone(new Date(atMidnight.getTime() + days * 24 * 60 * 60 * 1000), ADMIN_TIMEZONE, 'yyyy-MM-dd');
}

function getHistoryPresetDates(preset: HistoryPreset) {
  const today = getTodayLondonDate();
  if (preset === 'overall') return { from: '', to: '' };
  if (preset === 'last30') return { from: shiftLondonDate(today, -30), to: today };
  return { from: shiftLondonDate(today, -7), to: today };
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

function getUpcomingBookings(bookings: Booking[]) {
  const nowMs = Date.now();
  return bookings.filter((b) => b.status === 'CONFIRMED').filter((b) => new Date(b.endAt).getTime() > nowMs).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}
function isTodayInLondon(value: string, todayLondonDate: string) {
  return formatInTimeZone(new Date(value), ADMIN_TIMEZONE, 'yyyy-MM-dd') === todayLondonDate;
}


function formatLastUpdated(lastUpdatedAt: number | null, nowMs: number) {
  if (!lastUpdatedAt) return 'never';
  const diffSec = Math.floor((nowMs - lastUpdatedAt) / 1000);
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
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [error, setError] = useState('');
  const [updatedBookingIds, setUpdatedBookingIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<AdminBookingView>('timeline');
  const [selectedDate, setSelectedDate] = useState(() => getTodayLondonDate());
  const [historyBarberId, setHistoryBarberId] = useState<string>('all');
  const [historyPreset, setHistoryPreset] = useState<HistoryPreset>('last7');
  const [historyFrom, setHistoryFrom] = useState(() => getHistoryPresetDates('last7').from);
  const [historyTo, setHistoryTo] = useState(() => getHistoryPresetDates('last7').to);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [reports, setReports] = useState<ReportsPayload | null>(null);
  const [reportsError, setReportsError] = useState('');
  const [cancelSuccessMessage, setCancelSuccessMessage] = useState('');
  const [cancelErrorMessage, setCancelErrorMessage] = useState('');
  const [cancelLoadingBookingId, setCancelLoadingBookingId] = useState<string | null>(null);
  const [blockScopeBarberId, setBlockScopeBarberId] = useState<string>('all');
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


  const selectedDateInputRef = useRef<HTMLInputElement | null>(null);

  const inFlightRef = useRef(false);
    const timeBlocksInFlightRef = useRef(false);
  const pollingStoppedRef = useRef(false);
    const bookingsRequestIdRef = useRef(0);
  const timeBlocksRequestIdRef = useRef(0);

  const previousSignaturesRef = useRef<Map<string, string>>(new Map());
  const updatedRowsTimeoutRef = useRef<number | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollRestoreRef = useRef<{ left: number; top: number } | null>(null);
  const timelineScrollRafRef = useRef<number | null>(null);


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
    const response = await fetch('/api/admin/reports?range=week', { credentials: 'same-origin' });

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
  }, [loggedIn]);



  const fetchBookings = useCallback(async (appendHistory = false) => {
    if (!loggedIn || !isActive || pollingStoppedRef.current || inFlightRef.current) return;
    if (mode === 'history' && !appendHistory) setHistoryCursor(null);

    inFlightRef.current = true;
        const requestId = ++bookingsRequestIdRef.current;
    setIsRefreshing(true);

    try {
      const endpoint = (() => {
          if (mode === 'history') {
          const params = new URLSearchParams({ view: 'history', barberId: historyBarberId, limit: '50' });
          if (historyPreset !== 'custom') params.set('preset', historyPreset);
          if (historyFrom) params.set('from', historyFrom);
          if (historyTo) params.set('to', historyTo);
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
      setLastUpdatedAt(Date.now());

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

      setIsRefreshing(false);
      setHistoryLoadingMore(false);
    }
  }, [activeView, bookings, captureTimelineScroll, historyBarberId, historyCursor, historyFrom, historyPreset, historyTo, isActive, loggedIn, mode, restoreTimelineScroll, selectedDate]);
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
  }, [fetchBookings, historyBarberId, historyFrom, historyPreset, historyTo, isActive, loggedIn, mode]);
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


  const normalizedClientSearchQuery = useMemo(() => normalizeSearchValue(clientSearchQuery), [clientSearchQuery]);


  const todayLondonDate = useMemo(() => getTodayLondonDate(), [nowMs]);
  const todayBookings = useMemo(() => bookings.filter((booking) => isTodayInLondon(booking.startAt, todayLondonDate)), [bookings, todayLondonDate]);
  const upcomingBookings = useMemo(() => getUpcomingBookings(todayBookings), [todayBookings]);

  const nextBooking = upcomingBookings[0] ?? null;
  const currentBookingView = mode === 'history' ? 'history' : activeView;
  const filteredBookings = useMemo(() => bookings, [bookings]);


  const visibleBookings = useMemo(() => {
    if (!normalizedClientSearchQuery) return filteredBookings;
    return filteredBookings.map((booking, index) => ({ booking, score: getBookingSearchScore(booking, normalizedClientSearchQuery), index })).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score).map((entry) => entry.booking);

  }, [filteredBookings, normalizedClientSearchQuery]);
  const isMobileDashboard = mode === 'dashboard' && isMobileViewport;
    const isTimelineView = mode === 'dashboard' && activeView === 'timeline';
  const selectedDateLabel = useMemo(() => formatTimelineDateLabel(selectedDate), [selectedDate]);

  function openSelectedDatePicker() {
    const input = selectedDateInputRef.current;

    if (!input) return;
    if ('showPicker' in HTMLInputElement.prototype && typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.click();
  }


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


  async function login() { const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ secret }) }); setLoggedIn(res.ok); if (!res.ok) setError('Invalid secret'); }
  async function logout() { await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }); setBookings([]); setLoggedIn(false); }


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
      body: JSON.stringify({ title, startAt: startAt.toISOString(), endAt: endAt.toISOString(), barberId: blockScopeBarberId === 'all' ? null : blockScopeBarberId })
    });
    if (!response.ok) {
      setBlockErrorMessage('Could not create time block.');
      return;
    }
    setBlockSuccessMessage('Time block created.');
    await Promise.all([fetchBookings(), fetchTimeBlocks()]);
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

  if (!isActive) return null;
  if (isCheckingSession) return <section className="surface booking-shell"><h1>Admin</h1><p className="muted">Checking session...</p></section>;
  if (!loggedIn) return <section className="surface booking-shell"><h1>Admin</h1><label>Admin secret</label><input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} /><button className="btn btn--primary" onClick={login}>Login</button>{error && <p>{error}</p>}</section>;


  return (
    <section className="surface booking-shell">
      <h1>Admin Dashboard</h1>
      <div className={`admin-next-block ${isMobileDashboard ? 'admin-next-block--mobile-sticky' : ''}`}><p className="admin-next-primary">{currentBookingView === 'history' ? `History: ${bookings.length} bookings` : `Today: ${todayBookings.length} bookings`}</p>{nextBooking && mode !== 'history' && <p className="admin-next-secondary">Next: {nextBooking.barber?.name} — {nextBooking.service?.name} — {formatStartTime(nextBooking.startAt)} ({formatRelativeTime(nextBooking.startAt, nextBooking.endAt)})</p>}</div>
      <div className="admin-refresh-row"><p className="muted admin-last-updated">Last updated: {formatLastUpdated(lastUpdatedAt, nowMs)}</p>{isMobileDashboard ? null : <div className="admin-refresh-controls"><button type="button" className="btn btn--ghost" onClick={() => { void fetchBookings(); void fetchTimeBlocks(); void fetchReports(); }} disabled={isRefreshing}>Refresh</button><button type="button" className="btn btn--secondary" onClick={() => void logout()}>Logout</button></div>}</div>

      {cancelSuccessMessage && <p className="admin-inline-success">{cancelSuccessMessage}</p>}
      {cancelErrorMessage && <p className="admin-inline-error">{cancelErrorMessage}</p>}
      {mode !== 'reports' && (
        <>

          {mode === 'blocks' ? (
            <section className="admin-quick-blocks">
              <div className="admin-quick-blocks-head">
                <h2>Quick blocks</h2>
                {onBackToDashboard ? <button type="button" className="btn btn--ghost" onClick={onBackToDashboard}>Back to Dashboard</button> : null}
              </div>
              <p className="muted">These blocks affect booking availability for today.</p>
              <div className="admin-quick-scope"><label htmlFor="block-scope">Applies to</label><select id="block-scope" value={blockScopeBarberId} onChange={(event) => setBlockScopeBarberId(event.target.value)}><option value="all">All barbers</option>{barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.name}</option>)}</select></div>
              <div className="admin-quick-actions"><button type="button" className="btn btn--secondary" onClick={() => void handleQuickBlock30()}>Block 30 min</button><button type="button" className="btn btn--secondary" onClick={() => void handleQuickLunch()}>Lunch</button><button type="button" className="btn btn--secondary" onClick={() => setShowHolidayModal(true)}>Holiday</button></div>
              {blockSuccessMessage && <p className="admin-inline-success">{blockSuccessMessage}</p>}
              {blockErrorMessage && <p className="admin-inline-error">{blockErrorMessage}</p>}

              <h3>Today's blocks</h3>
              <ul className="admin-blocks-list">{timeBlocks.length === 0 ? <li className="muted">No blocks yet.</li> : timeBlocks.map((block) => <li key={block.id}><div><strong>{block.title}</strong><p className="muted">{block.barber?.name ?? 'All barbers'} · {formatBlockRange(block.startAt, block.endAt)}</p></div><button type="button" className="btn btn--ghost" onClick={() => void deleteTimeBlock(block.id)}>Remove</button></li>)}</ul>
            </section>
          ) : (
      <>

      {mode === 'dashboard' && (
        <>
          <div className={`admin-view-tabs admin-view-tabs--two ${isMobileDashboard ? 'admin-chip-row' : ''}`} role="tablist" aria-label="Admin views">
            <button type="button" className={`admin-filter-tab ${activeView === 'timeline' ? 'admin-filter-tab--active' : ''}`} onClick={() => setActiveView('timeline')}>Timeline</button>
            <button type="button" className={`admin-filter-tab ${activeView === 'list' ? 'admin-filter-tab--active' : ''}`} onClick={() => setActiveView('list')}>List</button>
          </div>
          {mode === 'dashboard' ? (
            <div className="admin-timeline-date-row">
              <p className="admin-timeline-date-label muted">{activeView === 'timeline' ? 'Timeline' : 'List'} · {selectedDateLabel}</p>
              <button
                type="button"
                className="admin-timeline-calendar-btn"
                onClick={openSelectedDatePicker}
                aria-label={`Choose ${activeView} date`}
                title={`Choose ${activeView} date`}

              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm13 8H4v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8ZM5 6a1 1 0 0 0-1 1v1h16V7a1 1 0 0 0-1-1H5Z" />
                </svg>
              </button>
              <input
                ref={selectedDateInputRef}
                type="date"
                className="admin-timeline-date-input"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                aria-label={`${activeView === 'timeline' ? 'Timeline' : 'List'} date`}

              />
            </div>
          ) : null}
        </>
      )}
      {mode === 'history' && (

        <section className="admin-history-filters">
          <div className="admin-history-row">
            <label htmlFor="history-barber">Barber</label>
            <select id="history-barber" value={historyBarberId} onChange={(event) => setHistoryBarberId(event.target.value)}>
              <option value="all">All barbers</option>
              {barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.name}</option>)}
            </select>
          </div>
          <div className="admin-filter-tabs admin-filter-tabs--history" role="tablist" aria-label="History range presets">
            <button type="button" className={`admin-filter-tab ${historyPreset === 'last7' ? 'admin-filter-tab--active' : ''}`} onClick={() => { const next = getHistoryPresetDates('last7'); setHistoryPreset('last7'); setHistoryFrom(next.from); setHistoryTo(next.to); }}>Last 7 days</button>
            <button type="button" className={`admin-filter-tab ${historyPreset === 'last30' ? 'admin-filter-tab--active' : ''}`} onClick={() => { const next = getHistoryPresetDates('last30'); setHistoryPreset('last30'); setHistoryFrom(next.from); setHistoryTo(next.to); }}>Last 30 days</button>
            <button type="button" className={`admin-filter-tab ${historyPreset === 'overall' ? 'admin-filter-tab--active' : ''}`} onClick={() => { const next = getHistoryPresetDates('overall'); setHistoryPreset('overall'); setHistoryFrom(next.from); setHistoryTo(next.to); }}>Overall</button>
            <button type="button" className={`admin-filter-tab ${historyPreset === 'custom' ? 'admin-filter-tab--active' : ''}`} onClick={() => setHistoryPreset('custom')}>Custom</button>
          </div>
          <div className="admin-history-date-grid">
            <div>
              <label htmlFor="history-from">From</label>
              <input id="history-from" type="date" value={historyFrom} onChange={(event) => { setHistoryFrom(event.target.value); setHistoryPreset('custom'); }} />
            </div>
            <div>
              <label htmlFor="history-to">To</label>
              <input id="history-to" type="date" value={historyTo} onChange={(event) => { setHistoryTo(event.target.value); setHistoryPreset('custom'); }} />
            </div>
            <button type="button" className="btn btn--secondary" onClick={() => void fetchBookings()}>Apply</button>
          </div>
        </section>
      )}

      <div className={`admin-search-row ${isMobileDashboard ? 'admin-search-row--sticky' : ''}`}><input type="search" value={clientSearchQuery} onChange={(e) => setClientSearchQuery(e.target.value)} placeholder="Search by client name or email..." aria-label="Search by client name or email" /></div>

      {mode !== 'history' && activeView === 'timeline' ? (
                <>

        <TodayTimeline
          barbers={barbers}
          bookings={visibleBookings}
          timeBlocks={timeBlocks}
          selectedDate={selectedDate}
          scrollContainerRef={timelineScrollRef}

          onBookingClick={openTimelineBooking}
        />
                </>
              ) : isMobileDashboard && mode !== 'history' ? (
        <div className="admin-booking-cards" aria-live="polite">
          {visibleBookings.map((booking) => (
            <article className={`admin-booking-card ${updatedBookingIds.includes(booking.id) ? 'admin-booking-card--updated' : ''}`} key={booking.id}>
              <div className="admin-booking-card-top">
                <p><strong>{formatStartTime(booking.startAt)}</strong> · {booking.service?.name}</p>
                <span className="admin-booking-card-status">{booking.status === 'CONFIRMED' && booking.rescheduledAt ? 'CONFIRMED · RESCHEDULED' : booking.status}</span>
              </div>
              <p className="admin-booking-card-barber">Barber: {booking.barber?.name}</p>
              <button type="button" className="admin-link-button" onClick={() => void openClientProfile(booking.clientId)}>{booking.fullName}</button>
              <p className="admin-booking-card-email">{booking.email}</p>
              {canBeCancelledByShop(booking) ? <button type="button" className="btn btn--secondary" onClick={() => void cancelBookingByShop(booking)} disabled={cancelLoadingBookingId === booking.id}>{cancelLoadingBookingId === booking.id ? 'Cancelling...' : 'Cancel'}</button> : null}
            </article>
          ))}
        </div>

      ) : (
        <div className="listTableWrap">
          <table className="admin-table">
            <thead><tr><th>Client</th><th>Email</th><th>Service</th><th>Barber</th><th>Status</th><th>Start</th><th>Actions</th></tr></thead>
            <tbody>
              {visibleBookings.map((booking) => (
                <tr className={updatedBookingIds.includes(booking.id) ? 'admin-row--updated' : ''} key={booking.id}>
                  <td><button type="button" className="admin-link-button" onClick={() => void openClientProfile(booking.clientId)}>{booking.fullName}</button></td>
                  <td className="admin-table-col-email"><button type="button" className="admin-link-button" onClick={() => void openClientProfile(booking.clientId)}>{booking.email}</button></td>
                  <td className="admin-table-col-service">{booking.service?.name}</td><td>{booking.barber?.name}</td><td>{booking.status === 'CONFIRMED' && booking.rescheduledAt ? 'CONFIRMED · RESCHEDULED' : booking.status}</td><td className="admin-table-col-start">{new Date(booking.startAt).toLocaleString('en-GB', { timeZone: ADMIN_TIMEZONE })}</td>
                  <td className="admin-table-col-actions">{canBeCancelledByShop(booking) ? <button type="button" className="btn btn--secondary admin-cancel-btn" onClick={() => void cancelBookingByShop(booking)} disabled={cancelLoadingBookingId === booking.id}>{cancelLoadingBookingId === booking.id ? 'Cancelling...' : 'Cancel'}</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mode === 'history' && historyHasMore && <button type="button" className="btn btn--secondary" onClick={() => void loadMoreHistory()} disabled={historyLoadingMore}>{historyLoadingMore ? 'Loading...' : 'Load more'}</button>}      </>
          )}
        </>      )}

      {mode === 'reports' && (
        <section className="admin-reports" aria-live="polite">
          <h2>Reports</h2>
          <p className="muted">This week (Europe/London)</p>
          {reportsError && <p className="admin-inline-error">{reportsError}</p>}
          <div className="admin-reports-grid">
            <article className="admin-kpi-card"><p className="admin-kpi-label">Bookings this week</p><p className="admin-kpi-value">{reports?.bookingsThisWeek ?? 0}</p></article>
            <article className="admin-kpi-card"><p className="admin-kpi-label">Cancelled rate</p><p className="admin-kpi-value">{`${(reports?.cancelledRate ?? 0).toFixed(1)}%`}</p></article>
            <article className="admin-kpi-card"><p className="admin-kpi-label">Most popular service</p><p className="admin-kpi-value">{reports?.mostPopularService ? `${reports.mostPopularService.name} (${reports.mostPopularService.count})` : 'No confirmed bookings'}</p></article>
            <article className="admin-kpi-card"><p className="admin-kpi-label">Busiest barber</p><p className="admin-kpi-value">{reports?.busiestBarber ? `${reports.busiestBarber.name} (${reports.busiestBarber.count})` : 'No confirmed bookings'}</p></article>
          </div>
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
