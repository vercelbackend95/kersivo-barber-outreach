import { groupServicesByCategory } from '@/lib/booking/groupServicesByCategory';
import {
  DEMO_ALL_CATEGORY_SLUG,
  DEMO_SERVICE_CATEGORIES,
  DEMO_SERVICE_CATEGORY_ORDER,
  demoCategorySlugFromKey,
  getDemoServiceCategoryByKey,
  getDemoServiceCategoryBySlug,
  parseDemoServiceCategoryParam,
  type DemoServiceCategory,
} from './serviceCategories';

export const DEMO_SHOP_KEY = 'blackline-barbers-demo';

export type DemoService = {
  id: string;
  slug: string;
  name: string;
  durationMinutes: number;
  pricePence: number;
  description: string;
  popular: boolean;
  featured: boolean;
  category: string;
  displayOrder: number;
};

function demoService(entry: Omit<DemoService, 'id' | 'popular'> & { featured: boolean }): DemoService {
  return {
    id: `bl-svc-${entry.slug}`,
    popular: entry.featured,
    ...entry,
  };
}

export const DEMO_SERVICES: readonly DemoService[] = [
  demoService({
    slug: 'haircut-finish',
    name: 'Classic Cut & Finish',
    durationMinutes: 35,
    pricePence: 2400,
    description: 'A tailored cut, finished and styled for the way you wear it.',
    featured: true,
    category: 'cuts & fades',
    displayOrder: 1,
  }),
  demoService({
    slug: 'skin-fade',
    name: 'Skin Fade',
    durationMinutes: 45,
    pricePence: 2800,
    description: 'A seamless fade taken down to skin with a sharp, structured finish.',
    featured: true,
    category: 'cuts & fades',
    displayOrder: 2,
  }),
  demoService({
    slug: 'taper-fade',
    name: 'Taper Fade',
    durationMinutes: 40,
    pricePence: 2600,
    description: 'A clean low taper through the temples and neckline with natural length above.',
    featured: false,
    category: 'cuts & fades',
    displayOrder: 3,
  }),
  demoService({
    slug: 'scissor-cut',
    name: 'Scissor Cut / Longer Hair',
    durationMinutes: 50,
    pricePence: 3000,
    description: 'Precision scissor work for longer shapes, movement and a natural finish.',
    featured: false,
    category: 'cuts & fades',
    displayOrder: 4,
  }),
  demoService({
    slug: 'buzz-cut',
    name: 'Buzz Cut',
    durationMinutes: 25,
    pricePence: 1800,
    description: 'A clean clipper cut using one length, finished around the edges and neckline.',
    featured: false,
    category: 'cuts & fades',
    displayOrder: 5,
  }),
  demoService({
    slug: 'restyle',
    name: 'Restyle',
    durationMinutes: 60,
    pricePence: 3400,
    description: 'Extra consultation and cutting time for a significant change of shape or length.',
    featured: false,
    category: 'cuts & fades',
    displayOrder: 6,
  }),
  demoService({
    slug: 'beard-trim',
    name: 'Beard Trim & Shape',
    durationMinutes: 25,
    pricePence: 1600,
    description: 'A tidy beard trim with defined lines and a balanced shape.',
    featured: false,
    category: 'beard & shave',
    displayOrder: 7,
  }),
  demoService({
    slug: 'beard-sculpt',
    name: 'Beard Sculpt & Hot Towel',
    durationMinutes: 35,
    pricePence: 2200,
    description: 'Detailed beard sculpting finished with a hot towel for a clean close.',
    featured: false,
    category: 'beard & shave',
    displayOrder: 8,
  }),
  demoService({
    slug: 'hot-towel-shave',
    name: 'Hot Towel Wet Shave',
    durationMinutes: 40,
    pricePence: 2500,
    description: 'A traditional hot towel wet shave with a close, clean finish.',
    featured: false,
    category: 'beard & shave',
    displayOrder: 9,
  }),
  demoService({
    slug: 'line-up',
    name: 'Line-Up & Neck Clean',
    durationMinutes: 15,
    pricePence: 1200,
    description: 'A sharp hairline, beard line and neck clean-up without a full cut.',
    featured: false,
    category: 'beard & shave',
    displayOrder: 10,
  }),
  demoService({
    slug: 'haircut-beard',
    name: 'Haircut & Beard',
    durationMinutes: 60,
    pricePence: 3600,
    description: 'A complete haircut and beard-shaping appointment.',
    featured: true,
    category: 'hair & beard combos',
    displayOrder: 11,
  }),
  demoService({
    slug: 'skin-fade-beard',
    name: 'Skin Fade & Beard',
    durationMinutes: 75,
    pricePence: 4400,
    description: 'A skin fade with a full beard trim and shape in one visit.',
    featured: false,
    category: 'hair & beard combos',
    displayOrder: 12,
  }),
  demoService({
    slug: 'taper-fade-beard',
    name: 'Taper Fade & Beard',
    durationMinutes: 70,
    pricePence: 4100,
    description: 'A taper fade paired with a considered beard trim and finish.',
    featured: false,
    category: 'hair & beard combos',
    displayOrder: 13,
  }),
  demoService({
    slug: 'full-grooming',
    name: 'Full Grooming Experience',
    durationMinutes: 90,
    pricePence: 5200,
    description: 'Hair, beard and finishing time for a complete reset.',
    featured: false,
    category: 'hair & beard combos',
    displayOrder: 14,
  }),
  demoService({
    slug: 'grey-blending',
    name: 'Grey Blending',
    durationMinutes: 45,
    pricePence: 3200,
    description: 'Soft colour blending to reduce grey without a solid dye look.',
    featured: false,
    category: 'grooming & care',
    displayOrder: 15,
  }),
  demoService({
    slug: 'scalp-treatment',
    name: 'Scalp Cleanse & Treatment',
    durationMinutes: 30,
    pricePence: 2200,
    description: 'A focused scalp cleanse and treatment to reset the hair and skin.',
    featured: false,
    category: 'grooming & care',
    displayOrder: 16,
  }),
  demoService({
    slug: 'express-facial',
    name: 'Express Facial',
    durationMinutes: 30,
    pricePence: 2400,
    description: 'A short facial to cleanse, refresh and settle the skin.',
    featured: false,
    category: 'grooming & care',
    displayOrder: 17,
  }),
  demoService({
    slug: 'wash-style-finish',
    name: 'Wash, Style & Finish',
    durationMinutes: 25,
    pricePence: 1800,
    description: 'A wash, blow-dry and finish without a cut.',
    featured: false,
    category: 'grooming & care',
    displayOrder: 18,
  }),
] as const;

