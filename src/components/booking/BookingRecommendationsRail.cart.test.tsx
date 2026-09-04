/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import BookingRecommendationsRail from './BookingRecommendationsRail';
import StorefrontCartDrawer from '@/components/shop/storefront/StorefrontCartDrawer';
import {
  bindCartNamespace,
  cartStorageKeyForShop,
  clear,
  closeCart,
  getSnapshot,
} from '@/lib/shop/cartStore';

vi.mock('@/lib/consent/events', () => ({
  trackConsentedEvent: vi.fn(() => true),
}));

const SHOP_ID = 'tenant-shop-cart-1';
const SERVICE_ID = 'svc-skin-fade';

const twoProducts = {
  ok: true,
  exposureId: 'exp-rail-cart-1',
  shopId: SHOP_ID,
  serviceIds: [SERVICE_ID],
  products: [
    {
      id: 'prod-fibre',
      name: 'Hair Fibre',
      pricePence: 1800,
      category: 'Styling',
      imageUrl: null,
      available: true,
      requiresOptions: false,
    },
    {
      id: 'prod-clay',
      name: 'Matte Clay',
      pricePence: 1900,
      category: 'Styling',
      imageUrl: null,
      available: true,
      requiresOptions: false,
    },
  ],
};

function productionCartProps() {
  return {
    mode: 'production' as const,
    shopId: SHOP_ID,
    shopName: 'Northgate Barbers',
    themeId: 'kersivo' as const,
    priceFormat: 'gbp' as const,
    exploreHref: `/shop/${SHOP_ID}`,
    checkout: { type: 'live' as const },
  };
}

function resetCartHarness() {
  closeCart();
  clear();
  bindCartNamespace();
  window.localStorage.clear();
  delete window.__KERSIVO_CART_NAMESPACE__;
  document.querySelectorAll('[data-add-to-cart]').forEach((node) => node.remove());
}

