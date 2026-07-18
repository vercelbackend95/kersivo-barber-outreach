import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BookingConfirmationPanel, { type BookingSummary } from './BookingConfirmationPanel';
import BookingReviewPanel from './BookingReviewPanel';
import BookingStepIndicator from './BookingStepIndicator';
import { SkeletonSlotGrid } from '../skeleton';
import { ANY_BARBER_ID, ANY_BARBER_NAME } from '../../lib/booking/constants';
import { groupServicesByCategory } from '../../lib/booking/groupServicesByCategory';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { trackConsentedEvent } from '@/lib/consent/events';
import EmptyState from '../EmptyState';
import { Clock } from '../lucide-react';

type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  pricePence: number;
  category?: string | null;
  displayOrder?: number;
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
    id?: string;
    barberName?: string;
    serviceName?: string;
    startAt?: string;
    status?: string;
  };
  error?: string;
};

type PostConfirmCtaConfig = {
  label: string;
  /** Private admin timeline deep-link after a test booking. */
  destination: 'admin-timeline';
};

type Props = {
  services: Service[];
  barbers: Barber[];
  mode?: 'create' | 'reschedule';
  token?: string;
  shopDetails?: ShopReviewDetails;
  /**
   * Landing "live preview" mode: hides the Details step, the sticky action bar
   * and the review/confirm panel, and never submits. Instead, `onComplete` fires
   * once service + barber + time are all chosen so the host can gate the preview.
   */
  previewMode?: boolean;
  /**
   * Public `/book` sandbox: full 4-step flow with static demo slots, local-only
   * Details completion (no API), and a demo confirmation screen.
   */
  publicDemoMode?: boolean;
  onComplete?: () => void;
  postConfirmCta?: PostConfirmCtaConfig | null;
};

const DEFAULT_BOOKING_TIMEZONE = 'Europe/London';

/** Fixed free slots for landing preview / public sandbox — no real availability fetch. */
const PREVIEW_STATIC_SLOTS = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '14:00',
  '14:30',
] as const;

const DEMO_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PUBLIC_DEMO_SANDBOX_NOTE =
  'This is a KERSIVO sandbox. No appointment will be created, no email will be sent, and the details you enter are not stored.';

type WizardStepId = 'service' | 'barber' | 'schedule' | 'details';

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
    year: 'numeric',
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
    month: 'short',
  });
}

