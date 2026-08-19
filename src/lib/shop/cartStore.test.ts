/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CART_MAX_QUANTITY,
  CART_STORAGE_KEY,
  addItem,
  bindCartNamespace,
  cartStorageKeyForShop,
  clear,
  getItems,
  setQuantity,
} from './cartStore';

describe('cartStore namespace', () => {
  beforeEach(() => {
    window.localStorage.clear();
    bindCartNamespace();
    clear();
  });

  afterEach(() => {
    clear();
    bindCartNamespace();
    window.localStorage.clear();
  });

  it('keeps the default key for the public retail demo', () => {
    expect(cartStorageKeyForShop()).toBe(CART_STORAGE_KEY);
    expect(cartStorageKeyForShop('blackline-barbers-demo')).toBe(
      'kersivo_shop_cart_v2:blackline-barbers-demo',
    );
    addItem({ productId: 'demo-product-matte-pomade', name: 'Matte Pomade', pricePence: 1800 });
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '[]')).toHaveLength(1);
  });

  it('isolates BLACKLINE items and drops stale foreign product ids', () => {
    window.localStorage.setItem(
      'kersivo_shop_cart_v2:blackline-barbers-demo',
      JSON.stringify([
        { productId: 'demo-product-matte-pomade', name: 'Matte Pomade', pricePence: 1800, quantity: 1 },
        { productId: 'bl-product-ironclad-pomade', name: 'Ironclad Pomade', pricePence: 1900, quantity: 1 },
      ]),
    );

    bindCartNamespace({
      shopId: 'blackline-barbers-demo',
      allowedProductIds: ['bl-product-ironclad-pomade'],
    });

    expect(getItems().map((item) => item.productId)).toEqual(['bl-product-ironclad-pomade']);
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? 'null')).toEqual([]);
  });

  it('clamps add and setQuantity to the storefront max', () => {
    addItem({ productId: 'prod-1', name: 'Pomade', pricePence: 1900, quantity: 8 });
    addItem({ productId: 'prod-1', name: 'Pomade', pricePence: 1900, quantity: 8 });
    expect(getItems()[0]?.quantity).toBe(CART_MAX_QUANTITY);

    setQuantity('prod-1', 99);
    expect(getItems()[0]?.quantity).toBe(CART_MAX_QUANTITY);

    setQuantity('prod-1', 0);
    expect(getItems()).toHaveLength(0);
  });
});
