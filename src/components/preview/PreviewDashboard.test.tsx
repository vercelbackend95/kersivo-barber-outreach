/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import PreviewDashboard from './PreviewDashboard';

describe('PreviewDashboard', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('gates when preview cookie is missing', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Preview session required.' }), { status: 401 }),
    );

    render(React.createElement(PreviewDashboard));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /preview session expired/i })).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: /build my barbershop/i }).getAttribute('href')).toBe(
      '/preview/onboarding',
    );
  });

  it('shows shop name from onboarding state', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          shop: { id: 'shop_1', name: 'Fade Lab', townCity: 'Leeds', logoUrl: null },
          onboardingCompleted: true,
          onboardingCurrentStep: 6,
          onboardingCompletedAt: null,
          barbers: [{ id: 'b1', name: 'Alex', avatarUrl: null, isActive: true, sortOrder: 0 }],
          services: [
            {
              id: 's1',
              name: 'Haircut',
              pricePence: 2500,
              durationMinutes: 30,
              isActive: true,
              displayOrder: 0,
              category: 'featured',
            },
          ],
          hours: [],
          shopHours: [],
          user: null,
        }),
        { status: 200 },
      ),
    );

    render(React.createElement(PreviewDashboard));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Fade Lab' })).toBeTruthy();
    });
    expect(
      screen.getByRole('link', { name: /get started — £39\/month/i }).getAttribute('href'),
    ).toBe('/admin/launch');
    expect(screen.getByRole('heading', { name: 'Bookings' })).toBeTruthy();
    expect(screen.getByText(/no bookings yet/i)).toBeTruthy();
  });
});
