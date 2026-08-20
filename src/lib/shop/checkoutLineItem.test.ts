import { describe, expect, it } from 'vitest';
import {
  cartItemToCheckoutLine,
  normalizeCheckoutMedia,
  resolvedRetailItemToCheckoutLine,
} from '@/lib/shop/checkoutLineItem';

describe('checkoutLineItem helpers', () => {
  it('normalizes empty or whitespace image URLs to empty src', () => {
    expect(normalizeCheckoutMedia({ imageUrl: '  ', name: 'Oil' })).toEqual({
      src: '',
      alt: 'Oil',
    });
    expect(normalizeCheckoutMedia({ imageUrl: null, name: 'Oil', imageAlt: 'Beard oil' })).toEqual({
      src: '',
      alt: 'Beard oil',
    });
  });

  it('maps cart items onto the shared checkout line contract', () => {
    expect(
      cartItemToCheckoutLine({
        productId: 'p1',
        name: 'Pomade',
        pricePence: 1800,
        quantity: 2,
        imageUrl: '/p.webp',
      }),
    ).toEqual({
      productId: 'p1',
      name: 'Pomade',
      imageUrl: '/p.webp',
      imageAlt: 'Pomade',
      quantity: 2,
      unitPrice: 1800,
    });
  });

  it('maps resolved retail catalog lines including canonical imageUrl', () => {
    expect(
      resolvedRetailItemToCheckoutLine({
        productId: 'p1',
        name: 'Pomade',
        unitPricePence: 1800,
        quantity: 1,
        lineTotalPence: 1800,
        imageUrl: '/catalog/pomade.webp',
      }),
    ).toMatchObject({
      productId: 'p1',
      imageUrl: '/catalog/pomade.webp',
      unitPrice: 1800,
    });
  });
});
