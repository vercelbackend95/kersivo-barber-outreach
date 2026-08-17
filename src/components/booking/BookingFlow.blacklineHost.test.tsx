/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import BookingFlow from './BookingFlow';
import { BLACKLINE_BOOKING_PRESENTATION } from '@/lib/demo/booking';
import { DEMO_BARBERS } from '@/lib/demo/barbers';
import { DEMO_SERVICES } from '@/lib/demo/services';

vi.mock('@/lib/consent/events', () => ({
  trackConsentedEvent: vi.fn(),
}));

import { trackConsentedEvent } from '@/lib/consent/events';

const trackSpy = vi.mocked(trackConsentedEvent);

const services = DEMO_SERVICES.map((service) => ({
  id: service.id,
  name: service.name,
  durationMinutes: service.durationMinutes,
  pricePence: service.pricePence,
  category: service.category,
  displayOrder: service.displayOrder,
}));

const barbers = DEMO_BARBERS.map((barber) => ({
  id: barber.id,
  name: barber.name,
  serviceIds: [...barber.serviceIds],
}));

describe('BookingFlow BLACKLINE host', () => {
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

  it('preselects a valid service and starts on the barber step', () => {
    render(
      <BookingFlow
        publicDemoMode
        initialServiceId="bl-svc-skin-fade"
        services={services}
        barbers={barbers}
        presentation={BLACKLINE_BOOKING_PRESENTATION}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Book a chair' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Choose a barber' })).toBeTruthy();
    expect(screen.getAllByText(/Skin Fade/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^Ellis Ward$/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Hot Towel Shave/i })).toBeNull();
  });

  it('ignores an invalid initialServiceId and stays on service selection', () => {
    render(
      <BookingFlow
        publicDemoMode
        initialServiceId="svc-from-another-shop"
        services={services}
        barbers={barbers}
        presentation={BLACKLINE_BOOKING_PRESENTATION}
      />,
    );

    expect(screen.getByRole('button', { name: /Skin Fade/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Hot Towel Shave/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Ellis Ward$/i })).toBeNull();
  });

  it('shows whole-pound prices and Blackline confirmation CTAs without tracking or fetching', async () => {
    render(
      <BookingFlow
        publicDemoMode
        initialServiceId="bl-svc-haircut-finish"
        services={services}
        barbers={barbers}
        presentation={BLACKLINE_BOOKING_PRESENTATION}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Noah Reid$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '09:00' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '09:00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^Name$/i)).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'Alex Demo' } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'alex@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete demo booking' }));

    await waitFor(() => {
      expect(screen.getByText('That’s the Blackline booking experience')).toBeTruthy();
    });

    expect(screen.getByRole('link', { name: 'Back to Blackline' }).getAttribute('href')).toBe('/demo');
    expect(screen.getByRole('link', { name: 'View services' }).getAttribute('href')).toBe('/demo/services');
    expect(screen.queryByRole('link', { name: 'See pricing' })).toBeNull();
    expect(screen.getByText(/^BL-\d{4}$/)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it('keeps a valid initialBarberId and skips the barber step after a service is chosen', async () => {
    render(
      <BookingFlow
        publicDemoMode
        initialBarberId="bl-barber-ellis"
        services={services}
        barbers={barbers}
        presentation={BLACKLINE_BOOKING_PRESENTATION}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Choose a service' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Ellis Ward$/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Skin Fade/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Pick a time' })).toBeTruthy();
      expect(screen.getByRole('button', { name: '09:00' })).toBeTruthy();
    });

    expect(screen.getAllByText('Ellis Ward').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Choose a barber' })).toBeNull();
  });

  it('ignores an invalid initialBarberId and stays on BLACKLINE barber selection', () => {
    render(
      <BookingFlow
        publicDemoMode
        initialBarberId="barber-from-another-shop"
        services={services}
        barbers={barbers}
        presentation={BLACKLINE_BOOKING_PRESENTATION}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Skin Fade/i }));

    expect(screen.getByRole('heading', { name: 'Choose a barber' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Ellis Ward$/i })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Pick a time' })).toBeNull();
  });

  it('starts on the schedule step when both service and barber are valid', async () => {
    render(
      <BookingFlow
        publicDemoMode
        initialServiceId="bl-svc-skin-fade"
        initialBarberId="bl-barber-noah"
        services={services}
        barbers={barbers}
        presentation={BLACKLINE_BOOKING_PRESENTATION}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Pick a time' })).toBeTruthy();
    expect(screen.getAllByText('Noah Reid').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Skin Fade/).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '09:00' })).toBeTruthy();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
