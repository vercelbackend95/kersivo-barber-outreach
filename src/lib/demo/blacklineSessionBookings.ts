import type { DemoDayBooking } from '@/lib/admin/demoFixtures/daySchedule';
import { atDayMinute } from '@/lib/admin/blacklineDemoFixtures/time';

export const BLACKLINE_SESSION_BOOKINGS_KEY = 'kersivo.blackline.session-bookings.v1';
export const BLACKLINE_SESSION_BOOKING_SOURCE = 'blackline-demo-session' as const;
export const BLACKLINE_SESSION_BOOKING_TAG = 'YOUR DEMO BOOKING';
export const BLACKLINE_SESSION_BOOKING_TTL_MS = 24 * 60 * 60 * 1000;

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const REFERENCE_RE = /^[A-Z]{2}-\d{4}$/;

export type BlacklineSessionBooking = {
  id: string;
  reference: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  pricePence: number;
  barberId: string;
  barberName: string;
  fullName: string;
  email: string;
  phone: string | null;
  date: string;
  startTime: string;
  startAt: string;
  endAt: string;
  status: 'BOOKED';
  createdAt: string;
  source: typeof BLACKLINE_SESSION_BOOKING_SOURCE;
};

export type BlacklineSessionBookingInput = {
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  pricePence: number;
  barberId: string;
  barberName: string;
  fullName: string;
  email: string;
  phone?: string | null;
  date: string;
  startTime: string;
  referencePrefix?: string;
  now?: Date;
};

