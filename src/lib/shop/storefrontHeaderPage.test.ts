import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mainLayout = readFileSync(new URL('../../layouts/MainLayout.astro', import.meta.url), 'utf8');
const marketingShop = readFileSync(new URL('../../pages/shop.astro', import.meta.url), 'utf8');
const tenantShop = readFileSync(new URL('../../pages/shop/[shopId].astro', import.meta.url), 'utf8');
const tenantPdp = readFileSync(new URL('../../pages/shop/[shopId]/[productId].astro', import.meta.url), 'utf8');
const testShop = readFileSync(new URL('../../pages/admin/test-shop.astro', import.meta.url), 'utf8');
const testShopPdp = readFileSync(new URL('../../pages/admin/test-shop/[id].astro', import.meta.url), 'utf8');
const header = readFileSync(new URL('../../components/shop/storefront/StorefrontHeader.astro', import.meta.url), 'utf8');

describe('tenant storefront header mounts', () => {
  it('uses StorefrontHeader on live tenant shops instead of the subscribe CTA', () => {
    expect(mainLayout).toContain('StorefrontHeader');
    expect(mainLayout).toContain('useTenantStorefrontHeader');
    expect(mainLayout).toContain("themeId=\"kersivo\"");
    expect(mainLayout).toContain('bookHref={`/book/${shopId}`}');
    expect(mainLayout).not.toMatch(/useTenantStorefrontHeader[\s\S]*saas_subscribe_click/);
    expect(tenantShop).toContain('brandLogoUrl={shop.logoUrl}');
    expect(tenantPdp).toContain('brandLogoUrl={pageData.shop.logoUrl}');
  });

  it('keeps the Kersivo marketing shop on Navbar17', () => {
    expect(marketingShop).toContain('navbarVariant="shop"');
    expect(marketingShop).toContain('publicDemoMode');
    expect(marketingShop).not.toContain('StorefrontHeader');
  });

  it('mounts StorefrontHeader on test-shop listing and PDP', () => {
    expect(testShop).toContain('StorefrontHeader');
    expect(testShop).toContain('bookHref="/admin/test-book"');
    expect(testShop).not.toContain('Navbar17');
    expect(testShopPdp).toContain('StorefrontHeader');
    expect(testShopPdp).toContain('bookHref="/admin/test-book"');
    expect(testShopPdp).not.toContain('Navbar17');
  });

  it('does not sniff BLACKLINE pathnames in the shared header', () => {
    expect(header).not.toContain('Astro.url');
    expect(header).not.toContain("'/demo'");
    expect(header).not.toContain('"/demo"');
    expect(header).not.toContain('BLACKLINE');
    expect(header).toContain('data-bl-bag-button');
    expect(header).toContain('data-sf-bag-button');
  });
});
