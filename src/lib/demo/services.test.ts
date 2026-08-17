import { describe, expect, it } from 'vitest';
import {
  DEMO_DEFAULT_SERVICE_SLUG,
  DEMO_FEATURED_SERVICE_IDS,
  DEMO_POPULAR_SERVICES,
  DEMO_SERVICES,
  DEMO_SHOP_KEY,
  demoBookingHref,
  demoServiceAccessibleName,
  demoServiceDurationRatio,
  demoServiceIndex,
  demoServicesMeta,
  formatDemoPriceGbp,
  getDemoFeaturedServices,
  resolveDemoServiceSlug,
} from './services';

describe('BLACKLINE demo catalogue', () => {
  it('keeps the shop key explicit', () => {
    expect(DEMO_SHOP_KEY).toBe('blackline-barbers-demo');
  });

  it('exposes the four popular services with UK whole-pound prices', () => {
    expect(DEMO_POPULAR_SERVICES).toHaveLength(4);
    expect(DEMO_SERVICES.map((service) => service.slug)).toEqual([
      'skin-fade',
      'haircut-finish',
      'haircut-beard',
      'hot-towel-shave',
    ]);
    expect(DEMO_SERVICES.map((service) => formatDemoPriceGbp(service.pricePence))).toEqual([
      '£25',
      '£22',
      '£32',
      '£22',
    ]);
    expect(DEMO_SERVICES.map((service) => service.durationMinutes)).toEqual([45, 35, 60, 40]);
    expect(DEMO_SERVICES.map((service) => service.id)).toEqual([
      'bl-svc-skin-fade',
      'bl-svc-haircut-finish',
      'bl-svc-haircut-beard',
      'bl-svc-hot-towel-shave',
    ]);
    expect(DEMO_SERVICES.map((service) => service.description)).toEqual([
      'A clean, graduated fade with a sharp, structured finish.',
      'A considered cut, styled and finished for the way you wear it.',
      'A complete haircut and beard-shaping appointment.',
      'A traditional hot towel shave with a clean finish.',
    ]);
    expect(DEMO_DEFAULT_SERVICE_SLUG).toBe('skin-fade');
  });

  it('derives hero metadata and duration ratios from the catalogue', () => {
    const meta = demoServicesMeta();
    expect(meta.countLabel).toBe('04 SERVICES');
    expect(meta.durationRangeLabel).toBe('35–60 MIN');
    expect(meta.fromPriceLabel).toBe('FROM £22');
    expect(DEMO_SERVICES.map((service) => demoServiceIndex(service.displayOrder - 1))).toEqual([
      '01',
      '02',
      '03',
      '04',
    ]);
    expect(DEMO_SERVICES.map((service) => demoServiceDurationRatio(service.durationMinutes))).toEqual([
      45 / 60,
      35 / 60,
      1,
      40 / 60,
    ]);
  });

  it('formats whole pounds without decimals', () => {
    expect(formatDemoPriceGbp(2500)).toBe('£25');
    expect(formatDemoPriceGbp(0)).toBe('£0');
  });

  it('builds booking hrefs from stable slugs', () => {
    expect(demoBookingHref('skin-fade')).toBe('/demo/book?service=skin-fade');
    expect(demoBookingHref('haircut-finish')).toBe('/demo/book?service=haircut-finish');
    expect(demoBookingHref('haircut-beard')).toBe('/demo/book?service=haircut-beard');
    expect(demoBookingHref('hot-towel-shave')).toBe('/demo/book?service=hot-towel-shave');
  });

  it('resolves known slugs and ignores invalid query values', () => {
    expect(resolveDemoServiceSlug('skin-fade')?.id).toBe('bl-svc-skin-fade');
    expect(resolveDemoServiceSlug(' Haircut-Beard ')?.name).toBe('Haircut & Beard');
    expect(resolveDemoServiceSlug('not-a-service')).toBeUndefined();
    expect(resolveDemoServiceSlug('')).toBeUndefined();
    expect(resolveDemoServiceSlug(null)).toBeUndefined();
  });

  it('builds accessible booking labels without ampersands', () => {
    const finish = DEMO_SERVICES.find((service) => service.slug === 'haircut-finish');
    expect(finish).toBeDefined();
    expect(demoServiceAccessibleName(finish!)).toBe('Book Haircut and Finish, 35 minutes, £22');
  });

  it('selects three homepage featured services without dropping Hot Towel Shave from the catalogue', () => {
    expect([...DEMO_FEATURED_SERVICE_IDS]).toEqual([
      'bl-svc-skin-fade',
      'bl-svc-haircut-finish',
      'bl-svc-haircut-beard',
    ]);
    const featured = getDemoFeaturedServices();
    expect(featured).toHaveLength(3);
    expect(featured.map((service) => service.name)).toEqual([
      'Skin Fade',
      'Haircut & Finish',
      'Haircut & Beard',
    ]);
    expect(featured.map((service) => service.durationMinutes)).toEqual([45, 35, 60]);
    expect(featured.map((service) => formatDemoPriceGbp(service.pricePence))).toEqual(['£25', '£22', '£32']);
    const featuredMax = demoServicesMeta(featured).maxDurationMinutes;
    expect(featuredMax).toBe(60);
    expect(featured.map((service) => demoServiceDurationRatio(service.durationMinutes, featuredMax))).toEqual([
      45 / 60,
      35 / 60,
      1,
    ]);
    expect(DEMO_SERVICES.some((service) => service.id === 'bl-svc-hot-towel-shave')).toBe(true);
    expect(featured.some((service) => service.id === 'bl-svc-hot-towel-shave')).toBe(false);
    expect(getDemoFeaturedServices(['missing-id', 'bl-svc-skin-fade'])).toHaveLength(1);
  });
});
