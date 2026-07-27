import { describe, expect, it } from 'vitest';
import { buildBookingIcs, escapeIcsText, formatIcsUtc } from './calendarIcs';

describe('calendarIcs', () => {
  it('formats UTC timestamps for DTSTART/DTEND', () => {
    const date = new Date(Date.UTC(2026, 6, 28, 12, 45, 0));
    expect(formatIcsUtc(date)).toBe('20260728T124500Z');
  });

  it('escapes TEXT special characters', () => {
    expect(escapeIcsText('Cut; fade, with\nnotes')).toBe('Cut\\; fade\\, with\\nnotes');
  });

  it('builds a VEVENT with summary, times, and location', () => {
    const ics = buildBookingIcs({
      uid: 'kersivo-booking-abc@kersivo.co.uk',
      summary: 'Kids Haircut — Plus Barbershop',
      description: 'Line one\nLine two',
      location: 'Plus Barbershop',
      startAt: new Date(Date.UTC(2026, 6, 28, 12, 45, 0)),
      endAt: new Date(Date.UTC(2026, 6, 28, 13, 15, 0)),
      dtStamp: new Date(Date.UTC(2026, 6, 27, 16, 0, 0)),
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:kersivo-booking-abc@kersivo.co.uk');
    expect(ics).toContain('DTSTART:20260728T124500Z');
    expect(ics).toContain('DTEND:20260728T131500Z');
    expect(ics).toContain('SUMMARY:Kids Haircut — Plus Barbershop');
    expect(ics).toContain('LOCATION:Plus Barbershop');
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two');
    expect(ics.endsWith('\r\n')).toBe(true);
  });
});
