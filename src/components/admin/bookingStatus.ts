export type BookingStatusTone = 'confirmed' | 'pending' | 'cancelled' | 'rescheduled';

type BookingStatusInput = {
  status: string;
  rescheduledAt?: string | null;
};

export function getBookingStatusTone(input: BookingStatusInput): BookingStatusTone {
  if (input.status.startsWith('CANCELLED')) return 'cancelled';
  if (input.status === 'PENDING_CONFIRMATION' || input.status === 'EXPIRED') return 'pending';
  const hasRescheduledFlag = Boolean(input.rescheduledAt) || input.status.includes('RESCHEDULED');
  if (hasRescheduledFlag) return 'rescheduled';
  if (input.status === 'CONFIRMED') return 'confirmed';
  return 'pending';
}

export function getStatusTextColorClass(tone: BookingStatusTone): string {
  if (tone === 'confirmed') return 'text-[var(--status-confirmed)]';
  if (tone === 'cancelled') return 'text-[var(--status-cancelled)]';
  if (tone === 'rescheduled') return 'text-[var(--status-rescheduled)]';
  return 'text-[var(--status-pending)]';
}
