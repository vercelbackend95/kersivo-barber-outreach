/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import {
  getRouteFamily,
  isLiveTenantShopPath,
  isSameRouteFamily,
  normalizePathname,
} from './routeFamilies';
import {
  isCurrentPathNavigation,
  isModifiedNavigationClick,
  isSameDocumentHashNavigation,
  markCrossFamilyReloadLinks,
  shouldCoverTransition,
  shouldIgnoreAnchorNavigation,
} from './routeTransition';

function url(path: string) {
  return new URL(path, 'http://localhost');
}

describe('route families', () => {
  it('classifies marketing, demo and minimal surfaces', () => {
    expect(getRouteFamily('/')).toBe('marketing');
    expect(getRouteFamily('/shop')).toBe('marketing');
    expect(getRouteFamily('/shop/demo/matte')).toBe('marketing');
    expect(getRouteFamily('/privacy')).toBe('marketing');
    expect(getRouteFamily('/cookies')).toBe('marketing');
    expect(getRouteFamily('/terms')).toBe('marketing');
    expect(getRouteFamily('/demo')).toBe('demo');
    expect(getRouteFamily('/demo/shop')).toBe('demo');
    expect(getRouteFamily('/demo/admin')).toBe('minimal');
    expect(getRouteFamily('/admin')).toBe('minimal');
    expect(getRouteFamily('/admin/onboarding')).toBe('minimal');
    expect(getRouteFamily('/book/abc')).toBe('minimal');
    expect(getRouteFamily('/shop/success')).toBe('minimal');
    expect(getRouteFamily('/shop/cancelled')).toBe('minimal');
    expect(normalizePathname('/shop/')).toBe('/shop');
  });

  it('classifies live tenant storefront routes as tenant', () => {
    expect(isLiveTenantShopPath('/shop/live-shop-id')).toBe(true);
    expect(isLiveTenantShopPath('/shop/live-shop-id/product-id')).toBe(true);
    expect(isLiveTenantShopPath('/shop/live-shop-id/success')).toBe(true);
    expect(isLiveTenantShopPath('/shop/live-shop-id/cancelled')).toBe(true);
    expect(isLiveTenantShopPath('/shop')).toBe(false);
    expect(isLiveTenantShopPath('/shop/demo/matte')).toBe(false);
    expect(isLiveTenantShopPath('/shop/success')).toBe(false);
    expect(isLiveTenantShopPath('/shop/cancelled')).toBe(false);

    expect(getRouteFamily('/shop/live-shop-id')).toBe('tenant');
    expect(getRouteFamily('/shop/live-shop-id/product-id')).toBe('tenant');
    expect(getRouteFamily('/shop/live-shop-id/success')).toBe('tenant');
    expect(getRouteFamily('/shop/live-shop-id/cancelled')).toBe('tenant');
  });

  it('keeps marketing↔tenant as a hard document boundary', () => {
    expect(isSameRouteFamily('/', '/shop/live-shop-id')).toBe(false);
    expect(isSameRouteFamily('/shop', '/shop/live-shop-id')).toBe(false);
    expect(isSameRouteFamily('/shop/live-shop-id', '/')).toBe(false);
    expect(isSameRouteFamily('/shop/live-shop-id', '/shop')).toBe(false);
    expect(
      isSameRouteFamily('/shop/live-shop-id', '/shop/live-shop-id/product-id'),
    ).toBe(true);
    expect(
      isSameRouteFamily('/shop/live-shop-id', '/shop/live-shop-id/success'),
    ).toBe(true);
  });

  it('keeps ClientRouter inside a family and treats crossings as reloads', () => {
    expect(isSameRouteFamily('/', '/shop')).toBe(true);
    expect(isSameRouteFamily('/shop', '/privacy')).toBe(true);
    expect(isSameRouteFamily('/admin', '/admin/onboarding')).toBe(true);
    expect(isSameRouteFamily('/', '/admin')).toBe(false);
    expect(isSameRouteFamily('/demo', '/')).toBe(false);
    expect(isSameRouteFamily('/', '/book/abc')).toBe(false);

    const marketing = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/' };
    expect(shouldIgnoreAnchorNavigation('/admin/launch', marketing)).toBe(true);
    expect(shouldIgnoreAnchorNavigation('/shop/live-shop-id', marketing)).toBe(true);
    expect(shouldIgnoreAnchorNavigation('/shop', marketing)).toBe(false);
    expect(shouldIgnoreAnchorNavigation('/#pricing', marketing)).toBe(true);
    expect(shouldIgnoreAnchorNavigation('mailto:hello@kersivo.co.uk', marketing)).toBe(true);
    expect(isModifiedNavigationClick({ metaKey: true })).toBe(true);

    const tenant = {
      href: 'http://localhost/shop/live-shop-id',
      origin: 'http://localhost',
      pathname: '/shop/live-shop-id',
    };
    expect(shouldIgnoreAnchorNavigation('/', tenant)).toBe(true);
    expect(shouldIgnoreAnchorNavigation('/shop/live-shop-id/product-id', tenant)).toBe(false);
  });

  it('covers in-family push navigations and skips traverse and reduced motion', () => {
    expect(
      shouldCoverTransition({
        from: url('/shop'),
        to: url('/shop/demo/matte'),
        navigationType: 'push',
        reducedMotion: false,
        family: 'marketing',
      }),
    ).toBe(true);
    expect(
      shouldCoverTransition({
        from: url('/shop'),
        to: url('/admin'),
        navigationType: 'push',
        reducedMotion: false,
        family: 'marketing',
      }),
    ).toBe(false);
    expect(
      shouldCoverTransition({
        from: url('/'),
        to: url('/shop/live-shop-id'),
        navigationType: 'push',
        reducedMotion: false,
        family: 'marketing',
      }),
    ).toBe(false);
    expect(
      shouldCoverTransition({
        from: url('/admin'),
        to: url('/admin/onboarding'),
        navigationType: 'traverse',
        reducedMotion: false,
        family: 'minimal',
      }),
    ).toBe(false);
    expect(isCurrentPathNavigation(url('/shop'), url('/shop'))).toBe(true);
    expect(isSameDocumentHashNavigation(url('/'), url('/#pricing'))).toBe(true);
  });

  it('marks marketing → live tenant links with data-astro-reload', () => {
    const current = {
      href: 'http://localhost/',
      origin: 'http://localhost',
      pathname: '/',
    };
    document.body.innerHTML = `
      <a id="to-tenant" href="http://localhost/shop/live-shop-id">Tenant shop</a>
      <a id="to-demo" href="http://localhost/shop">Retail demo</a>
      <a id="to-tenant-product" href="http://localhost/shop/live-shop-id/product-id">Product</a>
      <a id="hash" href="http://localhost/#pricing">Pricing</a>
    `;

    markCrossFamilyReloadLinks(document, current);

    expect(document.getElementById('to-tenant')?.hasAttribute('data-astro-reload')).toBe(true);
    expect(document.getElementById('to-tenant-product')?.hasAttribute('data-astro-reload')).toBe(
      true,
    );
    expect(document.getElementById('to-demo')?.hasAttribute('data-astro-reload')).toBe(false);
    expect(document.getElementById('hash')?.hasAttribute('data-astro-reload')).toBe(false);
  });

  it('marks tenant → marketing links with data-astro-reload', () => {
    const current = {
      href: 'http://localhost/shop/live-shop-id',
      origin: 'http://localhost',
      pathname: '/shop/live-shop-id',
    };
    document.body.innerHTML = `
      <a id="home" href="http://localhost/">Home</a>
      <a id="demo-shop" href="http://localhost/shop">Demo shop</a>
      <a id="product" href="http://localhost/shop/live-shop-id/product-id">Product</a>
      <a id="success" href="http://localhost/shop/live-shop-id/success">Success</a>
    `;

    markCrossFamilyReloadLinks(document, current);

    expect(document.getElementById('home')?.hasAttribute('data-astro-reload')).toBe(true);
    expect(document.getElementById('demo-shop')?.hasAttribute('data-astro-reload')).toBe(true);
    expect(document.getElementById('product')?.hasAttribute('data-astro-reload')).toBe(false);
    expect(document.getElementById('success')?.hasAttribute('data-astro-reload')).toBe(false);
  });
});