export const DEMO_POPULAR_SERVICES = DEMO_SERVICES.filter((service) => service.popular);

export const DEMO_FEATURED_SERVICE_IDS = [
  'bl-svc-skin-fade',
  'bl-svc-haircut-finish',
  'bl-svc-haircut-beard',
] as const;

export const DEMO_CANONICAL_SERVICE_IDS = [
  'bl-svc-skin-fade',
  'bl-svc-haircut-finish',
  'bl-svc-haircut-beard',
  'bl-svc-hot-towel-shave',
] as const;

export const DEMO_DEFAULT_SERVICE_SLUG = 'skin-fade';

const FEATURED_SERVICE_ID_SET = new Set<string>(DEMO_FEATURED_SERVICE_IDS);

export function isDemoFeaturedService(id: string): boolean {
  return FEATURED_SERVICE_ID_SET.has(id);
}

export function getDemoServiceById(id: string): DemoService | undefined {
  return DEMO_SERVICES.find((service) => service.id === id);
}

export function getDemoFeaturedServices(
  ids: readonly string[] = DEMO_FEATURED_SERVICE_IDS,
): DemoService[] {
  return ids.flatMap((id) => {
    const service = DEMO_SERVICES.find((item) => item.id === id);
    return service ? [service] : [];
  });
}

export type DemoServicesMeta = {
  count: number;
  countPadded: string;
  countLabel: string;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  durationRangeLabel: string;
  minPricePence: number;
  fromPriceLabel: string;
};

export type DemoServiceCategorySummary = DemoServiceCategory & {
  count: number;
  countLabel: string;
  minPricePence: number;
  fromPriceLabel: string;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  durationRangeLabel: string;
};

export type DemoServiceNavigatorGroup = DemoServiceCategorySummary & {
  indexLabel: string;
  services: DemoService[];
};

export function formatDemoPriceGbp(pence: number): string {
  const pounds = pence / 100;
  if (!Number.isFinite(pounds)) return '£0';
  const formatted = Number.isInteger(pounds) ? String(pounds) : pounds.toFixed(2).replace(/\.?0+$/, '');
  return `£${formatted}`;
}

export function demoBookingHref(slug: string): string {
  return `/demo/book?service=${encodeURIComponent(slug)}`;
}

export function resolveDemoServiceSlug(raw: string | null | undefined): DemoService | undefined {
  if (!raw) return undefined;
  const slug = raw.trim().toLowerCase();
  if (!slug) return undefined;
  return DEMO_SERVICES.find((service) => service.slug === slug);
}

export function demoServiceAccessibleName(service: DemoService): string {
  const spokenName = service.name.replace(/\s*&\s*/g, ' and ');
  return `Book ${spokenName}, ${service.durationMinutes} minutes, ${formatDemoPriceGbp(service.pricePence)}`;
}

