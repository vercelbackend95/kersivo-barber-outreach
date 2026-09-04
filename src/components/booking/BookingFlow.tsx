import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BookingConfirmationPanel, { type BookingSummary } from './BookingConfirmationPanel';
import BookingRecommendationsRail from './BookingRecommendationsRail';
import {
  buildAdminTimelineHref,
  type BookingFlowPresentation,
  type PostConfirmCtaConfig,
} from './bookingPresentation';
import BookingReviewPanel from './BookingReviewPanel';
import BookingStepIndicator from './BookingStepIndicator';
import { SkeletonSlotGrid } from '../skeleton';
import { ANY_BARBER_ID, ANY_BARBER_NAME } from '../../lib/booking/constants';
import { groupServicesByCategory } from '../../lib/booking/groupServicesByCategory';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { trackConsentedEvent } from '@/lib/consent/events';
import EmptyState from '../EmptyState';
import { Clock } from '../lucide-react';
import { addBlacklineSessionBooking } from '@/lib/demo/blacklineSessionBookings';
import {
  listBlacklineAvailableSlots,
  resolveBlacklineBarberForSlot,
} from '@/lib/demo/blacklineAvailability';
import { getDemoRecommendationProducts } from '@/lib/demo/recommendations';

type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  pricePence: number;
  category?: string | null;
  displayOrder?: number;
  featured?: boolean;
  description?: string | null;
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
  idempotencyKey?: string;
};

function makeBookingIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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
    depositRequired?: boolean;
    checkoutUrl?: string;
  };
  error?: string;
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
  /**
   * BLACKLINE `/demo/book` only: persist a session booking and offer fixture-backed slots.
   * Must not be set on the generic `/book` sandbox.
   */
  persistDemoSessionBooking?: boolean;
  /** Live tenant book: POST target for public create (never demo-shop). */
  publicCreateUrl?: string;
  /** Live tenant book: scopes availability to this shop (no admin session / demo fallback). */
  publicShopId?: string;
  /** When true, confirm CTA may redirect to Stripe deposit Checkout. */
  depositRequired?: boolean;
  onComplete?: () => void;
  postConfirmCta?: PostConfirmCtaConfig | null;
  /** Preselect a service from the provided catalogue. Ignored if it does not match. */
  initialServiceId?: string;
  /** Preselect a barber from the provided catalogue. Ignored if it does not match. */
  initialBarberId?: string;
  /** Host-specific copy and confirmation CTAs. Defaults keep the Kersivo `/book` sandbox. */
  presentation?: BookingFlowPresentation;
  /** Preferred category order for the service picker. Unknown keys follow default then alpha. */
  categoryOrder?: readonly string[];
};

function BookingChoiceMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`booking-choice__mark${compact ? ' booking-choice__mark--compact' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 16 16" focusable="false">
        <path
          d="M3.5 8.2 6.4 11l6.1-6.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

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

function formatPrice(pricePence: number, wholePounds = false): string {
  if (wholePounds && pricePence % 100 === 0) {
    return `£${pricePence / 100}`;
  }
  return `£${(pricePence / 100).toFixed(2)}`;
}

function resolveInitialServiceId(services: Service[], initialServiceId?: string): string {
  if (!initialServiceId) return '';
  return services.some((service) => service.id === initialServiceId) ? initialServiceId : '';
}

function barberOffersService(barber: Barber, serviceId: string): boolean {
  if (!barber.serviceIds || barber.serviceIds.length === 0) return true;
  return barber.serviceIds.includes(serviceId);
}

function resolveInitialBarberId(barbers: Barber[], initialBarberId?: string, serviceId = ''): string {
  if (!initialBarberId) return '';
  const barber = barbers.find((item) => item.id === initialBarberId);
  if (!barber) return '';
  if (serviceId && !barberOffersService(barber, serviceId)) return '';
  return barber.id;
}

function resolveInitialWizardStep(serviceId: string, barberId: string): number {
  if (serviceId && barberId) return 3;
  if (serviceId) return 2;
  return 1;
}

function makeDemoReference(prefix: string): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${n}`;
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
  persistDemoSessionBooking = false,
  publicCreateUrl,
  publicShopId,
  depositRequired = false,
  onComplete,
  postConfirmCta = null,
  initialServiceId,
  initialBarberId,
  presentation,
  categoryOrder,
}: Props) {
  const bookingTimezone = shopDetails?.timezone || DEFAULT_BOOKING_TIMEZONE;
  const resolvedInitialServiceId = resolveInitialServiceId(services, initialServiceId);
  const resolvedInitialBarberId = resolveInitialBarberId(barbers, initialBarberId, resolvedInitialServiceId);
  const [serviceId, setServiceId] = useState(resolvedInitialServiceId);
  const [barberId, setBarberId] = useState(resolvedInitialBarberId);
  const [date, setDate] = useState(() => getCurrentIsoDateInTimezone(bookingTimezone));
  const [slots, setSlots] = useState<string[]>([]);
  const [shopPaused, setShopPaused] = useState(false);
  const [shopPauseReason, setShopPauseReason] = useState<string | null>(null);
  const [time, setTime] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [brokenAvatarIds, setBrokenAvatarIds] = useState<Record<string, boolean>>({});
  const [wizardStep, setWizardStep] = useState(
    resolveInitialWizardStep(resolvedInitialServiceId, resolvedInitialBarberId),
  );
  const [stepKey, setStepKey] = useState(0);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const confirmationRef = useRef<HTMLElement | null>(null);
  const bookingShellRef = useRef<HTMLElement | null>(null);
  const stepIndicatorRef = useRef<HTMLElement | null>(null);
  const isAdvancingRef = useRef(false);
  const hasTrackedPublicDemoRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const [confirmation, setConfirmation] = useState<{
    type: 'booked' | 'rescheduled' | 'demo';
    summary: BookingSummary;
    bookingId?: string;
    serviceId?: string;
    startAt?: string;
    date?: string;
  } | null>(null);

  const isCreateMode = mode === 'create';
  const useBlacklineSessionSlots = persistDemoSessionBooking && publicDemoMode && !previewMode;
  const useStaticSlots = (previewMode || publicDemoMode) && !useBlacklineSessionSlots;
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
  const serviceGroups = useMemo(
    () => groupServicesByCategory(services, categoryOrder?.length ? { categoryOrder } : undefined),
    [services, categoryOrder],
  );
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

  const advanceFromContinue = useCallback(() => {
    if (isAdvancingRef.current) return false;
    isAdvancingRef.current = true;
    setIsAdvancing(true);
    goToStep(wizardStep + 1);

    const matchMedia =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia.bind(window)
        : null;
    const reduceMotion = matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const isMobile = matchMedia?.('(max-width: 39.99rem)').matches ?? false;
    const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = isMobile ? stepIndicatorRef.current : bookingShellRef.current;
        target?.scrollIntoView({ behavior, block: 'start' });
      });
    });
    return true;
  }, [goToStep, wizardStep]);

  useEffect(() => {
    isAdvancingRef.current = false;
    setIsAdvancing(false);
  }, [wizardStep]);

  const selectService = useCallback((id: string) => {
    setServiceId(id);
    setTime('');
    setSlots([]);
    const keepBarber = Boolean(
      barberId &&
        barbers.some((barber) => barber.id === barberId && barberOffersService(barber, id)),
    );
    if (!keepBarber) {
      setBarberId('');
    }
  }, [barberId, barbers]);

  const selectBarber = useCallback((id: string) => {
    setBarberId(id);
    setTime('');
  }, []);

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
      { label: 'Price', value: selectedService ? formatPrice(selectedService.pricePence, presentation?.wholePoundPrices) : '—' },
      ...(estimatedEndTime ? [{ label: 'Ends', value: estimatedEndTime }] : []),
    ],
    [bookingDateSummary, estimatedEndTime, normalizedDate, presentation?.wholePoundPrices, selectedBarberLabel, selectedService, time],
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
      if (persistDemoSessionBooking) {
        return [
          { label: 'No real appointment will be created' },
          { label: 'No confirmation email will be sent' },
          { label: 'Your demo details stay in this browser session and are cleared automatically' },
          { label: 'Times shown follow the Blackline owner timeline' },
        ];
      }
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
  }, [bookingTimezone, persistDemoSessionBooking, publicDemoMode, shopDetails?.cancellationWindowHours, shopDetails?.rescheduleWindowHours]);

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
    if (!barberId) return;
    if (!serviceId) return;
    if (!barberOptions.some((barber) => barber.id === barberId)) {
      setBarberId('');
      setTime('');
      setSlots([]);
    }
  }, [barberOptions, barberId, serviceId]);

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

    if (useBlacklineSessionSlots) {
      const durationMinutes = services.find((service) => service.id === serviceId)?.durationMinutes ?? 0;
      setSlots(
        listBlacklineAvailableSlots({
          date: nextDate,
          barberId,
          durationMinutes,
        }),
      );
      setTime('');
      setIsSlotsLoading(false);
      return;
    }

    setIsSlotsLoading(true);
    const availabilityUrl = publicShopId?.trim()
      ? `/api/public/bookings/${encodeURIComponent(publicShopId.trim())}/availability?serviceId=${serviceId}&barberId=${barberId}&date=${nextDate}`
      : `/api/availability?serviceId=${serviceId}&barberId=${barberId}&date=${nextDate}`;
    fetch(availabilityUrl)
      .then((res) => res.json())
      .then((data) => {
        setShopPaused(Boolean(data.paused));
        setShopPauseReason(
          typeof data.pauseReason === 'string' && data.pauseReason.trim()
            ? data.pauseReason.trim()
            : null,
        );
        setSlots(data.slots ?? []);
        setTime('');
      })
      .catch(() => {
        setShopPaused(false);
        setShopPauseReason(null);
        setSlots([]);
        setTime('');
      })
      .finally(() => {
        setIsSlotsLoading(false);
      });
  }, [serviceId, barberId, date, useStaticSlots, useBlacklineSessionSlots, publicShopId, services]);

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
        let assignedBarberId = barberId;
        let assignedBarberName = selectedBarberLabel;
        let sessionBookingId: string | undefined;
        let sessionReference: string | undefined =
          presentation?.demoReferencePrefix
            ? makeDemoReference(presentation.demoReferencePrefix)
            : undefined;

        if (persistDemoSessionBooking && selectedService) {
          const assigned = resolveBlacklineBarberForSlot({
            date: normalizedDate,
            time,
            durationMinutes: selectedService.durationMinutes,
            preferredBarberId: barberId,
          });
          if (!assigned) {
            setMessage('That time is no longer available. Please pick another slot.');
            return;
          }
          assignedBarberId = assigned.id;
          assignedBarberName = assigned.name;
          const record = addBlacklineSessionBooking({
            serviceId: selectedService.id,
            serviceName: selectedService.name,
            durationMinutes: selectedService.durationMinutes,
            pricePence: selectedService.pricePence,
            barberId: assignedBarberId,
            barberName: assignedBarberName,
            fullName: normalizedFullName,
            email: normalizedEmail,
            phone: normalizedPhone || null,
            date: normalizedDate,
            startTime: time,
            referencePrefix: presentation?.demoReferencePrefix,
          });
          sessionBookingId = record.id;
          sessionReference = record.reference;
        }

        setConfirmation({
          type: 'demo',
          summary: {
            service: selectedService?.name,
            barber: assignedBarberName,
            date: formatDateForSummary(normalizedDate, bookingTimezone),
            time,
            reference: sessionReference,
          },
          bookingId: sessionBookingId,
          serviceId: selectedService?.id,
          date: normalizedDate,
        });
        if (!presentation?.skipCompletionAnalytics && !hasTrackedPublicDemoRef.current) {
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
          serviceId,
          startAt: data.booking?.startAt,
          date: normalizedDate,
        });

        return;
      }

      if (!normalizedFullName || !normalizedEmail) {
        setMessage('Please provide your full name and email.');
        return;
      }

      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = makeBookingIdempotencyKey();
      }

      const payload: BookingCreatePayload = {
        serviceId,
        barberId,
        date: normalizedDate,
        time,
        fullName: normalizedFullName,
        email: normalizedEmail,
        idempotencyKey: idempotencyKeyRef.current,
        ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      };

      const createEndpoint = publicCreateUrl?.trim() || '/api/bookings/create';
      const res = await fetch(createEndpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Idempotency-Key': idempotencyKeyRef.current,
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as BookingApiResponse;
      if (!res.ok) {
        setMessage(data.error || 'Unable to create booking.');
        return;
      }

      idempotencyKeyRef.current = null;

      if (data.booking?.checkoutUrl) {
        window.location.assign(data.booking.checkoutUrl);
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
        serviceId,
        startAt: data.booking?.startAt,
        date: normalizedDate,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePrimaryAction() {
    if (wizardStep < maxStep) {
      if (!canContinue || isAdvancingRef.current) return;
      if (wizardStep === 3 && !isCreateMode && !previewMode) {
        void submit();
        return;
      }
      advanceFromContinue();
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
    if (depositRequired && publicCreateUrl) return 'Pay £5 deposit & book';
    return mode === 'reschedule' ? 'Reschedule booking' : 'Confirm booking';
  })();

  const primaryDisabled =
    isSubmitting ||
    isAdvancing ||
    (wizardStep < maxStep
      ? wizardStep === 3 && !isCreateMode && !previewMode
        ? isSubmitDisabled
        : !canContinue
      : isSubmitDisabled);

  const showReview = !previewMode && !confirmation && wizardStep >= 3;
  const stepCopy =
    publicDemoMode && activeStepId === 'details' ? PUBLIC_DEMO_DETAILS_COPY : STEP_COPY[activeStepId];

  if (confirmation) {
    const allowDemoCta = confirmation.type !== 'demo' || Boolean(postConfirmCta?.availableForDemo);
    const cta =
      allowDemoCta &&
      postConfirmCta?.destination === 'admin-timeline' &&
      confirmation.bookingId &&
      confirmation.date
        ? {
            label: postConfirmCta.label,
            href: buildAdminTimelineHref({
              adminBasePath: postConfirmCta.adminBasePath,
              bookingId: confirmation.bookingId,
              bookingDate: confirmation.date,
              demoJourney: Boolean(postConfirmCta.availableForDemo),
            }),
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
            demoCopy={
              publicDemoMode
                ? {
                    eyebrow: presentation?.confirmEyebrow,
                    heading: presentation?.confirmHeading,
                    body: presentation?.confirmBody,
                    ctas: presentation?.confirmCtas,
                  }
                : null
            }
          />
          {confirmation.serviceId && publicShopId && (confirmation.type === 'booked' || confirmation.type === 'rescheduled') ? (
            <BookingRecommendationsRail
              shopId={publicShopId}
              serviceId={confirmation.serviceId}
              serviceName={confirmation.summary.service}
              productHrefBase={`/shop/${publicShopId}`}
              themeId="kersivo"
              priceFormat="gbp"
            />
          ) : null}
          {confirmation.serviceId && persistDemoSessionBooking && confirmation.type === 'demo' ? (
            <BookingRecommendationsRail
              shopId="blackline-barbers-demo"
              serviceId={confirmation.serviceId}
              serviceName={confirmation.summary.service}
              productHrefBase="/demo/shop"
              themeId="blackline"
              priceFormat="demo"
              imageFallback="wordmark"
              demoProducts={getDemoRecommendationProducts(confirmation.serviceId)}
            />
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section
      ref={bookingShellRef}
      className={`surface booking-shell booking-flow booking-flow--wizard${previewMode ? ' booking-flow--preview' : ''}${publicDemoMode ? ' booking-flow--public-demo' : ''}`}
      aria-live="polite"
    >
      <div className="booking-form-content">
        <header className="booking-flow__hero">
          <div className="booking-flow__hero-copy">
            <p className="booking-flow__eyebrow">
              {presentation?.eyebrow ?? (publicDemoMode ? 'Interactive demo' : 'Instant booking')}
            </p>
            <h1>
              {presentation?.title ?? (publicDemoMode ? 'Try the booking flow' : isCreateMode ? 'Book now' : 'Reschedule')}
            </h1>
            {publicDemoMode ? (
              <p className="booking-flow__sandbox-note muted">
                {presentation?.sandboxNote ?? PUBLIC_DEMO_SANDBOX_NOTE}
              </p>
            ) : null}
          </div>
          <BookingStepIndicator ref={stepIndicatorRef} currentStep={wizardStep} steps={bookingSteps} />
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
                            const description = service.description?.trim();
                            return (
                              <button
                                type="button"
                                key={service.id}
                                role="radio"
                                className={`booking-choice booking-choice-card booking-choice-card--service${isSelected ? ' is-selected' : ''}`}
                                aria-checked={isSelected}
                                onClick={() => selectService(service.id)}
                              >
                                <span className="booking-choice-card__copy">
                                  <span className="booking-choice-card__title">{service.name}</span>
                                  {description ? (
                                    <span className="booking-choice-card__description">{description}</span>
                                  ) : null}
                                </span>
                                <span className="booking-choice-card__meta booking-choice-card__meta--service">
                                  <span className="booking-choice-card__price">{formatPrice(service.pricePence, presentation?.wholePoundPrices)}</span>
                                  <span className="booking-choice-card__stat">{service.durationMinutes} min</span>
                                  <BookingChoiceMark />
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
                            role="radio"
                            className={`booking-choice booking-choice-card booking-choice-card--barber${isSelected ? ' is-selected' : ''}${isAnyBarber ? ' booking-choice-card--any' : ''}`}
                            aria-checked={isSelected}
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
                            <BookingChoiceMark />
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
                                  role="radio"
                                  className={`booking-choice booking-slot${isSelected ? ' is-selected' : ''}`}
                                  aria-checked={isSelected}
                                  onClick={() => selectTime(slot)}
                                >
                                  <span className="booking-slot__label">{slot}</span>
                                  <BookingChoiceMark compact />
                                </button>
                              );
                            })}
                            {!canLoadAvailability ? (
                              <p className="muted booking-slots-section__empty">{slotsHelperText}</p>
                            ) : slots.length === 0 ? (
                              <EmptyState
                                icon={Clock}
                                title={shopPaused ? 'Barbershop temporarily closed' : 'No available times'}
                                description={
                                  shopPaused
                                    ? shopPauseReason ||
                                      'Bookings are paused right now. Please check back later.'
                                    : 'Try a different date or barber.'
                                }
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
                      disabled={isSubmitting || isAdvancing}
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
