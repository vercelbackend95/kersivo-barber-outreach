const HOUR_MS = 60 * 60 * 1000;

export const MANUAL_BOOKING_ACTIONS = ['NO_SHOW', 'CANCELLED_BY_SHOP', 'RESCHEDULE'] as const;
export type ManualBookingAction = (typeof MANUAL_BOOKING_ACTIONS)[number];
export const HISTORY_BOOKING_CORRECTIONS = [
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED_BY_CLIENT',
  'CANCELLED_BY_SHOP',
] as const;
export type HistoryBookingCorrection = (typeof HISTORY_BOOKING_CORRECTIONS)[number];
export type ManualBookingActionOption = {
  value: ManualBookingAction;
  label: string;
  enabled: boolean;
  reason: string;
};

type BookingTimingInput = {
  startAt: Date | string;
  endAt: Date | string;
  nowMs?: number;
};

type EffectiveStatusInput = BookingTimingInput & {
  status: string;
};

const TERMINAL_OR_MANUAL_STATUSES = new Set([
  'CANCELLED_BY_CLIENT',
  'CANCELLED_BY_ADMIN',
  'CANCELLED_BY_SHOP',
  'NO_SHOW',
  'RESCHEDULED',
  'EXPIRED',
]);

function toMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function isFiniteDateMs(value: number): boolean {
  return Number.isFinite(value);
}

export function getEffectiveBookingStatus(input: EffectiveStatusInput): string {
  const startMs = toMs(input.startAt);
  const endMs = toMs(input.endAt);
  const nowMs = input.nowMs ?? Date.now();
  if (!isFiniteDateMs(startMs) || !isFiniteDateMs(endMs) || endMs <= startMs) return input.status;
  if (TERMINAL_OR_MANUAL_STATUSES.has(input.status)) return input.status;
  if (nowMs < startMs) return 'BOOKED';
  if (nowMs >= endMs) return 'COMPLETED';
  return 'IN_PROGRESS';
}

export function canMarkBookingNoShow(input: BookingTimingInput): boolean {
  const startMs = toMs(input.startAt);
  const nowMs = input.nowMs ?? Date.now();
  if (!isFiniteDateMs(startMs)) return false;
  return nowMs >= startMs;
}

export function canCancelBookingByShop(input: BookingTimingInput): boolean {
  const startMs = toMs(input.startAt);
  const nowMs = input.nowMs ?? Date.now();
  if (!isFiniteDateMs(startMs)) return false;
  return startMs - nowMs > HOUR_MS;
}

export function canRescheduleBooking(input: BookingTimingInput): boolean {
  return canCancelBookingByShop(input);
}

export function isManualBookingAction(value: string): value is ManualBookingAction {
  return (MANUAL_BOOKING_ACTIONS as readonly string[]).includes(value);
}

export function isHistoryBookingCorrection(value: string): value is HistoryBookingCorrection {
  return (HISTORY_BOOKING_CORRECTIONS as readonly string[]).includes(value);
}

export function canCorrectHistoryBooking(input: BookingTimingInput & { status: string }): boolean {
  const endMs = toMs(input.endAt);
  const nowMs = input.nowMs ?? Date.now();
  if (!isFiniteDateMs(endMs)) return false;
  if (nowMs >= endMs) return true;
  return input.status === 'NO_SHOW' || input.status.startsWith('CANCELLED_BY_');
}

export function getAllowedManualBookingActions(input: BookingTimingInput): ManualBookingAction[] {
  return getManualBookingActionOptions(input)
    .filter((option) => option.enabled)
    .map((option) => option.value);
}

export function getManualBookingActionOptions(input: BookingTimingInput): ManualBookingActionOption[] {
  const noShowEnabled = canMarkBookingNoShow(input);
  const cancelEnabled = canCancelBookingByShop(input);
  const rescheduleEnabled = canRescheduleBooking(input);
  return [
    {
      value: 'NO_SHOW',
      label: 'No Show',
      enabled: noShowEnabled,
      reason: noShowEnabled
        ? 'Available from booking start onward.'
        : 'Available once booking start time is reached.',
    },
    {
      value: 'CANCELLED_BY_SHOP',
      label: 'Cancel by shop',
      enabled: cancelEnabled,
      reason: cancelEnabled
        ? 'Available only more than 1 hour before booking start.'
        : 'Unavailable now: allowed only more than 1 hour before start.',
    },
    {
      value: 'RESCHEDULE',
      label: 'Reschedule',
      enabled: rescheduleEnabled,
      reason: rescheduleEnabled
        ? 'Available only more than 1 hour before booking start.'
        : 'Unavailable now: allowed only more than 1 hour before start.',
    },
  ];
}