export function demoServiceIndex(index: number): string {
  return String(index + 1).padStart(2, '0');
}

export function demoServicesMeta(services: readonly DemoService[] = DEMO_SERVICES): DemoServicesMeta {
  const count = services.length;
  const durations = services.map((service) => service.durationMinutes);
  const prices = services.map((service) => service.pricePence);
  const minDurationMinutes = durations.length ? Math.min(...durations) : 0;
  const maxDurationMinutes = durations.length ? Math.max(...durations) : 0;
  const minPricePence = prices.length ? Math.min(...prices) : 0;

  return {
    count,
    countPadded: String(count).padStart(2, '0'),
    countLabel: `${String(count).padStart(2, '0')} SERVICES`,
    minDurationMinutes,
    maxDurationMinutes,
    durationRangeLabel: `${minDurationMinutes}–${maxDurationMinutes} MIN`,
    minPricePence,
    fromPriceLabel: `FROM ${formatDemoPriceGbp(minPricePence)}`,
  };
}

export function demoServiceDurationRatio(
  minutes: number,
  maxDurationMinutes = demoServicesMeta().maxDurationMinutes,
): number {
  if (!maxDurationMinutes) return 0;
  return minutes / maxDurationMinutes;
}

function toCategorySummary(
  category: DemoServiceCategory,
  services: readonly DemoService[],
): DemoServiceCategorySummary | null {
  if (!services.length) return null;
  const meta = demoServicesMeta(services);
  return {
    ...category,
    count: services.length,
    countLabel: `${services.length} ${services.length === 1 ? 'service' : 'services'}`,
    minPricePence: meta.minPricePence,
    fromPriceLabel: `from ${formatDemoPriceGbp(meta.minPricePence)}`,
    minDurationMinutes: meta.minDurationMinutes,
    maxDurationMinutes: meta.maxDurationMinutes,
    durationRangeLabel: `${meta.minDurationMinutes}–${meta.maxDurationMinutes} min`,
  };
}

export function demoServiceCategorySummaries(
  services: readonly DemoService[] = DEMO_SERVICES,
): DemoServiceCategorySummary[] {
  return DEMO_SERVICE_CATEGORIES.flatMap((category) => {
    const items = services.filter((service) => service.category === category.key);
    const summary = toCategorySummary(category, items);
    return summary ? [summary] : [];
  });
}

export function demoServiceNavigatorGroups(
  services: readonly DemoService[] = DEMO_SERVICES,
): DemoServiceNavigatorGroup[] {
  const byId = new Map(services.map((service) => [service.id, service]));
  const groups = groupServicesByCategory(
    services.map((service) => ({
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      pricePence: service.pricePence,
      category: service.category,
      displayOrder: service.displayOrder,
      featured: service.featured,
    })),
    { categoryOrder: DEMO_SERVICE_CATEGORY_ORDER },
  );

  return groups.flatMap((group, index) => {
    const items = group.services.flatMap((entry) => {
      const match = byId.get(entry.id);
      return match ? [match] : [];
    });
    const known = getDemoServiceCategoryByKey(group.category);
    const category: DemoServiceCategory = known ?? {
      key: group.category,
      slug: demoCategorySlugFromKey(group.category),
      label: group.label,
      shortLabel: group.label.toUpperCase(),
      description: '',
    };
    const summary = toCategorySummary(category, items);
    if (!summary) return [];
    return [
      {
        ...summary,
        indexLabel: demoServiceIndex(index),
        services: items,
      },
    ];
  });
}

export function demoServicesHref(categorySlug: string = DEMO_ALL_CATEGORY_SLUG): string {
  const slug = parseDemoServiceCategoryParam(categorySlug);
  if (slug === DEMO_ALL_CATEGORY_SLUG) return '/demo/services';
  return `/demo/services?category=${encodeURIComponent(slug)}`;
}

export function demoServiceFilterAnnouncement(
  categorySlug: string,
  groups: readonly DemoServiceNavigatorGroup[] = demoServiceNavigatorGroups(),
): string {
  const slug = parseDemoServiceCategoryParam(categorySlug);
  if (slug === DEMO_ALL_CATEGORY_SLUG) {
    const count = groups.reduce((total, group) => total + group.count, 0);
    return `Showing ${count} services.`;
  }
  const group = groups.find((entry) => entry.slug === slug);
  if (!group) return 'Showing all services.';
  return `Showing ${group.countLabel} in ${group.label}.`;
}

export {
  DEMO_ALL_CATEGORY_SLUG,
  DEMO_SERVICE_CATEGORIES,
  DEMO_SERVICE_CATEGORY_ORDER,
  demoCategorySlugFromKey,
  getDemoServiceCategoryByKey,
  getDemoServiceCategoryBySlug,
  parseDemoServiceCategoryParam,
};
