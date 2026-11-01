/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./AdminDesktopDashHeroSlot', () => ({
  default: () => null,
}));
vi.mock('./AdminWizardSheetLayer', () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? React.createElement('div', { role: 'dialog' }, children) : null,
}));
vi.mock('./service-wizard/ServiceWizard', () => ({
  default: () =>
    React.createElement('h2', { id: 'admin-service-form-title' }, 'Build a bookable service'),
}));
vi.mock('./adminAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./adminAuth')>();
  return {
    ...actual,
    isPublicAdminDemoMode: () => false,
    notifyAdminDemoBlocked: () => undefined,
    adminFetchJson: vi.fn(async (url: string) => {
      if (String(url).includes('/api/admin/services')) {
        return { services: [], categories: [] };
      }
      if (String(url).includes('/api/admin/barbers')) {
        return { barbers: [] };
      }
      return {};
    }),
  };
});

import ServicesAdminPanel from './ServicesAdminPanel';

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
  window.history.replaceState(null, '', '/admin/services?add=1');
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
});

describe('ServicesAdminPanel add intent', () => {
  it('renders the labelled header button, empty-state CTA, opens the sheet once, then strips add', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    render(<ServicesAdminPanel openCreateOnMount />);

    expect(await screen.findByRole('button', { name: 'Add service' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Add your first service' })).toBeTruthy();
    expect(screen.getByText('Add the services customers can book, with prices and durations.')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByText('Build a bookable service')).toBeTruthy();
    });

    await waitFor(() => {
      expect(replaceState.mock.calls.some((call) => call[2] === '/admin/services')).toBe(true);
    });
    expect(replaceState.mock.calls.some((call) => String(call[2]).includes('add='))).toBe(false);
  });
});
