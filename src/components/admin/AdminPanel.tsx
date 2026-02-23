import React, { useEffect, useState } from 'react';

type Booking = { id: string; fullName: string; email: string; status: string; startAt: string; barber: { name: string }; service: { name: string } };

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

  if (!loggedIn) {
    return <section className="surface booking-shell"><h1>Admin</h1><label>Admin secret</label><input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} /><button className="btn btn--primary" onClick={login}>Login</button>{error && <p>{error}</p>}</section>;
  }

  return (
    <section className="surface booking-shell">
      <h1>Admin Dashboard</h1>
      <p className="muted">Bookings</p>
      <table className="admin-table">
        <thead><tr><th>Client</th><th>Email</th><th>Service</th><th>Barber</th><th>Status</th><th>Start</th></tr></thead>
        <tbody>
          {bookings.map((booking) => <tr key={booking.id}><td>{booking.fullName}</td><td>{booking.email}</td><td>{booking.service?.name}</td><td>{booking.barber?.name}</td><td>{booking.status}</td><td>{new Date(booking.startAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}</td></tr>)}
        </tbody>
      </table>
    </section>
  );
}
