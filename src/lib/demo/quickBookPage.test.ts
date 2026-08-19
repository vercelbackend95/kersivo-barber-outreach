import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEMO_FEATURED_SERVICE_IDS,
  demoBookingHref,
  demoServiceAccessibleName,
  getDemoFeaturedServices,
} from './services';

const pageSource = readFileSync(new URL('../../pages/demo/index.astro', import.meta.url), 'utf8');
const source = readFileSync(new URL('../../components/demo/DemoQuickBook.astro', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles/demo/blackline.css', import.meta.url), 'utf8');
const featured = getDemoFeaturedServices();

describe('BLACKLINE homepage featured services', () => {
  it('keeps section 01 copy, heading id and a three-launcher deck', () => {
    expect(pageSource).toContain('DemoQuickBook');
    expect(source).toContain('01');
    expect(source).toContain('Featured services');
    expect(source).toContain('Featured services.');
    expect(source).toContain('id="popular-services-heading"');
    expect(source).toContain(
      'A selection of our most-booked appointments. Explore the full service menu for every cut,',
    );
    expect(source).toContain('featured services');
    expect(source).toContain('Book this service');
    expect(source).toContain('View all services');
    expect(source).toContain('href="/demo/services"');
    expect(source).toContain('class="bl-quick-booking"');
    expect(source).not.toContain('Quick Book');
    expect(source).not.toContain('your cut.');
    expect(source).not.toContain('Choose');
    expect(source).not.toContain('Select a featured service and continue straight into booking.');
    expect(source).not.toContain('Built around the details');
    expect(source).not.toContain('MOST POPULAR');
    expect(source).not.toContain('BEST SELLER');
    expect(source).not.toMatch(/<button/);
    expect(source).toContain('demoBookingHref(service.slug)');
    expect(source.match(/<a\b/g)).toHaveLength(2);
  });

  it('books the three featured services through canonical slugs with no barber preselect', () => {
    expect(DEMO_FEATURED_SERVICE_IDS).toHaveLength(3);
    expect(featured.map((service) => service.id)).toEqual([...DEMO_FEATURED_SERVICE_IDS]);
    expect(source).toContain('demoBookingHref(service.slug)');
    expect(source).toContain('demoServiceAccessibleName(service)');
    expect(source).not.toMatch(/\?barber=/);
    expect(source).not.toMatch(/£28|£24|£36/);
    expect(demoBookingHref('skin-fade')).toBe('/demo/book?service=skin-fade');
    expect(demoBookingHref('haircut-finish')).toBe('/demo/book?service=haircut-finish');
    expect(demoBookingHref('haircut-beard')).toBe('/demo/book?service=haircut-beard');
    expect(demoServiceAccessibleName(featured[0]!)).toBe('Book Skin Fade, 45 minutes, £28');
    expect(demoServiceAccessibleName(featured[1]!)).toBe('Book Classic Cut and Finish, 35 minutes, £24');
    expect(demoServiceAccessibleName(featured[2]!)).toBe('Book Haircut and Beard, 60 minutes, £36');
  });

  it('scopes the featured deck under the BLACKLINE theme and stacks below desktop', () => {
    expect(css).toContain("[data-theme='blackline'] .bl-quick");
    expect(css).toContain('padding-block: clamp(96px, 11vw, 176px)');
    expect(css).toContain('@media (min-width: 1024px)');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(css).toContain('--bl-quick-duration-ratio');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('(hover: hover) and (pointer: fine)');
    expect(css).not.toContain('.bl-popular');
    expect(source).toContain('--bl-quick-duration-ratio');
    expect(pageSource).toContain("setAttribute('data-bl-quick-motion'");

    const desktopBlock = css.slice(css.indexOf('@media (min-width: 1024px)'));
    expect(desktopBlock).toContain('.bl-quick-booking');
    expect(desktopBlock).toContain('margin-top: auto');
    expect(css).not.toMatch(/\.bl-quick-(facts|duration-track|booking)[^{]*\{[^}]*position:\s*absolute/);
  });
});
