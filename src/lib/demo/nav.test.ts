import { describe, expect, it } from 'vitest';
import {
  DEMO_BARBERS_SECTION_HREF,
  DEMO_BOOK_HREF,
  DEMO_CONTACT_HREF,
  DEMO_FOOTER_NAV,
  DEMO_GALLERY_HREF,
  DEMO_GALLERY_SECTION_HREF,
  DEMO_HOME_HREF,
  DEMO_KERSIVO_HREF,
  DEMO_SERVICES_SECTION_HREF,
  DEMO_SHOP_HREF,
  formatNavIndex,
  isDemoNavActive,
} from './nav';

describe('isDemoNavActive', () => {
  it('zero-pads editorial nav numbers', () => {
    expect(formatNavIndex(0)).toBe('01');
    expect(formatNavIndex(5)).toBe('06');
  });

  it('marks Home only on /demo', () => {
    expect(isDemoNavActive('/demo', '/demo')).toBe(true);
    expect(isDemoNavActive('/demo/', '/demo')).toBe(true);
    expect(isDemoNavActive('/demo/book', '/demo')).toBe(false);
    expect(isDemoNavActive('/demo/services', '/demo')).toBe(false);
  });

  it('marks nested shop routes without treating Home as active', () => {
    expect(isDemoNavActive('/demo/shop', '/demo/shop')).toBe(true);
    expect(isDemoNavActive('/demo/shop/pomade', '/demo/shop')).toBe(true);
    expect(isDemoNavActive('/demo/shop/pomade', '/demo')).toBe(false);
    expect(isDemoNavActive('/demo/gallery', '/demo/shop')).toBe(false);
  });

  it('marks the book CTA route', () => {
    expect(isDemoNavActive('/demo/book', '/demo/book')).toBe(true);
    expect(isDemoNavActive('/demo/book/', '/demo/book')).toBe(true);
    expect(isDemoNavActive('/demo/services', '/demo/book')).toBe(false);
  });

  it('keeps the gallery route stable', () => {
    expect(DEMO_GALLERY_HREF).toBe('/demo/gallery');
    expect(isDemoNavActive('/demo/gallery', DEMO_GALLERY_HREF)).toBe(true);
  });

  it('keeps the shop catalog route stable', () => {
    expect(DEMO_SHOP_HREF).toBe('/demo/shop');
    expect(isDemoNavActive('/demo/shop', DEMO_SHOP_HREF)).toBe(true);
  });

  it('keeps the contact route stable', () => {
    expect(DEMO_CONTACT_HREF).toBe('/demo/contact');
    expect(isDemoNavActive('/demo/contact', DEMO_CONTACT_HREF)).toBe(true);
    expect(isDemoNavActive('/demo/contact/', DEMO_CONTACT_HREF)).toBe(true);
    expect(isDemoNavActive('/demo/gallery', DEMO_CONTACT_HREF)).toBe(false);
  });

  it('keeps the booking route stable', () => {
    expect(DEMO_BOOK_HREF).toBe('/demo/book');
    expect(isDemoNavActive('/demo/book', DEMO_BOOK_HREF)).toBe(true);
  });

  it('exposes footer destinations to homepage sections, shop, and booking', () => {
    expect(DEMO_HOME_HREF).toBe('/demo');
    expect(DEMO_SERVICES_SECTION_HREF).toBe('/demo#popular-services-heading');
    expect(DEMO_BARBERS_SECTION_HREF).toBe('/demo#blackline-team-heading');
    expect(DEMO_GALLERY_SECTION_HREF).toBe('/demo#blackline-gallery-preview-heading');
    expect(DEMO_KERSIVO_HREF).toBe('https://kersivo.co.uk');
    expect(DEMO_FOOTER_NAV.map((item) => ({ href: item.href, label: item.label }))).toEqual([
      { href: DEMO_HOME_HREF, label: 'Home' },
      { href: DEMO_SERVICES_SECTION_HREF, label: 'Services' },
      { href: DEMO_BARBERS_SECTION_HREF, label: 'Barbers' },
      { href: DEMO_GALLERY_SECTION_HREF, label: 'Gallery' },
      { href: DEMO_SHOP_HREF, label: 'Shop' },
      { href: DEMO_BOOK_HREF, label: 'Book an appointment' },
    ]);
    expect(DEMO_FOOTER_NAV.every((item) => item.href !== '#')).toBe(true);
    expect(DEMO_FOOTER_NAV.every((item) => !item.href.includes('?'))).toBe(true);
  });
});
