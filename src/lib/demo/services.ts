export const DEMO_SHOP_KEY = 'blackline-barbers-demo';

export type DemoService = {
  id: string;
  slug: string;
  name: string;
  durationMinutes: number;
  pricePence: number;
  description: string;
  popular: boolean;
  category: string;
  displayOrder: number;
};

export const DEMO_SERVICES: readonly DemoService[] = [
  {
    id: 'bl-svc-skin-fade',
    slug: 'skin-fade',
    name: 'Skin Fade',
    durationMinutes: 45,
    pricePence: 2500,
    description: 'A clean, graduated fade with a sharp, structured finish.',
    popular: true,
    category: 'featured',
    displayOrder: 1,
  },
  {
    id: 'bl-svc-haircut-finish',
    slug: 'haircut-finish',
    name: 'Haircut & Finish',
    durationMinutes: 35,
    pricePence: 2200,
    description: 'A considered cut, styled and finished for the way you wear it.',
    popular: true,
    category: 'featured',
    displayOrder: 2,
  },
  {
    id: 'bl-svc-haircut-beard',
    slug: 'haircut-beard',
    name: 'Haircut & Beard',
    durationMinutes: 60,
    pricePence: 3200,
    description: 'A complete haircut and beard-shaping appointment.',
    popular: true,
    category: 'featured',
    displayOrder: 3,
  },
  {
    id: 'bl-svc-hot-towel-shave',
    slug: 'hot-towel-shave',
    name: 'Hot Towel Shave',
    durationMinutes: 40,
    pricePence: 2200,
    description: 'A traditional hot towel shave with a clean finish.',
    popular: true,
    category: 'featured',
    displayOrder: 4,
  },
] as const;

export const DEMO_POPULAR_SERVICES = DEMO_SERVICES.filter((service) => service.popular);

export const DEMO_FEATURED_SERVICE_IDS = [
  'bl-svc-skin-fade',
  'bl-svc-haircut-finish',
  'bl-svc-haircut-beard',
] as const;

export const DEMO_DEFAULT_SERVICE_SLUG = DEMO_SERVICES[0]?.slug ?? 'skin-fade';

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
