import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';

const ADMIN_TIMEZONE = 'Europe/London';
export const ADMIN_TODAY_BOOKINGS_POLL_MS = 120000;
const LAST_UPDATED_REFRESH_MS = 1000;
const LIVE_THRESHOLD_MS = 130000;
const CONNECTING_GRACE_MS = 2000;

export type AdminLiveBookingRow = {
  id?: string;
  status: string;
  startAt: string;
  endAt: string;
  barber: { name: string };
  service: { name: string };
};

function getTodayLondonDate() {
  return formatInTimeZone(new Date(), ADMIN_TIMEZONE, 'yyyy-MM-dd');
}

function isTodayInLondon(value: string, todayLondonDate: string) {
  return formatInTimeZone(new Date(value), ADMIN_TIMEZONE, 'yyyy-MM-dd') === todayLondonDate;
}

function addLondonDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const utc = Date.UTC(y!, m! - 1, d! + days, 12, 0, 0);
  return formatInTimeZone(new Date(utc), ADMIN_TIMEZONE, 'yyyy-MM-dd');
}

/** Upcoming BOOKED rows still in progress or later — used by Next appointments strip. */
export function getUpcomingBookings(bookings: AdminLiveBookingRow[], nowMs = Date.now()) {
  return bookings
    .filter((b) => b.status === 'BOOKED')
    .filter((b) => new Date(b.endAt).getTime() > nowMs)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

export function formatAdminLiveStartTime(startAt: string) {
  return new Date(startAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ADMIN_TIMEZONE,
  });
}

