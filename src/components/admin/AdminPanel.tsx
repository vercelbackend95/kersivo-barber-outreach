import React, { useEffect, useState } from 'react';

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

const ADMIN_TIMEZONE = 'Europe/London';

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

export default function AdminPanel() {
  const [secret, setSecret] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState('');

  async function login() {
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ secret }) });
    setLoggedIn(res.ok);
    if (!res.ok) setError('Invalid secret');
  }

  useEffect(() => {
    if (!loggedIn) return;
    fetch('/api/admin/bookings').then((r) => r.json()).then((data) => setBookings(data.bookings ?? []));
  }, [loggedIn]);

  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const upcomingBookings = getUpcomingBookings(bookings);
  const nextBooking = upcomingBookings[0] ?? null;
  const secondNextBooking = upcomingBookings[1] ?? null;

  function goToBooking(bookingId: string) {
    const row = document.getElementById(`booking-row-${bookingId}`);
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedBookingId(bookingId);
    window.setTimeout(() => setHighlightedBookingId((current) => (current === bookingId ? null : current)), 2000);
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
      <p className="muted">Bookings</p>
      <table className="admin-table">
        <thead><tr><th>Client</th><th>Email</th><th>Service</th><th>Barber</th><th>Status</th><th>Start</th></tr></thead>
        <tbody>
          {bookings.map((booking) => <tr id={`booking-row-${booking.id}`} className={highlightedBookingId === booking.id ? 'admin-row--highlighted' : ''} key={booking.id}><td>{booking.fullName}</td><td>{booking.email}</td><td>{booking.service?.name}</td><td>{booking.barber?.name}</td><td>{booking.status === 'CONFIRMED' && booking.rescheduledAt ? 'CONFIRMED · RESCHEDULED' : booking.status}</td><td>{new Date(booking.startAt).toLocaleString('en-GB', { timeZone: ADMIN_TIMEZONE })}</td></tr>)}
        </tbody>
      </table>
    </section>
  );
}
