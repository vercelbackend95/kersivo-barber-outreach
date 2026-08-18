/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import BookingFlow from './BookingFlow';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { BLACKLINE_SESSION_BOOKINGS_KEY } from '@/lib/demo/blacklineSessionBookings';

vi.mock('@/lib/consent/events', () => ({
  trackConsentedEvent: vi.fn(),
}));

import { trackConsentedEvent } from '@/lib/consent/events';

const trackSpy = vi.mocked(trackConsentedEvent);

const services = [
  {
    id: 'svc-fade',
    name: 'Skin Fade',
    durationMinutes: 30,
    pricePence: 2500,
    category: 'Hair',
  },
];

const barbers = [
  {
    id: 'barber-jamie',
    name: 'Jamie',
    avatarUrl: '/images/landing-demo/barbers/jamie.webp',
    serviceIds: ['svc-fade'],
  },
];

async function completeThroughSchedule() {
  fireEvent.click(screen.getByRole('button', { name: /Skin Fade/i }));
  fireEvent.click(screen.getByRole('button', { name: /^Jamie$/i }));

  await waitFor(() => {
    expect(screen.getByRole('button', { name: '09:00' })).toBeTruthy();
  });

  fireEvent.click(screen.getByRole('button', { name: '09:00' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  await waitFor(() => {
    expect(screen.getByLabelText(/^Name$/i)).toBeTruthy();
  });
}

describe('BookingFlow publicDemoMode', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    trackSpy.mockClear();
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('uses static slots and never calls availability, create, or lead APIs', async () => {
    render(<BookingFlow publicDemoMode services={services} barbers={barbers} />);

    fireEvent.click(screen.getByRole('button', { name: /Skin Fade/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Jamie$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '09:00' })).toBeTruthy();
      expect(screen.getByRole('button', { name: '14:30' })).toBeTruthy();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not complete with an invalid email and does not POST or track', async () => {
    render(<BookingFlow publicDemoMode services={services} barbers={barbers} />);
    await completeThroughSchedule();

    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'Alex Demo' } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'not-an-email' } });

    const completeBtn = screen.getByRole('button', { name: 'Complete demo booking' });
    expect(completeBtn).toHaveProperty('disabled', true);
    fireEvent.click(completeBtn);

    expect(screen.queryByText('Demo complete')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it('completes locally once, shows demo confirmation, tracks without PII', async () => {
    render(<BookingFlow publicDemoMode services={services} barbers={barbers} />);
    await completeThroughSchedule();

    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'Alex Demo' } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '07123456789' } });

    fireEvent.click(screen.getByRole('button', { name: 'Complete demo booking' }));

    await waitFor(() => {
      expect(screen.getByText('Demo complete')).toBeTruthy();
      expect(screen.getByText('That’s the KERSIVO booking experience')).toBeTruthy();
    });

    expect(screen.getByRole('link', { name: 'See pricing' }).getAttribute('href')).toBe('/#pricing');
    expect(screen.getByRole('link', { name: 'Ask about my setup' }).getAttribute('href')).toBe('/#contact');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy).toHaveBeenCalledWith(FUNNEL_EVENTS.public_demo_completed, undefined, 'analytics');

    const trackArgs = trackSpy.mock.calls[0];
    const serialized = JSON.stringify(trackArgs);
    expect(serialized).not.toContain('Alex Demo');
    expect(serialized).not.toContain('alex@example.com');
    expect(serialized).not.toContain('07123456789');

    expect(screen.queryByText(/confirmation email is on the way/i)).toBeNull();
    expect(screen.queryByText(/You're booked/i)).toBeNull();
    expect(window.sessionStorage.getItem(BLACKLINE_SESSION_BOOKINGS_KEY)).toBeNull();
  });

  it('shows sandbox copy instead of email confirmation promises', () => {
    render(<BookingFlow publicDemoMode services={services} barbers={barbers} />);

    expect(screen.getByText('Interactive demo')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Try the booking flow' })).toBeTruthy();
    expect(
      screen.getByText(/No appointment will be created, no email will be sent/i),
    ).toBeTruthy();
    expect(screen.queryByText('Instant confirmation by email')).toBeNull();
  });
});
