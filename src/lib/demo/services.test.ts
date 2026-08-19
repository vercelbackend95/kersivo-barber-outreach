import { describe, expect, it } from 'vitest';
import {
  DEMO_CANONICAL_SERVICE_IDS,
  DEMO_DEFAULT_SERVICE_SLUG,
  DEMO_FEATURED_SERVICE_IDS,
  DEMO_POPULAR_SERVICES,
  DEMO_SERVICE_CATEGORIES,
  DEMO_SERVICE_CATEGORY_ORDER,
  DEMO_SERVICES,
  DEMO_SHOP_KEY,
  demoBookingHref,
  demoServiceAccessibleName,
  demoServiceCategorySummaries,
  demoServiceDurationRatio,
  demoServiceFilterAnnouncement,
  demoServiceIndex,
  demoServiceNavigatorGroups,
  demoServicesHref,
  demoServicesMeta,
  formatDemoPriceGbp,
  getDemoFeaturedServices,
  getDemoServiceById,
  isDemoFeaturedService,
  parseDemoServiceCategoryParam,
  resolveDemoServiceSlug,
} from './services';

const CANONICAL_SLUGS = ['skin-fade', 'haircut-finish', 'haircut-beard', 'hot-towel-shave'] as const;

describe('BLACKLINE demo catalogue', () => {
  it('keeps the shop key explicit', () => {
    expect(DEMO_SHOP_KEY).toBe('blackline-barbers-demo');
  });

  it('exposes eighteen services across four ordered categories and keeps the original ids', () => {
    expect(DEMO_SERVICES).toHaveLength(18);
    expect(DEMO_POPULAR_SERVICES).toHaveLength(3);
    expect(DEMO_SERVICE_CATEGORY_ORDER).toEqual([
      'cuts & fades',
      'beard & shave',
      'hair & beard combos',
      'grooming & care',
    ]);
    expect(DEMO_SERVICE_CATEGORIES.map((category) => category.slug)).toEqual([
      'cuts-fades',
      'beard-shave',
      'hair-beard-combos',
      'grooming-care',
    ]);
    expect([...DEMO_CANONICAL_SERVICE_IDS]).toEqual([
      'bl-svc-skin-fade',
      'bl-svc-haircut-finish',
      'bl-svc-haircut-beard',
      'bl-svc-hot-towel-shave',
    ]);
    for (const slug of CANONICAL_SLUGS) {
      expect(DEMO_SERVICES.some((service) => service.slug === slug && service.id === `bl-svc-${slug}`)).toBe(true);
    }
    expect(getDemoServiceById('bl-svc-haircut-finish')?.name).toBe('Classic Cut & Finish');
    expect(getDemoServiceById('bl-svc-hot-towel-shave')?.name).toBe('Hot Towel Wet Shave');
    expect(DEMO_DEFAULT_SERVICE_SLUG).toBe('skin-fade');
  });

  it('derives hero metadata and duration ratios from the expanded catalogue', () => {
    const meta = demoServicesMeta();
    expect(meta.countLabel).toBe('18 SERVICES');
    expect(meta.durationRangeLabel).toBe('15–90 MIN');
    expect(meta.fromPriceLabel).toBe('FROM £12');
    expect(demoServiceIndex(0)).toBe('01');
    expect(demoServiceDurationRatio(90)).toBe(1);
    expect(demoServiceDurationRatio(45)).toBe(45 / 90);
  });

  it('hides empty categories and reports starting prices', () => {
    const cutsOnly = DEMO_SERVICES.filter((service) => service.category === 'cuts & fades');
    const summaries = demoServiceCategorySummaries(cutsOnly);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.slug).toBe('cuts-fades');
    expect(summaries[0]?.count).toBe(6);
    expect(summaries[0]?.fromPriceLabel).toBe('from £18');
    expect(demoServiceCategorySummaries([])).toEqual([]);
  });

  it('parses category URLs and falls invalid values back to all', () => {
    expect(parseDemoServiceCategoryParam(null)).toBe('all');
    expect(parseDemoServiceCategoryParam('')).toBe('all');
    expect(parseDemoServiceCategoryParam('all')).toBe('all');
    expect(parseDemoServiceCategoryParam('cuts-fades')).toBe('cuts-fades');
    expect(parseDemoServiceCategoryParam('not-a-category')).toBe('all');
    expect(demoServicesHref('all')).toBe('/demo/services');
    expect(demoServicesHref('cuts-fades')).toBe('/demo/services?category=cuts-fades');
    expect(demoServicesHref('missing')).toBe('/demo/services');
  });

  it('groups the navigator in fixture order with featured services first in their category', () => {
    const groups = demoServiceNavigatorGroups();
    expect(groups.map((group) => group.slug)).toEqual([
      'cuts-fades',
      'beard-shave',
      'hair-beard-combos',
      'grooming-care',
    ]);
    expect(groups[0]?.services.map((service) => service.slug).slice(0, 2)).toEqual([
      'haircut-finish',
      'skin-fade',
    ]);
    expect(demoServiceFilterAnnouncement('cuts-fades', groups)).toBe('Showing 6 services in Cuts & Fades.');
    expect(demoServiceFilterAnnouncement('all', groups)).toBe('Showing 18 services.');
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
    expect(demoServiceAccessibleName(finish!)).toBe('Book Classic Cut and Finish, 35 minutes, £24');
  });

  it('selects three homepage featured services without dropping Hot Towel Wet Shave from the catalogue', () => {
    expect([...DEMO_FEATURED_SERVICE_IDS]).toEqual([
      'bl-svc-skin-fade',
      'bl-svc-haircut-finish',
      'bl-svc-haircut-beard',
    ]);
    const featured = getDemoFeaturedServices();
    expect(featured).toHaveLength(3);
    expect(featured.map((service) => service.name)).toEqual([
      'Skin Fade',
      'Classic Cut & Finish',
      'Haircut & Beard',
    ]);
    expect(featured.every((service) => isDemoFeaturedService(service.id))).toBe(true);
    expect(featured.map((service) => service.durationMinutes)).toEqual([45, 35, 60]);
    expect(featured.map((service) => formatDemoPriceGbp(service.pricePence))).toEqual(['£28', '£24', '£36']);
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
