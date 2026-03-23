
import React, { useEffect, useMemo, useState } from 'react';
import BookingConfirmationPanel, { type BookingSummary } from './BookingConfirmationPanel';
type Service = { id: string; name: string; durationMinutes: number; pricePence: number };
type Barber = { id: string; name: string; avatarUrl?: string | null; serviceIds?: string[] };

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

function formatDateForSummary(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }

  return parsed.toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
function formatDateForBookingTab(isoDate: string): string {
  const normalizedDate = normalizeToIsoDate(isoDate);
  if (!normalizedDate) {
    return 'Select date';
  }

  const parsed = new Date(`${normalizedDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return 'Select date';
  }

  return parsed.toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  });
}


function formatPrice(pricePence: number): string {
  return `£${(pricePence / 100).toFixed(2)}`;
}

function getBarberInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return '?';

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function BookingFlow({ services, barbers, mode = 'create', token = '' }: Props) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [barberId, setBarberId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<string[]>([]);
  const [time, setTime] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
    const [brokenAvatarIds, setBrokenAvatarIds] = useState<Record<string, boolean>>({});
  const [confirmation, setConfirmation] = useState<{ type: 'booked' | 'rescheduled'; summary: BookingSummary } | null>(null);
  const availableBarbers = useMemo(() => {
    if (!serviceId) return [];
    return barbers.filter((barber) => {
      if (!barber.serviceIds || barber.serviceIds.length === 0) return true;
      return barber.serviceIds.includes(serviceId);
    });
  }, [barbers, serviceId]);
  const selectedService = useMemo(() => services.find((service) => service.id === serviceId), [serviceId, services]);
  const selectedBarber = useMemo(() => availableBarbers.find((barber) => barber.id === barberId), [availableBarbers, barberId]);

  const isCreateMode = mode === 'create';
  const isSubmitDisabled = !time || !barberId || (isCreateMode && (!fullName.trim() || !email.trim()));
  const bookingDateLabel = formatDateForBookingTab(date);

  useEffect(() => {
    if (!availableBarbers.some((barber) => barber.id === barberId)) {
      setBarberId(availableBarbers[0]?.id ?? '');
      setTime('');
      setSlots([]);
    }
  }, [availableBarbers, barberId]);


  useEffect(() => {
    if (!serviceId || !barberId || !date) return;

    const normalizedDate = normalizeToIsoDate(date);
    if (!normalizedDate) {

      setSlots([]);
      setTime('');
      return;
    }

    fetch(`/api/availability?serviceId=${serviceId}&barberId=${barberId}&date=${normalizedDate}`)
      .then((res) => res.json())
      .then((data) => {
        setSlots(data.slots ?? []);
        setTime('');
      });
  }, [serviceId, barberId, date]);


  async function submit() {
    setMessage('');

    setConfirmation(null);
    if (!serviceId || !barberId) {
      setMessage('Please choose a service and barber.');
      return;
    }

    const normalizedDate = normalizeToIsoDate(date);
    if (!normalizedDate) {

      setMessage('Please choose a valid date.');
      return;
    }

    if (!time) {
      setMessage('Please select an available time.');
      return;
    }

    if (mode === 'reschedule') {
      if (!token) {
        setMessage('Missing reschedule token. Please use the secure booking link from your email.');
        return;
      }

      const payload: BookingReschedulePayload = { token, serviceId, barberId, date: normalizedDate, time };

      const res = await fetch('/api/bookings/reschedule', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) {
        setMessage(data.error || 'Unable to reschedule booking.');
        return;
      }

      setConfirmation({
        type: 'rescheduled',
        summary: {
          service: selectedService?.name,
          barber: selectedBarber?.name,
          date: formatDateForSummary(normalizedDate),
          time
        }
      });

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
      date: normalizedDate,
      time,
      fullName: normalizedFullName,
      email: normalizedEmail,
      ...(normalizedPhone ? { phone: normalizedPhone } : {})
    };

    const res = await fetch('/api/bookings/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({} as { error?: string }));
    if (!res.ok) {
      setMessage(data.error || 'Unable to create booking.');
      return;
    }
    setConfirmation({
      type: 'booked',
      summary: {
        service: selectedService?.name,
        barber: selectedBarber?.name,
        date: formatDateForSummary(normalizedDate),
        time
      }
    });

  }

  return (
    <section className="surface booking-shell booking-flow" aria-live="polite">
      <div className="booking-form-content">
        <div className="booking-flow__hero">
          <div className="booking-flow__hero-copy">
            <p className="booking-flow__eyebrow">Instant booking</p>
            <h1>{isCreateMode ? 'Book now' : 'Reschedule your booking'}</h1>
            <p className="muted">
              {isCreateMode
                ? 'Choose your service, barber and time in a clean mobile-first flow built for fast confirmation.'
                : 'Pick a new service, barber, date and time in a cleaner mobile-first flow. Your appointment updates instantly after submission.'}

            </p>
          </div>


        </div>

        {confirmation ? <BookingConfirmationPanel variant={confirmation.type} summary={confirmation.summary} /> : null}
        {message ? <p className="admin-inline-error">{message}</p> : null}


        <div className="booking-flow__layout">
          <div className="booking-flow__main">
            <section className="booking-step" aria-labelledby="booking-step-service">
              <div className="booking-step__head">
                <span className="booking-step__index">01</span>
                <div className="booking-step__title">
                  <h2 id="booking-step-service">Choose a service</h2>
                </div>
                              </div>
              <div className="booking-choice-grid booking-choice-grid--services" role="radiogroup" aria-label="Services">
                {services.map((service) => {
                  const isSelected = service.id === serviceId;

                  return (
                    <button
                      type="button"
                      key={service.id}
                      className={`booking-choice-card booking-choice-card--service${isSelected ? ' is-selected' : ''}`}
                      aria-pressed={isSelected}
                      onClick={() => setServiceId(service.id)}
                    >
                      <span className="booking-choice-card__title">{service.name}</span>
                      <span className="booking-choice-card__meta booking-choice-card__meta--service">
                        <span className="booking-choice-card__meta-item">
                          <span className="booking-choice-card__meta-label">Duration</span>
                          <span className="booking-choice-card__stat">{service.durationMinutes} min</span>
                        </span>
                        <span className="booking-choice-card__meta-item booking-choice-card__meta-item--price">
                          <span className="booking-choice-card__meta-label">Price</span>
                          <span className="booking-choice-card__price">{formatPrice(service.pricePence)}</span>

                        </span>
                      </span>

                    </button>
                  );
                })}

              </div>
                          </section>

            <section className="booking-step" aria-labelledby="booking-step-barber">
              <div className="booking-step__head">
                <span className="booking-step__index">02</span>
                <div className="booking-step__title">
                  <h2 id="booking-step-barber">Choose a barber</h2>

                </div>

              </div>
              <div className="booking-choice-grid booking-choice-grid--barbers" role="radiogroup" aria-label="Barbers">
                {availableBarbers.map((barber) => {
                  const isSelected = barber.id === barberId;
                const hasAvatar = Boolean(barber.avatarUrl) && !brokenAvatarIds[barber.id];
                  const initials = getBarberInitials(barber.name);


                  return (
                    <button
                      type="button"
                      key={barber.id}
                      className={`booking-choice-card booking-choice-card--barber${isSelected ? ' is-selected' : ''}`}

                      aria-pressed={isSelected}
                      onClick={() => setBarberId(barber.id)}
                    >
                      <span className="booking-choice-card__avatar" aria-hidden="true" data-has-image={hasAvatar ? 'true' : 'false'}>
                        {hasAvatar ? (
                          <img
                            src={barber.avatarUrl ?? undefined}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            onError={() => setBrokenAvatarIds((current) => ({ ...current, [barber.id]: true }))}
                          />

                        ) : (
                          <span className="booking-choice-card__avatar-fallback">{initials}</span>
                        )}

                      </span>

                      <span className="booking-choice-card__content">
                        <span className="booking-choice-card__title">{barber.name}</span>
                      </span>

                    </button>
                  );
                })}
              </div>
              {availableBarbers.length === 0 ? <p className="muted">No active barbers offer this service right now.</p> : null}
            </section>



            <section className="booking-step" aria-labelledby="booking-step-date-time">
              <div className="booking-step__head">
                <span className="booking-step__index">03</span>
                <div className="booking-step__title">
                  <h2 id="booking-step-date-time">Choose date and time</h2>

                </div>
              </div>

              <div className="booking-date-panel">
                <div className="booking-flow__field booking-flow__field--date">
                  <label className="admin-filter-tab admin-filter-tab--split admin-filter-tab--active booking-date-tab" htmlFor="booking-date">
                    <span className="admin-filter-tab-main booking-date-tab__main">{bookingDateLabel}</span>
                    <span className="admin-filter-tab-calendar booking-date-tab__calendar" aria-hidden="true">
                      <input
                        id="booking-date"
                        type="date"
                        className="admin-filter-tab-calendar-input booking-date-tab__input"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        aria-label="Select booking date"
                      />
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm13 8H4v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8ZM5 6a1 1 0 0 0-1 1v1h16V7a1 1 0 0 0-1-1H5Z" />
                      </svg>
                    </span>
                  </label>
                </div>

              </div>
              
              <div className="booking-slots-section">
                <div className="booking-slots-section__head">
                  <label id="booking-time-slots">Available times {selectedService ? `for ${selectedService.name}` : ''}</label>
                  <span className="muted">
                    {slots.length > 0 ? 'Select the slot that works best for your schedule.' : 'Choose a barber and date to load availability.'}
                  </span>

                </div>
                <div className="slot-grid" role="radiogroup" aria-labelledby="booking-time-slots">
                  {slots.map((slot) => {
                    const isSelected = time === slot;

                    return (
                      <button
                        type="button"
                        key={slot}
                        className={`booking-slot${isSelected ? ' is-selected' : ''}`}
                        aria-pressed={isSelected}
                        onClick={() => setTime(slot)}
                      >
                        <span className="booking-slot__label">{slot}</span>
                        <span className="booking-slot__meta">{isSelected ? 'Selected' : 'Available'}</span>
                      </button>
                    );
                  })}
                  {slots.length === 0 ? <p className="muted booking-slots-section__empty">No slots available for this date.</p> : null}
                </div>
              </div>

            </section>
            {isCreateMode ? (
              <section className="booking-step" aria-labelledby="booking-step-details">
                <div className="booking-step__head">
                  <span className="booking-step__index">04</span>
                  <div className="booking-step__title">
                    <h2 id="booking-step-details">Your details</h2>
                  </div>
                </div>
                <div className="booking-flow__grid booking-flow__grid--details">
                  <label className="booking-flow__field">
                    <span>Name</span>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
                  </label>
                  <label className="booking-flow__field">
                    <span>Email</span>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  </label>
                  <label className="booking-flow__field">
                    <span>Phone (optional)</span>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                  </label>
                </div>
              </section>
                          ) : null}

            <div className="booking-action-bar">
              <div className="booking-action-bar__summary">
                <span className="booking-action-bar__label">Ready to confirm</span>
                <strong>
                  {selectedService?.name ?? 'Select service'}
                  {selectedBarber ? ` · ${selectedBarber.name}` : ''}
                  {time ? ` · ${time}` : ''}
                </strong>

              </div>
                            <button
                type="button"
                className="btn btn--primary booking-action-bar__button"
                disabled={isSubmitDisabled}
                onClick={submit}
              >
                {mode === 'reschedule' ? 'Reschedule booking' : 'Confirm booking'}
              </button>

            </div>
          </div>


        </div>
      </div>
    </section>
  );
}
