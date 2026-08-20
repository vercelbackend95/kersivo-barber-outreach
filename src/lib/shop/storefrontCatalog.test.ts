import { describe, expect, it } from 'vitest';
import { DEMO_PRODUCTS } from '@/lib/demo/products';
import { DEMO_CATALOG_PRODUCTS } from '@/lib/shop/demoCatalog';
import { formatGbp } from '@/lib/shop/money';
import {
  BLACKLINE_STOREFRONT_THEME,
  KERSIVO_STOREFRONT_THEME,
} from './storefrontTheme';
import {
  STOREFRONT_ALL_CATEGORY,
  STOREFRONT_PAGE_SIZE,
  STOREFRONT_SORT_MIN_COUNT,
  collectStorefrontProducts,
  featuredProducts,
  filterByCategory,
  formatStorefrontPrice,
  paginateStorefrontProducts,
  parseStorefrontCategoryParam,
  parseStorefrontQuery,
  relatedStorefrontProducts,
  searchStorefrontProducts,
  sortStorefrontProducts,
  storefrontCategoryOptions,
  storefrontCategorySearch,
  storefrontProductFromCatalog,
  storefrontProductFromDemo,
  storefrontProductHref,
  storefrontQuerySearch,
  toStorefrontProduct,
  visibleCategories,
  visibleProducts,
  productInitials,
  shopInitial,
  clampStorefrontFocalPoint,
  type StorefrontProduct,
} from './storefrontCatalog';

function product(overrides: Partial<StorefrontProduct> & Pick<StorefrontProduct, 'id' | 'name'>): StorefrontProduct {
  return {
    description: 'A grooming product.',
    pricePence: 1800,
    image: { src: '/images/example.png', alt: overrides.name },
    category: 'STYLING',
    featured: false,
    sortOrder: 0,
    active: true,
    available: true,
    requiresOptions: false,
    ...overrides,
  };
}

