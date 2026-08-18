/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import BookingConfirmationPanel from './BookingConfirmationPanel';

describe('BookingConfirmationPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps booked copy promising email confirmation', () => {
    render(
      <BookingConfirmationPanel
        variant="booked"
        summary={{ service: 'Fade', barber: 'Jamie', date: '18 Jul 2026', time: '09:00' }}
      />,
    );

    expect(screen.getByText("You're booked")).toBeTruthy();
    expect(screen.getByText(/A confirmation email is on the way/i)).toBeTruthy();
    expect(screen.queryByText('Demo complete')).toBeNull();
  });

  it('keeps rescheduled copy promising a fresh email', () => {
    render(<BookingConfirmationPanel variant="rescheduled" />);

    expect(screen.getByText('Booking rescheduled')).toBeTruthy();
    expect(screen.getByText(/A fresh email with the updated details is on the way/i)).toBeTruthy();
  });

  it('demo variant does not promise email and offers voluntary CTAs', () => {
    render(
      <BookingConfirmationPanel
        variant="demo"
        summary={{ service: 'Fade', barber: 'Jamie', date: '18 Jul 2026', time: '09:00' }}
      />,
    );

    expect(screen.getByText('Demo complete')).toBeTruthy();
    expect(screen.getByText('That’s the KERSIVO booking experience')).toBeTruthy();
    expect(screen.getByText(/No appointment was created and no email was sent/i)).toBeTruthy();
    expect(screen.queryByText(/confirmation email is on the way/i)).toBeNull();
    expect(screen.queryByText("You're booked")).toBeNull();
    expect(screen.getByRole('link', { name: 'See pricing' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ask about my setup' })).toBeTruthy();
  });

  it('uses host demo copy, CTAs, and a demo reference when provided', () => {
    render(
      <BookingConfirmationPanel
        variant="demo"
        summary={{
          service: 'Skin Fade',
          barber: 'Ellis Ward',
          date: '18 Jul 2026',
          time: '09:00',
          reference: 'BL-4821',
        }}
        demoCopy={{
          heading: 'That’s the Blackline booking experience',
          body: 'Your demo appointment has been added to this browser session. No real appointment was created and no email was sent.',
          ctas: [{ label: 'Back to Blackline', href: '/demo', primary: false }],
        }}
        postConfirmCta={{
          label: 'See your booking on the timeline',
          href: '/demo/admin?section=bookings_dashboard&bookingId=abc&bookingDate=2026-08-12&demoJourney=booking',
        }}
      />,
    );

    expect(screen.getByText('That’s the Blackline booking experience')).toBeTruthy();
    expect(screen.getByText('BL-4821')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See your booking on the timeline' }).getAttribute('href')).toContain(
      '/demo/admin',
    );
    expect(screen.getByRole('link', { name: 'Back to Blackline' }).getAttribute('href')).toBe('/demo');
    expect(screen.queryByRole('link', { name: 'View services' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'See pricing' })).toBeNull();
  });
});
