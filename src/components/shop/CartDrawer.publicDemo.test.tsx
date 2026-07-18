/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import CartDrawer from './CartDrawer';
import { addItem, clear, openCart, getSnapshot } from '@/lib/shop/cartStore';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';

vi.mock('@/lib/consent/events', () => ({
  trackConsentedEvent: vi.fn(),
}));

import { trackConsentedEvent } from '@/lib/consent/events';

const trackSpy = vi.mocked(trackConsentedEvent);

function seedDemoCart() {
  clear();
  addItem({
    productId: 'demo-product-matte-pomade',
    name: 'Matte Pomade',
    pricePence: 1800,
    quantity: 1,
  });
  openCart();
}

describe('CartDrawer publicDemoMode', () => {
  const fetchSpy = vi.fn();
  const locationHrefSetter = vi.fn();

  beforeEach(() => {
    trackSpy.mockClear();
    fetchSpy.mockReset();
    locationHrefSetter.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
    clear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        get href() {
          return 'http://localhost/shop';
        },
        set href(value: string) {
          locationHrefSetter(value);
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    clear();
    vi.unstubAllGlobals();
  });

  it('completes locally without fetch, Stripe redirect, or PII in analytics', async () => {
    seedDemoCart();
    render(<CartDrawer publicDemoMode />);

    expect(screen.getByText(/interactive retail demo/i)).toBeTruthy();
    expect(screen.queryByText(/Continue to secure checkout/i)).toBeNull();
    expect(screen.queryByText(/Stripe Checkout collects your email/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Complete demo order' }));

    await waitFor(() => {
      expect(screen.getByText('Demo order complete')).toBeTruthy();
    });

    expect(
      screen.getByText(/This was a demonstration only. No payment was taken and no order was created./i),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View KERSIVO pricing' }).getAttribute('href')).toBe(
      '/#pricing',
    );
    expect(screen.getByRole('link', { name: 'Talk to KERSIVO' }).getAttribute('href')).toBe(
      '/#contact',
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(locationHrefSetter).not.toHaveBeenCalled();
    expect(getSnapshot().items).toHaveLength(0);

    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy).toHaveBeenCalledWith(
      FUNNEL_EVENTS.public_shop_demo_completed,
      undefined,
      'analytics',
    );
    const serialized = JSON.stringify(trackSpy.mock.calls[0]);
    expect(serialized).not.toContain('Matte Pomade');
    expect(serialized).not.toContain('demo-product-matte-pomade');
    expect(serialized).not.toMatch(/@/);
  });

  it('does not call checkout when bag is empty', () => {
    clear();
    openCart();
    render(<CartDrawer publicDemoMode />);

    const completeBtn = screen.getByRole('button', { name: 'Complete demo order' });
    expect(completeBtn).toHaveProperty('disabled', true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it('guards against double-click completing the same demo twice', async () => {
    seedDemoCart();
    render(<CartDrawer publicDemoMode />);

    const completeBtn = screen.getByRole('button', { name: 'Complete demo order' });
    fireEvent.click(completeBtn);
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(screen.getByText('Demo order complete')).toBeTruthy();
    });

    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getAllByText('Demo order complete')).toHaveLength(1);
  });

  it('Try the demo again resets success, closes the drawer, and does not track or fetch', async () => {
    seedDemoCart();
    render(<CartDrawer publicDemoMode />);

    fireEvent.click(screen.getByRole('button', { name: 'Complete demo order' }));
    await waitFor(() => {
      expect(screen.getByText('Demo order complete')).toBeTruthy();
    });
    expect(trackSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Try the demo again' }));

    expect(screen.queryByText('Demo order complete')).toBeNull();
    expect(getSnapshot().isOpen).toBe(false);
    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('allows a second public_shop_demo_completed after starting a new demo', async () => {
    seedDemoCart();
    render(<CartDrawer publicDemoMode />);

    fireEvent.click(screen.getByRole('button', { name: 'Complete demo order' }));
    await waitFor(() => {
      expect(screen.getByText('Demo order complete')).toBeTruthy();
    });
    expect(trackSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Try the demo again' }));
    expect(getSnapshot().isOpen).toBe(false);

    seedDemoCart();
    await waitFor(() => {
      expect(getSnapshot().items).toHaveLength(1);
      expect(getSnapshot().isOpen).toBe(true);
      expect(screen.getByRole('button', { name: 'Complete demo order' })).toHaveProperty(
        'disabled',
        false,
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Complete demo order' }));

    await waitFor(() => {
      expect(screen.getByText('Demo order complete')).toBeTruthy();
    });

    expect(trackSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(trackSpy).toHaveBeenNthCalledWith(
      2,
      FUNNEL_EVENTS.public_shop_demo_completed,
      undefined,
      'analytics',
    );
  });
});

describe('CartDrawer testOrderMode regression', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
    clear();
  });

  afterEach(() => {
    cleanup();
    clear();
    vi.unstubAllGlobals();
  });

  it('still posts to /api/admin/shop/test-order', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        order: {
          id: 'order-test-1',
          status: 'READY_FOR_PICKUP',
          totalPence: 1800,
          totalFormatted: '£18.00',
          items: [{ name: 'Matte Pomade', quantity: 1, lineTotalFormatted: '£18.00' }],
        },
      }),
    });

    clear();
    addItem({
      productId: 'prod-owner-1',
      name: 'Matte Pomade',
      pricePence: 1800,
      quantity: 1,
    });
    openCart();

    render(<CartDrawer testOrderMode />);

    fireEvent.click(screen.getByRole('button', { name: 'Place Test Order' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/admin/shop/test-order');
    expect(init.method).toBe('POST');
    expect(fetchSpy.mock.calls.some((call) => String(call[0]).includes('/api/shop/checkout'))).toBe(
      false,
    );

    await waitFor(() => {
      expect(screen.getByText('Test order created')).toBeTruthy();
    });
  });
});