describe('BookingRecommendationsRail → cart integration', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    resetCartHarness();
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
    window.__KERSIVO_CART_NAMESPACE__ = { shopId: SHOP_ID };
  });

  afterEach(() => {
    cleanup();
    resetCartHarness();
    vi.unstubAllGlobals();
  });

  it('renders the rail when the API returns at least two products', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => twoProducts,
    });

    render(
      <>
        <StorefrontCartDrawer {...productionCartProps()} />
        <BookingRecommendationsRail
          shopId={SHOP_ID}
          serviceId={SERVICE_ID}
          productHrefBase={`/shop/${SHOP_ID}`}
        />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Recommended for you' })).toBeTruthy();
    });
    expect(screen.getByText('Hair Fibre')).toBeTruthy();
    expect(screen.getByText('Matte Clay')).toBeTruthy();
  });

  it('uses service-specific conversion heading when serviceName is provided', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => twoProducts,
    });

    render(
      <BookingRecommendationsRail
        shopId={SHOP_ID}
        serviceId={SERVICE_ID}
        serviceName="Skin Fade"
        productHrefBase={`/shop/${SHOP_ID}`}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Recommended for your Skin Fade' })).toBeTruthy();
    });
    expect(
      screen.getByText('Chosen to suit your booking. Add now and collect at your appointment.'),
    ).toBeTruthy();
  });

  it('quick-add mutates tenant cartStore and shows View bag toast', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => twoProducts,
    });

    render(
      <>
        <StorefrontCartDrawer {...productionCartProps()} />
        <BookingRecommendationsRail
          shopId={SHOP_ID}
          serviceId={SERVICE_ID}
          productHrefBase={`/shop/${SHOP_ID}`}
        />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Recommended for you' })).toBeTruthy();
    });

    const addButtons = screen.getAllByRole('button', { name: /Add to bag:/i });
    expect(addButtons.length).toBeGreaterThan(0);
    fireEvent.click(addButtons[0]!);

    await waitFor(() => {
      expect(getSnapshot().items.map((item) => item.productId)).toContain('prod-fibre');
    });

    expect(getSnapshot().isOpen).toBe(false);
    await waitFor(() => {
      expect(document.querySelector('[data-sf-cart-toast]')).toBeTruthy();
    });
    expect(document.querySelector('[data-sf-cart-toast]')?.textContent).toMatch(/Hair Fibre added to bag/i);
    expect(screen.getByRole('button', { name: 'View bag' })).toBeTruthy();

    const storageKey = cartStorageKeyForShop(SHOP_ID);
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]') as Array<{
      productId: string;
    }>;
    expect(stored.some((item) => item.productId === 'prod-fibre')).toBe(true);
  });

  it('View bag opens the drawer after quick-add', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => twoProducts,
    });

    render(
      <>
        <StorefrontCartDrawer {...productionCartProps()} />
        <BookingRecommendationsRail
          shopId={SHOP_ID}
          serviceId={SERVICE_ID}
          productHrefBase={`/shop/${SHOP_ID}`}
        />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Recommended for you' })).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Add to bag:/i })[0]!);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'View bag' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'View bag' }));
    await waitFor(() => {
      expect(getSnapshot().isOpen).toBe(true);
    });
  });

  it('hides the rail for empty and single-product responses', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...twoProducts, products: [] }),
    });

    const empty = render(
      <div data-testid="confirmation-shell">
        <p>Booking confirmed</p>
        <BookingRecommendationsRail
          shopId={SHOP_ID}
          serviceId={SERVICE_ID}
          productHrefBase={`/shop/${SHOP_ID}`}
        />
      </div>,
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    expect(empty.queryByRole('heading', { name: /Recommended for/i })).toBeNull();
    expect(empty.getByText('Booking confirmed')).toBeTruthy();
    empty.unmount();

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...twoProducts, products: [twoProducts.products[0]] }),
    });

    const one = render(
      <BookingRecommendationsRail
        shopId={SHOP_ID}
        serviceId={SERVICE_ID}
        productHrefBase={`/shop/${SHOP_ID}`}
      />,
    );
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
    expect(one.queryByRole('heading', { name: /Recommended for/i })).toBeNull();
  });

  it('keeps confirmation intact and hides rail when the API rejects', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));

    render(
      <div data-testid="confirmation-shell">
        <h2>Booking confirmed</h2>
        <BookingRecommendationsRail
          shopId={SHOP_ID}
          serviceId={SERVICE_ID}
          productHrefBase={`/shop/${SHOP_ID}`}
        />
      </div>,
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    expect(screen.getByText('Booking confirmed')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /Recommended for/i })).toBeNull();
    expect(getSnapshot().items).toHaveLength(0);
  });

  it('demo fixtures write into the BLACKLINE cart namespace and link to demo PDPs', async () => {
    const DEMO_SHOP = 'blackline-barbers-demo';
    window.__KERSIVO_CART_NAMESPACE__ = {
      shopId: DEMO_SHOP,
      allowedProductIds: ['bl-product-matte-clay', 'bl-product-matte-pomade', 'bl-product-fibre-paste'],
    };

    const demoProducts = [
      {
        id: 'bl-product-matte-clay',
        name: 'Matte Clay',
        category: 'STYLING',
        pricePence: 1700,
        imageUrl: '/demo/products/matte-clay.webp',
        available: true,
        requiresOptions: false,
      },
      {
        id: 'bl-product-fibre-paste',
        name: 'Fibre Paste',
        category: 'STYLING',
        pricePence: 1600,
        imageUrl: '/demo/products/fibre-paste.webp',
        available: true,
        requiresOptions: false,
      },
    ];

    render(
      <>
        <StorefrontCartDrawer
          mode="demo"
          shopId={DEMO_SHOP}
          shopName="BLACKLINE"
          themeId="blackline"
          priceFormat="demo"
          exploreHref="/demo/shop"
          checkout={{ type: 'href', href: '/demo/shop/checkout' }}
        />
        <BookingRecommendationsRail
          shopId={DEMO_SHOP}
          serviceId="bl-svc-skin-fade"
          serviceName="Skin Fade"
          productHrefBase="/demo/shop"
          themeId="blackline"
          priceFormat="demo"
          demoProducts={demoProducts}
        />
      </>,
    );

    expect(screen.getByRole('heading', { name: 'Recommended for your Skin Fade' })).toBeTruthy();
    const productHit = document.querySelector(
      'a.sf-card-hit[href="/demo/shop/bl-product-matte-clay"]',
    );
    expect(productHit).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: /Add to bag:/i })[0]!);
    await waitFor(() => {
      expect(getSnapshot().items.map((item) => item.productId)).toContain('bl-product-matte-clay');
    });
    const stored = JSON.parse(
      window.localStorage.getItem(cartStorageKeyForShop(DEMO_SHOP)) ?? '[]',
    ) as Array<{ productId: string }>;
    expect(stored.some((item) => item.productId === 'bl-product-matte-clay')).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resets products when serviceId changes so a second booking is not stale', async () => {
    const first = [
      {
        id: 'bl-product-matte-clay',
        name: 'Matte Clay',
        category: 'STYLING',
        pricePence: 1700,
        imageUrl: null,
        available: true,
        requiresOptions: false,
      },
      {
        id: 'bl-product-fibre-paste',
        name: 'Fibre Paste',
        category: 'STYLING',
        pricePence: 1600,
        imageUrl: null,
        available: true,
        requiresOptions: false,
      },
    ];
    const second = [
      {
        id: 'bl-product-beard-oil',
        name: 'Beard Oil',
        category: 'BEARD_CARE',
        pricePence: 2200,
        imageUrl: null,
        available: true,
        requiresOptions: false,
      },
      {
        id: 'bl-product-beard-balm',
        name: 'Beard Balm',
        category: 'BEARD_CARE',
        pricePence: 1600,
        imageUrl: null,
        available: true,
        requiresOptions: false,
      },
    ];

    const { rerender } = render(
      <BookingRecommendationsRail
        shopId="blackline-barbers-demo"
        serviceId="bl-svc-skin-fade"
        serviceName="Skin Fade"
        productHrefBase="/demo/shop"
        demoProducts={first}
      />,
    );

    expect(screen.getByText('Matte Clay')).toBeTruthy();
    expect(screen.queryByText('Beard Oil')).toBeNull();

    rerender(
      <BookingRecommendationsRail
        shopId="blackline-barbers-demo"
        serviceId="bl-svc-beard-trim"
        serviceName="Beard Trim & Shape"
        productHrefBase="/demo/shop"
        demoProducts={second}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Recommended for your Beard Trim & Shape' })).toBeTruthy();
    expect(screen.getByText('Beard Oil')).toBeTruthy();
    expect(screen.queryByText('Matte Clay')).toBeNull();
  });
});

