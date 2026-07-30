/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import BookingFlow from './BookingFlow';

vi.mock('@/lib/consent/events', () => ({
  trackConsentedEvent: vi.fn(),
}));

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

describe('BookingFlow publicShopId availability', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValue({
      json: async () => ({ slots: ['10:00', '10:30'], paused: false }),
    });
    vi.stubGlobal('fetch', fetchSpy);
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('fetches public shop availability when publicShopId is set', async () => {
    render(
      <BookingFlow
        publicShopId="shop-real-1"
        publicCreateUrl="/api/public/bookings/shop-real-1/create"
        services={services}
        barbers={barbers}
        shopDetails={{ timezone: 'Europe/London' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Skin Fade/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Jamie$/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    expect(calledUrl).toContain('/api/public/bookings/shop-real-1/availability?');
    expect(calledUrl).toContain('serviceId=svc-fade');
    expect(calledUrl).toContain('barberId=barber-jamie');
    expect(calledUrl).not.toContain('/api/availability?');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '10:00' })).toBeTruthy();
    });
  });

  it('falls back to /api/availability when publicShopId is absent', async () => {
    render(
      <BookingFlow
        services={services}
        barbers={barbers}
        shopDetails={{ timezone: 'Europe/London' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Skin Fade/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Jamie$/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    expect(calledUrl.startsWith('/api/availability?')).toBe(true);
    expect(calledUrl).not.toContain('/api/public/bookings/');
  });
});
