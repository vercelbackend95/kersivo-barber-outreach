/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./BookingsAdminPanel', () => ({
  default: () => React.createElement('div', { 'data-testid': 'bookings-panel' }),
}));
vi.mock('./ServicesAdminPanel', () => ({
  default: () => React.createElement('div', { 'data-testid': 'services-panel' }),
}));
vi.mock('./ShopAdminPanel', () => ({
  default: () => React.createElement('div', { 'data-testid': 'shop-panel' }),
}));
vi.mock('./ClientsAdminPanel', () => ({ default: () => null }));
vi.mock('./AiAssistantPanel', () => ({ default: () => null }));
vi.mock('./BarbershopSettingsPanel', () => ({ default: () => null }));
vi.mock('./SiteLaunchHubPanel', () => ({ default: () => null }));
vi.mock('./AdminGlobalMobileNextStripHost', () => ({ default: () => null }));
vi.mock('./ShopDepartureBanner', () => ({ default: () => React.createElement('div', { 'data-testid': 'departure-banner' }) }));
vi.mock('./useAdminTodayBookingsLive', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./useAdminTodayBookingsLive')>();
  return {
    ...actual,
    AdminTodayBookingsLiveProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});
vi.mock('./adminAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./adminAuth')>();
  return { ...actual, installAdminFetchInterceptor: () => undefined };
});
vi.mock('@/lib/auth-client', () => ({
  authClient: { getSession: vi.fn(async () => null), signOut: vi.fn(async () => undefined) },
}));

import AdminPanel from './AdminPanel';
import type { AdminHubChrome } from '@/lib/adminHub/hubChrome';

const hubChrome: AdminHubChrome = {
  section: 'services',
  setup: null,
  unreadMessages: 0,
  isOperator: false,
  shopName: 'Fade Lab',
  shopLogoUrl: null,
  profileUser: { name: 'Sam', email: 'sam@example.com', image: null },
  underConstruction: true,
};

function json(body: unknown) {
  return { ok: true, status: 200, json: async () => body, clone() { return this; } };
}

beforeEach(() => {
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
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/admin/session')) {
        return json({
          ok: true,
          via: 'hub',
          shopId: 'shop-draft',
          onboardingCompleted: false,
          onboardingRequired: true,
          onboardingGate: 'onboarding',
          permissions: ['catalog.manage', 'team.read', 'retail.manage'],
          productAccess: null,
          shop: { name: 'Fade Lab', logoUrl: null },
          user: null,
        });
      }
      return json({});
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AdminPanel hubChrome', () => {
  it('never redirects to /admin/onboarding', async () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, assign, pathname: '/admin/services', search: '', hash: '' },
    });

    render(<AdminPanel initialSection="services" hubChrome={hubChrome} />);
    await waitFor(() => expect(assign).not.toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    expect(assign).not.toHaveBeenCalledWith('/admin/onboarding');
    expect(assign).not.toHaveBeenCalled();

    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });
});
