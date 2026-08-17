import { describe, expect, it } from 'vitest';
import { getRouteFamily, isSameRouteFamily, normalizePathname } from './routeFamilies';
import {
  isCurrentPathNavigation,
  isModifiedNavigationClick,
  isSameDocumentHashNavigation,
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
    expect(getRouteFamily('/demo')).toBe('demo');
    expect(getRouteFamily('/demo/shop')).toBe('demo');
    expect(getRouteFamily('/admin')).toBe('minimal');
    expect(getRouteFamily('/admin/onboarding')).toBe('minimal');
    expect(getRouteFamily('/book/abc')).toBe('minimal');
    expect(getRouteFamily('/shop/success')).toBe('minimal');
    expect(normalizePathname('/shop/')).toBe('/shop');
  });

  it('keeps ClientRouter inside a family and treats crossings as reloads', () => {
    expect(isSameRouteFamily('/', '/shop')).toBe(true);
    expect(isSameRouteFamily('/shop', '/privacy')).toBe(true);
    expect(isSameRouteFamily('/admin', '/admin/onboarding')).toBe(true);
    expect(isSameRouteFamily('/', '/admin')).toBe(false);
    expect(isSameRouteFamily('/demo', '/')).toBe(false);

    const marketing = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/' };
    expect(shouldIgnoreAnchorNavigation('/admin/launch', marketing)).toBe(true);
    expect(shouldIgnoreAnchorNavigation('/shop', marketing)).toBe(false);
    expect(shouldIgnoreAnchorNavigation('/#pricing', marketing)).toBe(true);
    expect(shouldIgnoreAnchorNavigation('mailto:hello@kersivo.co.uk', marketing)).toBe(true);
    expect(isModifiedNavigationClick({ metaKey: true })).toBe(true);
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
});
