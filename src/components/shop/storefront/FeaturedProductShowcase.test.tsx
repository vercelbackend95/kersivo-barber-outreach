/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FeaturedProductShowcase, { FEATURED_AUTOPLAY_MS } from './FeaturedProductShowcase';
import { toStorefrontProduct } from '@/lib/shop/storefrontCatalog';
import { DEFAULT_STOREFRONT_COPY } from './types';

function mockMatchMedia(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  mockMatchMedia(false);
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error jsdom stub
  global.IntersectionObserver = IO;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const products = [
  toStorefrontProduct({
    id: 'a',
    name: 'Alpha Oil',
    description: 'First featured product',
    pricePence: 1200,
    category: 'BEARD_CARE',
    featured: true,
    imageUrl: '/a.webp',
  }),
  toStorefrontProduct({
    id: 'b',
    name: 'Bravo Clay',
    description: 'Second featured product',
    pricePence: 1800,
    category: 'POMADES_AND_CLAYS',
    featured: true,
    imageUrl: '/b.webp',
  }),
];

describe('FeaturedProductShowcase', () => {
  it('renders the unified carousel for any theme consumer', () => {
    const { container } = render(
      <FeaturedProductShowcase
        products={products}
        productHref={(id) => `/shop/${id}`}
        priceFormat="gbp"
        imageFallback="initial"
        shopName="KERSIVO"
        copy={DEFAULT_STOREFRONT_COPY}
      />,
    );

    expect(container.querySelector('.sf-spotlight--unified')).toBeTruthy();
    expect(container.querySelector('.sf-spotlight-progress')).toBeTruthy();
    expect(screen.getByRole('button', { name: /add to bag: alpha oil/i }).querySelector('svg')).toBeTruthy();
  });

  it('keeps autoplay timer infrastructure for multi-slide catalogs', () => {
    vi.useFakeTimers();
    const { container } = render(
      <FeaturedProductShowcase
        products={products}
        productHref={(id) => `/shop/${id}`}
        priceFormat="gbp"
        imageFallback="initial"
        shopName="KERSIVO"
        copy={DEFAULT_STOREFRONT_COPY}
      />,
    );

    expect(container.querySelector('.sf-spotlight-track')).toBeTruthy();
    vi.advanceTimersByTime(FEATURED_AUTOPLAY_MS + 50);
    expect(container.querySelector('.sf-spotlight--unified')).toBeTruthy();
  });
});
