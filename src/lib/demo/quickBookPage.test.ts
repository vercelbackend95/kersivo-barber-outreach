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

describe('BLACKLINE homepage Quick Book', () => {
  it('keeps section 01 copy, heading id and a three-launcher deck', () => {
    expect(pageSource).toContain('DemoQuickBook');
    expect(source).toContain('01');
    expect(source).toContain('Quick Book');
    expect(source).toContain('id="popular-services-heading"');
    expect(source).toContain('Choose');
    expect(source).toContain('your cut.');
    expect(source).toContain('Select a featured service and continue straight into booking.');
    expect(source).toContain('featured services');
    expect(source).toContain('Book this service');
    expect(source).toContain('View all services');
    expect(source).toContain('href="/demo/services"');
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
    expect(source).not.toMatch(/£25|£22|£32/);
    expect(demoBookingHref('skin-fade')).toBe('/demo/book?service=skin-fade');
    expect(demoBookingHref('haircut-finish')).toBe('/demo/book?service=haircut-finish');
    expect(demoBookingHref('haircut-beard')).toBe('/demo/book?service=haircut-beard');
    expect(demoServiceAccessibleName(featured[0]!)).toBe('Book Skin Fade, 45 minutes, £25');
    expect(demoServiceAccessibleName(featured[1]!)).toBe('Book Haircut and Finish, 35 minutes, £22');
    expect(demoServiceAccessibleName(featured[2]!)).toBe('Book Haircut and Beard, 60 minutes, £32');
  });

  it('scopes the Quick Book deck under the BLACKLINE theme and stacks below desktop', () => {
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
  });
});
