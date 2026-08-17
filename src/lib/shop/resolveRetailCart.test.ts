import { describe, expect, it } from 'vitest';
import { resolveRetailCartFromProducts } from './resolveRetailCart';

const products = [
  { id: 'bl-product-ironclad-pomade', name: 'Ironclad Pomade', pricePence: 1900, imageUrl: '/a.webp', active: true },
  { id: 'bl-product-beard-balm', name: 'Beard Balm', pricePence: 1600, imageUrl: '/b.webp', active: true },
];

describe('resolveRetailCartFromProducts', () => {
  it('recalculates line totals from catalog prices and ignores client amounts', () => {
    const resolved = resolveRetailCartFromProducts(products, [
      { productId: 'bl-product-ironclad-pomade', quantity: 2 },
      { productId: 'bl-product-beard-balm', quantity: 1 },
    ]);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.cart.totalPence).toBe(1900 * 2 + 1600);
    expect(resolved.cart.items[0]?.unitPricePence).toBe(1900);
  });

  it('rejects unknown products, empty bags, and quantities over the max', () => {
    expect(resolveRetailCartFromProducts(products, []).ok).toBe(false);
    expect(
      resolveRetailCartFromProducts(products, [{ productId: 'demo-product-matte-pomade', quantity: 1 }]).ok,
    ).toBe(false);
    expect(
      resolveRetailCartFromProducts(products, [{ productId: 'bl-product-ironclad-pomade', quantity: 11 }], {
        maxQuantity: 10,
      }).ok,
    ).toBe(false);
  });
});
