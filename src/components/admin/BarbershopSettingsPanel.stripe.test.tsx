/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LAUNCH_CONTEXT_REFRESH_EVENT } from '@/lib/admin/launchContextRefresh';

vi.mock('./QrKitSettingsCard', () => ({ default: () => null }));
vi.mock('./LeaveKersivoCard', () => ({ default: () => null }));

import BarbershopSettingsPanel from './BarbershopSettingsPanel';

type Connect = { accountLinked: boolean; disconnected: boolean; chargesEnabled: boolean };

function depositsPayload(ready: boolean, connect: Connect) {
  return {
    paid: false,
    productState: 'FREE_BOOKING',
    bookingPaymentMode: 'NONE',
    bookingPaymentsAvailable: true,
    paymentControlsEditable: false,
    bookingPaymentsReady: ready,
    collectReady: ready,
    canManagePayouts: true,
    connect: { accountId: connect.accountLinked ? 'acct_1' : null, accountType: 'STANDARD', ...connect },
  };
}

function stubFetch(deposits: () => unknown) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.startsWith('/api/admin/barbershop-settings/deposits')
      ? deposits()
      : url.startsWith('/api/admin/barbershop-settings/retail')
        ? {}
        : url.startsWith('/api/admin/barbershop-settings/google-booking')
          ? {}
          : url.startsWith('/api/setup/billing-status')
            ? {}
            : { identity: { name: 'Fade Room', townCity: 'Leeds', logoUrl: null }, hours: [], pause: null };
    return { ok: true, status: 200, json: async () => body } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const depositsCalls = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls.filter(([url]) => String(url) === '/api/admin/barbershop-settings/deposits').length;

describe('BarbershopSettingsPanel Stripe Connect action', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/admin?section=barbershop_settings');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('READY Stripe shows a passive connected state and no Connect/Continue button', async () => {
    stubFetch(() => depositsPayload(true, { accountLinked: true, disconnected: false, chargesEnabled: true }));
    render(<BarbershopSettingsPanel />);
    expect(await screen.findByText(/Stripe connected — ready for booking payments/)).toBeTruthy();
    expect(screen.queryByText(/Continue Stripe Connect/)).toBeNull();
    expect(document.querySelector('[data-stripe-connect-action]')).toBeNull();
  });

  it('linked but incomplete Stripe shows Finish Stripe setup', async () => {
    stubFetch(() => depositsPayload(false, { accountLinked: true, disconnected: false, chargesEnabled: false }));
    render(<BarbershopSettingsPanel />);
    expect(await screen.findByRole('button', { name: 'Finish Stripe setup' })).toBeTruthy();
    expect(screen.queryByText(/Continue Stripe Connect/)).toBeNull();
  });

  it('disconnected Stripe shows Reconnect Stripe; no account shows Connect Stripe', async () => {
    stubFetch(() => depositsPayload(false, { accountLinked: false, disconnected: true, chargesEnabled: false }));
    render(<BarbershopSettingsPanel />);
    expect(await screen.findByRole('button', { name: 'Reconnect Stripe' })).toBeTruthy();
    cleanup();

    stubFetch(() => depositsPayload(false, { accountLinked: false, disconnected: false, chargesEnabled: false }));
    render(<BarbershopSettingsPanel />);
    expect(await screen.findByRole('button', { name: 'Connect Stripe' })).toBeTruthy();
  });

  it('on Stripe return, re-checks with a bounded retry, updates without reload and refreshes the sidebar', async () => {
    window.history.replaceState({}, '', '/admin?section=barbershop_settings&connect=return');
    let calls = 0;
    const fetchMock = stubFetch(() => {
      calls += 1;
      return calls >= 3
        ? depositsPayload(true, { accountLinked: true, disconnected: false, chargesEnabled: true })
        : depositsPayload(false, { accountLinked: true, disconnected: false, chargesEnabled: false });
    });
    const refreshes = vi.fn();
    window.addEventListener(LAUNCH_CONTEXT_REFRESH_EVENT, refreshes);

    render(<BarbershopSettingsPanel />);

    expect(window.location.search).toBe('?section=barbershop_settings');
    await waitFor(
      () =>
        expect(document.querySelector('[data-stripe-connect-status]')?.textContent).toMatch(
          /Stripe connected — ready for booking payments/,
        ),
      { timeout: 4000 },
    );
    expect(screen.queryByRole('button', { name: 'Finish Stripe setup' })).toBeNull();
    expect(refreshes).toHaveBeenCalled();

    const settled = depositsCalls(fetchMock);
    await new Promise((resolve) => setTimeout(resolve, 3500));
    expect(depositsCalls(fetchMock)).toBe(settled);
    window.removeEventListener(LAUNCH_CONTEXT_REFRESH_EVENT, refreshes);
  }, 12000);

  it('stops polling after a few seconds when Stripe never becomes ready', async () => {
    window.history.replaceState({}, '', '/admin?section=barbershop_settings&connect=return');
    const fetchMock = stubFetch(() =>
      depositsPayload(false, { accountLinked: true, disconnected: false, chargesEnabled: false }),
    );
    render(<BarbershopSettingsPanel />);
    await waitFor(() => expect(screen.getByText(/Check back in a moment/)).toBeTruthy(), { timeout: 5000 });
    const settled = depositsCalls(fetchMock);
    // Initial settings load + the four bounded return checks.
    expect(settled).toBeLessThanOrEqual(5);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(depositsCalls(fetchMock)).toBe(settled);
  }, 12000);
});
