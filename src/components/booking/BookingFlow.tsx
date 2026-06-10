
import React, { useEffect, useMemo, useRef, useState } from 'react';
import BookingConfirmationPanel, { type BookingSummary } from './BookingConfirmationPanel';
import BookingReviewPanel from './BookingReviewPanel';
import { BookingStepRailItem } from './BookingStepIndicator';
import { SkeletonSlotGrid } from '../skeleton';
import { ANY_BARBER_ID, ANY_BARBER_NAME } from '../../lib/booking/constants';
import EmptyState from '../EmptyState';
import { Clock } from '../lucide-react';
type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  pricePence: number;
};

type Barber = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  serviceIds?: string[];
};

type ShopReviewDetails = {
  timezone: string;
  cancellationWindowHours?: number | null;
  rescheduleWindowHours?: number | null;
};

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
type BookingApiResponse = {
  booking?: {
    barberName?: string;
    serviceName?: string;
    startAt?: string;
    status?: string;
  };
  error?: string;
};


type Props = {
  services: Service[];
  barbers: Barber[];
  mode?: 'create' | 'reschedule';
  token?: string;
    shopDetails?: ShopReviewDetails;
};
const DEFAULT_BOOKING_TIMEZONE = 'Europe/London';


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
function formatDateForSummary(isoDate: string, timezone: string): string {
  const normalizedDate = normalizeToIsoDate(isoDate);
  if (!normalizedDate) return 'Select date';

  const parsed = new Date(`${normalizedDate}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return normalizedDate;
  }

  return parsed.toLocaleDateString('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
function formatDateForBookingTab(isoDate: string, timezone: string): string {
  const normalizedDate = normalizeToIsoDate(isoDate);
  if (!normalizedDate) {
    return 'Select date';
  }

  const parsed = new Date(`${normalizedDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return 'Select date';
  }

  return parsed.toLocaleDateString('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  });
}

function getCurrentIsoDateInTimezone(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
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

function formatTimezoneLabel(timezone: string): string {
  return timezone.replace(/_/g, ' ');
}

function formatWindow(hours?: number | null): string | null {
  if (typeof hours !== 'number' || Number.isNaN(hours)) return null;
  if (hours === 1) return 'Up to 1 hour before your appointment';
  return `Up to ${hours} hours before your appointment`;
}

function calculateEndTime(startTime: string, durationMinutes: number): string | null {
  const [hoursText, minutesText] = startTime.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }

  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const nextHours = Math.floor(totalMinutes / 60) % 24;
  const nextMinutes = totalMinutes % 60;

  return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`;
}

const BOOKING_STEP_REVEAL_MS = 520;

type BookingStepId = 'barber' | 'schedule' | 'details';

function scrollToBookingStep(section: HTMLElement, onReveal?: () => void) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  section.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });

  if (!reduced) {
    onReveal?.();
  }
}

export default function BookingFlow({ services, barbers, mode = 'create', token = '', shopDetails }: Props) {
  const bookingTimezone = shopDetails?.timezone || DEFAULT_BOOKING_TIMEZONE;
  const [serviceId, setServiceId] = useState('');
  const [barberId, setBarberId] = useState('');
  const [date, setDate] = useState(() => getCurrentIsoDateInTimezone(bookingTimezone));
  const [slots, setSlots] = useState<string[]>([]);
  const [time, setTime] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [brokenAvatarIds, setBrokenAvatarIds] = useState<Record<string, boolean>>({});
  const confirmationRef = useRef<HTMLElement | null>(null);
  const barberStepRef = useRef<HTMLElement>(null);
  const scheduleStepRef = useRef<HTMLElement>(null);
  const detailsStepRef = useRef<HTMLElement>(null);
  const prevStepRef = useRef(1);
  const revealTimeoutRef = useRef<number | null>(null);
  const [revealingStepId, setRevealingStepId] = useState<BookingStepId | null>(null);
  const [confirmation, setConfirmation] = useState<{ type: 'booked' | 'rescheduled'; summary: BookingSummary } | null>(null);
  const isCreateMode = mode === 'create';
  const normalizedFullName = fullName.trim();
  const normalizedEmail = email.trim();
  const normalizedPhone = phone.trim();

  const availableBarbers = useMemo(() => {
    if (!serviceId) return [];
    return barbers.filter((barber) => {
      if (!barber.serviceIds || barber.serviceIds.length === 0) return true;
      return barber.serviceIds.includes(serviceId);
    });
  }, [barbers, serviceId]);
  
  const barberOptions = useMemo(() => {
    if (availableBarbers.length === 0) return [];
    return [{ id: ANY_BARBER_ID, name: ANY_BARBER_NAME, avatarUrl: null }, ...availableBarbers];
  }, [availableBarbers]);


  const selectedService = useMemo(() => services.find((service) => service.id === serviceId), [serviceId, services]);
  const selectedBarber = useMemo(() => availableBarbers.find((barber) => barber.id === barberId), [availableBarbers, barberId]);
  const selectedBarberLabel = barberId === ANY_BARBER_ID ? ANY_BARBER_NAME : selectedBarber?.name;
  const normalizedDate = normalizeToIsoDate(date);
  const bookingDateLabel = formatDateForBookingTab(date, bookingTimezone);
  const bookingDateSummary = normalizedDate ? formatDateForSummary(normalizedDate, bookingTimezone) : 'Select date';
  const minBookingDate = getCurrentIsoDateInTimezone(bookingTimezone);
  const estimatedEndTime = selectedService && time ? calculateEndTime(time, selectedService.durationMinutes) : null;
  const hasSelectedDate = Boolean(normalizedDate);
  const hasSelectedContactDetails = isCreateMode ? Boolean(normalizedFullName && normalizedEmail) : true;
  const canLoadAvailability = Boolean(serviceId && barberId && normalizedDate);

  const currentStep = useMemo(() => {
    if (!serviceId) return 1;
    if (!barberId) return 2;
    if (!time) return 3;
    return 4;
  }, [serviceId, barberId, time]);

  const missingItems = useMemo(() => {
    const items: string[] = [];

    if (!serviceId) items.push('Select a service');
    if (!barberId) items.push('Choose a barber');
    if (!normalizedDate) items.push('Select a date');
    if (!time) items.push('Select a time');

    if (isCreateMode) {
      if (!normalizedFullName) items.push('Add your full name');
      if (!normalizedEmail) items.push('Add your email');
    }

    return items;
  }, [barberId, isCreateMode, normalizedDate, normalizedEmail, normalizedFullName, serviceId, time]);

  const isReadyToSubmit = missingItems.length === 0;
  const isSubmitDisabled = isSubmitting || !isReadyToSubmit;
  const compactBookingSummary = [
    selectedService?.name ?? 'Choose a service',
    selectedBarberLabel ?? 'Choose a barber',
    normalizedDate
      ? new Date(`${normalizedDate}T00:00:00`).toLocaleDateString('en-GB', {
          timeZone: bookingTimezone,
          day: 'numeric',
          month: 'long'
        })
      : 'Choose a date',
    time || 'Choose a time'
  ].join(' • ');

  const compactStatusMeta = isSubmitting
    ? (mode === 'reschedule'
      ? 'Updating your appointment and locking the new slot now.'
      : 'Securing your appointment and sending confirmation details now.')
    : missingItems[0] ?? (isCreateMode ? 'Ready to confirm booking.' : 'Ready to confirm reschedule.');
  const slotsHelperText = !serviceId
    ? 'Choose a service first to see matching availability.'
    : !barberId
      ? 'Choose a barber to load availability for this service.'
      : !normalizedDate
        ? 'Choose a date to load available times.'
        : slots.length > 0
          ? 'Select the slot that works best for your schedule.'
          : 'No slots available for this date.';


  const appointmentRows = useMemo(
    () => [
      { label: 'Service', value: selectedService?.name ?? 'Select a service' },
      { label: 'Barber', value: selectedBarberLabel ?? 'Choose a barber' },
      { label: 'Date', value: normalizedDate ? bookingDateSummary : 'Select a date' },
      { label: 'Time', value: time || 'Select a time' },
      { label: 'Duration', value: selectedService ? `${selectedService.durationMinutes} min` : 'Select a service' },
      { label: 'Price', value: selectedService ? formatPrice(selectedService.pricePence) : 'Select a service' },
      { label: 'Estimated end time', value: estimatedEndTime ?? 'Select a time' }
    ],
    [bookingDateSummary, estimatedEndTime, normalizedDate, selectedBarberLabel, selectedService, time]
  );

  const contactRows = useMemo(
    () => [
      { label: 'Name', value: normalizedFullName || 'Add your full name' },
      { label: 'Email', value: normalizedEmail || 'Add your email' },
      { label: 'Phone', value: normalizedPhone || 'Not provided' }
    ],
    [normalizedEmail, normalizedFullName, normalizedPhone]
  );

  useEffect(() => {
    if (!confirmation) return;

    confirmationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [confirmation]);

  useEffect(() => {
    const prev = prevStepRef.current;
    if (currentStep > prev) {
      const stepTargets: Record<number, { ref: React.RefObject<HTMLElement | null>; id: BookingStepId } | undefined> = {
        2: { ref: barberStepRef, id: 'barber' },
        3: { ref: scheduleStepRef, id: 'schedule' },
        4: isCreateMode ? { ref: detailsStepRef, id: 'details' } : undefined
      };

      const target = stepTargets[currentStep];
      if (target?.ref.current) {
        if (revealTimeoutRef.current !== null) {
          window.clearTimeout(revealTimeoutRef.current);
        }

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reducedMotion) {
          setRevealingStepId(target.id);
        }

        scrollToBookingStep(target.ref.current, () => {
          revealTimeoutRef.current = window.setTimeout(() => {
            setRevealingStepId(null);
            revealTimeoutRef.current = null;
          }, BOOKING_STEP_REVEAL_MS);
        });
      }
    }

    prevStepRef.current = currentStep;
  }, [currentStep, isCreateMode]);

  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current !== null) {
        window.clearTimeout(revealTimeoutRef.current);
      }
    };
  }, []);


  const trustItems = useMemo(() => {
    const items = [
      { label: 'Instant confirmation by email' },
      { label: 'Reschedule and cancel links included after booking' },
      { label: 'All times shown in local shop time', value: formatTimezoneLabel(bookingTimezone) }
    ];

    const cancellationWindow = formatWindow(shopDetails?.cancellationWindowHours);
    if (cancellationWindow) {
      items.push({ label: 'Cancellation window', value: cancellationWindow });
    }

    const rescheduleWindow = formatWindow(shopDetails?.rescheduleWindowHours);
    if (rescheduleWindow) {
      items.push({ label: 'Reschedule window', value: rescheduleWindow });
    }

    return items;
  }, [bookingTimezone, shopDetails?.cancellationWindowHours, shopDetails?.rescheduleWindowHours]);


  useEffect(() => {
    if (!barberOptions.some((barber) => barber.id === barberId)) {
      setBarberId('');
      setTime('');
      setSlots([]);
    }
  }, [barberOptions, barberId]);


  useEffect(() => {
    if (!serviceId || !barberId || !date) return;

    const nextDate = normalizeToIsoDate(date);
    if (!nextDate) {
      setSlots([]);
      setTime('');
      return;
    }

    setIsSlotsLoading(true);
    fetch(`/api/availability?serviceId=${serviceId}&barberId=${barberId}&date=${nextDate}`)
      .then((res) => res.json())
      .then((data) => {
        setSlots(data.slots ?? []);
        setTime('');
      })
      .catch(() => {
        setSlots([]);
        setTime('');
      })
      .finally(() => {
        setIsSlotsLoading(false);
      });
  }, [serviceId, barberId, date]);


  async function submit() {
    if (isSubmitting) return;
    setMessage('');
    setConfirmation(null);
    if (!serviceId || !barberId) {
      setMessage('Please choose a service and barber.');
      return;
    }

    if (!normalizedDate) {

      setMessage('Please choose a valid date.');
      return;
    }

    if (!time) {
      setMessage('Please select an available time.');
      return;
    }
    if (!slots.includes(time)) {
      setMessage('Please select a valid available time.');
      return;
    }
    setIsSubmitting(true);

    try {
      if (mode === 'reschedule') {
        if (!token) {
          setMessage('Missing reschedule token. Please use the secure booking link from your email.');
          return;
        }

        const payload: BookingReschedulePayload = {
          token,
          serviceId,
          barberId,
          date: normalizedDate,
          time
        };

        const res = await fetch('/api/bookings/reschedule', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = (await res.json().catch(() => ({}))) as BookingApiResponse;
        if (!res.ok) {
          setMessage(data.error || 'Unable to reschedule booking.');
          return;
        }

        setConfirmation({
          type: 'rescheduled',
          summary: {
            service: data.booking?.serviceName ?? selectedService?.name,
            barber: data.booking?.barberName ?? selectedBarberLabel,
            date: formatDateForSummary(normalizedDate, bookingTimezone),
            time
          }
        });


        return;
      }

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

      const data = (await res.json().catch(() => ({}))) as BookingApiResponse;
      if (!res.ok) {
        setMessage(data.error || 'Unable to create booking.');
        return;
      }

      setConfirmation({
        type: 'booked',
        summary: {
          service: data.booking?.serviceName ?? selectedService?.name,
          barber: data.booking?.barberName ?? selectedBarberLabel,

          date: formatDateForSummary(normalizedDate, bookingTimezone),
          time
        }
      });

    } finally {
      setIsSubmitting(false);

    }

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
        {confirmation ? (
          <BookingConfirmationPanel
            ref={confirmationRef}
            variant={confirmation.type}
            summary={confirmation.summary}
          />
        ) : null}

        {message ? <p className="admin-inline-error">{message}</p> : null}


        <div className="booking-flow__layout">
          <div className="booking-flow__left">
          <div className="booking-flow__main">
            <div className="booking-synced-step-row">
              <div className="booking-synced-step-row__rail">
                <BookingStepRailItem stepNumber={1} label="Service" currentStep={currentStep} showConnector />
              </div>
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
            </div>

            <div className="booking-synced-step-row">
              <div className="booking-synced-step-row__rail">
                <BookingStepRailItem stepNumber={2} label="Barber" currentStep={currentStep} showConnector />
              </div>
            <section
              ref={barberStepRef}
              className={`booking-step${revealingStepId === 'barber' ? ' is-revealing' : ''}`}
              aria-labelledby="booking-step-barber"
            >
              <div className="booking-step__head">
                <span className="booking-step__index">02</span>
                <div className="booking-step__title">
                  <h2 id="booking-step-barber">Choose a barber</h2>

                </div>

              </div>
              <div className="booking-choice-grid booking-choice-grid--barbers" role="radiogroup" aria-label="Barbers">
                {barberOptions.map((barber) => {
                  const isSelected = barber.id === barberId;

                  const isAnyBarber = barber.id === ANY_BARBER_ID;
                  const hasAvatar = !isAnyBarber && Boolean(barber.avatarUrl) && !brokenAvatarIds[barber.id];
                  const initials = isAnyBarber ? 'ANY' : getBarberInitials(barber.name);



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
                                                {isAnyBarber ? <span className="booking-choice-card__helper">Fastest matching barber</span> : null}
                      </span>

                    </button>
                  );
                })}
              </div>
              {!serviceId ? (
                <p className="muted">Choose a service first to see matching barbers.</p>
              ) : availableBarbers.length === 0 ? (
                <p className="muted">No active barbers offer this service right now.</p>
              ) : null}

            </section>
            </div>



            <div className="booking-synced-step-row">
              <div className="booking-synced-step-row__rail">
                <BookingStepRailItem
                  stepNumber={3}
                  label="Schedule"
                  currentStep={currentStep}
                  showConnector={isCreateMode}
                />
              </div>
            <section
              ref={scheduleStepRef}
              className={`booking-step${revealingStepId === 'schedule' ? ' is-revealing' : ''}`}
              aria-labelledby="booking-step-date-time"
            >
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
                        min={minBookingDate}
                        onChange={(event) => setDate(event.target.value)}

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
                  <span className="muted">{slotsHelperText}</span>

                </div>
                <div className="slot-grid" role="radiogroup" aria-labelledby="booking-time-slots" aria-busy={isSlotsLoading}>
                  {isSlotsLoading ? (
                    <SkeletonSlotGrid count={8} />
                  ) : (
                    <>
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
                      {!canLoadAvailability ? (
                        <p className="muted booking-slots-section__empty">{slotsHelperText}</p>
                      ) : slots.length === 0 ? (
                        <EmptyState
                          icon={Clock}
                          title="No available times"
                          description="No slots are available for this date. Try a different date or barber."
                        />
                      ) : null}
                    </>
                  )}
                </div>
              </div>

            </section>
            </div>
            {isCreateMode ? (
              <div className="booking-synced-step-row">
                <div className="booking-synced-step-row__rail">
                  <BookingStepRailItem stepNumber={4} label="Details" currentStep={currentStep} />
                </div>
              <section
                ref={detailsStepRef}
                className={`booking-step${revealingStepId === 'details' ? ' is-revealing' : ''}`}
                aria-labelledby="booking-step-details"
              >
                <div className="booking-step__head">
                  <span className="booking-step__index">04</span>
                  <div className="booking-step__title">
                    <h2 id="booking-step-details">Your details</h2>
                  </div>
                </div>
                <form
                  id="booking-details-form"
                  className="booking-flow__grid booking-flow__grid--details"
                  autoComplete="on"
                  onSubmit={(event) => event.preventDefault()}
                >
                  <label className="booking-flow__field" htmlFor="booking-full-name">
                    <span>Name</span>
                    <input
                      id="booking-full-name"
                      name="name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      autoComplete="name"
                    />
                  </label>
                  <label className="booking-flow__field" htmlFor="booking-email">
                    <span>Email</span>
                    <input
                      id="booking-email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                    />
                  </label>
                  <label className="booking-flow__field" htmlFor="booking-phone">
                    <span>Phone (optional)</span>
                    <input
                      id="booking-phone"
                      name="tel"
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      autoComplete="tel"
                    />
                  </label>
                </form>
              </section>
              </div>
            ) : null}

            <div className={`booking-action-bar${isSubmitting ? ' is-submitting' : ''}`} aria-live="polite">

              <div className="booking-action-bar__summary">
                <strong>{compactBookingSummary}</strong>
                <span className="booking-action-bar__meta">{compactStatusMeta}</span>

              </div>
              <button
                type="button"
                className="btn btn--primary booking-action-bar__button"
                form={isCreateMode ? 'booking-details-form' : undefined}
                disabled={isSubmitDisabled}
                aria-disabled={isSubmitDisabled}
                aria-busy={isSubmitting}
                onClick={() => void submit()}
              >
                {isSubmitting ? <span className="booking-action-bar__spinner" aria-hidden="true" /> : null}
                <span>{isSubmitting ? (mode === 'reschedule' ? 'Rescheduling…' : 'Confirming…') : mode === 'reschedule' ? 'Reschedule booking' : 'Confirm booking'}</span>
              </button>
              {isSubmitting ? (
                <p className="booking-action-bar__loading-note" role="status">
                  {mode === 'reschedule'
                    ? 'Please wait while we update your booking.'
                    : 'Please wait while we secure your booking.'}
                </p>
              ) : null}

            </div>
          </div>
          </div>

          <div className="booking-flow__right">
            <BookingReviewPanel
              mode={mode}
              appointmentRows={appointmentRows}
              contactRows={contactRows}
              contactHelper={isCreateMode ? 'Confirmation will be sent to the provided email address.' : undefined}
              trustItems={trustItems}
              alwaysVisible
              isSubmitting={isSubmitting}
              isSubmitDisabled={isSubmitDisabled}
              onSubmit={() => void submit()}
            />
          </div>

        </div>
      </div>
    </section>
  );
}
