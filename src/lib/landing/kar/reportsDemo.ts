/**
 * Data for the live Reports studio on /barbershop-reports.
 *
 * Reads the same deterministic payload the Heritage Grooming demo dashboard shows
 * (src/lib/admin/heritageDemoFixtures/reports.ts, no database) and shapes it into the
 * small JSON the page's studio animates. Client-safe and pure: runs in the page frontmatter.
 */
import { getHeritageReportsResponse } from '@/lib/admin/heritageDemoFixtures/reports';
import { ADMIN_REPORTS_TIMEZONE } from '@/lib/admin/reportsRange';

export type KarRangeKey = '1d' | '7d' | '30d' | '1y';

export type KarStudioRange = {
  key: KarRangeKey;
  label: string;
  short: string;
  bookings: number;
  /** Percent change against the previous period, or null when there is nothing to compare. */
  bookingsTrendPct: number | null;
  utilisationPct: number | null;
  utilisationPp: number | null;
  /** Average completed booking value in £, or null when no booking in the range is completed yet. */
  avgValueGbp: number | null;
  avgValueDeltaGbp: number;
  cancelledRatePct: number;
  cancelledRatePp: number;
  noShowRatePct: number;
  noShowRatePp: number;
  peak: string | null;
  popularService: string | null;
  busiestBarber: string | null;
  smallSample: boolean;
  /** One value per bucket (hour, day or week). */
  series: { bookings: number[]; value: number[] };
  axis: [string, string, string];
  leaderboard: { name: string; count: number }[];
};

export const KAR_STUDIO_RANGES: readonly { key: KarRangeKey; label: string; short: string }[] = [
  { key: '1d', label: '1 Day', short: '1D' },
  { key: '7d', label: '1 Week', short: '1W' },
  { key: '30d', label: '1 Month', short: '1M' },
  { key: '1y', label: '1 Year', short: '1Y' },
];

/** Reports flags fewer than about 10 bookings as a small sample. */
export const KAR_SMALL_SAMPLE_BELOW = 10;

const DAY_MS = 86_400_000;

const londonParts = (iso: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ADMIN_REPORTS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') };
};

/** Whole London calendar days between two instants. */
const londonDayIndex = (fromIso: string, iso: string) => {
  const a = londonParts(fromIso);
  const b = londonParts(iso);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY_MS);
};

const dayLabel = (fromIso: string, offset: number, withWeekday: boolean) => {
  const a = londonParts(fromIso);
  const date = new Date(Date.UTC(a.y, a.m - 1, a.d + offset, 12));
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    ...(withWeekday ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
  }).format(date);
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildKarStudioRange(key: KarRangeKey): KarStudioRange {
  const meta = KAR_STUDIO_RANGES.find((r) => r.key === key)!;
  const payload = getHeritageReportsResponse(key);
  const from = payload.rangeBoundaries.from;
  const to = payload.rangeBoundaries.to;

  // Buckets: opening hours for a day, days for a week or month, weeks for longer ranges.
  let bucketCount: number;
  let bucketOf: (iso: string) => number;
  let axis: [string, string, string];
  if (key === '1d') {
    const first = 9;
    const last = 19;
    bucketCount = last - first + 1;
    bucketOf = (iso) => londonParts(iso).h - first;
    axis = ['09:00', '14:00', '19:00'];
  } else {
    const days = Math.max(1, londonDayIndex(from, to) + 1);
    const weekly = days > 45;
    bucketCount = weekly ? Math.ceil(days / 7) : days;
    bucketOf = (iso) => {
      const day = londonDayIndex(from, iso);
      return weekly ? Math.floor(day / 7) : day;
    };
    const mid = Math.floor((days - 1) / 2);
    axis = [dayLabel(from, 0, !weekly), dayLabel(from, mid, !weekly), dayLabel(from, days - 1, !weekly)];
  }

  const bookings = new Array<number>(bucketCount).fill(0);
  const value = new Array<number>(bucketCount).fill(0);
  const perBarber = new Map<string, number>();
  for (const row of payload.reportBookings) {
    const i = bucketOf(row.startAt);
    if (i >= 0 && i < bucketCount) {
      bookings[i] += 1;
      value[i] += row.computedValueGbp ?? 0;
    }
    // Leaderboard counts the bookings a barber kept, as the dashboard's busiest-barber figure does.
    if (!/CANCEL/i.test(row.status)) perBarber.set(row.barberName, (perBarber.get(row.barberName) ?? 0) + 1);
  }

  const leaderboard = [...perBarber.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const t = payload.trends;
  return {
    key,
    label: meta.label,
    short: meta.short,
    bookings: payload.bookingsCount,
    bookingsTrendPct: t.bookingsPct,
    utilisationPct: payload.utilizationPct,
    utilisationPp: t.utilizationPp,
    avgValueGbp: payload.revenueCount > 0 ? round1(payload.avgBookingValue) : null,
    avgValueDeltaGbp: round1(t.avgBookingValueDelta),
    cancelledRatePct: round1(payload.cancelledRate),
    cancelledRatePp: round1(t.cancelledRatePp),
    noShowRatePct: round1(payload.noShowExpiredRate),
    noShowRatePp: round1(t.noShowExpiredRatePp),
    peak: payload.peakDay && payload.peakHour ? `${payload.peakDay} · ${payload.peakHour}` : null,
    popularService: payload.mostPopularService?.name ?? null,
    busiestBarber: payload.busiestBarber?.name ?? null,
    smallSample: payload.bookingsCount < KAR_SMALL_SAMPLE_BELOW,
    series: { bookings, value: value.map((v) => Math.round(v)) },
    axis,
    leaderboard,
  };
}

export function buildKarStudioData(): Record<KarRangeKey, KarStudioRange> {
  return Object.fromEntries(KAR_STUDIO_RANGES.map((r) => [r.key, buildKarStudioRange(r.key)])) as Record<
    KarRangeKey,
    KarStudioRange
  >;
}
