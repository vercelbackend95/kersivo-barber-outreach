/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildStarterLaunchProgress, emptyLaunchProgress } from '@/lib/admin/launchCtaProgress';
import AdminSidebarLaunchCta from './AdminSidebarLaunchCta';

describe('AdminSidebarLaunchCta', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders status and checklist from launch-context', async () => {
    const progress = emptyLaunchProgress();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ progress, pending: false, paid: false, paidHref: null }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminSidebarLaunchCta />);

    await waitFor(() => {
      expect(screen.getByText('IN PROGRESS')).toBeTruthy();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/setup/launch-context', { credentials: 'include' });
    expect(screen.getByText('Continue Setup')).toBeTruthy();
    expect(screen.getByText('Barbershop created')).toBeTruthy();
    expect(screen.getByText('First barber added')).toBeTruthy();
    expect(screen.getByText('Services added')).toBeTruthy();
    expect(screen.getByText('Set up your retail shop')).toBeTruthy();

    const cta = screen.getByRole('button');
    expect(cta.className).toContain('admin-sidebar-launch-cta');
    expect(cta.className).not.toContain('--conversion');
    expect(cta.querySelector('.admin-sidebar-launch-cta__checklist')).toBeTruthy();
  });

  it('Starter replaces the Retail CTA with Connect Stripe to launch bookings', async () => {
    const progress = buildStarterLaunchProgress({
      onboardingCompleted: true,
      activeBookableBarbers: 1,
      activeServiceCount: 1,
      servicesMeetPriceFloor: true,
      stripeReady: false,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          progress,
          pending: false,
          paid: false,
          paidHref: null,
          productState: 'FREE_BOOKING',
          starterLaunch: {
            stripeAccountLinked: false,
            stripeReady: false,
            stripeDisconnected: false,
            servicesMeetPriceFloor: true,
            activeServiceCount: 1,
            activeBookableBarbers: 1,
            publicBookingReady: false,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Stripe setup unavailable in test.' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminSidebarLaunchCta />);

    const button = await screen.findByRole('button', { name: /Launch your bookings/i });
    expect(screen.getByText('Stripe connected')).toBeTruthy();
    expect(screen.queryByText('Set up your retail shop')).toBeNull();
    expect(screen.getByText(/£5 online payment/i)).toBeTruthy();
    expect(screen.getByText(/0% KERSIVO fee/i)).toBeTruthy();

    fireEvent.click(button);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/barbershop-settings/deposits', {
        method: 'POST',
        credentials: 'include',
      });
    });
  });

  it('Starter with an existing incomplete Stripe account says Finish Stripe setup', async () => {
    const progress = buildStarterLaunchProgress({
      onboardingCompleted: true,
      activeBookableBarbers: 1,
      activeServiceCount: 1,
      servicesMeetPriceFloor: true,
      stripeReady: false,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          progress,
          paid: false,
          productState: 'FREE_BOOKING',
          starterLaunch: {
            stripeAccountLinked: true,
            stripeReady: false,
            stripeDisconnected: false,
            servicesMeetPriceFloor: true,
            activeServiceCount: 1,
            activeBookableBarbers: 1,
            publicBookingReady: false,
          },
        }),
      }),
    );

    render(<AdminSidebarLaunchCta />);
    expect(await screen.findByText('Finish Stripe setup')).toBeTruthy();
  });

  it('hides the Starter launch CTA once public bookings are live', async () => {
    const progress = buildStarterLaunchProgress({
      onboardingCompleted: true,
      activeBookableBarbers: 1,
      activeServiceCount: 1,
      servicesMeetPriceFloor: true,
      stripeReady: true,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          progress,
          paid: false,
          productState: 'FREE_BOOKING',
          starterLaunch: {
            stripeAccountLinked: true,
            stripeReady: true,
            stripeDisconnected: false,
            servicesMeetPriceFloor: true,
            activeServiceCount: 1,
            activeBookableBarbers: 1,
            publicBookingReady: true,
          },
        }),
      }),
    );

    const { container } = render(<AdminSidebarLaunchCta />);
    await waitFor(() => expect(container.querySelector('.admin-sidebar-launch-cta--loading')).toBeNull());
    expect(container.querySelector('.admin-sidebar-launch-cta')).toBeNull();
  });
});
