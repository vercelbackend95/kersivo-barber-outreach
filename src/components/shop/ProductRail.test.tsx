/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import { ProductRail } from './ProductRail';
import type { CarouselProduct } from '@/lib/shop/carouselProducts';

afterEach(() => {
  cleanup();
});

const products: CarouselProduct[] = [
  {
    id: 'bl-product-ironclad-pomade',
    name: 'Ironclad Pomade',
    category: 'POMADES_AND_CLAYS',
    pricePence: 1800,
    imageUrl: '/demo/products/ironclad-pomade.webp',
  },
  {
    id: 'bl-product-essential-styling-set',
    name: 'Essential Styling Set',
    category: 'GIFT_SETS',
    pricePence: 4200,
    imageUrl: null,
  },
  {
    id: 'p-3',
    name: 'Beard Balm',
    category: 'BEARD_CARE',
    pricePence: 1600,
    imageUrl: '',
  },
  {
    id: 'p-4',
    name: 'Barber Wash',
    category: 'HAIR_WASH',
    pricePence: 1400,
    imageUrl: '/demo/products/barber-wash.webp',
  },
];

describe('ProductRail', () => {
  it('links BLACKLINE products through productHrefBase and never renders empty img src', () => {
    const { container, getByRole } = render(
      <ProductRail
        products={products}
        productHrefBase="/demo/shop"
        variant="blackline"
        density="editorial"
        showAction="none"
        showControls
        showProgress
        fallbackBrandMark="BL"
        ariaLabel="Featured Blackline products"
      />,
    );

    expect(getByRole('link', { name: /view ironclad pomade/i }).getAttribute('href')).toBe(
      '/demo/shop/bl-product-ironclad-pomade',
    );
    expect(getByRole('link', { name: /view essential styling set/i }).getAttribute('href')).toBe(
      '/demo/shop/bl-product-essential-styling-set',
    );

    const emptySrc = container.querySelectorAll('img[src=""]');
    expect(emptySrc).toHaveLength(0);

    const styling = getByRole('link', { name: /view essential styling set/i });
    expect(within(styling).queryByRole('img', { name: /essential styling set/i })).toBeTruthy();
    expect(styling.querySelector('.sf-media-mark')?.textContent).toBe('BL');
    expect(styling.querySelector('img')).toBeNull();
  });

  it('keeps preview mode pointing at /shop without nested cart actions', () => {
    const { getAllByRole, queryByRole } = render(
      <ProductRail products={products} previewMode variant="kersivo" showControls={false} />,
    );

    for (const link of getAllByRole('link', { name: /view /i })) {
      expect(link.getAttribute('href')).toBe('/shop');
    }
    expect(queryByRole('button', { name: /add to cart/i })).toBeNull();
  });

  it('exposes previous and next controls with dual data attributes', () => {
    const { container } = render(
      <ProductRail
        products={products}
        showControls
        showProgress
        variant="blackline"
        density="editorial"
        showAction="none"
      />,
    );

    expect(container.querySelectorAll('[data-product-rail-prev][data-shop6-prev]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-product-rail-next][data-shop6-next]')).toHaveLength(1);
    expect(container.querySelector('[data-product-rail-status]')?.textContent).toMatch(/01 \/ 04/);
  });

  it('renders StorefrontAddToBagButton without nesting it inside a card link', () => {
    const { container, getByRole, queryByText } = render(
      <ProductRail
        products={products.slice(0, 2)}
        productHrefBase="/demo/shop"
        variant="blackline"
        density="editorial"
        showAction="add-to-cart"
        addToBagLabel="Add to bag"
      />,
    );

    const atc = getByRole('button', { name: /add to bag: ironclad pomade/i });
    expect(atc.hasAttribute('data-add-to-cart')).toBe(true);
    expect(atc.closest('a')).toBeNull();
    expect(queryByText(/^View$/)).toBeNull();
    expect(container.querySelectorAll('a.product-rail__card--link')).toHaveLength(0);
    expect(container.querySelectorAll('article.product-rail__card')).toHaveLength(2);
  });
});
