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

    expect(screen.getByText('Booking confirmed')).toBeTruthy();
    expect(screen.getByText("You're booked")).toBeTruthy();
    expect(screen.getByText(/Your appointment details are on their way by email/i)).toBeTruthy();
    expect(screen.queryByText('Demo complete')).toBeNull();
    expect(screen.getByText('Fade')).toBeTruthy();
    expect(screen.getByText('Jamie')).toBeTruthy();
  });

  it('keeps rescheduled copy promising a fresh email', () => {
    render(<BookingConfirmationPanel variant="rescheduled" />);

    expect(screen.getByText('Booking updated')).toBeTruthy();
    expect(screen.getByText('Your new time is confirmed')).toBeTruthy();
    expect(screen.getByText(/Updated appointment details are on their way by email/i)).toBeTruthy();
  });

  it('demo variant does not promise email', () => {
    render(
      <BookingConfirmationPanel
        variant="demo"
        summary={{ service: 'Fade', barber: 'Jamie', date: '18 Jul 2026', time: '09:00' }}
      />,
    );

    expect(screen.getByText('Demo complete')).toBeTruthy();
    expect(screen.getByText('Demo booking complete')).toBeTruthy();
    expect(screen.getByText(/Saved in this browser only/i)).toBeTruthy();
    expect(screen.queryByText(/on their way by email/i)).toBeNull();
    expect(screen.queryByText("You're booked")).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('uses host demo copy and shows subordinate reference', () => {
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
          heading: 'Demo booking complete',
          body: 'Saved in this browser only — no real appointment or email.',
        }}
      />,
    );

    expect(screen.getByText('Demo booking complete')).toBeTruthy();
    expect(screen.getByText('BL-4821')).toBeTruthy();
    expect(screen.getByLabelText('Booking summary')).toBeTruthy();
  });

  it('scopes the live region to the success announcement only', () => {
    const { container } = render(
      <BookingConfirmationPanel
        variant="booked"
        summary={{ service: 'Fade', barber: 'Jamie', date: '18 Jul 2026', time: '09:00' }}
      />,
    );

    const live = container.querySelector('[role="status"][aria-live="polite"]');
    expect(live).toBeTruthy();
    expect(live?.classList.contains('booking-confirmation__announce')).toBe(true);
    expect(live?.querySelector('.booking-confirmation__pass')).toBeNull();
  });
});
