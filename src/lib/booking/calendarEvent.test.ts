import { describe, expect, it } from 'vitest';
import {
  buildAppointmentIcs,
  buildCalendarEvent,
  buildCalendarUid,
  buildGoogleCalendarUrl,
  isSafePublicBookingUrl,
  shopLocalToUtc,
} from './calendarEvent';

const baseInput = {
  shopName: 'Blackline Barbers',
  location: 'Northern Quarter, Manchester',
  timezone: 'Europe/London',
  dateIso: '2026-09-07',
  timeHHmm: '18:15',
  durationMinutes: 35,
  service: 'Skin Fade',
  barber: 'Ellis Ward',
  reference: 'BL-7623',
  bookingId: 'session-abc',
} as const;

describe('calendarEvent', () => {
  it('resolves shop-local start/end to UTC using the shop IANA timezone', () => {
    const start = shopLocalToUtc('2026-09-07', '18:15', 'Europe/London');
    expect(start).not.toBeNull();
    // BST in September: 18:15 London = 17:15 UTC
    expect(start!.toISOString()).toBe('2026-09-07T17:15:00.000Z');
  });

  it('builds a Google Calendar URL without customer PII or unsafe tokens', () => {
    const built = buildCalendarEvent({
      ...baseInput,
      isDemo: true,
      safeBookingUrl: 'https://kersivo.co.uk/demo/book',
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const url = buildGoogleCalendarUrl(built.event);
    expect(url.startsWith('https://calendar.google.com/calendar/render?')).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get('action')).toBe('TEMPLATE');
    expect(params.get('text')).toBe('DEMO — Skin Fade — Blackline Barbers');
    expect(params.get('dates')).toBe('20260907T171500Z/20260907T175000Z');
    expect(params.get('location')).toBe('Northern Quarter, Manchester');
    expect(params.get('details') || '').toContain('DEMO only');
    expect(params.get('details') || '').toContain('Reference: BL-7623');
    expect(url.toLowerCase()).not.toContain('email');
    expect(url.toLowerCase()).not.toContain('@example.com');
    expect(url.toLowerCase()).not.toContain('token=');
    expect(url.toLowerCase()).not.toContain('access_token');
  });

  it('rejects unsafe booking URLs with secret-like query params', () => {
    expect(isSafePublicBookingUrl('https://kersivo.co.uk/book?token=abc')).toBe(false);
    expect(isSafePublicBookingUrl('https://kersivo.co.uk/demo/book')).toBe(true);
  });

  it('builds ICS with CRLF, UTC times, escaping, and stable UID', () => {
    const built = buildCalendarEvent({
      ...baseInput,
      isDemo: true,
      service: 'Cut; fade, with\nnotes',
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const ics = buildAppointmentIcs(built.event);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//KERSIVO//Booking//EN');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTSTART:20260907T171500Z');
    expect(ics).toContain('DTEND:20260907T175000Z');
    expect(ics).toContain('SUMMARY:DEMO — Cut\\; fade\\, with\\nnotes — Blackline Barbers');
    expect(ics).toContain(`UID:${buildCalendarUid(baseInput)}`);
    expect(ics.includes('\r\n')).toBe(true);
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.toLowerCase()).not.toContain('customer');
    expect(ics.toLowerCase()).not.toContain('access_token');
  });

  it('uses duration when endAt is absent and fails closed on bad input', () => {
    const ok = buildCalendarEvent(baseInput);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.event.endAt.getTime() - ok.event.startAt.getTime()).toBe(35 * 60_000);
    }

    expect(buildCalendarEvent({ ...baseInput, timeHHmm: '99:99' }).ok).toBe(false);
    expect(buildCalendarEvent({ ...baseInput, durationMinutes: 0, endAtIso: null }).ok).toBe(false);
    expect(buildCalendarEvent({ ...baseInput, timezone: 'Not/AZone' }).ok).toBe(false);
  });

  it('prefers explicit startAt/endAt instants when provided', () => {
    const built = buildCalendarEvent({
      ...baseInput,
      startAtIso: '2026-09-07T16:00:00.000Z',
      endAtIso: '2026-09-07T16:45:00.000Z',
      isDemo: false,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.event.summary.startsWith('DEMO')).toBe(false);
    expect(built.event.startAt.toISOString()).toBe('2026-09-07T16:00:00.000Z');
    expect(built.event.endAt.toISOString()).toBe('2026-09-07T16:45:00.000Z');
  });
});
