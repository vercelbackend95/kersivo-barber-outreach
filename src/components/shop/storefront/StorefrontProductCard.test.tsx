/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import StorefrontProductCard from './StorefrontProductCard';
import ProductCardImage from './ProductCardImage';
import { DEFAULT_STOREFRONT_COPY } from './types';
import { toStorefrontProduct } from '@/lib/shop/storefrontCatalog';

const baseProduct = toStorefrontProduct({
  id: 'prod-1',
  name: 'Matte Pomade',
  description: 'Medium hold with a clean matte finish for everyday restyle.',
  pricePence: 1800,
  category: 'POMADES_AND_CLAYS',
  featured: true,
  imageUrl: '/images/demoshop/matte-pomade.png',
});

afterEach(() => {
  cleanup();
});

describe('StorefrontProductCard', () => {
  it('exposes quick-add attributes without nesting buttons in links', () => {
    const { container } = render(
      <StorefrontProductCard
        product={baseProduct}
        href="/shop/demo/prod-1"
        priceFormat="gbp"
        imageFallback="initial"
        shopName="KERSIVO"
        copy={DEFAULT_STOREFRONT_COPY}
      />,
    );

    const button = screen.getByRole('button', { name: /add: matte pomade/i });
    expect(button.hasAttribute('data-add-to-cart')).toBe(true);
    expect(button.getAttribute('data-product-id')).toBe('prod-1');
    expect(button.getAttribute('data-product-name')).toBe('Matte Pomade');
    expect(button.getAttribute('data-product-price-pence')).toBe('1800');
    expect(button.getAttribute('data-product-image-url')).toBe('/images/demoshop/matte-pomade.png');
    expect(container.querySelector('a .sf-atc, a button')).toBeNull();
    expect(screen.queryByText('Featured')).toBeNull();
    expect(screen.getByText('Add')).toBeTruthy();
    expect(screen.getByText('£18.00')).toBeTruthy();
  });

  it('sends option products to the PDP instead of adding to the bag', () => {
    const product = toStorefrontProduct({
      ...baseProduct,
      id: 'opts',
      name: 'Gift set',
      requiresOptions: true,
      featured: false,
    });
    render(
      <StorefrontProductCard
        product={product}
        href="/shop/demo/opts"
        priceFormat="gbp"
        imageFallback="initial"
        shopName="KERSIVO"
        copy={DEFAULT_STOREFRONT_COPY}
      />,
    );
    const link = screen.getByRole('link', { name: 'Choose options' });
    expect(link.getAttribute('href')).toBe('/shop/demo/opts');
    expect(screen.queryByRole('button', { name: /add to bag/i })).toBeNull();
  });

  it('disables purchase when sold out and keeps the product link', () => {
    const product = { ...baseProduct, available: false, featured: false };
    render(
      <StorefrontProductCard
        product={product}
        href="/shop/demo/prod-1"
        priceFormat="gbp"
        imageFallback="initial"
        shopName="KERSIVO"
        copy={DEFAULT_STOREFRONT_COPY}
      />,
    );
    expect(screen.getByRole('button', { name: 'Sold out' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('link', { name: /view product: matte pomade/i }).getAttribute('href')).toBe(
      '/shop/demo/prod-1',
    );
  });

  it('falls back to a shop initial when the image is missing', () => {
    const { container } = render(
      <ProductCardImage
        image={{ src: '', alt: 'Missing' }}
        name="Matte Pomade"
        shopName="Northcutt"
        fallback="initial"
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.sf-media-initial')?.textContent).toBe('N');
  });

  it('morphs the add label after a click without calling addItem', () => {
    render(
      <StorefrontProductCard
        product={baseProduct}
        href="/shop/demo/prod-1"
        priceFormat="gbp"
        imageFallback="initial"
        shopName="KERSIVO"
        copy={DEFAULT_STOREFRONT_COPY}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /add: matte pomade/i }));
    expect(screen.getByRole('button', { name: /add: matte pomade/i }).textContent).toBe('Added');
  });
});