describe('storefrontCatalog', () => {
  it('maps BLACKLINE demo products and marketing catalog products', () => {
    const blackline = storefrontProductFromDemo(DEMO_PRODUCTS[0]!);
    expect(blackline.id).toBe('bl-product-ironclad-pomade');
    expect(blackline.image.src).toContain('/demo/products/');
    expect(blackline.featured).toBe(true);

    const marketing = storefrontProductFromCatalog(DEMO_CATALOG_PRODUCTS[0]!);
    expect(marketing.id).toBe('demo-product-matte-pomade');
    expect(marketing.image.src).toContain('/images/demoshop/');
  });

  it('clamps focal points and preserves them through demo product mapping', () => {
    expect(clampStorefrontFocalPoint()).toEqual({ x: 50, y: 50 });
    expect(clampStorefrontFocalPoint({ x: -10, y: 140 })).toEqual({ x: 0, y: 100 });
    expect(clampStorefrontFocalPoint({ x: Number.NaN, y: 12 })).toEqual({ x: 50, y: 12 });

    const barberWash = storefrontProductFromDemo(
      DEMO_PRODUCTS.find((product) => product.id === 'bl-product-barber-wash')!,
    );
    expect(barberWash.image.focalPoint).toEqual({ x: 50, y: 44 });

    const ironclad = storefrontProductFromDemo(
      DEMO_PRODUCTS.find((product) => product.id === 'bl-product-ironclad-pomade')!,
    );
    expect(ironclad.image.focalPoint).toBeUndefined();

    const clamped = toStorefrontProduct({
      id: 'focal-test',
      name: 'Focal Test',
      pricePence: 1000,
      category: 'STYLING',
      image: { src: '/demo/products/x.webp', alt: 'X', focalPoint: { x: 200, y: -5 } },
    });
    expect(clamped.image.focalPoint).toEqual({ x: 100, y: 0 });
  });

  it('hides inactive products and does not auto-feature the first item', () => {
    const list = [
      product({ id: 'a', name: 'Alpha', featured: false, sortOrder: 0 }),
      product({ id: 'b', name: 'Hidden', active: false, available: false, featured: true, sortOrder: 1 }),
      product({ id: 'c', name: 'Charlie', featured: false, sortOrder: 2 }),
    ];
    expect(visibleProducts(list).map((item) => item.id)).toEqual(['a', 'c']);
    expect(featuredProducts(list)).toEqual([]);
  });

  it('returns 0/1/2/many featured products in sortOrder without a cap', () => {
    expect(featuredProducts([])).toEqual([]);
    expect(featuredProducts([product({ id: 'one', name: 'One', featured: true })]).map((item) => item.id)).toEqual([
      'one',
    ]);

    const two = featuredProducts([
      product({ id: 'late', name: 'Late', featured: true, sortOrder: 2 }),
      product({ id: 'early', name: 'Early', featured: true, sortOrder: 1 }),
    ]);
    expect(two.map((item) => item.id)).toEqual(['early', 'late']);

    const many = Array.from({ length: 8 }, (_, index) =>
      product({
        id: `f-${index}`,
        name: `Featured ${index}`,
        featured: true,
        sortOrder: 8 - index,
      }),
    );
    expect(featuredProducts(many)).toHaveLength(8);
    expect(featuredProducts(many)[0]?.id).toBe('f-7');
  });

  it('keeps featured products in All products', () => {
    const list = [
      product({ id: 'feat', name: 'Featured', featured: true, category: 'BEARD_CARE', sortOrder: 1 }),
      product({ id: 'plain', name: 'Plain', featured: false, category: 'STYLING', sortOrder: 2 }),
    ];
    expect(filterByCategory(list, STOREFRONT_ALL_CATEGORY).map((item) => item.id)).toEqual(['feat', 'plain']);
    expect(featuredProducts(list).map((item) => item.id)).toEqual(['feat']);
  });

  it('derives product initials for untitled media', () => {
    expect(productInitials('Shave Cream')).toBe('SC');
    expect(productInitials('Ironclad Pomade')).toBe('IP');
    expect(shopInitial('BLACKLINE')).toBe('B');
  });

  it('keeps the Live BLACKLINE catalog at 30 SKUs with four featured items and six shop categories', () => {
    const list = DEMO_PRODUCTS.filter((item) => item.active).map(storefrontProductFromDemo);
    expect(list).toHaveLength(30);
    expect(featuredProducts(list).map((item) => item.name)).toEqual([
      'Ironclad Pomade',
      'Beard Balm',
      'Barber Wash',
      'Essential Styling Set',
    ]);
    expect(storefrontCategoryOptions(list).map((option) => option.label)).toEqual([
      'All products',
      'Styling',
      'Hair & Scalp',
      'Beard Care',
      'Shave & Skin',
      'Tools & Accessories',
      'Sets & Gifts',
    ]);
  });

  it('omits empty categories and keeps admin category order', () => {
    const list = [
      product({ id: 'tools', name: 'Comb', category: 'TOOLS' }),
      product({ id: 'pomade', name: 'Pomade', category: 'POMADES_AND_CLAYS' }),
      product({ id: 'hidden-gift', name: 'Gift', category: 'GIFT_SETS', active: false, available: false }),
    ];
    expect(visibleCategories(list)).toEqual(['TOOLS', 'POMADES_AND_CLAYS']);
    expect(storefrontCategoryOptions(list).map((option) => option.value)).toEqual([
      'ALL',
      'TOOLS',
      'POMADES_AND_CLAYS',
    ]);
  });

  it('sorts by admin sortOrder by default, then price and name', () => {
    const list = [
      product({ id: 'b', name: 'Bravo', pricePence: 2200, sortOrder: 2 }),
      product({ id: 'a', name: 'Alpha', pricePence: 900, sortOrder: 1 }),
      product({ id: 'c', name: 'Charlie', pricePence: 1500, sortOrder: 3 }),
    ];
    expect(sortStorefrontProducts(list, 'recommended').map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(sortStorefrontProducts(list, 'price-asc').map((item) => item.id)).toEqual(['a', 'c', 'b']);
    expect(sortStorefrontProducts(list, 'price-desc').map((item) => item.id)).toEqual(['b', 'c', 'a']);
    expect(sortStorefrontProducts(list, 'name').map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(STOREFRONT_SORT_MIN_COUNT).toBe(8);
  });

  it('formats GBP for tenants and whole pounds for BLACKLINE', () => {
    expect(formatStorefrontPrice(1900, 'gbp')).toBe(formatGbp(1900));
    expect(formatStorefrontPrice(1900, 'demo')).toBe('£19');
  });

  it('parses category URLs and product hrefs', () => {
    const valid = ['ALL', 'BEARD_CARE'];
    expect(parseStorefrontCategoryParam('BEARD_CARE', valid)).toBe('BEARD_CARE');
    expect(parseStorefrontCategoryParam('nope', valid)).toBe('ALL');
    expect(parseStorefrontCategoryParam(null, valid)).toBe('ALL');
    expect(storefrontCategorySearch('ALL')).toBe('');
    expect(storefrontCategorySearch('BEARD_CARE')).toBe('?category=BEARD_CARE');
    expect(storefrontProductHref('/shop/abc/', 'prod 1')).toBe('/shop/abc/prod%201');
  });

  it('keeps requiresOptions false on live-shaped data and true on a fixture', () => {
    const live = toStorefrontProduct({
      id: 'live',
      name: 'Live',
      pricePence: 1000,
      category: 'STYLING',
    });
    expect(live.requiresOptions).toBe(false);
    expect(live.available).toBe(true);

    const optionsFixture = toStorefrontProduct({
      id: 'opts',
      name: 'Choose me',
      pricePence: 1000,
      category: 'STYLING',
      requiresOptions: true,
    });
    expect(optionsFixture.requiresOptions).toBe(true);
  });

  it('uses the same components for BLACKLINE and the marketing catalog as a second tenant', () => {
    const blackline = DEMO_PRODUCTS.map(storefrontProductFromDemo);
    const marketing = DEMO_CATALOG_PRODUCTS.map(storefrontProductFromCatalog);
    expect(blackline.every((item) => item.id.startsWith('bl-product-'))).toBe(true);
    expect(marketing.every((item) => item.id.startsWith('demo-product-'))).toBe(true);
    expect(blackline.some((item) => marketing.some((other) => other.id === item.id))).toBe(false);
    expect(BLACKLINE_STOREFRONT_THEME.id).toBe('blackline');
    expect(KERSIVO_STOREFRONT_THEME.id).toBe('kersivo');
    expect(BLACKLINE_STOREFRONT_THEME.imageFallback).not.toBe(KERSIVO_STOREFRONT_THEME.imageFallback);
    expect(featuredProducts(blackline).map((item) => item.name)).toEqual([
      'Ironclad Pomade',
      'Beard Balm',
      'Barber Wash',
      'Essential Styling Set',
    ]);
    expect(visibleCategories(blackline)).toEqual([
      'STYLING',
      'HAIR_WASH',
      'BEARD_CARE',
      'SHAVE_AND_SKIN',
      'TOOLS',
      'GIFT_SETS',
    ]);
  });

  it('parses listing query strings and searches name, description and category', () => {
    const valid = ['ALL', 'BEARD_CARE', 'STYLING'];
    expect(
      parseStorefrontQuery(
        new URLSearchParams('category=BEARD_CARE&q=oil&sort=price-asc&availability=available'),
        valid,
      ),
    ).toEqual({
      category: 'BEARD_CARE',
      q: 'oil',
      sort: 'price-asc',
      availability: 'available',
    });
    expect(parseStorefrontQuery(new URLSearchParams('category=nope&sort=nope'), valid)).toEqual({
      category: 'ALL',
      q: '',
      sort: 'recommended',
      availability: 'all',
    });
    expect(storefrontQuerySearch({ category: 'BEARD_CARE', q: 'oil' })).toBe('?category=BEARD_CARE&q=oil');

    const list = [
      product({ id: 'oil', name: 'Beard Oil', description: 'Softens hair', category: 'BEARD_CARE' }),
      product({ id: 'pomade', name: 'Ironclad', description: 'Firm hold', category: 'STYLING' }),
    ];
    expect(searchStorefrontProducts(list, 'beard').map((item) => item.id)).toEqual(['oil']);
    expect(searchStorefrontProducts(list, 'styling').map((item) => item.id)).toEqual(['pomade']);
    expect(collectStorefrontProducts(list, {
      category: 'ALL',
      q: 'hold',
      sort: 'recommended',
      availability: 'all',
    }).map((item) => item.id)).toEqual(['pomade']);
  });

  it('paginates the filtered set and related products stay in the same category', () => {
    const list = Array.from({ length: 30 }, (_, index) =>
      product({
        id: `p-${index}`,
        name: `Product ${String(index).padStart(2, '0')}`,
        sortOrder: index,
        category: index < 4 ? 'BEARD_CARE' : 'STYLING',
      }),
    );
    const page = paginateStorefrontProducts(list, STOREFRONT_PAGE_SIZE);
    expect(page.visible).toHaveLength(24);
    expect(page.hasMore).toBe(true);
    expect(paginateStorefrontProducts(list, 48).visible).toHaveLength(30);
    expect(relatedStorefrontProducts(list, 'p-1').every((item) => item.category === 'BEARD_CARE')).toBe(true);
    expect(relatedStorefrontProducts(list, 'p-1').map((item) => item.id)).not.toContain('p-1');
  });
});