function getCurrentIsoDateInTimezone(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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

const STEP_COPY: Record<WizardStepId, { title: string; hint: string }> = {
  service: { title: 'Choose a service', hint: 'Pick what you need' },
  barber: { title: 'Choose a barber', hint: 'Who should take you' },
  schedule: { title: 'Pick a time', hint: 'Date and available slots' },
  details: { title: 'Your details', hint: 'Where we send confirmation' },
};

const PUBLIC_DEMO_DETAILS_COPY = {
  title: 'Your details',
  hint: 'Demo only — details stay in this browser',
} as const;

export default function BookingFlow({
  services,
  barbers,
  mode = 'create',
  token = '',
  shopDetails,
  previewMode = false,
  publicDemoMode = false,
  onComplete,
  postConfirmCta = null,
}: Props) {
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
  const [wizardStep, setWizardStep] = useState(1);
  const [stepKey, setStepKey] = useState(0);
  const confirmationRef = useRef<HTMLElement | null>(null);
  const hasTrackedPublicDemoRef = useRef(false);
  const [confirmation, setConfirmation] = useState<{
    type: 'booked' | 'rescheduled' | 'demo';
    summary: BookingSummary;
    bookingId?: string;
    startAt?: string;
    date?: string;
  } | null>(null);

  const isCreateMode = mode === 'create';
  const useStaticSlots = previewMode || publicDemoMode;
  const maxStep = previewMode || !isCreateMode ? 3 : 4;
  const normalizedFullName = fullName.trim();
  const normalizedEmail = email.trim();
  const normalizedPhone = phone.trim();
  const emailLooksValid = DEMO_EMAIL_RE.test(normalizedEmail);

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
  const serviceGroups = useMemo(() => groupServicesByCategory(services), [services]);
  const selectedBarber = useMemo(() => availableBarbers.find((barber) => barber.id === barberId), [availableBarbers, barberId]);
  const selectedBarberLabel = barberId === ANY_BARBER_ID ? ANY_BARBER_NAME : selectedBarber?.name;
  const normalizedDate = normalizeToIsoDate(date);
  const bookingDateLabel = formatDateForBookingTab(date, bookingTimezone);
  const bookingDateSummary = normalizedDate ? formatDateForSummary(normalizedDate, bookingTimezone) : 'Select date';
  const minBookingDate = getCurrentIsoDateInTimezone(bookingTimezone);
  const estimatedEndTime = selectedService && time ? calculateEndTime(time, selectedService.durationMinutes) : null;
  const canLoadAvailability = Boolean(serviceId && barberId && normalizedDate);

  const bookingSteps = useMemo(
    () =>
      isCreateMode && !previewMode
        ? [{ label: 'Service' }, { label: 'Barber' }, { label: 'Schedule' }, { label: 'Details' }]
        : [{ label: 'Service' }, { label: 'Barber' }, { label: 'Schedule' }],
    [isCreateMode, previewMode],
  );

  const activeStepId: WizardStepId =
    wizardStep === 1 ? 'service' : wizardStep === 2 ? 'barber' : wizardStep === 3 ? 'schedule' : 'details';

  const goToStep = useCallback((next: number) => {
    const clamped = Math.min(Math.max(next, 1), maxStep);
    setWizardStep(clamped);
    setStepKey((key) => key + 1);
    setMessage('');
  }, [maxStep]);

  const selectService = useCallback((id: string) => {
    setServiceId(id);
    setBarberId('');
    setTime('');
    setSlots([]);
    goToStep(2);
  }, [goToStep]);

  const selectBarber = useCallback((id: string) => {
    setBarberId(id);
    setTime('');
    goToStep(3);
  }, [goToStep]);

  const selectTime = useCallback((slot: string) => {
    setTime(slot);
  }, []);

  const canContinue = useMemo(() => {
    if (wizardStep === 1) return Boolean(serviceId);
    if (wizardStep === 2) return Boolean(barberId);
    if (wizardStep === 3) return Boolean(normalizedDate && time);
    if (wizardStep === 4) {
      if (!normalizedFullName || !normalizedEmail) return false;
      if (publicDemoMode) return emailLooksValid;
      return true;
    }
    return false;
  }, [
    wizardStep,
    serviceId,
    barberId,
    normalizedDate,
    time,
    normalizedFullName,
    normalizedEmail,
    publicDemoMode,
    emailLooksValid,
  ]);

  const missingItems = useMemo(() => {
    const items: string[] = [];
    if (!serviceId) items.push('Select a service');
    if (!barberId) items.push('Choose a barber');
    if (!normalizedDate) items.push('Select a date');
    if (!time) items.push('Select a time');
    if (isCreateMode) {
      if (!normalizedFullName) items.push('Add your full name');
      if (!normalizedEmail) items.push('Add your email');
      else if (publicDemoMode && !emailLooksValid) items.push('Enter a valid email');
    }
    return items;
  }, [
    barberId,
    isCreateMode,
    normalizedDate,
    normalizedEmail,
    normalizedFullName,
    publicDemoMode,
    emailLooksValid,
    serviceId,
    time,
  ]);

  const isReadyToSubmit = missingItems.length === 0;
  const isSubmitDisabled = isSubmitting || !isReadyToSubmit;

  const compactBookingSummary = [
    selectedService?.name,
    selectedBarberLabel,
    normalizedDate
      ? new Date(`${normalizedDate}T00:00:00`).toLocaleDateString('en-GB', {
          timeZone: bookingTimezone,
          day: 'numeric',
          month: 'short',
        })
      : null,
    time || null,
  ]
    .filter(Boolean)
    .join(' · ');

  const slotsHelperText = !serviceId
    ? 'Choose a service first.'
    : !barberId
      ? 'Choose a barber to load times.'
      : !normalizedDate
        ? 'Choose a date.'
        : useStaticSlots
          ? publicDemoMode
            ? 'Demo times'
            : 'Preview times'
          : slots.length > 0
            ? 'Select a slot'
            : 'No slots this day';

  const appointmentRows = useMemo(
    () => [
      { label: 'Service', value: selectedService?.name ?? '—' },
      { label: 'Barber', value: selectedBarberLabel ?? '—' },
      { label: 'Date', value: normalizedDate ? bookingDateSummary : '—' },
      { label: 'Time', value: time || '—' },
      { label: 'Duration', value: selectedService ? `${selectedService.durationMinutes} min` : '—' },
      { label: 'Price', value: selectedService ? formatPrice(selectedService.pricePence) : '—' },
      ...(estimatedEndTime ? [{ label: 'Ends', value: estimatedEndTime }] : []),
    ],
    [bookingDateSummary, estimatedEndTime, normalizedDate, selectedBarberLabel, selectedService, time],
  );

  const contactRows = useMemo(
    () => [
      { label: 'Name', value: normalizedFullName || '—' },
      { label: 'Email', value: normalizedEmail || '—' },
      { label: 'Phone', value: normalizedPhone || 'Optional' },
    ],
    [normalizedEmail, normalizedFullName, normalizedPhone],
  );

  const trustItems = useMemo(() => {
    if (publicDemoMode) {
      return [
        { label: 'No appointment will be created' },
        { label: 'No confirmation email will be sent' },
        { label: 'Your details are not stored' },
        { label: 'Times shown are for demonstration only' },
      ];
    }

    const items = [
      { label: 'Instant confirmation by email' },
      { label: 'Reschedule and cancel links included' },
      { label: 'Times in shop local time', value: formatTimezoneLabel(bookingTimezone) },
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
  }, [bookingTimezone, publicDemoMode, shopDetails?.cancellationWindowHours, shopDetails?.rescheduleWindowHours]);

  useEffect(() => {
    if (!confirmation) return;
    confirmationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [confirmation]);

  const hasFiredCompleteRef = useRef(false);
  useEffect(() => {
    if (!previewMode) return;
    if (serviceId && barberId && time && !hasFiredCompleteRef.current) {
      hasFiredCompleteRef.current = true;
      onComplete?.();
    }
  }, [previewMode, serviceId, barberId, time, onComplete]);

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

    if (useStaticSlots) {
      setSlots([...PREVIEW_STATIC_SLOTS]);
      setTime('');
      setIsSlotsLoading(false);
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
  }, [serviceId, barberId, date, useStaticSlots]);

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

    if (publicDemoMode) {
      if (!normalizedFullName || !normalizedEmail) {
        setMessage('Please provide your full name and email.');
        return;
      }
      if (!emailLooksValid) {
        setMessage('Please enter a valid email address.');
        return;
      }

      setIsSubmitting(true);
      try {
        setConfirmation({
          type: 'demo',
          summary: {
            service: selectedService?.name,
            barber: selectedBarberLabel,
            date: formatDateForSummary(normalizedDate, bookingTimezone),
            time,
          },
          date: normalizedDate,
        });
        if (!hasTrackedPublicDemoRef.current) {
          hasTrackedPublicDemoRef.current = true;
          trackConsentedEvent(FUNNEL_EVENTS.public_demo_completed, undefined, 'analytics');
        }
      } finally {
        setIsSubmitting(false);
      }
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
          time,
        };

        const res = await fetch('/api/bookings/reschedule', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
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
            time,
          },
          bookingId: data.booking?.id,
          startAt: data.booking?.startAt,
          date: normalizedDate,
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
        ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      };

      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
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
          time,
        },
        bookingId: data.booking?.id,
        startAt: data.booking?.startAt,
        date: normalizedDate,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePrimaryAction() {
    if (wizardStep < maxStep) {
      if (!canContinue) return;
      if (wizardStep === 3 && !isCreateMode && !previewMode) {
        void submit();
        return;
      }
      goToStep(wizardStep + 1);
      return;
    }
    void submit();
  }

  const primaryLabel = (() => {
    if (isSubmitting) {
      return mode === 'reschedule' ? 'Rescheduling…' : publicDemoMode ? 'Completing…' : 'Confirming…';
    }
    if (wizardStep === 3 && !isCreateMode && !previewMode) {
      return 'Reschedule booking';
    }
    if (wizardStep < maxStep) return 'Continue';
    if (publicDemoMode) return 'Complete demo booking';
    return mode === 'reschedule' ? 'Reschedule booking' : 'Confirm booking';
  })();

  const primaryDisabled =
    isSubmitting ||
    (wizardStep < maxStep
      ? wizardStep === 3 && !isCreateMode && !previewMode
        ? isSubmitDisabled
        : !canContinue
      : isSubmitDisabled);

  const showReview = !previewMode && !confirmation && wizardStep >= 3;
  const stepCopy =
    publicDemoMode && activeStepId === 'details' ? PUBLIC_DEMO_DETAILS_COPY : STEP_COPY[activeStepId];

  if (confirmation) {
    const cta =
      confirmation.type !== 'demo' &&
      postConfirmCta?.destination === 'admin-timeline' &&
      confirmation.bookingId &&
      confirmation.date
        ? {
            label: postConfirmCta.label,
            href: `/admin?section=bookings_dashboard&bookingId=${encodeURIComponent(confirmation.bookingId)}&bookingDate=${encodeURIComponent(confirmation.date)}`,
          }
        : null;

    return (
      <section className="surface booking-shell booking-flow booking-flow--wizard" aria-live="polite">
        <div className="booking-form-content">
          <BookingConfirmationPanel
            ref={confirmationRef}
            variant={confirmation.type}
            summary={confirmation.summary}
            postConfirmCta={cta}
          />
        </div>
      </section>
    );
  }

  return (
    <section
      className={`surface booking-shell booking-flow booking-flow--wizard${previewMode ? ' booking-flow--preview' : ''}${publicDemoMode ? ' booking-flow--public-demo' : ''}`}
      aria-live="polite"
    >
      <div className="booking-form-content">
        <header className="booking-flow__hero">
          <div className="booking-flow__hero-copy">
            <p className="booking-flow__eyebrow">{publicDemoMode ? 'Interactive demo' : 'Instant booking'}</p>
            <h1>{publicDemoMode ? 'Try the booking flow' : isCreateMode ? 'Book now' : 'Reschedule'}</h1>
            {publicDemoMode ? <p className="booking-flow__sandbox-note muted">{PUBLIC_DEMO_SANDBOX_NOTE}</p> : null}
          </div>
          <BookingStepIndicator currentStep={wizardStep} steps={bookingSteps} />
        </header>

        {message ? <p className="admin-inline-error">{message}</p> : null}

        <div className="booking-flow__layout">
          <div className="booking-flow__left">
            <div className="booking-flow__main">
              {compactBookingSummary && wizardStep > 1 ? (
                <p className="booking-flow__picks" aria-live="polite">
                  {compactBookingSummary}
                </p>
              ) : null}

              <div key={stepKey} className="booking-step booking-step--active is-revealing" data-step={activeStepId}>
                <div className="booking-step__head">
                  <div className="booking-step__title">
                    <h2 id={`booking-step-${activeStepId}`}>{stepCopy.title}</h2>
                    <p className="muted">{stepCopy.hint}</p>
                  </div>
                </div>

                {activeStepId === 'service' ? (
                  <div className="booking-service-catalog" role="radiogroup" aria-label="Services">
                    {serviceGroups.map((group) => (
                      <section
                        key={group.category}
                        className="booking-service-category"
                        aria-labelledby={`booking-service-category-${group.category}`}
                      >
                        <h3
                          id={`booking-service-category-${group.category}`}
                          className="booking-service-category__heading"
                        >
                          {group.label}
                        </h3>
                        <div className="booking-choice-grid booking-choice-grid--services">
                          {group.services.map((service) => {
                            const isSelected = service.id === serviceId;
                            return (
                              <button
                                type="button"
                                key={service.id}
                                className={`booking-choice-card booking-choice-card--service${isSelected ? ' is-selected' : ''}`}
                                aria-pressed={isSelected}
                                onClick={() => selectService(service.id)}
                              >
                                <span className="booking-choice-card__title">{service.name}</span>
                                <span className="booking-choice-card__meta booking-choice-card__meta--service">
                                  <span className="booking-choice-card__stat">{service.durationMinutes} min</span>
                                  <span className="booking-choice-card__price">{formatPrice(service.pricePence)}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : null}

                {activeStepId === 'barber' ? (
                  <>
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
                            className={`booking-choice-card booking-choice-card--barber${isSelected ? ' is-selected' : ''}${isAnyBarber ? ' booking-choice-card--any' : ''}`}
                            aria-pressed={isSelected}
                            onClick={() => selectBarber(barber.id)}
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
                              {isAnyBarber ? <span className="booking-choice-card__helper">Fastest available</span> : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {!serviceId ? (
                      <p className="muted">Choose a service first.</p>
                    ) : availableBarbers.length === 0 ? (
                      <p className="muted">No barbers offer this service right now.</p>
                    ) : null}
                  </>
                ) : null}

                {activeStepId === 'schedule' ? (
                  <>
                    <div className="booking-date-panel">
                      <div className="booking-flow__field booking-flow__field--date">
                        <label
                          className="booking-date-tab"
                          htmlFor="booking-date"
                          aria-label={`Select date, currently ${bookingDateLabel}`}
                        >
                          <span className="booking-date-tab__main">{bookingDateLabel}</span>
                          <span className="booking-date-tab__calendar" aria-hidden="true">
                            <svg viewBox="0 0 24 24" focusable="false">
                              <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm13 8H4v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8ZM5 6a1 1 0 0 0-1 1v1h16V7a1 1 0 0 0-1-1H5Z" />
                            </svg>
                          </span>
                          <input
                            id="booking-date"
                            type="date"
                            className="booking-date-tab__input"
                            value={date}
                            min={minBookingDate}
                            onChange={(event) => setDate(event.target.value)}
                            aria-label="Select booking date"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="booking-slots-section">
                      <div className="booking-slots-section__head">
                        <label id="booking-time-slots">Available times</label>
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
                                  onClick={() => selectTime(slot)}
                                >
                                  <span className="booking-slot__label">{slot}</span>
                                </button>
                              );
                            })}
                            {!canLoadAvailability ? (
                              <p className="muted booking-slots-section__empty">{slotsHelperText}</p>
                            ) : slots.length === 0 ? (
                              <EmptyState
                                icon={Clock}
                                title="No available times"
                                description="Try a different date or barber."
                              />
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}

                {activeStepId === 'details' ? (
                  <form
                    id="booking-details-form"
                    className="booking-flow__grid booking-flow__grid--details"
                    autoComplete="on"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submit();
                    }}
                  >
                    <label className="booking-flow__field" htmlFor="booking-full-name">
                      <span>Name</span>
                      <input
                        id="booking-full-name"
                        name="name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        autoComplete="name"
                        placeholder="Your full name"
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
                        placeholder="you@email.com"
                      />
                    </label>
                    <label className="booking-flow__field" htmlFor="booking-phone">
                      <span>Phone <em>(optional)</em></span>
                      <input
                        id="booking-phone"
                        name="tel"
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        autoComplete="tel"
                        placeholder="Mobile number"
                      />
                    </label>
                  </form>
                ) : null}
              </div>

              {!previewMode ? (
                <div className={`booking-action-bar${isSubmitting ? ' is-submitting' : ''}`} aria-live="polite">
                  {compactBookingSummary ? (
                    <div className="booking-action-bar__summary">
                      <strong>{compactBookingSummary}</strong>
                    </div>
                  ) : null}
                  <div className="booking-action-bar__nav">
                    {wizardStep > 1 ? (
                      <button
                        type="button"
                        className="btn btn--secondary booking-action-bar__back"
                        onClick={() => goToStep(wizardStep - 1)}
                        disabled={isSubmitting}
                      >
                        Back
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn--primary booking-action-bar__button"
                      disabled={primaryDisabled}
                      aria-disabled={primaryDisabled}
                      aria-busy={isSubmitting}
                      onClick={handlePrimaryAction}
                    >
                      {isSubmitting ? <span className="booking-action-bar__spinner" aria-hidden="true" /> : null}
                      <span>{primaryLabel}</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {showReview ? (
            <div className="booking-flow__right">
              <BookingReviewPanel
                mode={mode}
                appointmentRows={appointmentRows}
                contactRows={contactRows}
                contactHelper={
                  publicDemoMode
                    ? 'Demo only — details stay in this browser'
                    : isCreateMode
                      ? 'Confirmation goes to your email.'
                      : undefined
                }
                trustItems={trustItems}
                maxTrustItems={publicDemoMode ? 4 : 3}
                submitLabel={publicDemoMode ? 'Complete demo booking' : undefined}
                alwaysVisible
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