export function formatAdminLiveRelativeTime(startAt: string, endAt: string) {
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

export type AdminTodayBookingsLiveValue = {
  sessionChecked: boolean;
  loggedIn: boolean;
  isPublicDemo: boolean;
  /** False until the first successful bookings load (or seeded payload is promoted after mount). */
  hasLoadedOnce: boolean;
  upcomingBookings: AdminLiveBookingRow[];
  connectionStateLabel: string;
  hasLivePulse: boolean;
  showDemoModePills: boolean;
  formatStartTime: (iso: string) => string;
  formatRelativeTime: (startAt: string, endAt: string) => string;
};

const AdminTodayBookingsLiveContext = createContext<AdminTodayBookingsLiveValue | null>(null);

export function AdminTodayBookingsLiveProvider({
  children,
  isPublicDemo = false,
  showDemoModePills,
  initialBookings,
}: {
  children: React.ReactNode;
  isPublicDemo?: boolean;
  /** Generic public demo shows DEMO MODE; BLACKLINE already has banner + sidebar status. */
  showDemoModePills?: boolean;
  /** SSR-seeded demo (or other) payload — avoids a cold empty flash after hydration. */
  initialBookings?: AdminLiveBookingRow[];
}) {
  const seeded = initialBookings != null;
  const demoPills = showDemoModePills ?? isPublicDemo;
  const [loggedIn, setLoggedIn] = useState(isPublicDemo);
  const [sessionChecked, setSessionChecked] = useState(isPublicDemo);
  const [bookings, setBookings] = useState<AdminLiveBookingRow[]>(() => initialBookings ?? []);
  // Start false even when seeded so SSR HTML stays a skeleton (relative times depend on Date.now()).
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const initialMountMsRef = useRef(Date.now());
  const inFlightRef = useRef(false);
  const skipInitialFetchRef = useRef(seeded);

  useEffect(() => {
    if (isPublicDemo) return;
    void (async () => {
      try {
        const response = await fetch('/api/admin/session', { credentials: 'include' });
        setLoggedIn(response.ok);
      } finally {
        setSessionChecked(true);
      }
    })();
  }, [isPublicDemo]);

  const fetchToday = useCallback(async () => {
    if (!loggedIn || inFlightRef.current) return;
    inFlightRef.current = true;
    const today = getTodayLondonDate();
    try {
      const response = await fetch(
        `/api/admin/bookings?date=${encodeURIComponent(today)}&mode=day`,
        { credentials: 'include' },
      );
      if (response.status === 401) {
        setLoggedIn(false);
        return;
      }
      if (!response.ok) return;
      const data = (await response.json()) as { bookings?: AdminLiveBookingRow[] };
      let rows = data.bookings ?? [];

      // Public demo: after the last slot ends, still show Next appointments from tomorrow.
      if (isPublicDemo && getUpcomingBookings(rows).length === 0) {
        const tomorrow = addLondonDays(today, 1);
        const tomorrowResponse = await fetch(
          `/api/admin/bookings?date=${encodeURIComponent(tomorrow)}&mode=day`,
          { credentials: 'include' },
        );
        if (tomorrowResponse.ok) {
          const tomorrowData = (await tomorrowResponse.json()) as { bookings?: AdminLiveBookingRow[] };
          rows = [...rows, ...(tomorrowData.bookings ?? [])];
        }
      }

      setBookings(rows);
      setLastSuccessAt(Date.now());
      setHasLoadedOnce(true);
    } finally {
      inFlightRef.current = false;
    }
  }, [isPublicDemo, loggedIn]);

  useEffect(() => {
    if (!loggedIn) return undefined;

    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      // Promote seeded payload after mount — client Date.now() for relative labels.
      setHasLoadedOnce(true);
      setLastSuccessAt(Date.now());
    } else {
      void fetchToday();
    }

    const id = window.setInterval(() => {
      void fetchToday();
    }, ADMIN_TODAY_BOOKINGS_POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchToday, loggedIn]);

  useEffect(() => {
    if (!loggedIn) return undefined;
    const id = window.setInterval(() => setNowMs(Date.now()), LAST_UPDATED_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [loggedIn]);

  const todayLondonDate = useMemo(() => getTodayLondonDate(), [nowMs]);
  const upcomingBookings = useMemo(() => {
    const todayRows = bookings.filter((booking) => isTodayInLondon(booking.startAt, todayLondonDate));
    const fromToday = getUpcomingBookings(todayRows, nowMs);
    if (fromToday.length > 0 || !isPublicDemo) return fromToday;
    return getUpcomingBookings(bookings, nowMs);
  }, [bookings, isPublicDemo, nowMs, todayLondonDate]);

  const hasRecentConnectionAttempt = nowMs - initialMountMsRef.current > CONNECTING_GRACE_MS;
  const isLive = lastSuccessAt ? nowMs - lastSuccessAt <= LIVE_THRESHOLD_MS : false;
  const connectionStateLabel = isPublicDemo
    ? hasLoadedOnce
      ? 'LIVE'
      : 'CONNECTING…'
    : !lastSuccessAt && !hasRecentConnectionAttempt
      ? 'CONNECTING…'
      : isLive
        ? 'LIVE'
        : 'OFFLINE';
  const hasLivePulse = connectionStateLabel === 'LIVE';

  const formatStartTime = useCallback((iso: string) => formatAdminLiveStartTime(iso), []);
  const formatRelativeTime = useCallback(
    (startAt: string, endAt: string) => formatAdminLiveRelativeTime(startAt, endAt),
    [],
  );

  const value = useMemo<AdminTodayBookingsLiveValue>(
    () => ({
      sessionChecked,
      loggedIn,
      isPublicDemo,
      hasLoadedOnce,
      upcomingBookings,
      connectionStateLabel,
      hasLivePulse,
      showDemoModePills: demoPills,
      formatStartTime,
      formatRelativeTime,
    }),
    [
      sessionChecked,
      loggedIn,
      isPublicDemo,
      hasLoadedOnce,
      upcomingBookings,
      connectionStateLabel,
      hasLivePulse,
      demoPills,
      formatStartTime,
      formatRelativeTime,
    ],
  );

  return (
    <AdminTodayBookingsLiveContext.Provider value={value}>{children}</AdminTodayBookingsLiveContext.Provider>
  );
}

export function useAdminTodayBookingsLive(): AdminTodayBookingsLiveValue {
  const ctx = useContext(AdminTodayBookingsLiveContext);
  if (!ctx) {
    throw new Error('useAdminTodayBookingsLive must be used within AdminTodayBookingsLiveProvider');
  }
  return ctx;
}
