/**
 * Pure helpers for /barbershop-price-list-template. No DOM, no network.
 * Service names are suggestions only; the tool never pre-fills prices.
 */

export type PriceListItem = {
  name: string;
  /** Price in pounds as typed; null when empty or invalid. */
  priceGbp: number | null;
  /** "From" price (e.g. longer hair or extra work). */
  from: boolean;
  /** Minutes; null when not shown. */
  minutes: number | null;
};

export type PriceListOptions = {
  shopName: string;
  items: readonly PriceListItem[];
  showDuration: boolean;
  footer: string;
};

export const PRICE_LIST_MAX_ITEMS = 20;
export const PRICE_LIST_MAX_PRICE_GBP = 999;
export const PRICE_LIST_MAX_MINUTES = 480;
export const PRICE_LIST_NAME_MAX = 60;
export const PRICE_LIST_SHOP_MAX = 60;
export const PRICE_LIST_FOOTER_MAX = 120;

/** Starting rows: common UK barbershop services, no prices. */
export const PRICE_LIST_SUGGESTED_SERVICES: readonly string[] = [
  'Haircut',
  'Skin fade',
  'Scissor cut',
  'Beard trim',
  'Haircut and beard',
  'Hot towel shave',
  'Kids cut (under 12)',
];

/** One-tap extra rows (names only, never prices). */
export const PRICE_LIST_QUICK_ADD: readonly string[] = [
  'Line up',
  'Buzz cut',
  'Beard shape-up',
  'Eyebrow tidy',
  'Wash and style',
  'Hair design',
  'Student cut',
  'Senior cut',
];

export const PRICE_LIST_DURATION_OPTIONS: readonly number[] = [15, 20, 30, 45, 60, 75, 90];

/** Parses a typed price ("12", "£12.50", "12.5") into pounds with at most 2 decimals. */
export function parsePriceGbp(raw: string): number | null {
  const cleaned = raw.replace(/[£,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0 || value > PRICE_LIST_MAX_PRICE_GBP) return null;
  return Math.round(value * 100) / 100;
}

export function formatPriceGbp(value: number): string {
  return Number.isInteger(value) ? `£${value}` : `£${value.toFixed(2)}`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

function clip(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function normalisePriceList(options: PriceListOptions): PriceListOptions {
  return {
    shopName: clip(options.shopName, PRICE_LIST_SHOP_MAX),
    footer: clip(options.footer, PRICE_LIST_FOOTER_MAX),
    showDuration: options.showDuration,
    items: options.items
      .slice(0, PRICE_LIST_MAX_ITEMS)
      .map((item) => ({
        name: clip(item.name, PRICE_LIST_NAME_MAX),
        priceGbp: item.priceGbp,
        from: item.from,
        minutes:
          item.minutes !== null && Number.isInteger(item.minutes) && item.minutes > 0 && item.minutes <= PRICE_LIST_MAX_MINUTES
            ? item.minutes
            : null,
      }))
      .filter((item) => item.name.length > 0),
  };
}

export function formatItemPrice(item: PriceListItem): string {
  if (item.priceGbp === null) return '£—';
  return `${item.from ? 'from ' : ''}${formatPriceGbp(item.priceGbp)}`;
}

/** Plain text for Instagram, a Google Business Profile post or a booking page. */
export function buildPriceListText(input: PriceListOptions): string {
  const options = normalisePriceList(input);
  const title = options.shopName ? `${options.shopName} prices` : 'Prices';
  const lines = options.items.map((item) => {
    const duration = options.showDuration && item.minutes !== null ? ` (${formatMinutes(item.minutes)})` : '';
    return `${item.name}${duration}: ${formatItemPrice(item)}`;
  });
  return [title, '', ...lines, ...(options.footer ? ['', options.footer] : [])].join('\n');
}

/** Rows that still need a price, so the tool can warn before copying or printing. */
export function itemsMissingPrice(input: PriceListOptions): string[] {
  return normalisePriceList(input)
    .items.filter((item) => item.priceGbp === null)
    .map((item) => item.name);
}

/** What a service earns per hour in the chair, from the owner's own price and time. Null without both. */
export function hourlyRateGbp(item: Pick<PriceListItem, 'priceGbp' | 'minutes'>): number | null {
  if (item.priceGbp === null || item.minutes === null || item.minutes <= 0) return null;
  return Math.round((item.priceGbp / item.minutes) * 60);
}

/** Rows with a name, and how many of them have a price: drives the progress ring. */
export function pricedCount(input: PriceListOptions): { priced: number; total: number } {
  const items = normalisePriceList(input).items;
  return { priced: items.filter((item) => item.priceGbp !== null).length, total: items.length };
}
