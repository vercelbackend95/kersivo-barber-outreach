/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import TodayTimeline from './TodayTimeline';
import { atDayMinute } from '@/lib/admin/blacklineDemoFixtures/time';

describe('TodayTimeline BLACKLINE focus', () => {
  afterEach(() => {
    cleanup();
  });

  it('receives focusBookingId, expands the slot, and reports handled', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
    const startAt = atDayMinute('2026-08-12', 12 * 60);
    const endAt = atDayMinute('2026-08-12', 12 * 60 + 35);
    const onHandled = vi.fn();

    render(
      <TodayTimeline
        barbers={[{ id: 'bl-barber-ellis', name: 'Ellis Ward' }]}
        bookings={[
          {
            id: 'session-focus-1',
            fullName: 'Alex Demo',
            email: 'alex@example.com',
            status: 'BOOKED',
            startAt,
            endAt,
            barberId: 'bl-barber-ellis',
            barber: { name: 'Ellis Ward' },
            service: { id: 'bl-svc-haircut-finish', name: 'Haircut & Finish' },
            clientTags: ['YOUR DEMO BOOKING'],
          },
        ]}
        timeBlocks={[]}
        selectedDate="2026-08-12"
        onBookingClick={() => undefined}
        focusBookingId="session-focus-1"
        onFocusBookingHandled={onHandled}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-booking-id="session-focus-1"]')).toBeTruthy();
    });
    await waitFor(() => {
      expect(onHandled).toHaveBeenCalledWith('session-focus-1');
    });
  });
});
