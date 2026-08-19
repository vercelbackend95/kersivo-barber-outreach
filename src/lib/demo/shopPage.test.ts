import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shopPage = readFileSync(new URL('../../pages/demo/shop.astro', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../../layouts/DemoLayout.astro', import.meta.url), 'utf8');
const storefrontPage = readFileSync(
  new URL('../../components/shop/storefront/StorefrontShopPage.tsx', import.meta.url),
  'utf8',
);
const checkout = readFileSync(new URL('../../pages/demo/shop/checkout.astro', import.meta.url), 'utf8');
const confirmation = readFileSync(new URL('../../pages/demo/shop/confirmation.astro', import.meta.url), 'utf8');
const complete = readFileSync(new URL('../../pages/api/demo/shop/complete.ts', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../../styles/demo/blackline.css', import.meta.url), 'utf8');

const pdpPage = readFileSync(new URL('../../pages/demo/shop/[id].astro', import.meta.url), 'utf8');
const marketingShop = readFileSync(new URL('../../pages/shop.astro', import.meta.url), 'utf8');
const marketingPdp = readFileSync(new URL('../../pages/shop/demo/[id].astro', import.meta.url), 'utf8');
const tenantPdp = readFileSync(new URL('../../pages/shop/[shopId]/[productId].astro', import.meta.url), 'utf8');
const testShopPdp = readFileSync(new URL('../../pages/admin/test-shop/[id].astro', import.meta.url), 'utf8');

describe('BLACKLINE shop pages', () => {
  it('uses the required catalog, checkout and confirmation copy', () => {
    expect(shopPage).toContain('StorefrontShopPage');
    expect(shopPage).toContain('headingId: \'blackline-shop-heading\'');
    expect(shopPage).toContain('THE BLACKLINE EDIT.');
    expect(shopPage).toContain('Grooming essentials selected by the shop, ready to collect.');
    expect(shopPage).toContain('COLLECT IN SHOP');
    expect(shopPage).toContain('DEMO CHECKOUT');
    expect(shopPage).not.toContain('safetyNote');
    expect(shopPage).toContain('Shop the shelf.');
    expect(shopPage).toContain("addToBagLabel: 'Add'");
    expect(shopPage).not.toContain('ADD TO BAG');
    expect(shopPage).not.toContain('DemoShopHero');
    expect(shopPage).not.toContain('DemoShopCollection');
    expect(shopPage).not.toContain('BLACKLINE_PRODUCT_LAYOUT');
    expect(checkout).toContain('Collect at Blackline.');
    expect(checkout).toContain('No payment will be taken and no real fulfilment will begin.');
    expect(confirmation).toContain('Ready for collection.');
    expect(confirmation).toContain('No payment was taken and no real order was placed.');
    expect(confirmation).not.toContain('A demo order was created inside the isolated BLACKLINE sandbox.');
    expect(confirmation).not.toContain('payment received');
    expect(confirmation).not.toContain('/admin-demo');
  });

  it('binds the BLACKLINE cart namespace before hydrate and does not import shop.css', () => {
    expect(layout).toContain('__KERSIVO_CART_NAMESPACE__');
    expect(layout).toContain('CartDrawerMount');
    expect(layout).toContain('themeId="blackline"');
    expect(layout).toContain('/demo/shop/checkout');
    expect(layout).not.toContain('DemoBagDrawer');
    expect(layout).not.toContain("shop.css");
    expect(layout).not.toContain('@/styles/components/shop.css');
    expect(shopPage).toContain("@/styles/components/storefront.css");
    expect(readFileSync(new URL('../../styles/components/storefront.css', import.meta.url), 'utf8')).toContain(
      '--sf-accent: #ff1717;',
    );
  });

  it('loads the catalog from the BLACKLINE loader rather than another tenant', () => {
    expect(shopPage).toContain("from '@/lib/demo/blacklineShop'");
    expect(shopPage).toContain('getBlacklineRetailProducts');
    expect(shopPage).toContain('storefrontProductFromDemo');
    expect(shopPage).not.toContain('getDemoCatalogProducts');
    expect(shopPage).not.toContain('demo-shop');
    expect(storefrontPage).not.toContain('bl-product-ironclad-pomade');
  });

  it('completes without Stripe, orders, email or SMS', () => {
    expect(complete).toContain('resolveRetailCartFromProducts');
    expect(complete).not.toContain('createShopOrder');
    expect(complete).not.toContain('stripe');
    expect(complete).not.toContain('enqueueEmail');
    expect(complete).not.toContain('sms');
    expect(complete).not.toContain('prisma.order');
    expect(complete).not.toContain('/admin-demo');
    expect(complete).not.toContain('sendEmail');
    expect(complete).not.toContain('sendSms');
  });

  it('scopes shop motion under the BLACKLINE theme', () => {
    expect(cssSource).toContain("[data-theme='blackline'][data-bl-shop-motion]");
    expect(cssSource).toContain("[data-theme='blackline'] .bl-page-hero");
    expect(cssSource).toContain('--bl-size-page-hero: clamp(3.75rem, 8vw, 8.75rem)');
  });

  it('puts BLACKLINE, marketing, live and test-shop PDPs on the shared storefront detail', () => {
    expect(pdpPage).toContain('StorefrontProductDetail');
    expect(pdpPage).not.toContain('bl-pdp');
    expect(pdpPage).not.toContain('DemoProductAdd');
    expect(marketingPdp).toContain('StorefrontProductDetail');
    expect(marketingPdp).not.toContain('product-hero');
    expect(tenantPdp).toContain('StorefrontProductDetail');
    expect(testShopPdp).toContain('StorefrontProductDetail');
  });
});

describe('KERSIVO marketing shop isolation', () => {
  it('uses the shared storefront with the kersivo theme and demo-product ids', () => {
    expect(marketingShop).toContain('StorefrontShopPage');
    expect(marketingShop).toContain('themeId="kersivo"');
    expect(marketingShop).toContain('productHrefPrefix="/shop/demo"');
    expect(marketingShop).toContain('storefrontProductFromCatalog');
    expect(marketingShop).not.toContain('bl-product-');
    expect(marketingShop).not.toContain('getBlacklineRetailProducts');
  });
});
