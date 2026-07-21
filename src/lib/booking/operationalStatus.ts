const HOUR_MS = 60 * 60 * 1000;

/** Day-of operational statuses available to Barber (and Owner/Manager). */
export const DAY_OF_BOOKING_ACTIONS = ['ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW'] as const;
export type DayOfBookingAction = (typeof DAY_OF_BOOKING_ACTIONS)[number];

/** Shop-management actions (Owner/Manager only). */
export const SHOP_BOOKING_ACTIONS = ['CANCELLED_BY_SHOP', 'RESCHEDULE'] as const;
export type ShopBookingAction = (typeof SHOP_BOOKING_ACTIONS)[number];

export const MANUAL_BOOKING_ACTIONS = [
  ...DAY_OF_BOOKING_ACTIONS,
  ...SHOP_BOOKING_ACTIONS,
] as const;
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
  // Explicit day-of overrides — do not rewrite from clock.
  'ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
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

export function canMarkBookingArrived(input: BookingTimingInput): boolean {
  const endMs = toMs(input.endAt);
  const nowMs = input.nowMs ?? Date.now();
  if (!isFiniteDateMs(endMs)) return false;
  // Allow early check-in until appointment end.
  return nowMs < endMs;
}

export function canMarkBookingInProgress(input: BookingTimingInput): boolean {
  const startMs = toMs(input.startAt);
  const nowMs = input.nowMs ?? Date.now();
  if (!isFiniteDateMs(startMs)) return false;
  return nowMs >= startMs;
}

export function canMarkBookingCompleted(input: BookingTimingInput): boolean {
  return canMarkBookingInProgress(input);
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

export function isDayOfBookingAction(value: string): value is DayOfBookingAction {
  return (DAY_OF_BOOKING_ACTIONS as readonly string[]).includes(value);
}

export function isShopBookingAction(value: string): value is ShopBookingAction {
  return (SHOP_BOOKING_ACTIONS as readonly string[]).includes(value);
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

export type BookingActionRoleScope = 'barber' | 'shop';

export function getAllowedManualBookingActions(
  input: BookingTimingInput,
  roleScope: BookingActionRoleScope = 'shop',
): ManualBookingAction[] {
  return getManualBookingActionOptions(input, roleScope)
    .filter((option) => option.enabled)
    .map((option) => option.value);
}

export function getManualBookingActionOptions(
  input: BookingTimingInput,
  roleScope: BookingActionRoleScope = 'shop',
): ManualBookingActionOption[] {
  const arrivedEnabled = canMarkBookingArrived(input);
  const inProgressEnabled = canMarkBookingInProgress(input);
  const completedEnabled = canMarkBookingCompleted(input);
  const noShowEnabled = canMarkBookingNoShow(input);
  const cancelEnabled = canCancelBookingByShop(input);
  const rescheduleEnabled = canRescheduleBooking(input);

  const dayOf: ManualBookingActionOption[] = [
    {
      value: 'ARRIVED',
      label: 'Arrived',
      enabled: arrivedEnabled,
      reason: arrivedEnabled
        ? 'Available until the appointment end time.'
        : 'Unavailable after the appointment end time.',
    },
    {
      value: 'IN_PROGRESS',
      label: 'In progress',
      enabled: inProgressEnabled,
      reason: inProgressEnabled
        ? 'Available from booking start onward.'
        : 'Available once booking start time is reached.',
    },
    {
      value: 'COMPLETED',
      label: 'Completed',
      enabled: completedEnabled,
      reason: completedEnabled
        ? 'Available from booking start onward.'
        : 'Available once booking start time is reached.',
    },
    {
      value: 'NO_SHOW',
      label: 'No Show',
      enabled: noShowEnabled,
      reason: noShowEnabled
        ? 'Available from booking start onward.'
        : 'Available once booking start time is reached.',
    },
  ];

  if (roleScope === 'barber') return dayOf;

  return [
    ...dayOf,
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
