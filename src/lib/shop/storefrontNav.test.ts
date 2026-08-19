import { describe, expect, it } from 'vitest';
import { formatNavIndex, isStorefrontNavActive } from './storefrontNav';

describe('isStorefrontNavActive', () => {
  it('exact-matches home and prefix-matches children', () => {
    expect(isStorefrontNavActive('/demo', '/demo', '/demo')).toBe(true);
    expect(isStorefrontNavActive('/demo/shop', '/demo', '/demo')).toBe(false);
    expect(isStorefrontNavActive('/demo/shop/pomade', '/demo/shop', '/demo')).toBe(true);
  });

  it('keeps tenant Shop current on PDPs when home is not the shop path', () => {
    expect(isStorefrontNavActive('/shop/abc', '/shop/abc', '/')).toBe(true);
    expect(isStorefrontNavActive('/shop/abc/pomade', '/shop/abc', '/')).toBe(true);
    expect(isStorefrontNavActive('/shop/abc/pomade', '/shop/abc', '/shop/abc')).toBe(false);
  });

  it('zero-pads editorial numbers', () => {
    expect(formatNavIndex(0)).toBe('01');
    expect(formatNavIndex(9)).toBe('10');
  });
});
