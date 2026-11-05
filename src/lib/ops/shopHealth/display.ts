/**
 * Display helpers for the shop health Ops UI. Pure (no DB), shared by the pages, the rail card and the
 * launch guard island. Every light and status has an icon AND text: colour is never the only signal.
 */
import { OVERALL_LABELS } from './overall';
import type { ShopHealthOverall, ShopHealthStatus } from './types';

export const OPS_SHOPS_PATH = '/ops/shops';

export function opsShopHealthPath(shopId: string): string {
  return `${OPS_SHOPS_PATH}/${encodeURIComponent(shopId)}`;
}

export function shopHealthRunApi(shopId: string): string {
  return `/api/ops/shops/${encodeURIComponent(shopId)}/health/run`;
}

/** Glyphs differ in shape as well as colour (tick, exclamation, cross, open circle). */
export const OVERALL_ICONS: Record<ShopHealthOverall, string> = { GREEN: '✓', AMBER: '!', RED: '✕', GREY: '○' };

export const NOT_CHECKED_LABEL = 'Not checked yet';

/** "Green — all checks passed", or "Not live yet — 9 / 12 ready" for GREY with readiness. */
export function overallText(
  overall: ShopHealthOverall | null,
  readiness?: { ready: number; total: number } | null,
): string {
  if (!overall) return NOT_CHECKED_LABEL;
  if (overall === 'GREY' && readiness && readiness.total > 0) {
    return `${OVERALL_LABELS.GREY} — ${readiness.ready} / ${readiness.total} ready`;
  }
  return OVERALL_LABELS[overall];
}

/** Short word for the dot history and chips. */
export const OVERALL_SHORT: Record<ShopHealthOverall, string> = { GREEN: 'Green', AMBER: 'Amber', RED: 'Red', GREY: 'Grey' };

export const STATUS_LABELS: Record<ShopHealthStatus, string> = {
  pass: 'Passed',
  warn: 'Warning',
  fail: 'Failed',
  skip: 'Does not apply',
  after_launch: 'After launch',
  inconclusive: 'Inconclusive',
};

export const STATUS_ICONS: Record<ShopHealthStatus, string> = {
  pass: '✓',
  warn: '!',
  fail: '✕',
  skip: '–',
  after_launch: '…',
  inconclusive: '?',
};

/** Order inside an area: what needs action first. */
export const STATUS_ORDER: Record<ShopHealthStatus, number> = { fail: 0, inconclusive: 1, warn: 2, pass: 3, after_launch: 4, skip: 5 };

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
export function formatRelative(from: Date | null | undefined, now: Date = new Date()): string {
  if (!from) return 'Never';
  const minutes = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

export function formatLondon(value: Date | null | undefined): string {
  if (!value) return '—';
  return value.toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' });
}

/** The first `max` titles plus "+n" for the rest. */
export function truncateIssues(titles: readonly string[], max = 2): { shown: string[]; more: number } {
  return { shown: titles.slice(0, max), more: Math.max(0, titles.length - max) };
}

/** Evidence values as short text for the collapsible evidence list. */
export function evidenceText(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}
