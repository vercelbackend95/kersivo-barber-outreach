import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Booking = {
  id: string;
  fullName: string;
  email: string;
  status: string;
  startAt: string;
  endAt: string;
  rescheduledAt?: string | null;
  barber: { name: string };
  service: { name: string };
};

type BookingFilterTab = 'confirmed' | 'rescheduled' | 'pending' | 'cancelled';

const ADMIN_TIMEZONE = 'Europe/London';
const POLL_INTERVAL_MS = 15000;
const LAST_UPDATED_REFRESH_MS = 1000;
const UPDATED_ROW_HIGHLIGHT_MS = 2000;

function formatRelativeTime(startAt: string, endAt: string) {
  const nowMs = Date.now();
  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();

  if (nowMs >= startMs && nowMs < endMs) {
    const elapsedMin = Math.floor((nowMs - startMs) / 60000);
    return elapsedMin <= 0 ? 'now' : `started ${elapsedMin} min ago`;
  }

  const diffMs = startMs - nowMs;
  if (diffMs <= 0) return 'now';

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `in ${diffMin} min`;

  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return mins ? `in ${hours}h ${mins}m` : `in ${hours}h`;
}

function formatStartTime(startAt: string) {
  return new Date(startAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ADMIN_TIMEZONE
  });
}

