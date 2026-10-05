/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BookingsAdminPanel from './BookingsAdminPanel';
import { AdminProductLockProvider } from './FullKersivoUpgradeDialog';
import { AdminTodayBookingsLiveProvider } from './useAdminTodayBookingsLive';

function LiveShell({ children }: { children: React.ReactNode }) {
  return <AdminTodayBookingsLiveProvider isPublicDemo={false}>{children}</AdminTodayBookingsLiveProvider>;
}

const STARTER_GATE = {
  state: 'FREE_BOOKING' as const,
  capabilities: {
    bookingCore: true,
    publicBooking: true,
    bookingPayments: true,
    team: true,
    services: true,
    reports: false,
    clientsCore: true,
    clients: false,
    recentBookingHistory: true,
    fullBookingHistory: false,
    retail: false,
    assistant: false,
    smsReminders: false,
    automatedEmailReminders: true,
    brandedSite: false,
    manualBookings: true,
    googleBookingSetup: true,
  },
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ bookings: [], barbers: [] }) })),
  );
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('BookingsAdminPanel Starter product boundaries', () => {
  it('Starter can open the rolling 90-day History view', async () => {
    const openUpgrade = vi.fn();
    const onOpenHistoryWithinBookings = vi.fn();
    render(
      <LiveShell>
        <AdminProductLockProvider value={{ gate: STARTER_GATE, openUpgrade }}>
          <BookingsAdminPanel isActive mode="dashboard" onOpenHistoryWithinBookings={onOpenHistoryWithinBookings} />
        </AdminProductLockProvider>
      </LiveShell>,
    );

    const historyTab = await waitFor(() => {
      const tab = screen
        .getAllByRole('tab')
        .find((node) => node.querySelector('.admin-view-toggle-label')?.textContent === 'History');
      expect(tab).toBeTruthy();
      return tab!;
    });
    expect(historyTab.dataset.locked).toBeUndefined();
    expect(historyTab.querySelector('.admin-view-toggle-lock')).toBeFalsy();

    fireEvent.click(historyTab);
    await waitFor(() => expect(onOpenHistoryWithinBookings).toHaveBeenCalled());
    expect(openUpgrade).not.toHaveBeenCalled();
  });

  it('Full (no gate) keeps the History tab navigating as before', async () => {
    const onOpenHistoryWithinBookings = vi.fn();
    render(
      <LiveShell>
        <BookingsAdminPanel isActive mode="dashboard" onOpenHistoryWithinBookings={onOpenHistoryWithinBookings} />
      </LiveShell>,
    );

    const historyTab = await waitFor(() => {
      const tab = screen
        .getAllByRole('tab')
        .find((node) => node.querySelector('.admin-view-toggle-label')?.textContent === 'History');
      expect(tab).toBeTruthy();
      return tab!;
    });
    expect(historyTab.dataset.locked).toBeUndefined();
    fireEvent.click(historyTab);
    await waitFor(() => expect(onOpenHistoryWithinBookings).toHaveBeenCalled());
  });
});
