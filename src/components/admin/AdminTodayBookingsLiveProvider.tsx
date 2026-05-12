import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import type { AdminBookingsOpsDashHeroBooking } from './AdminBookingsOpsDashHero';

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

function getUpcomingBookings(bookings: AdminLiveBookingRow[]) {
  const nowMs = Date.now();
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
  upcomingBookings: AdminLiveBookingRow[];
  nextBooking: AdminBookingsOpsDashHeroBooking | null;
  connectionStateLabel: string;
  hasLivePulse: boolean;
  formatStartTime: (iso: string) => string;
  formatRelativeTime: (startAt: string, endAt: string) => string;
};

const AdminTodayBookingsLiveContext = createContext<AdminTodayBookingsLiveValue | null>(null);

export function AdminTodayBookingsLiveProvider({ children }: { children: React.ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [bookings, setBookings] = useState<AdminLiveBookingRow[]>([]);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const initialMountMsRef = useRef(Date.now());
  const inFlightRef = useRef(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/admin/session', { credentials: 'include' });
        setLoggedIn(response.ok);
      } finally {
        setSessionChecked(true);
      }
    })();
  }, []);

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
      setBookings(data.bookings ?? []);
      setLastSuccessAt(Date.now());
    } finally {
      inFlightRef.current = false;
    }
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) return undefined;
    void fetchToday();
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
  const todayBookings = useMemo(
    () => bookings.filter((booking) => isTodayInLondon(booking.startAt, todayLondonDate)),
    [bookings, todayLondonDate],
  );
  const upcomingBookings = useMemo(() => getUpcomingBookings(todayBookings), [todayBookings]);
  const nextBooking: AdminBookingsOpsDashHeroBooking | null = upcomingBookings[0] ?? null;

  const hasRecentConnectionAttempt = nowMs - initialMountMsRef.current > CONNECTING_GRACE_MS;
  const isLive = lastSuccessAt ? nowMs - lastSuccessAt <= LIVE_THRESHOLD_MS : false;
  const connectionStateLabel =
    !lastSuccessAt && !hasRecentConnectionAttempt ? 'CONNECTING…' : isLive ? 'LIVE' : 'OFFLINE';
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
      upcomingBookings,
      nextBooking,
      connectionStateLabel,
      hasLivePulse,
      formatStartTime,
      formatRelativeTime,
    }),
    [
      sessionChecked,
      loggedIn,
      upcomingBookings,
      nextBooking,
      connectionStateLabel,
      hasLivePulse,
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