function getUpcomingBookings(bookings: Booking[]) {
  const nowMs = Date.now();
  return bookings
    .filter((booking) => booking.status === 'CONFIRMED')
    .filter((booking) => new Date(booking.endAt).getTime() > nowMs)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

function describeBooking(booking: Booking) {
  return `Next: ${booking.barber?.name ?? 'Unknown barber'} — ${booking.service?.name ?? 'Service'} — ${formatStartTime(booking.startAt)} (${formatRelativeTime(booking.startAt, booking.endAt)})`;
}

function describeAfterThat(booking: Booking) {
  return `After that: ${booking.barber?.name ?? 'Unknown barber'} — ${booking.service?.name ?? 'Service'} — ${formatStartTime(booking.startAt)} (${formatRelativeTime(booking.startAt, booking.endAt)})`;
}

function toSignature(booking: Booking) {
  return [
    booking.id,
    booking.fullName,
    booking.email,
    booking.status,
    booking.startAt,
    booking.endAt,
    booking.rescheduledAt ?? '',
    booking.barber?.name ?? '',
    booking.service?.name ?? ''
  ].join('|');
}

function formatLastUpdated(lastUpdatedAt: number | null, nowMs: number) {
  if (!lastUpdatedAt) return 'never';
  const diffSec = Math.floor((nowMs - lastUpdatedAt) / 1000);
  if (diffSec <= 4) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  return `${diffMin}m ago`;
}
function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

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

function isCancelledStatus(status: string) {
  return status.startsWith('CANCELLED');
}
function canBeCancelledByShop(booking: Booking) {
  return booking.status === 'CONFIRMED';
}


function matchesTabFilter(booking: Booking, activeFilter: BookingFilterTab) {
  if (activeFilter === 'confirmed') {
    return booking.status === 'CONFIRMED' && !booking.rescheduledAt;
  }

  if (activeFilter === 'rescheduled') {
    return booking.status === 'CONFIRMED' && Boolean(booking.rescheduledAt);
  }

  if (activeFilter === 'pending') {
    return booking.status === 'PENDING_CONFIRMATION';
  }

  return isCancelledStatus(booking.status);
}

function sortByFilter(bookingA: Booking, bookingB: Booking, activeFilter: BookingFilterTab) {
  const startAtA = new Date(bookingA.startAt).getTime();
  const startAtB = new Date(bookingB.startAt).getTime();

  if (activeFilter === 'cancelled') {
    return startAtB - startAtA;
  }

  return startAtA - startAtB;
}


export default function AdminPanel() {
  const [secret, setSecret] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState('');
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const [updatedBookingIds, setUpdatedBookingIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<BookingFilterTab>('confirmed');
  const [cancelSuccessMessage, setCancelSuccessMessage] = useState('');
  const [cancelErrorMessage, setCancelErrorMessage] = useState('');
  const [cancelLoadingBookingId, setCancelLoadingBookingId] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const pollingStoppedRef = useRef(false);
  const previousSignaturesRef = useRef<Map<string, string>>(new Map());
  const updatedRowsTimeoutRef = useRef<number | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!loggedIn || pollingStoppedRef.current || inFlightRef.current) return;

    inFlightRef.current = true;
    setIsRefreshing(true);
    const scrollY = window.scrollY;

    try {
      const response = await fetch('/api/admin/bookings', { credentials: 'same-origin' });

      if (response.status === 401) {
        pollingStoppedRef.current = true;
        setLoggedIn(false);
        setError('Session expired. Please log in again.');
        return;
      }

      if (!response.ok) {
        throw new Error(`Fetch failed with status ${response.status}`);
      }

      const data = (await response.json()) as { bookings?: Booking[] };
      const incomingBookings = data.bookings ?? [];
      const nextSignatures = new Map(incomingBookings.map((booking) => [booking.id, toSignature(booking)]));
      const changedIds = incomingBookings
        .filter((booking) => previousSignaturesRef.current.get(booking.id) !== nextSignatures.get(booking.id))
        .map((booking) => booking.id);

      setBookings(incomingBookings);
      previousSignaturesRef.current = nextSignatures;
      setLastUpdatedAt(Date.now());

      if (changedIds.length) {
        setUpdatedBookingIds(changedIds);
        if (updatedRowsTimeoutRef.current) {
          window.clearTimeout(updatedRowsTimeoutRef.current);
        }
        updatedRowsTimeoutRef.current = window.setTimeout(() => setUpdatedBookingIds([]), UPDATED_ROW_HIGHLIGHT_MS);
      }

      window.requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY });
      });
    } catch {
      setError('Could not refresh bookings right now.');
    } finally {
      inFlightRef.current = false;
      setIsRefreshing(false);
    }
  }, [loggedIn]);

  async function login() {
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret })
    });

    setLoggedIn(res.ok);
    if (!res.ok) {
      setError('Invalid secret');
      return;
    }

    pollingStoppedRef.current = false;
    previousSignaturesRef.current = new Map();
    void fetchBookings();
  }

  async function logout() {
    await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'same-origin'
    });

    pollingStoppedRef.current = true;
    previousSignaturesRef.current = new Map();
    setBookings([]);
    setLoggedIn(false);
    setSecret('');
    setError('');
  }

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const response = await fetch('/api/admin/session', { credentials: 'same-origin' });
        if (!isMounted) return;

        if (response.ok) {
          pollingStoppedRef.current = false;
          setLoggedIn(true);
          return;
        }

        setLoggedIn(false);
      } catch {
        if (!isMounted) return;
        setLoggedIn(false);
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!loggedIn || pollingStoppedRef.current) return;

    void fetchBookings();
    const intervalId = window.setInterval(() => {
      void fetchBookings();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchBookings, loggedIn]);

  useEffect(() => {
    if (!loggedIn) return;

    const timerId = window.setInterval(() => {
      setNowMs(Date.now());
    }, LAST_UPDATED_REFRESH_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, [loggedIn]);

  useEffect(() => {
    return () => {
      pollingStoppedRef.current = true;
      if (updatedRowsTimeoutRef.current) {
        window.clearTimeout(updatedRowsTimeoutRef.current);
      }
    };
  }, []);

  const upcomingBookings = useMemo(() => getUpcomingBookings(bookings), [bookings]);
  const nextBooking = upcomingBookings[0] ?? null;
  const secondNextBooking = upcomingBookings[1] ?? null;
  const normalizedClientSearchQuery = useMemo(() => normalizeSearchValue(clientSearchQuery), [clientSearchQuery]);

  const bookingsByTab = useMemo(() => {
    return {
      confirmed: bookings.filter((booking) => matchesTabFilter(booking, 'confirmed')).length,
      rescheduled: bookings.filter((booking) => matchesTabFilter(booking, 'rescheduled')).length,
      pending: bookings.filter((booking) => matchesTabFilter(booking, 'pending')).length,
      cancelled: bookings.filter((booking) => matchesTabFilter(booking, 'cancelled')).length
    };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    return bookings
      .filter((booking) => matchesTabFilter(booking, activeFilter))
      .sort((bookingA, bookingB) => sortByFilter(bookingA, bookingB, activeFilter));
  }, [activeFilter, bookings]);

  const visibleBookings = useMemo(() => {
    if (!normalizedClientSearchQuery) {
      return filteredBookings;
    }

    return filteredBookings
      .map((booking, index) => ({
        booking,
        score: getBookingSearchScore(booking, normalizedClientSearchQuery),
        index
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;

        const startAtDiff = new Date(a.booking.startAt).getTime() - new Date(b.booking.startAt).getTime();
        if (startAtDiff !== 0) return startAtDiff;

        return a.index - b.index;
      })
      .map((entry) => entry.booking);
  }, [filteredBookings, normalizedClientSearchQuery]);


  function goToBooking(bookingId: string) {
    const row = document.getElementById(`booking-row-${bookingId}`);
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedBookingId(bookingId);
    window.setTimeout(() => setHighlightedBookingId((current) => (current === bookingId ? null : current)), 2000);
  }
  function clearClientSearch() {
    setClientSearchQuery('');
  }
  async function cancelBookingByShop(booking: Booking) {
    if (!canBeCancelledByShop(booking)) return;

    const confirmed = window.confirm('Cancel this booking? The client will be notified by email.');
    if (!confirmed) return;

    setCancelSuccessMessage('');
    setCancelErrorMessage('');
    setCancelLoadingBookingId(booking.id);

    try {
      const response = await fetch('/api/admin/bookings/cancel', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        details?: string;
        message?: string;
      };


      if (!response.ok) {
        if (response.status === 409) {
                   setCancelErrorMessage(payload.error || payload.details || 'This booking is already cancelled or expired.');
          return;
        }

        if (response.status === 404) {
          setCancelErrorMessage(payload.error || payload.details || 'Booking not found. It may have been removed already.');
          return;
        }

        if (response.status < 500) {
          setCancelErrorMessage(payload.error || payload.details || payload.message || 'Unable to cancel booking due to request error.');

          return;
        }

        setCancelErrorMessage(payload.error || 'Could not cancel booking right now. Please try again.');
        return;
      }

      setCancelSuccessMessage('Booking cancelled successfully.');
      await fetchBookings();
    } catch {
      setCancelErrorMessage('Could not cancel booking right now. Please try again.');
    } finally {
      setCancelLoadingBookingId(null);
    }
  }



  if (isCheckingSession) {
    return <section className="surface booking-shell"><h1>Admin</h1><p className="muted">Checking session…</p></section>;
  }

  if (!loggedIn) {
    return <section className="surface booking-shell"><h1>Admin</h1><label>Admin secret</label><input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} /><button className="btn btn--primary" onClick={login}>Login</button>{error && <p>{error}</p>}</section>;
  }

  return (
    <section className="surface booking-shell">
      <h1>Admin Dashboard</h1>
      <div className="admin-next-block" aria-live="polite">
        {nextBooking ? (
          <>
            <p className="admin-next-primary">{describeBooking(nextBooking)}</p>
            {secondNextBooking && <p className="admin-next-secondary">{describeAfterThat(secondNextBooking)}</p>}
            <button type="button" className="btn btn--secondary" onClick={() => goToBooking(nextBooking.id)}>Go to booking</button>
          </>
        ) : (
          <p className="admin-next-primary">Next: No upcoming confirmed bookings.</p>
        )}
      </div>

      <div className="admin-refresh-row">
        <p className="muted admin-last-updated">Last updated: {formatLastUpdated(lastUpdatedAt, nowMs)}</p>
        <div className="admin-refresh-controls">
          {isRefreshing && <span className="admin-refreshing" aria-live="polite">Refreshing…</span>}
          <button type="button" className="btn btn--ghost" onClick={() => void fetchBookings()} disabled={isRefreshing}>Refresh</button>
          <button type="button" className="btn btn--secondary" onClick={() => void logout()}>Logout</button>
        </div>
      </div>

      {error && <p className="muted">{error}</p>}
      {cancelSuccessMessage && <p className="admin-inline-success" role="status" aria-live="polite">{cancelSuccessMessage}</p>}
      {cancelErrorMessage && <p className="admin-inline-error" role="alert">{cancelErrorMessage}</p>}

      <p className="muted">Bookings</p>
      <div className="admin-filter-tabs" role="tablist" aria-label="Booking status filters">
        <button type="button" className={`admin-filter-tab ${activeFilter === 'confirmed' ? 'admin-filter-tab--active' : ''}`} role="tab" aria-selected={activeFilter === 'confirmed'} onClick={() => setActiveFilter('confirmed')}>
          Confirmed <span className="admin-filter-count">({bookingsByTab.confirmed})</span>
        </button>
        <button type="button" className={`admin-filter-tab ${activeFilter === 'rescheduled' ? 'admin-filter-tab--active' : ''}`} role="tab" aria-selected={activeFilter === 'rescheduled'} onClick={() => setActiveFilter('rescheduled')}>
          Rescheduled <span className="admin-filter-count">({bookingsByTab.rescheduled})</span>
        </button>
        <button type="button" className={`admin-filter-tab ${activeFilter === 'pending' ? 'admin-filter-tab--active' : ''}`} role="tab" aria-selected={activeFilter === 'pending'} onClick={() => setActiveFilter('pending')}>
          Pending <span className="admin-filter-count">({bookingsByTab.pending})</span>
        </button>
        <button type="button" className={`admin-filter-tab ${activeFilter === 'cancelled' ? 'admin-filter-tab--active' : ''}`} role="tab" aria-selected={activeFilter === 'cancelled'} onClick={() => setActiveFilter('cancelled')}>
          Cancelled <span className="admin-filter-count">({bookingsByTab.cancelled})</span>
        </button>
      </div>

      <div className="admin-search-row">
        <input
          type="search"
          value={clientSearchQuery}
          onChange={(event) => setClientSearchQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              clearClientSearch();
            }
          }}
          placeholder="Search by client name or email…"
          aria-label="Search by client name or email"
        />
        {clientSearchQuery && (
          <button type="button" className="btn btn--ghost admin-search-clear" onClick={clearClientSearch} aria-label="Clear search">
            X
          </button>
        )}
      </div>
      <table className="admin-table">
        <thead><tr><th>Client</th><th>Email</th><th>Service</th><th>Barber</th><th>Status</th><th>Start</th><th>Actions</th></tr></thead>
        <tbody>
          {visibleBookings.map((booking) => {
            const isFocused = highlightedBookingId === booking.id;
            const isUpdated = updatedBookingIds.includes(booking.id);
            const rowClassName = [isFocused ? 'admin-row--highlighted' : '', isUpdated ? 'admin-row--updated' : ''].filter(Boolean).join(' ');
            return <tr id={`booking-row-${booking.id}`} className={rowClassName} key={booking.id}><td>{booking.fullName}</td><td>{booking.email}</td><td>{booking.service?.name}</td><td>{booking.barber?.name}</td><td>{booking.status === 'CONFIRMED' && booking.rescheduledAt ? 'CONFIRMED · RESCHEDULED' : booking.status}</td><td>{new Date(booking.startAt).toLocaleString('en-GB', { timeZone: ADMIN_TIMEZONE })}</td><td>{canBeCancelledByShop(booking) ? <button type="button" className="btn btn--secondary admin-cancel-btn" onClick={() => void cancelBookingByShop(booking)} disabled={cancelLoadingBookingId === booking.id}>{cancelLoadingBookingId === booking.id ? 'Cancelling…' : 'Cancel'}</button> : null}</td></tr>;
          })}
        </tbody>
      </table>
    </section>
  );
}