describe('booking page production cart opt-in contracts', () => {
  const root = process.cwd();

  it('opts real tenant book and deposit success pages into production cart', () => {
    const bookPage = readFileSync(join(root, 'src/pages/book/[shopId].astro'), 'utf8');
    const successPage = readFileSync(join(root, 'src/pages/book/[shopId]/success.astro'), 'utf8');

    expect(bookPage).toMatch(/enableProductionCart=\{true\}/);
    expect(bookPage).toMatch(/shopId=\{shop\.id\}/);
    expect(successPage).toMatch(/enableProductionCart=\{Boolean\(shopId\)\}/);
    expect(successPage).toMatch(/shopId=\{shopId \|\| undefined\}/);
  });

  it('does not enable production cart on demo, preview, or admin test-book paths', () => {
    const paths = [
      'src/pages/book/index.astro',
      'src/pages/admin/test-book.astro',
      'src/pages/preview/onboarding.astro',
      'src/layouts/MinimalLayout.astro',
    ];

    for (const relative of paths.slice(0, 3)) {
      const source = readFileSync(join(root, relative), 'utf8');
      expect(source).not.toMatch(/enableProductionCart=\{true\}/);
      expect(source).not.toMatch(/checkout=\{\{\s*type:\s*'live'/);
    }

    const minimal = readFileSync(join(root, paths[3]!), 'utf8');
    expect(minimal).toMatch(/enableProductionCart/);
    expect(minimal).toMatch(/mode="production"/);
    expect(minimal).toMatch(/checkout=\{\{\s*type:\s*'live'\s*\}\}/);
  });
});
