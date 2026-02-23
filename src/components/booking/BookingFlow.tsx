// src/components/booking/BookingFlow.tsx
import React, { useEffect, useMemo, useState } from 'react';

type Service = { id: string; name: string; durationMinutes: number; fromPriceText?: string | null };
type Barber = { id: string; name: string };


type BookingPayload = {
  serviceId: string;
  barberId: string;
  date: string;
  time: string;
};

type BookingCreatePayload = BookingPayload & {
  fullName: string;
  email: string;
  phone?: string;
};


type BookingReschedulePayload = BookingPayload & {
  token: string;
};

type Props = {
  services: Service[];
  barbers: Barber[];
  mode?: 'create' | 'reschedule';
  token?: string;
};

function normalizeToIsoDate(input: string): string | null {
  const trimmed = input.trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const dmyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!dmyMatch) return null;

  const day = Number(dmyMatch[1]);
  const month = Number(dmyMatch[2]);
  const year = Number(dmyMatch[3]);
  const validated = new Date(Date.UTC(year, month - 1, day));

  if (validated.getUTCFullYear() !== year || validated.getUTCMonth() !== month - 1 || validated.getUTCDate() !== day) {
    return null;
  }

  return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
}


export default function BookingFlow({ services, barbers, mode = 'create', token = '' }: Props) {
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

    const isoDate = normalizeToIsoDate(date);
    if (!isoDate) {
      setSlots([]);
      setTime('');
      return;
    }

    fetch(`/api/availability?serviceId=${serviceId}&barberId=${barberId}&date=${isoDate}`)
      .then((res) => res.json())
      .then((data) => {
        setSlots(data.slots ?? []);
        setTime('');
      });
  }, [serviceId, barberId, date]);

  const selectedService = useMemo(() => services.find((s) => s.id === serviceId), [serviceId, services]);

  async function submit() {
    setMessage('');


    if (!serviceId || !barberId) {
      setMessage('Please choose a service and barber.');
      return;
    }

    const isoDate = normalizeToIsoDate(date);
    if (!isoDate) {
      setMessage('Please choose a valid date.');
      return;
    }

    if (!time) {
      setMessage('Please select an available time.');
      return;
    }

    if (mode === 'reschedule') {
      if (!token) {
        setMessage('Missing reschedule token. Please use the manage link from your email.');
        return;
      }

      const payload: BookingReschedulePayload = {
        token,
        serviceId,
        barberId,
        date: isoDate,
        time
      };

      const res = await fetch('/api/bookings/reschedule', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({} as { error?: string; booking?: { startAt?: string } }));
      if (!res.ok) {
        setMessage(data.error || 'Unable to reschedule booking.');
        return;
      }

      const startAt = data.booking?.startAt ? new Date(data.booking.startAt).toLocaleString('en-GB', { timeZone: 'Europe/London' }) : `${isoDate} ${time}`;
      setMessage(`Booking rescheduled successfully. New time: ${startAt}.`);
      return;
    }

    const normalizedFullName = fullName.trim();
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();

    if (!normalizedFullName || !normalizedEmail) {
      setMessage('Please provide your full name and email.');
      return;
    }

    const payload: BookingCreatePayload = {
      serviceId,
      barberId,
      date: isoDate,
      time,
      fullName: normalizedFullName,
      email: normalizedEmail,
      ...(normalizedPhone ? { phone: normalizedPhone } : {})
    };

    const res = await fetch('/api/bookings/create', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({} as { error?: string }));
    setMessage(res.ok ? 'Booking created. Check email for confirmation magic link.' : data.error || 'Unable to create booking.');
  }

  return (
    <section className="surface booking-shell">

      <h1>{mode === 'reschedule' ? 'Reschedule Booking' : 'Book Now'}</h1>
      <p className="muted">Timezone: Europe/London • {mode === 'reschedule' ? 'Choose a new slot and submit once.' : 'Confirmation required by email.'}</p>

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
        {slots.map((slot) => (
          <button
            type="button"
            key={slot}
            className={time === slot ? 'btn btn--primary' : 'btn btn--secondary'}
            onClick={() => setTime(slot)}
          >
            {slot}
          </button>
        ))}
        {slots.length === 0 && <p className="muted">No slots available for this date.</p>}
      </div>

      {mode === 'create' && (
        <>
          <label>Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>Phone (optional)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </>
      )}

      <button type="button" className="btn btn--primary" disabled={!time || (mode === 'create' && (!fullName || !email))} onClick={submit}>{mode === 'reschedule' ? 'Reschedule booking' : 'Create booking'}</button>
      {message && <p>{message}</p>}
    </section>
  );
}
