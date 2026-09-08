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
    expect(screen.getByText(/Jamie/)).toBeTruthy();
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
    expect(screen.getByText("You're all set")).toBeTruthy();
    expect(screen.getByText(/Demo only — no appointment or email was created/i)).toBeTruthy();
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
          heading: "You're all set",
          body: 'Demo only — no appointment or email was created.',
        }}
      />,
    );

    expect(screen.getByText("You're all set")).toBeTruthy();
    expect(screen.getByText('BL-4821')).toBeTruthy();
    expect(screen.getByLabelText('Booking summary')).toBeTruthy();
  });

  it('preserves appointment note dl semantics with service dominance', () => {
    const { container } = render(
      <BookingConfirmationPanel
        variant="booked"
        summary={{
          service: 'Classic Cut & Finish',
          barber: 'Marcus Bell',
          date: 'Mon, 07 Sep',
          time: '18:15',
          reference: 'BL-7623',
        }}
      />,
    );

    const pass = container.querySelector('.booking-confirmation__pass');
    expect(pass).toBeTruthy();
    expect(pass?.querySelector('dl.booking-confirmation__pass-fields')).toBeTruthy();
    expect(pass?.querySelector('.booking-confirmation__pass-field--service dd')?.textContent).toBe(
      'Classic Cut & Finish',
    );
    expect(pass?.querySelector('.booking-confirmation__pass-when')?.textContent).toContain('Mon, 07 Sep');
    expect(pass?.querySelector('.booking-confirmation__pass-when')?.textContent).toContain('18:15');
    expect(pass?.querySelector('.booking-confirmation__pass-field--barber dd')?.textContent).toMatch(
      /with\s+Marcus Bell/,
    );
    expect(pass?.querySelector('.booking-confirmation__pass-field--ref dd')?.textContent).toBe('BL-7623');
    // Date/Time remain in the accessibility tree via dt/dd
    expect(pass?.querySelector('.booking-confirmation__pass-field--date dd')?.textContent).toBe('Mon, 07 Sep');
    expect(pass?.querySelector('.booking-confirmation__pass-field--time dd')?.textContent).toBe('18:15');
  });

  it('supports long service and barber names without creating links', () => {
    render(
      <BookingConfirmationPanel
        variant="demo"
        summary={{
          service: 'Extra Long Signature Skin Fade With Beard Sculpting And Hot Towel Finish',
          barber: 'Barber Name That Is Extremely Long For Overflow Testing',
          date: '18 Jul 2026',
          time: '09:00',
          reference: 'BL-9999',
        }}
      />,
    );

    const service = screen.getByText(/Extra Long Signature Skin Fade/i);
    const barber = screen.getByText(/Barber Name That Is Extremely Long/i);
    expect(service).toBeTruthy();
    expect(barber).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
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
