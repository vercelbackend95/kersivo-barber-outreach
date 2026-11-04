/**
 * The ONE place that formats public shop data for display (en-GB, £, 24-hour, Monday first).
 * Templates never format by hand; they use the `*Display` strings built from these helpers.
 */
import type { SiteOpeningPeriod } from './types';

const GBP_WHOLE = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const GBP_PENCE = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

/** 2500 → "£25", 2550 → "£25.50", 0 → "£0". */
export function formatPricePence(pence: number): string {
  return pence % 100 === 0 ? GBP_WHOLE.format(pence / 100) : GBP_PENCE.format(pence / 100);
}

/** "£25" or "From £25". */
export function formatServicePrice(pence: number, priceFrom: boolean): string {
  const amount = formatPricePence(pence);
  return priceFrom ? `From ${amount}` : amount;
}

/** Decimal string for schema.org prices: 2500 → "25.00". */
export function pricePenceToDecimal(pence: number): string {
  return (pence / 100).toFixed(2);
}

/** 45 → "45 min", 60 → "1 hr", 75 → "1 hr 15 min", 120 → "2 hr". */
export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** ISO weekday (1 = Monday) names, Monday first. */
export const WEEKDAYS = [
  { dayOfWeek: 1, dayName: 'Monday', shortName: 'Mon', schemaDay: 'https://schema.org/Monday' },
  { dayOfWeek: 2, dayName: 'Tuesday', shortName: 'Tue', schemaDay: 'https://schema.org/Tuesday' },
  { dayOfWeek: 3, dayName: 'Wednesday', shortName: 'Wed', schemaDay: 'https://schema.org/Wednesday' },
  { dayOfWeek: 4, dayName: 'Thursday', shortName: 'Thu', schemaDay: 'https://schema.org/Thursday' },
  { dayOfWeek: 5, dayName: 'Friday', shortName: 'Fri', schemaDay: 'https://schema.org/Friday' },
  { dayOfWeek: 6, dayName: 'Saturday', shortName: 'Sat', schemaDay: 'https://schema.org/Saturday' },
  { dayOfWeek: 7, dayName: 'Sunday', shortName: 'Sun', schemaDay: 'https://schema.org/Sunday' },
] as const;

/** Minutes from midnight → "HH:mm" (24-hour). */
export function formatMinutesAsTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** [] → "Closed"; one or more periods → "09:00–18:00, 19:00–21:00" (en dash). */
export function formatOpeningPeriods(periods: SiteOpeningPeriod[]): string {
  if (periods.length === 0) return 'Closed';
  return periods.map((p) => `${p.opens}–${p.closes}`).join(', ');
}

/** "2026-12-25" → "Friday 25 December" (calendar date, no time zone shift). */
export function formatCalendarDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace(',', '');
}

/** "+44 161 000 0000" → "tel:+441610000000". */
export function phoneHref(phone: string | null): string | null {
  if (!phone) return null;
  const compact = phone.replace(/[^\d+]/g, '');
  return compact ? `tel:${compact}` : null;
}
