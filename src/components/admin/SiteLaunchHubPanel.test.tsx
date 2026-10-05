/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SiteLaunchHubPanel from './SiteLaunchHubPanel';

const basePayload = {
  shopId: 'shop-1',
  status: 'approved',
  previewUrl: 'https://preview.example',
  siteVersion: 'v1',
  previewReadyAt: null,
  approvedAt: '2026-10-05T10:00:00.000Z',
  approvedByEmail: 'owner@example.com',
  approvedVersion: 'v1',
  goLiveAt: '2026-10-05T10:00:00.000Z',
};

function stubLaunch(payload: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    }),
  );
}

describe('SiteLaunchHubPanel booking test link', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens the OPS-verified live own-domain destination when one exists', async () => {
    stubLaunch({
      ...basePayload,
      liveBookingDestination: 'https://examplebarbers.co.uk/book',
    });

    render(<SiteLaunchHubPanel />);

    const link = await screen.findByRole('link', { name: 'Test online booking' });
    expect(link.getAttribute('href')).toBe('https://examplebarbers.co.uk/book');
  });

  it('keeps the hosted booking fallback before own-domain verification', async () => {
    stubLaunch({
      ...basePayload,
      liveBookingDestination: null,
    });

    render(<SiteLaunchHubPanel />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Test online booking' }).getAttribute('href')).toBe(
        '/book/shop-1',
      );
    });
  });
});
