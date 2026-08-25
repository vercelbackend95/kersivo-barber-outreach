import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BLACKLINE_CART_STORAGE_KEY,
  BLACKLINE_SHOP_ID,
  DEMO_FEATURED_PRODUCTS,
  DEMO_PRODUCTS,
  DEMO_PRODUCT_IDS,
  demoProductHref,
  demoProductsMeta,
  getDemoProductById,
  resolveBlacklineSeedImageUrl,
} from './products';
import { DEMO_SHOP_KEY, formatDemoPriceGbp } from './services';

describe('BLACKLINE demo products', () => {
  it('keeps a stable BLACKLINE tenant id', () => {
    expect(BLACKLINE_SHOP_ID).toBe('blackline-barbers-demo');
    expect(DEMO_SHOP_KEY).toBe(BLACKLINE_SHOP_ID);
    expect(BLACKLINE_CART_STORAGE_KEY).toBe('kersivo_shop_cart_v2:blackline-barbers-demo');
  });

  it('exposes twenty-nine database-shaped products with stable ids', () => {
    expect(DEMO_PRODUCTS).toHaveLength(29);
    expect(DEMO_PRODUCTS.every((product) => product.id.startsWith('bl-product-'))).toBe(true);
    expect(DEMO_PRODUCTS.every((product) => !product.id.startsWith('demo-product-'))).toBe(true);
    expect(new Set(DEMO_PRODUCTS.map((product) => product.sortOrder)).size).toBe(29);
    expect(DEMO_PRODUCTS.some((product) => product.category === 'SHAVE_AND_SKIN')).toBe(true);
    expect(DEMO_PRODUCTS.filter((product) => product.category === 'POMADES_AND_CLAYS')).toHaveLength(0);
  });

  it('keeps packshot prices and local WebP paths for every SKU', () => {
    expect(getDemoProductById('bl-product-ironclad-pomade')?.pricePence).toBe(1900);
    expect(getDemoProductById('bl-product-matte-pomade')?.pricePence).toBe(1800);
    expect(getDemoProductById('bl-product-beard-balm')?.pricePence).toBe(1600);
    expect(getDemoProductById('bl-product-sea-salt-texture-spray')?.pricePence).toBe(1400);
    expect(getDemoProductById('bl-product-beard-oil')?.pricePence).toBe(2200);
    expect(getDemoProductById('bl-product-barber-wash')?.pricePence).toBe(1500);
    expect(getDemoProductById('bl-product-forge-styling-powder')?.pricePence).toBe(1200);
    expect(getDemoProductById('bl-product-essential-styling-set')?.pricePence).toBe(3800);
    expect(getDemoProductById('bl-product-clipper-guard-set')?.pricePence).toBe(3400);
    expect(getDemoProductById('bl-product-beard-kit')?.pricePence).toBe(5800);
    expect(getDemoProductById('bl-product-travel-grooming-set')?.pricePence).toBe(4200);
    expect(getDemoProductById('bl-product-shop-gift-box')?.pricePence).toBe(6500);
    expect(getDemoProductById('bl-product-hot-towel-kit')?.pricePence).toBe(9800);
    expect(formatDemoPriceGbp(1500)).toBe('£15');
    expect(DEMO_PRODUCTS.every((product) => product.image.src.endsWith('.webp'))).toBe(true);
    expect(DEMO_PRODUCTS.filter((product) => !product.image.src).length).toBe(0);
  });

  it('keeps four featured products in canonical order', () => {
    expect(DEMO_FEATURED_PRODUCTS.map((product) => product.name)).toEqual([
      'Ironclad Pomade',
      'Beard Balm',
      'Barber Wash',
      'Essential Styling Set',
    ]);
    expect(demoProductsMeta().countLabel).toBe('29 PRODUCTS');
    expect(demoProductHref('bl-product-ironclad-pomade')).toBe('/demo/shop/bl-product-ironclad-pomade');
    expect(getDemoProductById('demo-product-matte-pomade')).toBeNull();
  });

  it('points at existing local packshots for every product', () => {
    for (const product of DEMO_PRODUCTS) {
      const fileName = product.image.src.replace('/demo/products/', '');
      expect(existsSync(resolve(process.cwd(), 'public/demo/products', fileName))).toBe(true);
      expect(product.image.width).toBeGreaterThan(0);
      expect(product.image.height).toBeGreaterThan(0);
    }
    expect(getDemoProductById('bl-product-beard-oil')?.image).toMatchObject({ width: 1122, height: 1402 });
    expect(getDemoProductById('bl-product-sea-salt-texture-spray')?.image).toMatchObject({
      width: 1122,
      height: 1402,
    });
    expect(getDemoProductById('bl-product-hot-towel-kit')?.image).toMatchObject({ width: 1402, height: 1122 });
  });

  it('describes packaging without claiming BLACKLINE manufacture', () => {
    for (const product of DEMO_PRODUCTS) {
      expect(product.image.alt.toLowerCase()).toContain('fictional blackline shop');
      expect(product.image.alt.toLowerCase()).not.toContain('manufactured');
      expect(product.image.alt.toLowerCase()).not.toContain('award');
    }
    expect(DEMO_PRODUCT_IDS).toEqual(DEMO_PRODUCTS.map((product) => product.id));
  });

  it('preserves uploaded seed images and does not invent empty paths', () => {
    expect(resolveBlacklineSeedImageUrl('https://cdn.example/custom.jpg', '')).toBe('https://cdn.example/custom.jpg');
    expect(resolveBlacklineSeedImageUrl('/demo/products/ironclad-pomade.webp', '/demo/products/ironclad-pomade.webp')).toBe(
      '/demo/products/ironclad-pomade.webp',
    );
    expect(resolveBlacklineSeedImageUrl('/demo/products/old.webp', '')).toBe('/demo/products/old.webp');
    expect(resolveBlacklineSeedImageUrl(null, '')).toBeNull();
  });
});
