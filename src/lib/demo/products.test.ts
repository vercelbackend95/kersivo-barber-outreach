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
} from './products';
import { DEMO_SHOP_KEY, formatDemoPriceGbp } from './services';

describe('BLACKLINE demo products', () => {
  it('keeps a stable BLACKLINE tenant id', () => {
    expect(BLACKLINE_SHOP_ID).toBe('blackline-barbers-demo');
    expect(DEMO_SHOP_KEY).toBe(BLACKLINE_SHOP_ID);
    expect(BLACKLINE_CART_STORAGE_KEY).toBe('kersivo_shop_cart_v2:blackline-barbers-demo');
  });

  it('exposes at least three database-shaped products with local WebP images', () => {
    expect(DEMO_PRODUCTS.length).toBeGreaterThanOrEqual(3);
    expect(DEMO_PRODUCTS).toHaveLength(7);
    expect(DEMO_PRODUCTS.every((product) => product.id.startsWith('bl-product-'))).toBe(true);
    expect(DEMO_PRODUCTS.every((product) => !product.id.startsWith('demo-product-'))).toBe(true);
    expect(DEMO_PRODUCTS.every((product) => product.image.src.startsWith('/demo/products/'))).toBe(true);
    expect(DEMO_PRODUCTS.every((product) => product.image.src.endsWith('.webp'))).toBe(true);
    expect(DEMO_PRODUCTS.map((product) => product.image.src)).not.toContain('/demo/products/matte-clay.webp');
  });

  it('uses demo-catalog prices in pence and the shared GBP helper', () => {
    expect(DEMO_PRODUCTS.map((product) => product.pricePence)).toEqual([
      1900, 1800, 1600, 1400, 2200, 1500, 1200,
    ]);
    expect(DEMO_PRODUCTS.map((product) => formatDemoPriceGbp(product.pricePence))).toEqual([
      '£19',
      '£18',
      '£16',
      '£14',
      '£22',
      '£15',
      '£12',
    ]);
  });

  it('keeps three featured homepage products from the same catalog', () => {
    expect(DEMO_FEATURED_PRODUCTS.map((product) => product.id)).toEqual([
      'bl-product-ironclad-pomade',
      'bl-product-beard-balm',
      'bl-product-barber-wash',
    ]);
    expect(demoProductsMeta().countLabel).toBe('07 PRODUCTS');
    expect(demoProductHref('bl-product-ironclad-pomade')).toBe('/demo/shop/bl-product-ironclad-pomade');
    expect(getDemoProductById('demo-product-matte-pomade')).toBeNull();
  });

  it('points at existing local packshots whose dimensions match the fixture', () => {
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
  });

  it('describes packaging without claiming BLACKLINE manufacture', () => {
    for (const product of DEMO_PRODUCTS) {
      expect(product.image.alt.toLowerCase()).toContain('fictional blackline shop');
      expect(product.image.alt.toLowerCase()).not.toContain('manufactured');
      expect(product.image.alt.toLowerCase()).not.toContain('award');
    }
    expect(DEMO_PRODUCT_IDS).toEqual(DEMO_PRODUCTS.map((product) => product.id));
  });
});
