import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import AdminBookingsOpsDashHero, { type AdminBookingsOpsDashHeroBooking } from './AdminBookingsOpsDashHero';

const ADMIN_TIMEZONE = 'Europe/London';
const POLL_INTERVAL_MS = 15000;
const LAST_UPDATED_REFRESH_MS = 1000;
const LIVE_THRESHOLD_MS = 20000;
const CONNECTING_GRACE_MS = 2000;

type BookingRow = {
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

function getUpcomingBookings(bookings: BookingRow[]) {
  const nowMs = Date.now();
  return bookings
    .filter((b) => b.status === 'CONFIRMED')
    .filter((b) => new Date(b.endAt).getTime() > nowMs)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

function formatStartTime(startAt: string) {
  return new Date(startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: ADMIN_TIMEZONE });
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

function formatLastUpdated(lastSuccessAt: number | null, nowMs: number) {
  if (!lastSuccessAt) return 'never';
  const diffSec = Math.floor((nowMs - lastSuccessAt) / 1000);

  if (diffSec <= 4) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  return `${Math.floor(diffSec / 60)}m ago`;
}

/**
 * Same Bookings ops dash hero (next booking + LIVE + freshness), with its own
 * poll of today's schedule — used when BookingsAdminPanel is not mounted (e.g. Services tab).
 */
export default function AdminBookingsOpsDashHeroLive() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
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
        { credentials: 'include' }
      );
      if (response.status === 401) {
        setLoggedIn(false);
        return;
      }
      if (!response.ok) return;
      const data = (await response.json()) as { bookings?: BookingRow[] };
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
    }, POLL_INTERVAL_MS);
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
    [bookings, todayLondonDate]
  );
  const upcomingBookings = useMemo(() => getUpcomingBookings(todayBookings), [todayBookings]);
  const nextBooking: AdminBookingsOpsDashHeroBooking | null = upcomingBookings[0] ?? null;

  const hasRecentConnectionAttempt = nowMs - initialMountMsRef.current > CONNECTING_GRACE_MS;
  const isLive = lastSuccessAt ? nowMs - lastSuccessAt <= LIVE_THRESHOLD_MS : false;
  const connectionStateLabel =
    !lastSuccessAt && !hasRecentConnectionAttempt ? 'CONNECTING…' : isLive ? 'LIVE' : 'OFFLINE';
  const hasLivePulse = connectionStateLabel === 'LIVE';
  const freshnessLabel = lastSuccessAt
    ? `Updated ${formatLastUpdated(lastSuccessAt, nowMs)}`
    : 'Waiting for successful refresh';

  if (!sessionChecked || !loggedIn) return null;

  return (
    <AdminBookingsOpsDashHero
      nextBooking={nextBooking}
      connectionStateLabel={connectionStateLabel}
      hasLivePulse={hasLivePulse}
      freshnessLabel={freshnessLabel}
      formatStartTime={formatStartTime}
      formatRelativeTime={formatRelativeTime}
    />
  );
}
