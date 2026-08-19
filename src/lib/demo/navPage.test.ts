import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEMO_BOOK_HREF,
  DEMO_CONTACT_HREF,
  DEMO_HOME_HREF,
  DEMO_NAV,
  DEMO_SHOP_HREF,
  formatNavIndex,
  isDemoNavActive,
} from './nav';

const wrapper = readFileSync(new URL('../../components/demo/DemoNav.astro', import.meta.url), 'utf8');
const header = readFileSync(new URL('../../components/shop/storefront/StorefrontHeader.astro', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../../layouts/DemoLayout.astro', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles/components/storefront-header.css', import.meta.url), 'utf8');

describe('BLACKLINE mobile navigation markup', () => {
  it('starts closed with a real toggle and accessible names', () => {
    expect(header).toContain('data-bl-nav-state="closed"');
    expect(wrapper).toContain('homeLabel="BLACKLINE demo home"');
    expect(wrapper).toContain('BlacklineWordmark');
    expect(wrapper).toContain('size="default"');
    expect(wrapper).not.toContain('bl-wordmark-sub');
    expect(header).toContain('Open navigation menu');
    expect(header).toContain('aria-controls={panelId}');
    expect(header).toContain('aria-expanded="false"');
    expect(header).toContain('data-bl-nav-panel hidden');
    expect(header).toContain('aria-label="Mobile navigation"');
  });

  it('uses established routes and a booking href without preselect queries', () => {
    expect(DEMO_NAV.map((item) => item.href)).toEqual([
      DEMO_HOME_HREF,
      '/demo/services',
      '/demo/barbers',
      '/demo/gallery',
      DEMO_SHOP_HREF,
      DEMO_CONTACT_HREF,
    ]);
    expect(wrapper).toContain('DEMO_BOOK_HREF');
    expect(wrapper).not.toContain('?service=');
    expect(wrapper).not.toContain('?barber=');
    expect(wrapper).not.toContain('href="#"');
    expect(DEMO_BOOK_HREF).toBe('/demo/book');
    expect(isDemoNavActive('/demo/shop/bl-product-ironclad-pomade', DEMO_SHOP_HREF)).toBe(true);
    expect(isDemoNavActive('/demo/shop', DEMO_HOME_HREF)).toBe(false);
  });

  it('keeps overlay booking plus a compact header BOOK control', () => {
    expect(header).toContain('data-bl-nav-book');
    expect(header).toContain('Book an appointment');
    expect(header.match(/data-bl-nav-book/g)).toHaveLength(1);
    expect(header).toContain('BOOK NOW');
    expect(header).toContain('data-bl-nav-bag');
    expect(header).toContain('data-bl-bag-count');
    expect(header).toContain('data-bl-bag-button');
    expect(formatNavIndex(0)).toBe('01');
  });

  it('scopes the overlay and desktop protection in storefront-header tokens', () => {
    expect(css).toContain('.sf-nav-layer');
    expect(css).toContain('@media (min-width: 70rem)');
    expect(css).toContain('--sf-header-accent: #ff1717');
    expect(css).not.toContain('--bl-cobalt');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('env(safe-area-inset-bottom');
    expect(css).toContain('max-width: 359px');
    expect(layout).toContain('viewport-fit=cover');
    expect(layout).toContain('blackline-wordmark.css');
  });
});
