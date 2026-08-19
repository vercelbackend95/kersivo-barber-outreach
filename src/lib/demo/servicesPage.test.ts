import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEMO_CANONICAL_SERVICE_IDS,
  DEMO_SERVICES,
  demoBookingHref,
  demoServicesMeta,
} from './services';
import { DEMO_BOOK_HREF } from './nav';

const pageSource = readFileSync(new URL('../../pages/demo/services.astro', import.meta.url), 'utf8');
const heroSource = readFileSync(new URL('../../components/demo/DemoServicesHero.astro', import.meta.url), 'utf8');
const menuSource = readFileSync(new URL('../../components/demo/DemoServicesMenu.astro', import.meta.url), 'utf8');
const closeSource = readFileSync(new URL('../../components/demo/DemoServicesClose.astro', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../../styles/demo/blackline.css', import.meta.url), 'utf8');
const sources = [pageSource, heroSource, menuSource, closeSource].join('\n');

describe('BLACKLINE Services page', () => {
  it('keeps the shared demo shell and service-menu landmarks', () => {
    expect(pageSource).toContain('DemoLayout');
    expect(pageSource).toContain('DemoServicesHero');
    expect(pageSource).toContain('DemoServicesMenu');
    expect(pageSource).toContain('DemoServicesClose');
    expect(heroSource).toContain("from '@/components/demo/DemoPageHero.astro'");
    expect(heroSource).toContain('headingId="blackline-services-heading"');
    expect(menuSource).toContain('aria-labelledby="blackline-service-menu-heading"');
    expect(menuSource).toContain('id="blackline-service-menu-heading"');
    expect(menuSource).toContain('<ol');
    expect(menuSource).toContain('<article');
    expect(closeSource).toContain('id="blackline-services-close-heading"');
  });

  it('uses navigator copy, computed metadata, and no selected-service duplicate', () => {
    expect(heroSource).toContain('The</span> Services');
    expect(heroSource).toContain('Cut.');
    expect(heroSource).toContain('Shape.');
    expect(heroSource).toContain('Finish.');
    expect(heroSource).toContain('Clear timing. Straightforward pricing. Choose what fits.');
    expect(heroSource).toContain('{meta.countLabel}');
    expect(heroSource).toContain('{meta.durationRangeLabel}');
    expect(heroSource).toContain('{meta.fromPriceLabel}');
    expect(demoServicesMeta().countLabel).toBe('18 SERVICES');
    expect(demoServicesMeta().durationRangeLabel).toBe('15–90 MIN');
    expect(demoServicesMeta().fromPriceLabel).toBe('FROM £12');
    expect(menuSource).toContain('Find your service');
    expect(menuSource).toContain('Choose your finish.');
    expect(menuSource).toContain('Browse by category, compare the details and book the service that fits.');
    expect(menuSource).toContain('All services');
    expect(menuSource).toContain('Book this service');
    expect(menuSource).toContain('parseDemoServiceCategoryParam');
    expect(menuSource).toContain('data-category-slug');
    expect(menuSource).not.toContain('Selected service');
    expect(menuSource).not.toContain('The Blackline Menu.');
    expect(closeSource).toContain('Ready when you are');
    expect(closeSource).toContain('Take your seat.');
    expect(closeSource).toContain('Choose your barber, service and time.');
    expect(closeSource).toContain('Start your booking');
    expect(sources).not.toMatch(/luxury|award-winning|best in Manchester|expert|master|guaranteed|available today/i);
  });

  it('preserves service identities and booking destinations', () => {
    expect(DEMO_SERVICES.map((service) => service.id)).toEqual(
      expect.arrayContaining([...DEMO_CANONICAL_SERVICE_IDS]),
    );
    expect(menuSource).toContain('demoBookingHref');
    expect(demoBookingHref('skin-fade')).toBe('/demo/book?service=skin-fade');
    expect(demoBookingHref('haircut-finish')).toBe('/demo/book?service=haircut-finish');
    expect(demoBookingHref('haircut-beard')).toBe('/demo/book?service=haircut-beard');
    expect(demoBookingHref('hot-towel-shave')).toBe('/demo/book?service=hot-towel-shave');
    expect(closeSource).toContain('DEMO_BOOK_HREF');
    expect(DEMO_BOOK_HREF).toBe('/demo/book');
    expect(closeSource).not.toMatch(/\?barber=|\?service=/);
    expect(menuSource).not.toMatch(/\?barber=/);
    expect(sources).not.toMatch(/src=["']https?:\/\//);
    expect(sources).not.toMatch(/unsplash|images\.unsplash/i);
  });

  it('progressively enhances motion without hiding the closing CTA or booking links', () => {
    expect(cssSource).not.toMatch(/transition:\s*all/);
    expect(cssSource).toContain("[data-theme='blackline'][data-bl-services-motion]");
    expect(cssSource).toContain("[data-theme='blackline'][data-bl-services-motion] .bl-services-close-eyebrow");
    expect(cssSource).not.toContain("[data-theme='blackline'][data-bl-services-motion] .bl-services-close-cta");
    expect(cssSource).toContain('@media (min-width: 1100px)');
    expect(cssSource).toContain("@media (hover: hover) and (pointer: fine)");
    expect(pageSource).toContain("setAttribute('data-bl-services-motion'");
    expect(pageSource).toContain("removeAttribute('data-bl-services-motion'");
    expect(pageSource).toContain('IntersectionObserver');
    expect(pageSource).toContain('unobserve');
    expect(pageSource).toContain('disconnect');
    expect(pageSource).toContain('pageshow');
    expect(pageSource).toContain('pointerenter');
    expect(pageSource).toContain('focusin');
    expect(pageSource).toContain('popstate');
    expect(pageSource).toContain("url.searchParams.set('category'");
    expect(pageSource).not.toMatch(/addEventListener\(['"]scroll['"]/);
    expect(menuSource).toContain('href={demoBookingHref(service.slug)}');
    expect(menuSource).not.toContain('is-inview');
    expect(closeSource).toContain('href={DEMO_BOOK_HREF}');
    expect(cssSource).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*\.bl-service-arrow[\s\S]*transform: rotate\(45deg\)/,
    );
  });
});
