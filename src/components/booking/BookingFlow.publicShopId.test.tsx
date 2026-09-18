/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import BookingFlow from './BookingFlow';
import { clearBookingAvailabilityCache } from '@/lib/booking/useBookingAvailability';

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
    clearBookingAvailabilityCache();
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

    fireEvent.click(screen.getByRole('radio', { name: /Skin Fade/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Choose a barber' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('radio', { name: /^Jamie$/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    expect(calledUrl).toContain('/api/public/bookings/shop-real-1/availability?');
    expect(calledUrl).toContain('serviceId=svc-fade');
    expect(calledUrl).toContain('barberId=barber-jamie');
    expect(calledUrl).not.toContain('/api/availability?');

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: '10:00' })).toBeTruthy();
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

    fireEvent.click(screen.getByRole('radio', { name: /Skin Fade/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Choose a barber' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('radio', { name: /^Jamie$/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    expect(calledUrl.startsWith('/api/availability?')).toBe(true);
    expect(calledUrl).not.toContain('/api/public/bookings/');

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: '10:00' })).toBeTruthy();
    });
  });

  it('aborts stale availability and keeps the latest date’s slots', async () => {
    type PendingAvailabilityRequest = {
      url: string;
      date: string;
      signal: AbortSignal | null | undefined;
      resolve: (value: Response | PromiseLike<Response>) => void;
    };

    const requests: PendingAvailabilityRequest[] = [];

    fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const date = new URL(url, 'http://local.test').searchParams.get('date') ?? '';

      return new Promise<Response>((resolve, reject) => {
        const signal = init?.signal;

        const abort = () => {
          reject(new DOMException('Aborted', 'AbortError'));
        };

        signal?.addEventListener('abort', abort, { once: true });

        if (signal?.aborted) {
          abort();
          return;
        }

        requests.push({
          url,
          date,
          signal,
          resolve,
        });
      });
    });

    render(
      <BookingFlow
        publicShopId="shop-real-1"
        publicCreateUrl="/api/public/bookings/shop-real-1/create"
        services={services}
        barbers={barbers}
        shopDetails={{ timezone: 'Europe/London' }}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /Skin Fade/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Choose a barber' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('radio', { name: /^Jamie$/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    const initialRequest = requests[0];
    expect(initialRequest).toBeDefined();
    const initialDate = initialRequest!.date;

    await waitFor(() => {
      expect(screen.getByLabelText('Select booking date')).toBeTruthy();
    });

    const dateInput = screen.getByLabelText('Select booking date') as HTMLInputElement;
    const [year, month, day] = dateInput.value.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
    fireEvent.change(dateInput, { target: { value: next } });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    const latestRequest = requests[1];
    expect(latestRequest).toBeDefined();
    expect(latestRequest!.url).toContain(`date=${next}`);
    expect(latestRequest!.date).toBe(next);
    expect(latestRequest!.date).not.toBe(initialDate);
    expect(requests).toHaveLength(2);

    // Resolve only the latest request. Leave the stale request pending so it cannot
    // overwrite slots (BookingFlow does not pass AbortSignal on availability fetch).
    latestRequest!.resolve(
      new Response(
        JSON.stringify({
          slots: ['16:00'],
          paused: false,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: '16:00' })).toBeTruthy();
    });
    expect(screen.queryByRole('radio', { name: '09:00' })).toBeNull();
  });
});
