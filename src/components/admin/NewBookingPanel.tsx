import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from '../lucide-react';
import { adminFetchJson } from './adminAuth';

type ServiceOption = {
  id: string;
  name: string;
  isActive?: boolean;
  active?: boolean;
};

type BarberOption = {
  id: string;
  name: string;
  isActive: boolean;
  serviceIds?: string[];
};

function todayLondon(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function NewBookingPanel({
  fixedBarberId,
  onClose,
  onCreated,
}: {
  fixedBarberId?: string | null;
  onClose: () => void;
  onCreated: (booking: { id: string; date: string; startAt: string }) => void;
}) {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [barberId, setBarberId] = useState(fixedBarberId ?? '');
  const [date, setDate] = useState(todayLondon);
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [idempotencyKey] = useState(newIdempotencyKey);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      adminFetchJson<{ services?: ServiceOption[] }>('/api/admin/services', {
        errorMessage: 'Could not load services.',
      }),
      adminFetchJson<{ barbers?: BarberOption[] }>('/api/admin/barbers', {
        errorMessage: 'Could not load barbers.',
      }),
    ])
      .then(([serviceData, barberData]) => {
        if (cancelled) return;
        const nextServices = (serviceData.services ?? []).filter(
          (service) => service.isActive !== false && service.active !== false,
        );
        const nextBarbers = (barberData.barbers ?? []).filter((barber) => barber.isActive !== false);
        setServices(nextServices);
        setBarbers(nextBarbers);
        setServiceId((current) => current || nextServices[0]?.id || '');
        setBarberId((current) => current || fixedBarberId || nextBarbers[0]?.id || '');
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load booking setup.');
      })
      .finally(() => {
        if (!cancelled) setLoadingSetup(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fixedBarberId]);

  const eligibleBarbers = useMemo(() => {
    if (!serviceId) return barbers;
    return barbers.filter(
      (barber) => !barber.serviceIds?.length || barber.serviceIds.includes(serviceId),
    );
  }, [barbers, serviceId]);

  useEffect(() => {
    if (fixedBarberId) {
      setBarberId(fixedBarberId);
      return;
    }
    if (!eligibleBarbers.some((barber) => barber.id === barberId)) {
      setBarberId(eligibleBarbers[0]?.id ?? '');
    }
  }, [barberId, eligibleBarbers, fixedBarberId]);

  useEffect(() => {
    let cancelled = false;
    setTime('');
    setSlots([]);
    if (!serviceId || !barberId || !date) return undefined;

    setLoadingSlots(true);
    setError('');
    const params = new URLSearchParams({ serviceId, barberId, date });
    adminFetchJson<{ slots?: string[] }>(
      `/api/admin/bookings/manual-availability?${params.toString()}`,
      { errorMessage: 'Could not load available times.' },
    )
      .then((result) => {
        if (!cancelled) setSlots(result.slots ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load available times.');
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [barberId, date, serviceId]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, saving]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !serviceId || !barberId || !date || !time || !fullName.trim() || !email.trim()) return;

    setSaving(true);
    setError('');
    try {
      const result = await adminFetchJson<{
        booking: { id: string; startAt: string; paymentType: 'NONE' };
      }>('/api/admin/bookings/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          serviceId,
          barberId,
          date,
          time,
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          note: note.trim(),
        }),
        errorMessage: 'Could not create booking.',
      });
      onCreated({ id: result.booking.id, date, startAt: result.booking.startAt });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create booking.');
    } finally {
      setSaving(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="admin-cp-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-new-booking-title"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div className="admin-cp-panel admin-new-booking-panel" onClick={(event) => event.stopPropagation()}>
        <div className="admin-cp-header">
          <span id="admin-new-booking-title" className="admin-cp-header-title">New booking</span>
          <button
            type="button"
            className="admin-cp-close-btn"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            <X className="admin-cp-close-icon" aria-hidden />
          </button>
        </div>

        <form className="admin-new-booking-form" onSubmit={(event) => void submit(event)}>
          <p className="admin-new-booking-payment-note">
            Pay at shop · No online payment is created for manual bookings.
          </p>

          {error ? <p className="admin-inline-error" role="alert">{error}</p> : null}

          <label className="admin-new-booking-field">
            <span>Service</span>
            <select
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
              disabled={loadingSetup || saving}
              required
            >
              <option value="">Choose service</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>{service.name}</option>
              ))}
            </select>
          </label>

          <label className="admin-new-booking-field">
            <span>Barber</span>
            <select
              value={barberId}
              onChange={(event) => setBarberId(event.target.value)}
              disabled={loadingSetup || saving || Boolean(fixedBarberId)}
              required
            >
              <option value="">Choose barber</option>
              {eligibleBarbers.map((barber) => (
                <option key={barber.id} value={barber.id}>{barber.name}</option>
              ))}
            </select>
          </label>

          <label className="admin-new-booking-field">
            <span>Date</span>
            <input
              type="date"
              value={date}
              min={todayLondon()}
              onChange={(event) => setDate(event.target.value)}
              disabled={saving}
              required
            />
          </label>

          <label className="admin-new-booking-field">
            <span>Time</span>
            <select
              value={time}
              onChange={(event) => setTime(event.target.value)}
              disabled={loadingSlots || saving || slots.length === 0}
              required
            >
              <option value="">
                {loadingSlots ? 'Loading times…' : slots.length ? 'Choose time' : 'No available times'}
              </option>
              {slots.map((slot) => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </select>
          </label>

          <label className="admin-new-booking-field">
            <span>Customer name</span>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              minLength={2}
              disabled={saving}
              required
              autoComplete="name"
            />
          </label>

          <label className="admin-new-booking-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={saving}
              required
              autoComplete="email"
            />
          </label>

          <label className="admin-new-booking-field">
            <span>Phone <small>(optional)</small></span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={saving}
              autoComplete="tel"
            />
          </label>

          <label className="admin-new-booking-field">
            <span>Internal note <small>(optional)</small></span>
            <textarea
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={saving}
            />
          </label>

          <div className="admin-new-booking-actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={
                saving ||
                loadingSetup ||
                loadingSlots ||
                !serviceId ||
                !barberId ||
                !date ||
                !time ||
                !fullName.trim() ||
                !email.trim()
              }
            >
              {saving ? 'Creating…' : 'Create booking'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
