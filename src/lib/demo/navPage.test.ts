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

const source = readFileSync(new URL('../../components/demo/DemoNav.astro', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../../layouts/DemoLayout.astro', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles/demo/blackline.css', import.meta.url), 'utf8');

describe('BLACKLINE mobile navigation markup', () => {
  it('starts closed with a real toggle and accessible names', () => {
    expect(source).toContain('data-bl-nav-state="closed"');
    expect(source).toContain('aria-label="BLACKLINE demo home"');
    expect(source).toContain('Open navigation menu');
    expect(source).toContain('aria-controls={panelId}');
    expect(source).toContain('aria-expanded="false"');
    expect(source).toContain('data-bl-nav-panel hidden');
    expect(source).toContain('aria-label="Mobile navigation"');
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
    expect(source).toContain('DEMO_BOOK_HREF');
    expect(source).not.toContain('?service=');
    expect(source).not.toContain('?barber=');
    expect(source).not.toContain('href="#"');
    expect(DEMO_BOOK_HREF).toBe('/demo/book');
    expect(isDemoNavActive('/demo/shop/bl-product-ironclad-pomade', DEMO_SHOP_HREF)).toBe(true);
    expect(isDemoNavActive('/demo/shop', DEMO_HOME_HREF)).toBe(false);
  });

  it('keeps one overlay booking CTA and a compact closed-header Book control', () => {
    expect(source).toContain('data-bl-header-book');
    expect(source).toContain('data-bl-nav-book');
    expect(source).toContain('Book an appointment');
    expect(source.match(/data-bl-nav-book/g)).toHaveLength(1);
    expect(source).toContain('Book now');
    expect(source).toContain('data-bl-nav-bag');
    expect(source).toContain('data-bl-bag-count');
    expect(formatNavIndex(0)).toBe('01');
  });

  it('scopes the overlay and desktop protection in the BLACKLINE theme', () => {
    expect(css).toContain('.bl-nav-layer');
    expect(css).toContain('@media (min-width: 1024px)');
    expect(css).toContain('.bl-header-book');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('env(safe-area-inset-bottom');
    expect(layout).toContain('viewport-fit=cover');
  });
});
