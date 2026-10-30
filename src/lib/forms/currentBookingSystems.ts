/**
 * Current booking-system options for public forms (contact + free preview).
 * One list, one set of stored values, one set of labels.
 */

export const CURRENT_BOOKING_SYSTEMS = [
  { value: 'booksy', label: 'Booksy' },
  { value: 'fresha', label: 'Fresha' },
  { value: 'treatwell', label: 'Treatwell' },
  { value: 'nearcut', label: 'Nearcut' },
  { value: 'setora', label: 'Setora' },
  { value: 'square', label: 'Square' },
  { value: 'other-platform', label: 'Other booking platform' },
  { value: 'mixed-manual', label: 'Manual bookings / mixed tools' },
  { value: 'none', label: 'No booking system' },
] as const;

export type CurrentBookingSystemValue = (typeof CURRENT_BOOKING_SYSTEMS)[number]['value'];

export const CURRENT_BOOKING_SYSTEM_VALUES = CURRENT_BOOKING_SYSTEMS.map(
  (option) => option.value,
) as [CurrentBookingSystemValue, ...CurrentBookingSystemValue[]];

export const CURRENT_BOOKING_SYSTEM_VALUE_SET = new Set<string>(CURRENT_BOOKING_SYSTEM_VALUES);

/** Values stored on free-preview requests before the shared list. */
const LEGACY_BOOKING_SYSTEM_LABELS: Record<string, string> = {
  other: 'Other booking platform',
};

export function currentBookingSystemLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return (
    CURRENT_BOOKING_SYSTEMS.find((option) => option.value === value)?.label ??
    LEGACY_BOOKING_SYSTEM_LABELS[value] ??
    value
  );
}
