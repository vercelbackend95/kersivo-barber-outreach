/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildStarterLaunchProgress, emptyLaunchProgress } from '@/lib/admin/launchCtaProgress';
import { LAUNCH_CONTEXT_REFRESH_EVENT } from '@/lib/admin/launchContextRefresh';
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
    expect(screen.queryByText(/£5 online payment/i)).toBeNull();
    expect(screen.queryByText(/0% KERSIVO fee/i)).toBeNull();

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

  describe('live Starter keeps a Full KERSIVO conversion card', () => {
    const liveProgress = () =>
      buildStarterLaunchProgress({
        onboardingCompleted: true,
        activeBookableBarbers: 1,
        activeServiceCount: 1,
        servicesMeetPriceFloor: true,
        stripeReady: true,
      });
    const liveState = (qrKitRequested: boolean) => ({
      stripeAccountLinked: true,
      stripeReady: true,
      stripeDisconnected: false,
      servicesMeetPriceFloor: true,
      activeServiceCount: 1,
      activeBookableBarbers: 1,
      publicBookingReady: true,
      qrKitRequested,
    });
    const payload = (qrKitRequested: boolean) => ({
      ok: true,
      json: async () => ({
        progress: liveProgress(),
        paid: false,
        productState: 'FREE_BOOKING',
        starterLaunch: liveState(qrKitRequested),
      }),
    });

    it('shows STARTER LIVE / Unlock Full KERSIVO and opens the existing upgrade flow', async () => {
      const fetchMock = vi.fn().mockResolvedValue(payload(false));
      vi.stubGlobal('fetch', fetchMock);
      const onUpgrade = vi.fn();

      render(<AdminSidebarLaunchCta onUpgrade={onUpgrade} />);
      const card = await screen.findByRole('button', { name: /STARTER LIVE: Unlock Full KERSIVO/i });
      expect(screen.getByText('£39/month')).toBeTruthy();
      expect(screen.getByText('Online bookings live')).toBeTruthy();
      expect(screen.getByText('Order your QR Kit (optional)')).toBeTruthy();
      expect(screen.getByText('Get your branded website')).toBeTruthy();
      expect(screen.getByText('Add your retail shop')).toBeTruthy();
      expect(screen.queryByText(/Stripe/)).toBeNull();
      expect(screen.getByRole('button', { name: 'Order QR Kit' })).toBeTruthy();

      fireEvent.click(card);
      expect(onUpgrade).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('shows QR Kit requested once a kit exists and drops the QR action', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(payload(true)));
      render(<AdminSidebarLaunchCta onUpgrade={vi.fn()} />);
      expect(await screen.findByText('QR Kit requested')).toBeTruthy();
      expect(screen.queryByText('Order your QR Kit (optional)')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Order QR Kit' })).toBeNull();
    });

    it('refetches launch-context on the shared refresh event (no page reload)', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(payload(false)).mockResolvedValueOnce(payload(true));
      vi.stubGlobal('fetch', fetchMock);
      render(<AdminSidebarLaunchCta onUpgrade={vi.fn()} />);
      expect(await screen.findByText('Order your QR Kit (optional)')).toBeTruthy();

      act(() => {
        window.dispatchEvent(new CustomEvent(LAUNCH_CONTEXT_REFRESH_EVENT));
      });
      expect(await screen.findByText('QR Kit requested')).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('switches from Finish Stripe setup to the live card after a Stripe refresh event', async () => {
    const pendingProgress = buildStarterLaunchProgress({
      onboardingCompleted: true,
      activeBookableBarbers: 1,
      activeServiceCount: 1,
      servicesMeetPriceFloor: true,
      stripeReady: false,
    });
    const readyProgress = buildStarterLaunchProgress({
      onboardingCompleted: true,
      activeBookableBarbers: 1,
      activeServiceCount: 1,
      servicesMeetPriceFloor: true,
      stripeReady: true,
    });
    const base = {
      stripeAccountLinked: true,
      stripeDisconnected: false,
      servicesMeetPriceFloor: true,
      activeServiceCount: 1,
      activeBookableBarbers: 1,
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            progress: pendingProgress,
            productState: 'FREE_BOOKING',
            starterLaunch: { ...base, stripeReady: false, publicBookingReady: false },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            progress: readyProgress,
            productState: 'FREE_BOOKING',
            starterLaunch: { ...base, stripeReady: true, publicBookingReady: true },
          }),
        }),
    );
    render(<AdminSidebarLaunchCta onUpgrade={vi.fn()} />);
    expect(await screen.findByText('Finish Stripe setup')).toBeTruthy();
    act(() => {
      window.dispatchEvent(new CustomEvent(LAUNCH_CONTEXT_REFRESH_EVENT));
    });
    expect(await screen.findByText('Unlock Full KERSIVO')).toBeTruthy();
    expect(screen.queryByText('Finish Stripe setup')).toBeNull();
  });

  it('after Full → Starter, a stale paid flag never hides the Reconnect Stripe recovery CTA', async () => {
    const progress = buildStarterLaunchProgress({
      onboardingCompleted: true,
      activeBookableBarbers: 3,
      activeServiceCount: 2,
      servicesMeetPriceFloor: true,
      stripeReady: false,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          progress,
          paid: true,
          productState: 'FREE_BOOKING',
          starterLaunch: {
            stripeAccountLinked: false,
            stripeReady: false,
            stripeDisconnected: true,
            servicesMeetPriceFloor: true,
            activeServiceCount: 2,
            activeBookableBarbers: 3,
            publicBookingReady: false,
          },
        }),
      }),
    );

    render(<AdminSidebarLaunchCta />);
    expect(await screen.findByText('Reconnect Stripe')).toBeTruthy();
  });

  it('a legacy-Express Starter is sent to the Standard onboarding flow', async () => {
    const progress = buildStarterLaunchProgress({
      onboardingCompleted: true,
      activeBookableBarbers: 2,
      activeServiceCount: 2,
      servicesMeetPriceFloor: true,
      stripeReady: false,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          progress,
          paid: false,
          productState: 'FREE_BOOKING',
          starterLaunch: {
            stripeAccountLinked: true,
            stripeReady: false,
            stripeDisconnected: false,
            stripeRequiresStandard: true,
            servicesMeetPriceFloor: true,
            activeServiceCount: 2,
            activeBookableBarbers: 2,
            publicBookingReady: false,
          },
        }),
      })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Stripe setup unavailable in test.' }) });
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminSidebarLaunchCta />);
    const button = await screen.findByRole('button', { name: /Connect Stripe Standard/i });
    expect(screen.getByText(/existing Stripe account stays in place for past payments and refunds/i)).toBeTruthy();

    fireEvent.click(button);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/barbershop-settings/deposits', {
        method: 'POST',
        credentials: 'include',
      });
    });
  });

  it('after Full → Starter, names the services below £5 that pause online bookings', async () => {
    const progress = buildStarterLaunchProgress({
      onboardingCompleted: true,
      activeBookableBarbers: 2,
      activeServiceCount: 3,
      servicesMeetPriceFloor: false,
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
            servicesMeetPriceFloor: false,
            activeServiceCount: 3,
            activeBookableBarbers: 2,
            publicBookingReady: false,
            servicesBelowMinimum: [{ id: 'svc_low', name: 'Line-up', pricePence: 300 }],
          },
        }),
      }),
    );

    render(<AdminSidebarLaunchCta />);
    expect(await screen.findByText('Fix service prices')).toBeTruthy();
    expect(screen.getByText(/Raise the price or make inactive: Line-up\./)).toBeTruthy();
  });
});
