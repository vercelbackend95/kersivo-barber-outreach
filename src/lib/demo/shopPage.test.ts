import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shopPage = readFileSync(new URL('../../pages/demo/shop.astro', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../../layouts/DemoLayout.astro', import.meta.url), 'utf8');
const hero = readFileSync(new URL('../../components/demo/DemoShopHero.astro', import.meta.url), 'utf8');
const collection = readFileSync(new URL('../../components/demo/DemoShopCollection.astro', import.meta.url), 'utf8');
const checkout = readFileSync(new URL('../../pages/demo/shop/checkout.astro', import.meta.url), 'utf8');
const confirmation = readFileSync(new URL('../../pages/demo/shop/confirmation.astro', import.meta.url), 'utf8');
const complete = readFileSync(new URL('../../pages/api/demo/shop/complete.ts', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../../styles/demo/blackline.css', import.meta.url), 'utf8');

describe('BLACKLINE shop pages', () => {
  it('uses the required catalog, checkout and confirmation copy', () => {
    expect(hero).toContain("from '@/components/demo/DemoPageHero.astro'");
    expect(hero).toContain('headingId="blackline-shop-heading"');
    expect(hero).toContain('The Blackline');
    expect(hero).toContain('Edit.');
    expect(hero).toContain('A curated selection for styling, care and the finish.');
    expect(hero).toContain('COLLECT IN SHOP');
    expect(hero).toContain('DEMO CHECKOUT');
    expect(hero).toContain('No real payment or fulfilment is created.');
    expect(collection).toContain('Shop the shelf.');
    expect(collection).toContain('Order online and collect from the shop.');
    expect(collection).toContain('ADD TO BAG');
    expect(collection).toContain('VIEW PRODUCT');
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
    expect(layout).toContain('DemoBagDrawer');
    expect(layout).not.toContain("shop.css");
    expect(layout).not.toContain('@/styles/components/shop.css');
  });

  it('loads the catalog from the BLACKLINE loader rather than another tenant', () => {
    expect(shopPage).toContain("from '@/lib/demo/blacklineShop'");
    expect(shopPage).toContain('getBlacklineRetailProducts');
    expect(shopPage).not.toContain('getDemoCatalogProducts');
    expect(shopPage).not.toContain('demo-shop');
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
});
