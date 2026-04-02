export type BookingStatusTone = 'confirmed' | 'pending' | 'cancelled' | 'rescheduled';
export type StatusTone = BookingStatusTone | 'info' | 'neutral';

type BookingStatusInput = {
  status: string;
  rescheduledAt?: string | null;
};

/** True for Prisma `CANCELLED_BY_*` values; aligned with cancelled tone below. */
export function isCancelledBookingStatus(status: string): boolean {
  return status.startsWith('CANCELLED');
}

export function getBookingStatusTone(input: BookingStatusInput): BookingStatusTone {
  if (isCancelledBookingStatus(input.status)) return 'cancelled';
  if (input.status === 'PENDING_CONFIRMATION' || input.status === 'EXPIRED') return 'pending';
  const hasRescheduledFlag = Boolean(input.rescheduledAt) || input.status.includes('RESCHEDULED');
  if (hasRescheduledFlag) return 'rescheduled';
  if (input.status === 'CONFIRMED') return 'confirmed';
  return 'pending';
}

export type BookingStatusToneCounts = Record<BookingStatusTone, number>;

/** Counts bookings using the same tone rules as the admin timeline cards. */
export function countBookingsByStatusTone(bookings: readonly BookingStatusInput[]): BookingStatusToneCounts {
  const counts: BookingStatusToneCounts = {
    confirmed: 0,
    pending: 0,
    cancelled: 0,
    rescheduled: 0,
  };
  for (const booking of bookings) {
    counts[getBookingStatusTone(booking)] += 1;
  }
  return counts;
}

export function getStatusTextColorClass(tone: BookingStatusTone): string {
  if (tone === 'confirmed') return 'admin-status-text--confirmed';
  if (tone === 'cancelled') return 'admin-status-text--cancelled';
  if (tone === 'rescheduled') return 'admin-status-text--rescheduled';
  return 'admin-status-text--pending';
}

export function getStatusBadgeClass(tone: BookingStatusTone): string {
  return `badge badge--${tone}`;
}

/** Maps any admin status string (booking, order, barber) to a semantic tone. */
export function getStatusTone(status: string, rescheduledAt?: string | null): StatusTone {
  if (status === 'PAID') return 'info';
  if (status === 'COLLECTED') return 'confirmed';
  if (status === 'ACTIVE') return 'confirmed';
  if (status === 'INACTIVE') return 'neutral';
  return getBookingStatusTone({ status, rescheduledAt: rescheduledAt ?? null });
}

/** Returns a human-readable label for any admin status string. */
export function getStatusLabel(status: string, rescheduledAt?: string | null): string {
  if (status === 'CONFIRMED' && rescheduledAt) return 'Confirmed · Rescheduled';
  if (status === 'CONFIRMED') return 'Confirmed';
  if (status === 'CANCELLED_BY_CLIENT') return 'Cancelled by client';
  if (status === 'CANCELLED_BY_SHOP') return 'Cancelled by shop';
  if (status === 'CANCELLED_BY_ADMIN') return 'Cancelled by admin';
  if (status === 'PENDING_CONFIRMATION') return 'Pending';
  if (status === 'EXPIRED') return 'Expired';
  if (status === 'RESCHEDULED') return 'Rescheduled';
  if (status === 'PAID') return 'Paid';
  if (status === 'COLLECTED') return 'Collected';
  if (status === 'PENDING') return 'Pending';
  if (status === 'ACTIVE') return 'Active';
  if (status === 'INACTIVE') return 'Inactive';
  return status.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}
