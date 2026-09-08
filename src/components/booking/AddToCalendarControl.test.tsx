/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AddToCalendarControl from './AddToCalendarControl';
import BookingConfirmationPanel from './BookingConfirmationPanel';
import type { BookingCalendarInput } from '@/lib/booking/calendarEvent';
import type { ClientPlatform } from '@/lib/client/platform';

const resolveClientPlatform = vi.hoisted(() => vi.fn((): ClientPlatform => 'DESKTOP'));

vi.mock('@/lib/client/platform', () => ({
  resolveClientPlatform: () => resolveClientPlatform(),
}));

const calendar: BookingCalendarInput = {
  shopName: 'Blackline Barbers',
  location: 'Northern Quarter, Manchester',
  timezone: 'Europe/London',
  dateIso: '2026-09-07',
  timeHHmm: '18:15',
  durationMinutes: 35,
  service: 'Skin Fade',
  barber: 'Ellis Ward',
  reference: 'BL-7623',
  isDemo: true,
};

function stubIcsDownload() {
  const click = vi.fn();
  const createObjectURL = vi.fn(() => 'blob:ics');
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeObjectURL });
  const originalCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = originalCreate(tag);
    if (tag === 'a') {
      el.click = click;
    }
    return el;
  });
  return { click, createObjectURL, revokeObjectURL };
}

describe('AddToCalendarControl', () => {
  beforeEach(() => {
    resolveClientPlatform.mockReturnValue('DESKTOP');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('opens menu with Google and Apple choices and closes on Escape with focus restore', async () => {
    render(<AddToCalendarControl calendar={calendar} />);
    const trigger = screen.getByRole('button', { name: /Add to calendar/i });

    await waitFor(() => {
      expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menuitem', { name: /Google Calendar/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Apple \/ Other calendar/i })).toBeTruthy();

    const google = screen.getByRole('menuitem', { name: /Google Calendar/i });
    expect(google.getAttribute('target')).toBe('_blank');
    expect(google.getAttribute('rel')).toContain('noopener');
    expect(google.getAttribute('href')).toContain('calendar.google.com');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('invokes ICS download for Apple / Other calendar on desktop menu', async () => {
    const { click, createObjectURL } = stubIcsDownload();

    render(<AddToCalendarControl calendar={calendar} />);
    const trigger = screen.getByRole('button', { name: /Add to calendar/i });
    await waitFor(() => expect(trigger.getAttribute('aria-haspopup')).toBe('menu'));

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: /Apple \/ Other calendar/i }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('shows inline error without crashing when calendar data is invalid on desktop', async () => {
    render(
      <AddToCalendarControl
        calendar={{
          shopName: 'Blackline Barbers',
          timezone: 'Europe/London',
          dateIso: 'bad-date',
          timeHHmm: '18:15',
          durationMinutes: 35,
          isDemo: true,
        }}
      />,
    );
    const trigger = screen.getByRole('button', { name: /Add to calendar/i });
    await waitFor(() => expect(trigger.getAttribute('aria-haspopup')).toBe('menu'));
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: /Apple \/ Other calendar/i }));
    expect(screen.getByRole('alert').textContent).toMatch(/could not resolve|missing|invalid/i);
  });

  it('downloads ICS immediately on iOS without opening a menu', async () => {
    resolveClientPlatform.mockReturnValue('IOS');
    const { click, createObjectURL } = stubIcsDownload();

    render(<AddToCalendarControl calendar={calendar} />);
    const trigger = screen.getByRole('button', { name: /Add to calendar/i });

    await waitFor(() => {
      expect(trigger.getAttribute('aria-haspopup')).toBeNull();
    });

    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('downloads ICS immediately on iPadOS (IOS platform) without opening a menu', () => {
    resolveClientPlatform.mockReturnValue('IOS');
    const { click, createObjectURL } = stubIcsDownload();

    render(<AddToCalendarControl calendar={calendar} />);
    fireEvent.click(screen.getByRole('button', { name: /Add to calendar/i }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('downloads ICS immediately on OTHER_MOBILE without opening a menu', () => {
    resolveClientPlatform.mockReturnValue('OTHER_MOBILE');
    const { click, createObjectURL } = stubIcsDownload();

    render(<AddToCalendarControl calendar={calendar} />);
    fireEvent.click(screen.getByRole('button', { name: /Add to calendar/i }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('opens Google Calendar immediately on Android without opening a menu', () => {
    resolveClientPlatform.mockReturnValue('ANDROID');
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);

    render(<AddToCalendarControl calendar={calendar} />);
    fireEvent.click(screen.getByRole('button', { name: /Add to calendar/i }));

    expect(screen.queryByRole('menu')).toBeNull();
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0]?.[0]).toContain('calendar.google.com');
    expect(openSpy.mock.calls[0]?.[1]).toBe('_blank');
    expect(String(openSpy.mock.calls[0]?.[2])).toContain('noopener');
  });

  it('shows inline error on iOS when calendar data is invalid and does not open menu', () => {
    resolveClientPlatform.mockReturnValue('IOS');
    render(
      <AddToCalendarControl
        calendar={{
          shopName: 'Blackline Barbers',
          timezone: 'Europe/London',
          dateIso: 'bad-date',
          timeHHmm: '18:15',
          durationMinutes: 35,
          isDemo: true,
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Add to calendar/i }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('alert').textContent).toMatch(/could not resolve|missing|invalid/i);
  });

  it('does not set menu a11y attrs on Android after mount', async () => {
    resolveClientPlatform.mockReturnValue('ANDROID');
    render(<AddToCalendarControl calendar={calendar} />);
    const trigger = screen.getByRole('button', { name: /Add to calendar/i });
    await waitFor(() => {
      expect(trigger.getAttribute('aria-haspopup')).toBeNull();
      expect(trigger.getAttribute('aria-expanded')).toBeNull();
    });
  });
});

describe('BookingConfirmationPanel calendar', () => {
  afterEach(() => cleanup());

  it('renders Add to calendar inside the appointment note', () => {
    resolveClientPlatform.mockReturnValue('DESKTOP');
    render(
      <BookingConfirmationPanel
        variant="demo"
        summary={{
          service: 'Skin Fade',
          barber: 'Ellis Ward',
          date: 'Mon, 07 Sep',
          time: '18:15',
          reference: 'BL-7623',
        }}
        calendar={calendar}
      />,
    );
    const pass = document.querySelector('.booking-confirmation__pass');
    const trigger = screen.getByRole('button', { name: /Add to calendar/i });
    expect(pass?.contains(trigger)).toBe(true);
  });
});
