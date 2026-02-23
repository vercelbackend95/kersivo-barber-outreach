import React, { useEffect, useMemo, useState } from 'react';

type Service = { id: string; name: string; durationMinutes: number; fromPriceText?: string | null };
type Barber = { id: string; name: string };

type Props = { services: Service[]; barbers: Barber[] };

export default function BookingFlow({ services, barbers }: Props) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [barberId, setBarberId] = useState(barbers[0]?.id ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<string[]>([]);
  const [time, setTime] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!serviceId || !barberId || !date) return;
    fetch(`/api/availability?serviceId=${serviceId}&barberId=${barberId}&date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        setSlots(data.slots ?? []);
        setTime('');
      });
  }, [serviceId, barberId, date]);

  const selectedService = useMemo(() => services.find((s) => s.id === serviceId), [serviceId, services]);

  async function submit() {
    setMessage('');
    const res = await fetch('/api/bookings/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId, barberId, date, time, fullName, email, phone })
    });
    const data = await res.json();
    setMessage(res.ok ? 'Booking created. Check email for confirmation magic link.' : data.error || 'Unable to create booking.');
  }

  return (
    <section className="surface booking-shell">
      <h1>Book Now</h1>
      <p className="muted">Timezone: Europe/London • Confirmation required by email.</p>

      <label>Service</label>
      <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
        {services.map((service) => <option key={service.id} value={service.id}>{service.name} ({service.durationMinutes} min)</option>)}
      </select>

      <label>Barber</label>
      <select value={barberId} onChange={(e) => setBarberId(e.target.value)}>
        {barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.name}</option>)}
      </select>

      <label>Date</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      <label>Available times {selectedService ? `for ${selectedService.name}` : ''}</label>
      <div className="slot-grid">
        {slots.map((slot) => <button type="button" key={slot} className={time === slot ? 'btn primary' : 'btn secondary'} onClick={() => setTime(slot)}>{slot}</button>)}
        {slots.length === 0 && <p className="muted">No slots available for this date.</p>}
      </div>

      <label>Full name</label>
      <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <label>Email</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label>Phone (optional)</label>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} />

      <button className="btn btn--primary" disabled={!time || !fullName || !email} onClick={submit}>Create booking</button>
      {message && <p>{message}</p>}
    </section>
  );
}
