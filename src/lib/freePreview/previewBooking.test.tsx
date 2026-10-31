/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import BookingFlow from '@/components/booking/BookingFlow';
import { previewBookingPresentation } from './previewBooking';

vi.mock('@/lib/consent/events', () => ({ trackConsentedEvent: vi.fn() }));
import { trackConsentedEvent } from '@/lib/consent/events';

const services = [{ id: 'svc_cut', name: 'Skin Fade', durationMinutes: 30, pricePence: 2500, category: 'Hair' }];
const barbers = [{ id: 'barber_sam', name: 'Sam', serviceIds: ['svc_cut'] }];

/**
 * Spec §6: the preview booking flow runs in test mode — no real bookings, no payments, no emails, no
 * Stripe calls. Every one of those needs a request to the server, so the proof is that completing a
 * test booking makes no network request at all.
 */
describe('free preview test-mode booking', () => {
  const fetchSpy = vi.fn();
  const beaconSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => {
      throw new Error('XMLHttpRequest must not be used on a preview booking');
    }));
    Object.defineProperty(navigator, 'sendBeacon', { value: beaconSpy, configurable: true });
    Element.prototype.scrollIntoView = vi.fn();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('completes a test booking without any request: nothing is booked, charged or emailed', async () => {
    render(
      <BookingFlow
        mode="create"
        publicDemoMode
        services={services}
        barbers={barbers}
        shopDetails={{ timezone: 'Europe/London', name: 'Sharp Cuts' }}
        presentation={previewBookingPresentation('Sharp Cuts')}
      />,
    );

    expect(screen.getByText('Test bookings only — no payments are taken. Times shown are examples.')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: /Skin Fade/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Choose a barber' })).toBeTruthy());
    fireEvent.click(screen.getByRole('radio', { name: /^Sam$/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: '09:00' })).toBeTruthy());
    fireEvent.click(screen.getByRole('radio', { name: '09:00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByLabelText(/^Name$/i)).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'Test Client' } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'client@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete test booking' }));

    await waitFor(() => expect(screen.getByText('Test booking complete')).toBeTruthy());
    expect(
      screen.getByText(/no appointment was created, no payment was taken and no emails were sent/i),
    ).toBeTruthy();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
    expect(trackConsentedEvent).not.toHaveBeenCalled();
  });

  it('shows no Sunday slots after shop hours apply closed Sunday', async () => {
    render(
      <BookingFlow
        mode="create"
        publicDemoMode
        services={services}
        barbers={barbers}
        openingHours={[1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, open: true }))}
        shopDetails={{ timezone: 'Europe/London', name: 'Sharp Cuts' }}
        presentation={previewBookingPresentation('Sharp Cuts')}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /Skin Fade/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Choose a barber' })).toBeTruthy());
    fireEvent.click(screen.getByRole('radio', { name: /^Sam$/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const sunday = (await screen.findAllByRole('button', { name: /^Sunday,/ }))[0];
    fireEvent.click(sunday!);
    await waitFor(() => expect(screen.getByText(/No times available|No available times/i)).toBeTruthy());
    expect(screen.queryByRole('radio', { name: '09:00' })).toBeNull();
  });

  it('the preview page never wires the booking flow to a create, availability or payment endpoint', () => {
    const page = readFileSync('src/pages/preview/[token].astro', 'utf8');
    const bookingFlowUsage = page.slice(page.indexOf('<BookingFlow'), page.indexOf('/>', page.indexOf('<BookingFlow')));
    expect(bookingFlowUsage).toContain('publicDemoMode={true}');
    expect(bookingFlowUsage).not.toMatch(/publicCreateUrl|publicShopId|bookingPaymentMode|starterPaymentPolicy|token=/);
    expect(page).not.toMatch(/\/api\/public\/bookings|\/api\/bookings\/create|enableProductionCart/);
  });
});
