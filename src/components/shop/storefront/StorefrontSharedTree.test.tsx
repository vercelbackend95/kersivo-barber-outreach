/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StorefrontShopPage from './StorefrontShopPage';
import ProductGrid from './ProductGrid';
import StorefrontProductDetail from './StorefrontProductDetail';
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
});

function makeProducts(count: number, featuredCount = 2) {
  return Array.from({ length: count }, (_, index) =>
    toStorefrontProduct({
      id: `p-${index + 1}`,
      name: `Product ${index + 1}`,
      description: `Description for product ${index + 1}`,
      pricePence: 1000 + index * 50,
      category: index % 2 === 0 ? 'BEARD_CARE' : 'POMADES_AND_CLAYS',
      featured: index < featuredCount,
      imageUrl: index % 5 === 0 ? '' : `/img/${index + 1}.webp`,
    }),
  );
}

describe('shared storefront tree', () => {
  it('renders the same discovery/featured/grid structure for blackline and kersivo', () => {
    const products = makeProducts(8);
    const shared = {
      products,
      shopName: 'Shop',
      productHrefPrefix: '/shop/demo',
      intro: { heading: 'Shop heading' },
      copy: DEFAULT_STOREFRONT_COPY,
    };

    const blackline = render(<StorefrontShopPage {...shared} themeId="blackline" imageFallback="wordmark" />);
    expect(blackline.container.querySelector('[data-sf-discovery-variant="compact"]')).toBeTruthy();
    expect(blackline.container.querySelector('.sf-spotlight--unified')).toBeTruthy();
    expect(blackline.container.querySelector('input[type="search"]')).toBeNull();
    expect(blackline.container.querySelectorAll('.sf-atc--icon').length).toBeGreaterThan(0);
    const blSelectors = [
      '.sf-discovery--compact',
      '.sf-grid',
      '.sf-card',
      '.sf-spotlight-progress',
    ].map((sel) => Boolean(blackline.container.querySelector(sel)));
    blackline.unmount();

    const kersivo = render(<StorefrontShopPage {...shared} themeId="kersivo" imageFallback="initial" />);
    expect(kersivo.container.querySelector('[data-sf-discovery-variant="compact"]')).toBeTruthy();
    expect(kersivo.container.querySelector('.sf-spotlight--unified')).toBeTruthy();
    expect(kersivo.container.querySelector('input[type="search"]')).toBeNull();
    expect(kersivo.container.querySelectorAll('.sf-atc--icon').length).toBeGreaterThan(0);
    const kvSelectors = [
      '.sf-discovery--compact',
      '.sf-grid',
      '.sf-card',
      '.sf-spotlight-progress',
    ].map((sel) => Boolean(kersivo.container.querySelector(sel)));

    expect(kvSelectors).toEqual(blSelectors);
    expect(kersivo.container.querySelector('[data-sf-theme="kersivo"]')).toBeTruthy();
    expect(kersivo.container.firstElementChild?.className).toContain('sf-shop--kersivo');
  });

  it('renders fifty products in the shared grid without crashing', () => {
    const products = makeProducts(50, 0);
    const { container } = render(
      <ProductGrid
        products={products}
        productHrefPrefix="/shop/demo"
        priceFormat="gbp"
        imageFallback="initial"
        shopName="KERSIVO"
        copy={DEFAULT_STOREFRONT_COPY}
      />,
    );
    expect(container.querySelectorAll('[data-product-item]')).toHaveLength(50);
    expect(container.querySelectorAll('.sf-atc--icon')).toHaveLength(50);
  });

  it('uses ProductRail storefront variant on every PDP', () => {
    const products = makeProducts(4);
    const { container } = render(
      <StorefrontProductDetail
        product={products[0]!}
        related={products.slice(1)}
        themeId="kersivo"
        shopName="KERSIVO"
        backHref="/shop/demo"
        productHrefPrefix="/shop/demo"
        imageFallback="initial"
      />,
    );

    expect(container.querySelector('[data-product-rail-variant="storefront"]')).toBeTruthy();
    expect(container.querySelector('.sf-grid')).toBeNull();
    expect(screen.getByRole('button', { name: /add to bag: product 1/i }).querySelector('svg')).toBeTruthy();
  });
});
