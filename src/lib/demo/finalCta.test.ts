import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEMO_BOOK_HREF } from './nav';

const source = readFileSync(new URL('../../components/demo/DemoFinalCta.astro', import.meta.url), 'utf8');

describe('BLACKLINE final booking CTA', () => {
  it('uses the exact heading and supporting copy without an eyebrow', () => {
    expect(source).toContain('Your next cut');
    expect(source).toContain('Starts here.');
    expect(source).toContain('Choose your barber, service and time in under a minute.');
    expect(source).toContain('id="blackline-final-cta-heading"');
    expect(source).not.toMatch(/07/);
    expect(source).not.toMatch(/eyebrow/i);
    expect(source).not.toMatch(/BOOKING/);
  });

  it('opens the canonical booking route with a single unparameterised link', () => {
    expect(DEMO_BOOK_HREF).toBe('/demo/book');
    expect(source).toContain('DEMO_BOOK_HREF');
    expect(source).not.toMatch(/\?barber=/);
    expect(source).not.toMatch(/\?service=/);
    expect(source.match(/<a\b/g)).toHaveLength(1);
    expect(source).toContain('Book an appointment');
    expect(source).not.toMatch(/GET DIRECTIONS|CALL NOW|CONTACT US|FIND US/i);
  });
});
