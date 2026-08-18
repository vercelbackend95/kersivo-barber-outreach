/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import {
  AdminTodayBookingsLiveProvider,
  useAdminTodayBookingsLive,
  type AdminLiveBookingRow,
  type AdminTodayBookingsLiveValue,
} from './AdminTodayBookingsLiveProvider';

function Probe({ onValue }: { onValue: (v: AdminTodayBookingsLiveValue) => void }) {
  const value = useAdminTodayBookingsLive();
  onValue(value);
  return null;
}

const seed: AdminLiveBookingRow[] = [
  {
    id: 'demo-1',
    status: 'BOOKED',
    startAt: '2099-01-01T12:00:00.000Z',
    endAt: '2099-01-01T12:30:00.000Z',
    barber: { name: 'Jamie' },
    service: { name: 'Cut' },
  },
];

describe('AdminTodayBookingsLiveProvider hasLoadedOnce', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('starts hasLoadedOnce=false without a seed and stays false until fetch succeeds', async () => {
    fetchSpy.mockImplementation(() => new Promise(() => undefined)); // never resolves
    const latest: { current: AdminTodayBookingsLiveValue | null } = { current: null };

    render(
      <AdminTodayBookingsLiveProvider isPublicDemo>
        <Probe onValue={(v) => { latest.current = v; }} />
      </AdminTodayBookingsLiveProvider>,
    );

    expect(latest.current?.hasLoadedOnce).toBe(false);
    expect(latest.current?.connectionStateLabel).toBe('CONNECTING…');
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('promotes seeded payload after mount without calling fetch on the first tick', async () => {
    const latest: { current: AdminTodayBookingsLiveValue | null } = { current: null };

    render(
      <AdminTodayBookingsLiveProvider isPublicDemo initialBookings={seed}>
        <Probe onValue={(v) => { latest.current = v; }} />
      </AdminTodayBookingsLiveProvider>,
    );

    await waitFor(() => {
      expect(latest.current?.hasLoadedOnce).toBe(true);
    });

    expect(latest.current?.connectionStateLabel).toBe('LIVE');
    expect(latest.current?.upcomingBookings.length).toBeGreaterThan(0);
    // Seed skip: first mount must not hit the network (poll is 120s).
    expect(fetchSpy).not.toHaveBeenCalled();

    await act(async () => {
      // drain microtasks
    });
  });
});

describe('AdminTodayBookingsLiveProvider BLACKLINE session overlay', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it('merges a session booking into upcoming rows without duplicating on re-render', async () => {
    const { addBlacklineSessionBooking, mergeBlacklineSessionBookings } = await import(
      '@/lib/demo/blacklineSessionBookings'
    );
    const { formatInTimeZone } = await import('date-fns-tz');
    const start = new Date(Date.now() + 90 * 60 * 1000);
    const dayKey = formatInTimeZone(start, 'Europe/London', 'yyyy-MM-dd');
    const startTime = formatInTimeZone(start, 'Europe/London', 'HH:mm');
    const created = addBlacklineSessionBooking({
      serviceId: 'bl-svc-haircut-finish',
      serviceName: 'Haircut & Finish',
      durationMinutes: 35,
      pricePence: 2200,
      barberId: 'bl-barber-ellis',
      barberName: 'Ellis Ward',
      fullName: 'Alex Demo',
      email: 'alex@example.com',
      date: dayKey,
      startTime,
    });
    const latest: { current: AdminTodayBookingsLiveValue | null } = { current: null };

    const { rerender } = render(
      <AdminTodayBookingsLiveProvider isPublicDemo isBlacklineDemo initialBookings={seed}>
        <Probe
          onValue={(v) => {
            latest.current = v;
          }}
        />
      </AdminTodayBookingsLiveProvider>,
    );

    await waitFor(() => {
      expect(latest.current?.upcomingBookings.some((row) => row.id === created.id)).toBe(true);
    });

    rerender(
      <AdminTodayBookingsLiveProvider isPublicDemo isBlacklineDemo initialBookings={seed}>
        <Probe
          onValue={(v) => {
            latest.current = v;
          }}
        />
      </AdminTodayBookingsLiveProvider>,
    );

    expect(latest.current?.upcomingBookings.filter((row) => row.id === created.id)).toHaveLength(1);
    expect(mergeBlacklineSessionBookings(seed, dayKey).filter((row) => row.id === created.id)).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
