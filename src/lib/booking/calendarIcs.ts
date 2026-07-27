/** Build a minimal RFC 5545 .ics payload for a booking appointment. */

export type BookingIcsInput = {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  startAt: Date;
  endAt: Date;
  /** When the ICS was generated (defaults to now). */
  dtStamp?: Date;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format as UTC TIMESTAMP (YYYYMMDDTHHMMSSZ). */
export function formatIcsUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  );
}

/** Escape TEXT values per RFC 5545. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n');
}

export function buildBookingIcs(input: BookingIcsInput): string {
  const stamp = input.dtStamp ?? new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KERSIVO//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(input.uid)}`,
    `DTSTAMP:${formatIcsUtc(stamp)}`,
    `DTSTART:${formatIcsUtc(input.startAt)}`,
    `DTEND:${formatIcsUtc(input.endAt)}`,
    `SUMMARY:${escapeIcsText(input.summary)}`,
  ];

  if (input.description?.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(input.description.trim())}`);
  }
  if (input.location?.trim()) {
    lines.push(`LOCATION:${escapeIcsText(input.location.trim())}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR', '');
  return lines.join('\r\n');
}
