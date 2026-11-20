/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StorefrontCartDrawer from './StorefrontCartDrawer';
import { addItem, bindCartNamespace, clear, closeCart, getSnapshot, openCart } from '@/lib/shop/cartStore';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';

vi.mock('@/lib/consent/events', () => ({
  trackConsentedEvent: vi.fn(),
}));

import { trackConsentedEvent } from '@/lib/consent/events';

const trackSpy = vi.mocked(trackConsentedEvent);

const publicDemoProps = {
  mode: 'publicDemo' as const,
  shopId: '',
  shopName: 'KERSIVO',
  themeId: 'kersivo' as const,
  priceFormat: 'gbp' as const,
  exploreHref: '/shop',
  checkout: { type: 'publicDemo' as const },
};

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

function mountAddButton() {
  const button = document.createElement('button');
  button.setAttribute('data-add-to-cart', '');
  button.dataset.productId = 'demo-product-matte-pomade';
  button.dataset.productName = 'Matte Pomade';
  button.dataset.productPricePence = '1800';
  document.body.appendChild(button);
  return button;
}

describe('StorefrontCartDrawer publicDemo', () => {
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
    closeCart();
    clear();
    bindCartNamespace();
    document.querySelectorAll('[data-add-to-cart]').forEach((node) => node.remove());
    document.querySelectorAll('[data-bl-bag-button]').forEach((node) => node.remove());
    vi.unstubAllGlobals();
  });

  it('completes locally without fetch, Stripe redirect, or PII in analytics', async () => {
    seedDemoCart();
    render(<StorefrontCartDrawer {...publicDemoProps} />);

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
    expect(screen.getByRole('link', { name: 'View KERSIVO pricing' }).getAttribute('href')).toBe('/pricing');
    expect(screen.getByRole('link', { name: 'Talk to KERSIVO' }).getAttribute('href')).toBe('/#contact');

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
    render(<StorefrontCartDrawer {...publicDemoProps} />);

    expect(screen.queryByRole('button', { name: 'Complete demo order' })).toBeNull();
    expect(screen.getByRole('link', { name: 'EXPLORE PRODUCTS' })).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it('names the bag trigger Open bag, N items', () => {
    const button = document.createElement('button');
    button.setAttribute('data-bl-bag-button', '');
    button.setAttribute('aria-label', 'Open bag, 0 items');
    document.body.appendChild(button);
    seedDemoCart();
    render(<StorefrontCartDrawer {...publicDemoProps} />);
    expect(button.getAttribute('aria-label')).toBe('Open bag, 1 item');
    button.remove();
  });

  it('guards against double-click completing the same demo twice', async () => {
    seedDemoCart();
    render(<StorefrontCartDrawer {...publicDemoProps} />);

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
    render(<StorefrontCartDrawer {...publicDemoProps} />);

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
    render(<StorefrontCartDrawer {...publicDemoProps} />);

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
      expect(screen.getByRole('button', { name: 'Complete demo order' })).toHaveProperty('disabled', false);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Complete demo order' }));

    await waitFor(() => {
      expect(screen.getByText('Demo order complete')).toBeTruthy();
    });

    expect(trackSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('adds to bag with a toast and does not auto-open', async () => {
    clear();
    render(<StorefrontCartDrawer {...publicDemoProps} />);
    const button = mountAddButton();

    fireEvent.click(button);

    await waitFor(() => {
      expect(getSnapshot().items).toHaveLength(1);
    });
    expect(getSnapshot().isOpen).toBe(false);
    expect(screen.getByText('Matte Pomade added to bag')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View bag' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'CONTINUE TO CHECKOUT' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'View bag' }));
    expect(getSnapshot().isOpen).toBe(true);
    button.remove();
  });
});

describe('StorefrontCartDrawer testOrder', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
    clear();
  });

  afterEach(() => {
    cleanup();
    closeCart();
    clear();
    bindCartNamespace();
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

    addItem({
      productId: 'prod-owner-1',
      name: 'Matte Pomade',
      pricePence: 1800,
      quantity: 1,
    });
    openCart();

    render(
      <StorefrontCartDrawer
        mode="testOrder"
        shopId=""
        shopName="My shop"
        themeId="kersivo"
        priceFormat="gbp"
        exploreHref="/admin/test-shop"
        checkout={{ type: 'testOrder' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Place Test Order' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/admin/shop/test-order');
    expect(init.method).toBe('POST');
    expect(fetchSpy.mock.calls.some((call) => String(call[0]).includes('/api/shop/checkout'))).toBe(false);

    await waitFor(() => {
      expect(screen.getByText('Test order created')).toBeTruthy();
    });
  });
});

describe('StorefrontCartDrawer BLACKLINE href checkout', () => {
  afterEach(() => {
    cleanup();
    closeCart();
    clear();
    bindCartNamespace();
    document.querySelectorAll('[data-add-to-cart]').forEach((node) => node.remove());
  });

  it('navigates to demo checkout and uses the red cart theme', () => {
    bindCartNamespace({ shopId: 'blackline-barbers-demo' });
    addItem({
      productId: 'bl-product-ironclad-pomade',
      name: 'Ironclad Pomade',
      pricePence: 1900,
      quantity: 1,
    });
    openCart();

    const { container } = render(
      <StorefrontCartDrawer
        mode="demo"
        shopId="blackline-barbers-demo"
        shopName="Blackline Barbers"
        themeId="blackline"
        priceFormat="demo"
        imageFallback="wordmark"
        exploreHref="/demo/shop"
        checkout={{ type: 'href', href: '/demo/shop/checkout' }}
      />,
    );

    expect(container.querySelector('[data-sf-cart-theme="blackline"]')).toBeTruthy();
    const checkout = screen.getByRole('link', { name: 'CONTINUE TO CHECKOUT' });
    expect(checkout.getAttribute('href')).toBe('/demo/shop/checkout');
    expect(screen.getAllByText('£19').length).toBeGreaterThan(0);
  });
});

describe('StorefrontCartDrawer live pay at collection', () => {
  const fetchSpy = vi.fn();
  const locationHrefSetter = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    locationHrefSetter.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        get href() {
          return 'http://localhost/shop/shop_1';
        },
        set href(value: string) {
          locationHrefSetter(value);
        },
      },
    });
    bindCartNamespace({ shopId: 'shop_1' });
    clear();
    addItem({ productId: 'prod_1', name: 'Matte Pomade', pricePence: 1800, quantity: 2 });
    openCart();
  });

  afterEach(() => {
    cleanup();
    closeCart();
    clear();
    bindCartNamespace();
    vi.unstubAllGlobals();
  });

  function renderLive(paymentMode?: 'FULL_UPFRONT' | 'PAY_AT_COLLECTION') {
    render(
      <StorefrontCartDrawer
        mode="production"
        shopId="shop_1"
        shopName="Fade Room"
        themeId="kersivo"
        priceFormat="gbp"
        exploreHref="/shop/shop_1"
        checkout={paymentMode ? { type: 'live', paymentMode } : { type: 'live' }}
      />,
    );
  }

  it('asks for details, reserves without Stripe and shows the pickup reference', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        kind: 'reserved',
        paymentMode: 'PAY_AT_COLLECTION',
        orderId: 'ord_res',
        reference: 'KRV-RESV01',
        totalPence: 3600,
        customerEmail: 'sam@example.com',
        items: [{ name: 'Matte Pomade', quantity: 2, lineTotalPence: 3600 }],
      }),
    });
    renderLive('PAY_AT_COLLECTION');

    expect(screen.getByText('Nothing to pay now. You pay in the shop when you collect.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'CONTINUE · PAY WHEN COLLECTING' }));
    expect(fetchSpy).not.toHaveBeenCalled();
    // The Continue click must not also submit the details form that replaces it.
    expect(screen.getByLabelText('Full name')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();

    // Client-side validation blocks an empty name.
    fireEvent.click(screen.getByRole('button', { name: 'RESERVE · PAY WHEN COLLECTING' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Enter your name');
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Sam Client' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sam@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'RESERVE · PAY WHEN COLLECTING' }));

    await waitFor(() => {
      expect(screen.getByText('Order reserved')).toBeTruthy();
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/public/shop/shop_1/checkout');
    expect(JSON.parse(String(init.body))).toMatchObject({
      items: [{ productId: 'prod_1', quantity: 2 }],
      customerName: 'Sam Client',
      customerEmail: 'sam@example.com',
    });
    expect(screen.getByText('KRV-RESV01')).toBeTruthy();
    expect(screen.getByText('To pay on collection')).toBeTruthy();
    expect(locationHrefSetter).not.toHaveBeenCalled();
    expect(getSnapshot().items).toHaveLength(0);
  });

  it('switches to the details step when the API says the shop takes payment at collection', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'Enter your name so the shop knows who is collecting.',
        code: 'customer_details_required',
        field: 'customerName',
        paymentMode: 'PAY_AT_COLLECTION',
      }),
    });
    renderLive();

    fireEvent.click(screen.getByRole('button', { name: 'CONTINUE TO CHECKOUT' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Full name')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'RESERVE · PAY WHEN COLLECTING' })).toBeTruthy();
    expect(locationHrefSetter).not.toHaveBeenCalled();
  });

  it('keeps the Stripe redirect for full payment upfront', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ kind: 'redirect', url: 'https://checkout.stripe.test/cs_1' }),
    });
    renderLive('FULL_UPFRONT');

    fireEvent.click(screen.getByRole('button', { name: 'CONTINUE TO CHECKOUT' }));

    await waitFor(() => {
      expect(locationHrefSetter).toHaveBeenCalledWith('https://checkout.stripe.test/cs_1');
    });
    expect(screen.queryByLabelText('Full name')).toBeNull();
  });
});
