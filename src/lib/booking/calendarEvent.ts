import { fromZonedTime } from 'date-fns-tz';
import { addMinutes } from '@/lib/booking/time';
import { buildBookingIcs, formatIcsUtc } from '@/lib/booking/calendarIcs';

export type BookingCalendarInput = {
  shopName: string;
  location?: string | null;
  timezone: string;
  /** ISO yyyy-MM-dd in the shop timezone. */
  dateIso?: string | null;
  /** HH:mm slot in the shop timezone. */
  timeHHmm?: string | null;
  durationMinutes?: number | null;
  /** Absolute instants when already known (API). */
  startAtIso?: string | null;
  endAtIso?: string | null;
  service?: string | null;
  barber?: string | null;
  reference?: string | null;
  bookingId?: string | null;
  isDemo?: boolean;
  /** Public booking URL with no secret/token query params. */
  safeBookingUrl?: string | null;
};

export type ResolvedCalendarEvent = {
  summary: string;
  description: string;
  location?: string;
  startAt: Date;
  endAt: Date;
  uid: string;
};

export type CalendarBuildResult =
  | { ok: true; event: ResolvedCalendarEvent }
  | { ok: false; error: string };

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SECRET_QUERY =
  /(^|[?&])(token|access_token|refresh_token|session_id|sessionid|secret|sig|signature|auth|jwt|key)=/i;

function isValidIanaTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function parseIsoInstant(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Interpret a shop-local civil date+time as a UTC instant using the shop IANA zone. */
export function shopLocalToUtc(dateIso: string, timeHHmm: string, timezone: string): Date | null {
  if (!ISO_DAY.test(dateIso) || !HHMM.test(timeHHmm) || !isValidIanaTimezone(timezone)) return null;
  const stamp = `${dateIso}T${timeHHmm}:00`;
  const utc = fromZonedTime(stamp, timezone);
  return Number.isNaN(utc.getTime()) ? null : utc;
}

export function isSafePublicBookingUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url.trim(), 'https://kersivo.co.uk');
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (SECRET_QUERY.test(parsed.search) || SECRET_QUERY.test(parsed.hash)) return false;
    return true;
  } catch {
    return false;
  }
}

export function buildCalendarUid(input: Pick<BookingCalendarInput, 'reference' | 'bookingId'>): string {
  const raw = (input.reference || input.bookingId || 'appointment').trim().toLowerCase();
  const safe = raw.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'appointment';
  return `kersivo-${safe}@kersivo.co.uk`;
}

function buildDescription(input: BookingCalendarInput): string {
  const lines: string[] = [];
  if (input.isDemo) {
    lines.push('DEMO only — no real appointment was created.');
  }
  if (input.barber?.trim()) lines.push(`Barber: ${input.barber.trim()}`);
  if (input.reference?.trim()) lines.push(`Reference: ${input.reference.trim()}`);
  if (isSafePublicBookingUrl(input.safeBookingUrl)) {
    lines.push(`Booking: ${input.safeBookingUrl!.trim()}`);
  }
  return lines.join('\n');
}

function buildSummary(input: BookingCalendarInput): string {
  const service = input.service?.trim() || 'Appointment';
  const shop = input.shopName.trim() || 'Barbershop';
  const base = `${service} — ${shop}`;
  return input.isDemo ? `DEMO — ${base}` : base;
}

export function buildCalendarEvent(input: BookingCalendarInput): CalendarBuildResult {
  const shopName = input.shopName?.trim();
  if (!shopName) return { ok: false, error: 'Missing shop name for calendar event.' };
  if (!input.timezone?.trim() || !isValidIanaTimezone(input.timezone.trim())) {
    return { ok: false, error: 'Missing or invalid shop timezone.' };
  }

  let startAt = parseIsoInstant(input.startAtIso);
  let endAt = parseIsoInstant(input.endAtIso);

  if (!startAt) {
    const dateIso = input.dateIso?.trim() || '';
    const timeHHmm = input.timeHHmm?.trim() || '';
    startAt = shopLocalToUtc(dateIso, timeHHmm, input.timezone.trim());
  }

  if (!startAt) {
    return { ok: false, error: 'Could not resolve appointment start time.' };
  }

  if (!endAt) {
    const duration = input.durationMinutes;
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
      return { ok: false, error: 'Could not resolve appointment end time.' };
    }
    endAt = addMinutes(startAt, Math.floor(duration));
  }

  if (endAt.getTime() <= startAt.getTime()) {
    return { ok: false, error: 'Appointment end must be after start.' };
  }

  return {
    ok: true,
    event: {
      summary: buildSummary({ ...input, shopName }),
      description: buildDescription(input),
      location: input.location?.trim() || undefined,
      startAt,
      endAt,
      uid: buildCalendarUid(input),
    },
  };
}

export function buildGoogleCalendarUrl(event: ResolvedCalendarEvent): string {
  const dates = `${formatIcsUtc(event.startAt)}/${formatIcsUtc(event.endAt)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.summary,
    dates,
  });
  if (event.description) params.set('details', event.description);
  if (event.location) params.set('location', event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildAppointmentIcs(event: ResolvedCalendarEvent): string {
  return buildBookingIcs({
    uid: event.uid,
    summary: event.summary,
    description: event.description,
    location: event.location,
    startAt: event.startAt,
    endAt: event.endAt,
  });
}

export const ICS_FILENAME = 'kersivo-appointment.ics';
export const ICS_MIME = 'text/calendar;charset=utf-8';

/** Trigger a user-initiated .ics download in the browser. */
export function downloadAppointmentIcs(event: ResolvedCalendarEvent): void {
  const ics = buildAppointmentIcs(event);
  const blob = new Blob([ics], { type: ICS_MIME });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = ICS_FILENAME;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
