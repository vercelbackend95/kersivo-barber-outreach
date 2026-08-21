/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_SHOP_HREF } from '@/lib/demo/nav';
import { OWNER_LAUNCH_HREF } from '@/lib/admin/launchCtaProgress';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';

vi.mock('@/lib/consent/events', () => ({
  trackConsentedEvent: vi.fn(),
}));

import { trackConsentedEvent } from '@/lib/consent/events';
import BlacklineBookingProofCard from './BlacklineBookingProofCard';

const trackSpy = vi.mocked(trackConsentedEvent);

describe('BlacklineBookingProofCard', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    trackSpy.mockReset();
  });

  it('renders hierarchy CTAs with correct destinations', () => {
    const onDismiss = vi.fn();
    render(<BlacklineBookingProofCard bookingId="session-1" onDismiss={onDismiss} />);

    expect(document.body.querySelector('[data-blackline-booking-proof]')).toBeTruthy();
    expect(document.body.querySelector('[data-blackline-booking-proof-layer]')).toBeTruthy();

    expect(screen.getByText('YOUR BOOKING IS LIVE')).toBeTruthy();
    expect(
      screen.getByText(
        'You’ve just seen the booking flow from the client side to your dashboard.',
      ),
    ).toBeTruthy();

    const orderLink = screen.getByRole('link', { name: /Place a demo order/i });
    expect(orderLink.getAttribute('href')).toBe(DEMO_SHOP_HREF);

    const launchLink = screen.getByRole('link', { name: /Get KERSIVO for my shop/i });
    expect(launchLink.getAttribute('href')).toBe(OWNER_LAUNCH_HREF);

    expect(trackSpy).toHaveBeenCalledWith(
      FUNNEL_EVENTS.blackline_booking_proof_card_viewed,
      { bookingId: 'session-1' },
      'analytics',
    );
  });

  it('Explore the dashboard dismisses without navigation', () => {
    const onDismiss = vi.fn();
    render(<BlacklineBookingProofCard bookingId="session-1" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /Explore the dashboard/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(trackSpy).toHaveBeenCalledWith(
      FUNNEL_EVENTS.blackline_booking_proof_explore_clicked,
      { bookingId: 'session-1' },
      'analytics',
    );
  });

  it('close control dismisses with accessible label', () => {
    const onDismiss = vi.fn();
    render(<BlacklineBookingProofCard bookingId="session-1" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(trackSpy).toHaveBeenCalledWith(
      FUNNEL_EVENTS.blackline_booking_proof_dismissed,
      { bookingId: 'session-1' },
      'analytics',
    );
  });

  it('overlay catch dismisses when clicked', () => {
    const onDismiss = vi.fn();
    render(<BlacklineBookingProofCard bookingId="session-1" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss booking proof overlay' }));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(trackSpy).toHaveBeenCalledWith(
      FUNNEL_EVENTS.blackline_booking_proof_dismissed,
      { bookingId: 'session-1' },
      'analytics',
    );
  });

  it('tracks Get KERSIVO and Place order clicks then dismisses', () => {
    const onDismiss = vi.fn();
    render(<BlacklineBookingProofCard bookingId="session-1" onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('link', { name: /Place a demo order/i }));
    expect(trackSpy).toHaveBeenCalledWith(
      FUNNEL_EVENTS.blackline_booking_proof_order_clicked,
      { bookingId: 'session-1' },
      'analytics',
    );
    expect(onDismiss).toHaveBeenCalled();

    onDismiss.mockClear();
    cleanup();
    render(<BlacklineBookingProofCard bookingId="session-1" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('link', { name: /Get KERSIVO for my shop/i }));
    expect(trackSpy).toHaveBeenCalledWith(
      FUNNEL_EVENTS.blackline_booking_proof_get_kersivo_clicked,
      { bookingId: 'session-1' },
      'analytics',
    );
    expect(onDismiss).toHaveBeenCalled();
  });
});
