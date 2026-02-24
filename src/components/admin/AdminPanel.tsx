import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

type Booking = {
  id: string;
  clientId?: string | null;
  fullName: string;
  email: string;
  status: string;
  startAt: string;
  endAt: string;
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


type BookingFilterTab = 'confirmed' | 'rescheduled' | 'pending' | 'cancelled';
type AdminBookingView = 'today' | 'all';

const ADMIN_TIMEZONE = 'Europe/London';
const SLOT_STEP_MINUTES = 15;
const POLL_INTERVAL_MS = 15000;
const LAST_UPDATED_REFRESH_MS = 1000;
const UPDATED_ROW_HIGHLIGHT_MS = 2000;

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

function formatLastUpdated(lastUpdatedAt: number | null, nowMs: number) {
  if (!lastUpdatedAt) return 'never';
  const diffSec = Math.floor((nowMs - lastUpdatedAt) / 1000);
  if (diffSec <= 4) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  return `${Math.floor(diffSec / 60)}m ago`;
}

const normalizeSearchValue = (value: string) => value.trim().toLowerCase();
const isCancelledStatus = (status: string) => status.startsWith('CANCELLED');
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



function matchesTabFilter(booking: Booking, activeFilter: BookingFilterTab) {

  if (activeFilter === 'confirmed') return booking.status === 'CONFIRMED' && !booking.rescheduledAt;
  if (activeFilter === 'rescheduled') return booking.status === 'CONFIRMED' && Boolean(booking.rescheduledAt);
  if (activeFilter === 'pending') return booking.status === 'PENDING_CONFIRMATION';
  return isCancelledStatus(booking.status);
}
function roundUpLondon(now: Date, stepMinutes = SLOT_STEP_MINUTES) {
  const zoned = toZonedTime(now, ADMIN_TIMEZONE);
  const year = zoned.getFullYear();
  const month = zoned.getMonth();
  const day = zoned.getDate();
  const hours = zoned.getHours();
  const minutes = zoned.getMinutes();
  const rounded = Math.ceil(minutes / stepMinutes) * stepMinutes;
  const withCarry = new Date(year, month, day, hours, rounded, 0, 0);
  return fromZonedTime(withCarry, ADMIN_TIMEZONE);
}
function formatLocalInputValue(date: Date) {
  return formatInTimeZone(date, ADMIN_TIMEZONE, "yyyy-MM-dd'T'HH:mm");
}

function formatBlockRange(startAt: string, endAt: string) {
  return `${new Date(startAt).toLocaleString('en-GB', { timeZone: ADMIN_TIMEZONE })} → ${new Date(endAt).toLocaleString('en-GB', { timeZone: ADMIN_TIMEZONE })}`;


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
  const [activeView, setActiveView] = useState<AdminBookingView>('today');
  const [cancelSuccessMessage, setCancelSuccessMessage] = useState('');
  const [cancelErrorMessage, setCancelErrorMessage] = useState('');
  const [cancelLoadingBookingId, setCancelLoadingBookingId] = useState<string | null>(null);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfilePayload | null>(null);
  const [isClientLoading, setIsClientLoading] = useState(false);
  const [clientError, setClientError] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);


  const inFlightRef = useRef(false);
  const pollingStoppedRef = useRef(false);
  const previousSignaturesRef = useRef<Map<string, string>>(new Map());
  const updatedRowsTimeoutRef = useRef<number | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!loggedIn || pollingStoppedRef.current || inFlightRef.current) return;

    inFlightRef.current = true;
    setIsRefreshing(true);

    try {
      const endpoint = activeView === 'today' ? '/api/admin/bookings?range=today' : '/api/admin/bookings';
      const response = await fetch(endpoint, { credentials: 'same-origin' });

      if (response.status === 401) {
        pollingStoppedRef.current = true;
        setLoggedIn(false);
        setError('Session expired. Please log in again.');
        return;
      }
      if (!response.ok) throw new Error('Fetch failed');

      const data = (await response.json()) as { bookings?: Booking[] };
      const incomingBookings = data.bookings ?? [];
      const nextSignatures = new Map(incomingBookings.map((b) => [b.id, [b.id, b.fullName, b.email, b.status, b.startAt, b.endAt, b.rescheduledAt ?? '', b.barber?.name ?? '', b.service?.name ?? '', b.clientId ?? ''].join('|')]));
      const changedIds = incomingBookings.filter((b) => previousSignaturesRef.current.get(b.id) !== nextSignatures.get(b.id)).map((b) => b.id);

      setBookings(incomingBookings);
      previousSignaturesRef.current = nextSignatures;
      setLastUpdatedAt(Date.now());

      if (changedIds.length) {
        setUpdatedBookingIds(changedIds);
        if (updatedRowsTimeoutRef.current) window.clearTimeout(updatedRowsTimeoutRef.current);
        updatedRowsTimeoutRef.current = window.setTimeout(() => setUpdatedBookingIds([]), UPDATED_ROW_HIGHLIGHT_MS);
      }

    } catch {
      setError('Could not refresh bookings right now.');
    } finally {
      inFlightRef.current = false;
      setIsRefreshing(false);
    }
  }, [activeView, loggedIn]);

  useEffect(() => { void (async () => { try { const response = await fetch('/api/admin/session', { credentials: 'same-origin' }); setLoggedIn(response.ok); } finally { setIsCheckingSession(false); } })(); }, []);
  useEffect(() => { if (!loggedIn) return; void fetchBookings(); const id = window.setInterval(() => void fetchBookings(), POLL_INTERVAL_MS); return () => window.clearInterval(id); }, [fetchBookings, loggedIn]);
  useEffect(() => { if (!loggedIn) return; const id = window.setInterval(() => setNowMs(Date.now()), LAST_UPDATED_REFRESH_MS); return () => window.clearInterval(id); }, [loggedIn]);

  const normalizedClientSearchQuery = useMemo(() => normalizeSearchValue(clientSearchQuery), [clientSearchQuery]);


  const upcomingBookings = useMemo(() => getUpcomingBookings(bookings), [bookings]);
  const nextBooking = upcomingBookings[0] ?? null;
  const filteredBookings = useMemo(() => bookings.filter((b) => matchesTabFilter(b, activeFilter)), [bookings, activeFilter]);

  const visibleBookings = useMemo(() => {
    if (!normalizedClientSearchQuery) return filteredBookings;
    return filteredBookings.map((booking, index) => ({ booking, score: getBookingSearchScore(booking, normalizedClientSearchQuery), index })).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score).map((entry) => entry.booking);

  }, [filteredBookings, normalizedClientSearchQuery]);

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
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notes: notesDraft })
    });
    if (response.ok && clientProfile) {
      setClientProfile({ ...clientProfile, client: { ...clientProfile.client, notes: notesDraft } });
    }
    setNotesSaving(false);

  }

  async function login() { const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ secret }) }); setLoggedIn(res.ok); if (!res.ok) setError('Invalid secret'); }
  async function logout() { await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }); setBookings([]); setLoggedIn(false); }


  async function cancelBookingByShop(booking: Booking) {
    setCancelLoadingBookingId(booking.id);

    const response = await fetch('/api/admin/bookings/cancel', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bookingId: booking.id }) });
    if (response.ok) { setCancelSuccessMessage('Booking cancelled successfully.'); await fetchBookings(); } else { setCancelErrorMessage('Could not cancel booking right now.'); }
    setCancelLoadingBookingId(null);

  }

  if (isCheckingSession) return <section className="surface booking-shell"><h1>Admin</h1><p className="muted">Checking session…</p></section>;
  if (!loggedIn) return <section className="surface booking-shell"><h1>Admin</h1><label>Admin secret</label><input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} /><button className="btn btn--primary" onClick={login}>Login</button>{error && <p>{error}</p>}</section>;


  return (
    <section className="surface booking-shell">
      <h1>Admin Dashboard</h1>
      <div className="admin-next-block"><p className="admin-next-primary">{activeView === 'today' ? `Today: ${bookings.length} bookings` : `All: ${bookings.length} bookings`}</p>{nextBooking && <p className="admin-next-secondary">Next: {nextBooking.barber?.name} — {nextBooking.service?.name} — {formatStartTime(nextBooking.startAt)} ({formatRelativeTime(nextBooking.startAt, nextBooking.endAt)})</p>}</div>
      <div className="admin-refresh-row"><p className="muted admin-last-updated">Last updated: {formatLastUpdated(lastUpdatedAt, nowMs)}</p><div className="admin-refresh-controls"><button type="button" className="btn btn--ghost" onClick={() => void fetchBookings()} disabled={isRefreshing}>Refresh</button><button type="button" className="btn btn--secondary" onClick={() => void logout()}>Logout</button></div></div>

      {cancelSuccessMessage && <p className="admin-inline-success">{cancelSuccessMessage}</p>}
      {cancelErrorMessage && <p className="admin-inline-error">{cancelErrorMessage}</p>}

      <div className="admin-view-tabs" role="tablist" aria-label="Admin views"><button type="button" className={`admin-filter-tab ${activeView === 'today' ? 'admin-filter-tab--active' : ''}`} onClick={() => setActiveView('today')}>Today</button><button type="button" className={`admin-filter-tab ${activeView === 'all' ? 'admin-filter-tab--active' : ''}`} onClick={() => setActiveView('all')}>All bookings</button></div>
      <div className="admin-filter-tabs" role="tablist" aria-label="Booking status filters"><button type="button" className={`admin-filter-tab ${activeFilter === 'confirmed' ? 'admin-filter-tab--active' : ''}`} onClick={() => setActiveFilter('confirmed')}>Confirmed</button><button type="button" className={`admin-filter-tab ${activeFilter === 'rescheduled' ? 'admin-filter-tab--active' : ''}`} onClick={() => setActiveFilter('rescheduled')}>Rescheduled</button><button type="button" className={`admin-filter-tab ${activeFilter === 'pending' ? 'admin-filter-tab--active' : ''}`} onClick={() => setActiveFilter('pending')}>Pending</button><button type="button" className={`admin-filter-tab ${activeFilter === 'cancelled' ? 'admin-filter-tab--active' : ''}`} onClick={() => setActiveFilter('cancelled')}>Cancelled</button></div>
      <div className="admin-search-row"><input type="search" value={clientSearchQuery} onChange={(e) => setClientSearchQuery(e.target.value)} placeholder="Search by client name or email…" aria-label="Search by client name or email" /></div>

      <table className="admin-table">
        <thead><tr><th>Client</th><th>Email</th><th>Service</th><th>Barber</th><th>Status</th><th>Start</th><th>Actions</th></tr></thead>
        <tbody>
          {visibleBookings.map((booking) => (
            <tr id={`booking-row-${booking.id}`} className={highlightedBookingId === booking.id ? 'admin-row--highlighted' : ''} key={booking.id}>
              <td><button type="button" className="admin-link-button" onClick={() => void openClientProfile(booking.clientId)}>{booking.fullName}</button></td>
              <td><button type="button" className="admin-link-button" onClick={() => void openClientProfile(booking.clientId)}>{booking.email}</button></td>
              <td>{booking.service?.name}</td><td>{booking.barber?.name}</td><td>{booking.status === 'CONFIRMED' && booking.rescheduledAt ? 'CONFIRMED · RESCHEDULED' : booking.status}</td><td>{new Date(booking.startAt).toLocaleString('en-GB', { timeZone: ADMIN_TIMEZONE })}</td>
              <td>{canBeCancelledByShop(booking) ? <button type="button" className="btn btn--secondary admin-cancel-btn" onClick={() => void cancelBookingByShop(booking)} disabled={cancelLoadingBookingId === booking.id}>{cancelLoadingBookingId === booking.id ? 'Cancelling…' : 'Cancel'}</button> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedClientId && (
        <div className="admin-client-modal-backdrop" role="presentation" onClick={() => setSelectedClientId(null)}>
          <div className="admin-client-modal" role="dialog" aria-modal="true" aria-label="Client profile" onClick={(event) => event.stopPropagation()}>
            <div className="admin-client-modal-head"><h2>Client profile</h2><button type="button" className="btn btn--ghost" onClick={() => setSelectedClientId(null)}>Close</button></div>
            {isClientLoading && <p className="muted">Loading…</p>}
            {clientError && <p className="admin-inline-error">{clientError}</p>}
            {clientProfile && (
              <>
                <p><strong>{clientProfile.client.fullName || 'Unnamed client'}</strong><br />{clientProfile.client.email}<br />{clientProfile.client.phone || 'No phone'}</p>
                <div className="admin-client-stats"><p>Total visits: {clientProfile.stats.totalBookings}</p><p>Last visit: {clientProfile.stats.lastBookingAt ? new Date(clientProfile.stats.lastBookingAt).toLocaleString('en-GB', { timeZone: ADMIN_TIMEZONE }) : '—'}</p><p>Cancelled: {clientProfile.stats.cancelledCount}</p></div>
                <h3>Recent bookings</h3>
                <ul className="admin-client-bookings">{clientProfile.recentBookings.map((item) => <li key={item.id}>{new Date(item.startAt).toLocaleString('en-GB', { timeZone: ADMIN_TIMEZONE })} · {item.status} · {item.service?.name} · {item.barber?.name}</li>)}</ul>
                <label htmlFor="client-notes">Notes</label>
                <textarea id="client-notes" value={notesDraft} onChange={(event) => setNotesDraft(event.target.value)} rows={5} />
                <button type="button" className="btn btn--primary" onClick={() => void saveNotes()} disabled={notesSaving}>{notesSaving ? 'Saving…' : 'Save notes'}</button>
              </>
            )}
          </div>

        </div>

      )}
    </section>
  );
}
