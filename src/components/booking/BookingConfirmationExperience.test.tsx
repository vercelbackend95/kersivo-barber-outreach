/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import BookingConfirmationExperience from './BookingConfirmationExperience';

describe('BookingConfirmationExperience', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders confirmation, then actions, then recommendations in DOM order inside primary', () => {
    const { container } = render(
      <BookingConfirmationExperience
        secondaryActions={[
          { label: 'View booking timeline', href: '/demo/admin?bookingId=1', variant: 'primary' },
          { label: 'Back to Blackline', href: '/demo', variant: 'secondary' },
        ]}
        recommendations={<section data-testid="rail" className="booking-recommendations">Rail</section>}
      >
        <div data-testid="panel">Panel</div>
      </BookingConfirmationExperience>,
    );

    const root = container.querySelector('[data-booking-confirmation-experience]');
    const primary = root?.querySelector('.booking-confirmation-experience__primary');
    const confirm = root?.querySelector('.booking-confirmation-experience__confirm');
    const actions = root?.querySelector('.booking-confirmation-experience__actions');
    const recs = root?.querySelector('.booking-confirmation-experience__recommendations');
    expect(primary).toBeTruthy();
    expect(confirm).toBeTruthy();
    expect(actions).toBeTruthy();
    expect(recs).toBeTruthy();
    expect(primary!.contains(confirm!)).toBe(true);
    expect(primary!.contains(actions!)).toBe(true);
    expect(primary!.contains(recs!)).toBe(false);

    const order = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(confirm!.compareDocumentPosition(actions!) & order).toBeTruthy();
    expect(actions!.compareDocumentPosition(recs!) & order).toBeTruthy();
  });

  it('keeps primary timeline destination and shows actions without recommendations', () => {
    const { container } = render(
      <BookingConfirmationExperience
        secondaryActions={[
          {
            label: 'View booking timeline',
            href: '/demo/admin?section=bookings_dashboard&bookingId=abc&bookingDate=2026-09-07&demoJourney=booking',
            variant: 'primary',
          },
          { label: 'Back to Blackline', href: '/demo', variant: 'secondary' },
        ]}
      >
        <div>Panel</div>
      </BookingConfirmationExperience>,
    );

    const primary = screen.getByRole('link', { name: 'View booking timeline' });
    expect(primary.getAttribute('href')).toContain('/demo/admin?');
    expect(primary.getAttribute('href')).toContain('bookingId=abc');
    expect(primary.className).toMatch(/cta--primary/);
    expect(screen.getByRole('link', { name: 'Back to Blackline' })).toBeTruthy();
    expect(container.querySelector('.booking-confirmation-experience__recommendations')).toBeNull();
    expect(container.querySelector('.booking-recommendations')).toBeNull();
  });

  it('omits recommendations chrome when the rail child renders nothing', () => {
    const EmptyRail = () => null;
    const { container } = render(
      <BookingConfirmationExperience
        secondaryActions={[{ label: 'View booking timeline', href: '/demo/admin', variant: 'primary' }]}
        recommendations={<EmptyRail />}
      >
        <div>Panel</div>
      </BookingConfirmationExperience>,
    );

    expect(container.querySelector('.booking-confirmation-experience__recommendations')).toBeTruthy();
    expect(container.querySelector('.booking-recommendations')).toBeNull();
    expect(screen.getByRole('link', { name: 'View booking timeline' })).toBeTruthy();
  });
});
