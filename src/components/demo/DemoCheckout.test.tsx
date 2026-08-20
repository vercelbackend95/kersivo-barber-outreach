/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DemoCheckout from '@/components/demo/DemoCheckout';
import { navigateDemoPath } from '@/lib/demo/clientNavigate';
import {
  BLACKLINE_CONFIRMATION_STORAGE_KEY,
  BLACKLINE_SHOP_ID,
} from '@/lib/demo/products';
import { addItem, bindCartNamespace, clear, getItems } from '@/lib/shop/cartStore';

vi.mock('@/lib/demo/clientNavigate', () => ({
  navigateDemoPath: vi.fn().mockResolvedValue(undefined),
}));

const navigateSpy = vi.mocked(navigateDemoPath);

describe('BLACKLINE demo checkout', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    navigateSpy.mockClear();
    vi.stubGlobal('fetch', fetchSpy);
    bindCartNamespace({ shopId: BLACKLINE_SHOP_ID, allowedProductIds: ['bl-product-ironclad-pomade'] });
    clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    clear();
    bindCartNamespace();
    vi.unstubAllGlobals();
  });

  it('keeps the bag until the server accepts the demo order, then clears it', async () => {
    addItem({
      productId: 'bl-product-ironclad-pomade',
      name: 'Ironclad Pomade',
      pricePence: 1,
      quantity: 2,
    });

    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        order: {
          items: [
            {
              productId: 'bl-product-ironclad-pomade',
              name: 'Ironclad Pomade',
              unitPricePence: 1900,
              quantity: 2,
              lineTotalPence: 3800,
              imageUrl: '/demo/products/ironclad-pomade.webp',
            },
          ],
          totalPence: 3800,
          collectionMethod: 'Collect in shop',
          createdAt: '2026-08-17T00:00:00.000Z',
        },
      }),
    });

    render(<DemoCheckout />);
    fireEvent.click(screen.getByRole('button', { name: 'COMPLETE DEMO ORDER →' }));

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/demo/shop/confirmation');
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, request] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toEqual({
      items: [{ productId: 'bl-product-ironclad-pomade', quantity: 2 }],
    });
    expect(getItems()).toEqual([]);
    expect(window.sessionStorage.getItem(BLACKLINE_CONFIRMATION_STORAGE_KEY)).toContain('3800');
    expect(window.sessionStorage.getItem('kersivo.blackline.session-orders.v1')).toContain('Ironclad Pomade');
    expect(window.sessionStorage.getItem('kersivo.blackline.session-orders.v1')).toContain('3800');
  });

  it('ignores a duplicate complete while the first request is in flight', async () => {
    addItem({
      productId: 'bl-product-ironclad-pomade',
      name: 'Ironclad Pomade',
      pricePence: 1900,
    });

    let resolveFetch: ((value: unknown) => void) | undefined;
    fetchSpy.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    render(<DemoCheckout />);
    const submit = screen.getByRole('button', { name: 'COMPLETE DEMO ORDER →' });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(getItems()).toHaveLength(1);

    resolveFetch?.({
      ok: true,
      json: async () => ({
        ok: true,
        order: {
          items: [
            {
              productId: 'bl-product-ironclad-pomade',
              name: 'Ironclad Pomade',
              unitPricePence: 1900,
              quantity: 1,
              lineTotalPence: 1900,
              imageUrl: '/demo/products/ironclad-pomade.webp',
            },
          ],
          totalPence: 1900,
          collectionMethod: 'Collect in shop',
          createdAt: '2026-08-17T00:00:00.000Z',
        },
      }),
    });

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/demo/shop/confirmation');
    });
    expect(getItems()).toEqual([]);
  });

  it('does not clear the bag when completion fails', async () => {
    addItem({
      productId: 'bl-product-ironclad-pomade',
      name: 'Ironclad Pomade',
      pricePence: 1900,
    });
    fetchSpy.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Unable to complete the demo order.' }),
    });

    render(<DemoCheckout />);
    fireEvent.click(screen.getByRole('button', { name: 'COMPLETE DEMO ORDER →' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/unable to complete/i);
    });
    expect(getItems()).toHaveLength(1);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('renders product thumbnails from cart imageUrl and a placeholder when missing', () => {
    bindCartNamespace({
      shopId: BLACKLINE_SHOP_ID,
      allowedProductIds: ['bl-product-ironclad-pomade', 'bl-product-essential-styling-set'],
    });
    addItem({
      productId: 'bl-product-ironclad-pomade',
      name: 'Ironclad Pomade',
      pricePence: 1900,
      quantity: 1,
      imageUrl: '/demo/products/ironclad-pomade.webp',
    });
    addItem({
      productId: 'bl-product-essential-styling-set',
      name: 'Essential Styling Set',
      pricePence: 4200,
      quantity: 1,
      imageUrl: '',
    });

    const { container } = render(<DemoCheckout />);
    const img = container.querySelector(
      'img[src="/demo/products/ironclad-pomade.webp"]',
    ) as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img?.alt).toBe('Ironclad Pomade');
    expect(container.querySelectorAll('.checkout-line')).toHaveLength(2);
    expect(container.querySelectorAll('.sf-media--fallback').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('img[src=""]')).toHaveLength(0);
  });

  it('keeps quantity controls wired to the shared cart store', () => {
    addItem({
      productId: 'bl-product-ironclad-pomade',
      name: 'Ironclad Pomade',
      pricePence: 1900,
      quantity: 1,
      imageUrl: '/demo/products/ironclad-pomade.webp',
    });
    render(<DemoCheckout />);
    fireEvent.click(screen.getByRole('button', { name: /increase quantity of ironclad pomade/i }));
    expect(getItems()[0]?.quantity).toBe(2);
    expect(screen.getByText(/2 ×/i)).toBeTruthy();
  });
});