function getSessionStorage(): Storage | null {
  try {
    if (typeof globalThis === 'undefined' || !('sessionStorage' in globalThis)) return null;
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

export function createCollisionResistantId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `bl-session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function makeBlacklineDemoReference(prefix = 'BL'): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${n}`;
}

export function parseHhMmToMinutes(time: string): number | null {
  if (!TIME_RE.test(time)) return null;
  const [hoursText, minutesText] = time.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isBlacklineSessionBooking(value: unknown): value is BlacklineSessionBooking {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (!isNonEmptyString(row.id)) return false;
  if (typeof row.reference !== 'string' || !REFERENCE_RE.test(row.reference)) return false;
  if (!isNonEmptyString(row.serviceId) || !isNonEmptyString(row.serviceName)) return false;
  if (typeof row.durationMinutes !== 'number' || !Number.isInteger(row.durationMinutes) || row.durationMinutes <= 0) {
    return false;
  }
  if (typeof row.pricePence !== 'number' || !Number.isInteger(row.pricePence) || row.pricePence < 0) {
    return false;
  }
  if (!isNonEmptyString(row.barberId) || !isNonEmptyString(row.barberName)) return false;
  if (!isNonEmptyString(row.fullName) || !isNonEmptyString(row.email)) return false;
  if (row.phone != null && typeof row.phone !== 'string') return false;
  if (typeof row.date !== 'string' || !DAY_KEY_RE.test(row.date)) return false;
  if (typeof row.startTime !== 'string' || parseHhMmToMinutes(row.startTime) == null) return false;
  if (!isNonEmptyString(row.startAt) || !isNonEmptyString(row.endAt)) return false;
  if (row.status !== 'BOOKED') return false;
  if (!isNonEmptyString(row.createdAt)) return false;
  if (row.source !== BLACKLINE_SESSION_BOOKING_SOURCE) return false;
  return true;
}

function isFresh(row: BlacklineSessionBooking, nowMs: number): boolean {
  const createdMs = Date.parse(row.createdAt);
  if (!Number.isFinite(createdMs)) return false;
  return nowMs - createdMs <= BLACKLINE_SESSION_BOOKING_TTL_MS;
}

function readRawList(): unknown[] {
  const storage = getSessionStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(BLACKLINE_SESSION_BOOKINGS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(rows: BlacklineSessionBooking[]): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(BLACKLINE_SESSION_BOOKINGS_KEY, JSON.stringify(rows));
  } catch {
    // Quota or private-mode — ignore; the in-memory caller still has the record.
  }
}

function persistValidated(now = new Date()): BlacklineSessionBooking[] {
  const nowMs = now.getTime();
  const incoming = readRawList();
  const valid = incoming.filter(isBlacklineSessionBooking).filter((row) => isFresh(row, nowMs));
  if (valid.length !== incoming.length) writeList(valid);
  return valid;
}

export function listBlacklineSessionBookings(now = new Date()): BlacklineSessionBooking[] {
  return persistValidated(now);
}

export function getBlacklineSessionBooking(
  id: string,
  now = new Date(),
): BlacklineSessionBooking | null {
  return persistValidated(now).find((row) => row.id === id) ?? null;
}

export function isBlacklineSessionBookingId(id: string, now = new Date()): boolean {
  return getBlacklineSessionBooking(id, now) != null;
}

export function buildBlacklineSessionBooking(
  input: BlacklineSessionBookingInput,
): BlacklineSessionBooking {
  const startMinute = parseHhMmToMinutes(input.startTime);
  if (!DAY_KEY_RE.test(input.date) || startMinute == null) {
    throw new Error('Invalid BLACKLINE session booking date or time.');
  }
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0) {
    throw new Error('Invalid BLACKLINE session booking duration.');
  }

  const prefix = (input.referencePrefix ?? 'BL').replace(/[^A-Z]/gi, '').slice(0, 2).toUpperCase() || 'BL';
  const phone = input.phone?.trim() ? input.phone.trim() : null;
  const now = input.now ?? new Date();

  return {
    id: createCollisionResistantId(),
    reference: makeBlacklineDemoReference(prefix),
    serviceId: input.serviceId,
    serviceName: input.serviceName,
    durationMinutes: input.durationMinutes,
    pricePence: input.pricePence,
    barberId: input.barberId,
    barberName: input.barberName,
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    phone,
    date: input.date,
    startTime: input.startTime,
    startAt: atDayMinute(input.date, startMinute),
    endAt: atDayMinute(input.date, startMinute + input.durationMinutes),
    status: 'BOOKED',
    createdAt: now.toISOString(),
    source: BLACKLINE_SESSION_BOOKING_SOURCE,
  };
}

export function saveBlacklineSessionBooking(
  booking: BlacklineSessionBooking,
  now = new Date(),
): BlacklineSessionBooking {
  if (!isBlacklineSessionBooking(booking)) {
    throw new Error('Refusing to persist a malformed BLACKLINE session booking.');
  }
  const existing = persistValidated(now).filter((row) => row.id !== booking.id);
  const next = [...existing, booking];
  writeList(next);
  return booking;
}

export function addBlacklineSessionBooking(
  input: BlacklineSessionBookingInput,
): BlacklineSessionBooking {
  return saveBlacklineSessionBooking(buildBlacklineSessionBooking(input), input.now);
}

export function toAdminBooking(row: BlacklineSessionBooking): DemoDayBooking {
  return {
    id: row.id,
    serviceId: row.serviceId,
    barberId: row.barberId,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    clientId: null,
    startAt: row.startAt,
    endAt: row.endAt,
    status: 'BOOKED',
    notes: null,
    rescheduledAt: null,
    paymentRequired: false,
    depositAmountPence: null,
    paymentStatus: 'NOT_REQUIRED',
    totalPricePence: row.pricePence,
    serviceNameAtBooking: row.serviceName,
    servicePricePenceAtBooking: row.pricePence,
    barber: { name: row.barberName },
    service: { id: row.serviceId, name: row.serviceName },
    clientTags: [BLACKLINE_SESSION_BOOKING_TAG],
  };
}

export function mergeBlacklineSessionBookings<T extends { id?: string; startAt?: string }>(
  seeded: readonly T[],
  dayKey: string,
  now = new Date(),
): Array<T | DemoDayBooking> {
  const extras = persistValidated(now)
    .filter((row) => row.date === dayKey)
    .filter((row) => !seeded.some((entry) => entry.id === row.id))
    .map(toAdminBooking);

  if (extras.length === 0) return [...seeded];

  return [...seeded, ...extras].sort((a, b) => {
    const aStart = typeof a.startAt === 'string' ? Date.parse(a.startAt) : 0;
    const bStart = typeof b.startAt === 'string' ? Date.parse(b.startAt) : 0;
    return aStart - bStart;
  });
}
