import { describe, it, expect } from 'vitest';
import {
  buildDemoProductBreadcrumbJsonLd,
  buildProductPageJsonLd,
} from './productJsonLd';

describe('product JSON-LD helpers', () => {
  it('buildDemoProductBreadcrumbJsonLd is BreadcrumbList only (no Product/Offer)', () => {
    const jsonLd = buildDemoProductBreadcrumbJsonLd('Matte Pomade', '/shop/demo-product-matte-pomade');
    const serialized = JSON.stringify(jsonLd);

    expect(jsonLd['@type']).toBe('BreadcrumbList');
    expect(serialized).not.toContain('"Offer"');
    expect(serialized).not.toContain('"Product"');
    expect(serialized).not.toContain('InStock');
    expect(serialized).not.toContain('priceCurrency');
  });

  it('buildProductPageJsonLd still includes Product Offer for future live shops', () => {
    const blocks = buildProductPageJsonLd({
      id: 'live-product-1',
      name: 'Live Clay',
      description: 'Real product',
      pricePence: 2500,
      inStock: true,
    });

    expect(blocks.some((block) => block['@type'] === 'Product')).toBe(true);
    expect(JSON.stringify(blocks)).toContain('"Offer"');
  });
});
