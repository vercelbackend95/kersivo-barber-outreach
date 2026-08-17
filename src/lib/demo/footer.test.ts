import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEMO_BARBERS_SECTION_HREF,
  DEMO_BOOK_HREF,
  DEMO_FOOTER_NAV,
  DEMO_GALLERY_SECTION_HREF,
  DEMO_HOME_HREF,
  DEMO_KERSIVO_HREF,
  DEMO_SERVICES_SECTION_HREF,
  DEMO_SHOP_HREF,
} from './nav';
import { DEMO_LOCATION, DEMO_LOCATION_NOTE, DEMO_PHONE, DEMO_PHONE_TEL } from './site';

const source = readFileSync(new URL('../../components/demo/DemoFooter.astro', import.meta.url), 'utf8');

describe('BLACKLINE demo footer', () => {
  it('declares a footer landmark and labelled navigation', () => {
    expect(source).toContain('aria-label="BLACKLINE site footer"');
    expect(source).toContain('aria-label="Footer navigation"');
    expect(source).toContain('aria-label="BLACKLINE demo home"');
  });

  it('states that BLACKLINE is fictional and creates no real transaction', () => {
    expect(source).toContain('BLACKLINE is a fictional barbershop created to demonstrate KERSIVO.');
    expect(source).toContain('No real appointment, order or payment is created.');
  });

  it('reuses the shared demonstration location and Ofcom phone number', () => {
    expect(DEMO_LOCATION).toBe('Northern Quarter, Manchester');
    expect(DEMO_LOCATION_NOTE).toBe('Demonstration location');
    expect(DEMO_PHONE).toBe('0161 496 0127');
    expect(DEMO_PHONE_TEL).toBe('tel:+441614960127');
    expect(source).toContain('DEMO_PHONE_TEL');
    expect(source).toContain('<address>');
  });

  it('links to homepage sections, shop, and booking without placeholders or queries', () => {
    expect(DEMO_FOOTER_NAV.map((item) => item.href)).toEqual([
      DEMO_HOME_HREF,
      DEMO_SERVICES_SECTION_HREF,
      DEMO_BARBERS_SECTION_HREF,
      DEMO_GALLERY_SECTION_HREF,
      DEMO_SHOP_HREF,
      DEMO_BOOK_HREF,
    ]);
    expect(DEMO_SERVICES_SECTION_HREF).toBe('/demo#popular-services-heading');
    expect(DEMO_BARBERS_SECTION_HREF).toBe('/demo#blackline-team-heading');
    expect(DEMO_GALLERY_SECTION_HREF).toBe('/demo#blackline-gallery-preview-heading');
    expect(DEMO_SHOP_HREF).toBe('/demo/shop');
    expect(DEMO_BOOK_HREF).toBe('/demo/book');
    expect(source).not.toContain('href="#"');
    expect(source).not.toMatch(/\?barber=|\?service=/);
  });

  it('attributes the experience to KERSIVO without images or social accounts', () => {
    expect(DEMO_KERSIVO_HREF).toBe('https://kersivo.co.uk');
    expect(source).toContain('DEMO_KERSIVO_HREF');
    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noopener noreferrer"');
    expect(source).not.toMatch(/<img\b/);
    expect(source.toLowerCase()).not.toMatch(/instagram|tiktok|facebook|twitter|youtube/);
  });
});
