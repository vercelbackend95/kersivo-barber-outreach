import { formatInTimeZone } from 'date-fns-tz';

import type { ReportsRangeKey } from './reportsRange';

export type ReportsChartMetric = 'revenue' | 'bookings' | 'cancelRate';
export type { ReportsRangeKey };

export type ReportsChartBookingRow = {
  startAt: string;
  barberId: string;
  barberName: string;
  status: string;
  computedValueGbp: number | null;
};

export type ReportsChartInput = {
  revenueSeries: Array<{ label: string; value: number }>;
  reportBookings: ReportsChartBookingRow[];
};

export type ChartPoint = { label: string; value: number };

export type BarberTotal = {
  barberId: string;
  barberName: string;
  total: number;
};

const ADMIN_TIMEZONE = 'Europe/London';

const CANCELLED_STATUSES = new Set([
  'CANCELLED_BY_CLIENT',
  'CANCELLED_BY_SHOP',
  'CANCELLED_BY_ADMIN',
  'EXPIRED',
]);

export function getBucketLabel(date: Date | string, rangeKey: ReportsRangeKey): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (rangeKey === '1y') {
    return formatInTimeZone(d, ADMIN_TIMEZONE, "yyyy-'W'II");
  }
  return formatInTimeZone(d, ADMIN_TIMEZONE, 'yyyy-MM-dd');
}

function isCancelledStatus(status: string): boolean {
  return CANCELLED_STATUSES.has(status);
}

function seedLabels(reports: ReportsChartInput): string[] {
  return reports.revenueSeries.map((point) => point.label);
}

function isWeeklyLabels(labels: string[]): boolean {
  return labels.some((label) => label.includes('W'));
}

function resolveBucketKey(startAt: string, labels: string[]): string | null {
  const key = getBucketLabel(startAt, isWeeklyLabels(labels) ? '1y' : '7d');
  return labels.includes(key) ? key : null;
}

function zeroBuckets(labels: string[]): Map<string, number> {
  return new Map(labels.map((label) => [label, 0]));
}

function finalizeBuckets(
  buckets: Map<string, number>,
  labels: string[],
  metric: ReportsChartMetric,
): ChartPoint[] {
  return labels.map((label) => {
    const raw = buckets.get(label) ?? 0;
    if (metric === 'revenue') {
      return { label, value: Math.round(raw * 100) };
    }
    if (metric === 'cancelRate') {
      return { label, value: raw };
    }
    return { label, value: Math.round(raw) };
  });
}

export function buildOverallSeries(
  reports: ReportsChartInput,
  metric: ReportsChartMetric,
): ChartPoint[] {
  const labels = seedLabels(reports);

  if (metric === 'revenue') {
    return reports.revenueSeries.map((point) => ({
      label: point.label,
      value: Math.round(point.value * 100),
    }));
  }

  if (metric === 'bookings') {
    const buckets = zeroBuckets(labels);
    for (const row of reports.reportBookings) {
      const key = resolveBucketKey(row.startAt, labels);
      if (!key) continue;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return finalizeBuckets(buckets, labels, metric);
  }

  const cancelBuckets = new Map<string, { total: number; cancelled: number }>();
  for (const label of labels) cancelBuckets.set(label, { total: 0, cancelled: 0 });
  for (const row of reports.reportBookings) {
    const key = resolveBucketKey(row.startAt, labels);
    if (!key) continue;
    const bucket = cancelBuckets.get(key)!;
    bucket.total += 1;
    if (isCancelledStatus(row.status)) bucket.cancelled += 1;
  }

  return labels.map((label) => {
    const bucket = cancelBuckets.get(label) ?? { total: 0, cancelled: 0 };
    return {
      label,
      value: bucket.total > 0 ? (bucket.cancelled / bucket.total) * 100 : 0,
    };
  });
}

export function buildBarberSeries(
  reports: ReportsChartInput,
  barberId: string,
  metric: ReportsChartMetric,
): ChartPoint[] {
  const labels = seedLabels(reports);
  const rows = reports.reportBookings.filter((row) => row.barberId === barberId);

  if (metric === 'revenue') {
    const buckets = zeroBuckets(labels);
    for (const row of rows) {
      const key = resolveBucketKey(row.startAt, labels);
      if (!key) continue;
      buckets.set(key, (buckets.get(key) ?? 0) + (row.computedValueGbp ?? 0));
    }
    return finalizeBuckets(buckets, labels, metric);
  }

  if (metric === 'bookings') {
    const buckets = zeroBuckets(labels);
    for (const row of rows) {
      const key = resolveBucketKey(row.startAt, labels);
      if (!key) continue;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return finalizeBuckets(buckets, labels, metric);
  }

  const cancelBuckets = new Map<string, { total: number; cancelled: number }>();
  for (const label of labels) cancelBuckets.set(label, { total: 0, cancelled: 0 });
  for (const row of rows) {
    const key = resolveBucketKey(row.startAt, labels);
    if (!key) continue;
    const bucket = cancelBuckets.get(key)!;
    bucket.total += 1;
    if (isCancelledStatus(row.status)) bucket.cancelled += 1;
  }

  return labels.map((label) => {
    const bucket = cancelBuckets.get(label) ?? { total: 0, cancelled: 0 };
    return {
      label,
      value: bucket.total > 0 ? (bucket.cancelled / bucket.total) * 100 : 0,
    };
  });
}

export function getBarberTotals(
  reports: ReportsChartInput,
  metric: ReportsChartMetric,
): BarberTotal[] {
  const byBarber = new Map<string, { name: string; revenue: number; bookings: number; cancelled: number }>();

  for (const row of reports.reportBookings) {
    const entry = byBarber.get(row.barberId) ?? {
      name: row.barberName,
      revenue: 0,
      bookings: 0,
      cancelled: 0,
    };
    entry.bookings += 1;
    entry.revenue += row.computedValueGbp ?? 0;
    if (isCancelledStatus(row.status)) entry.cancelled += 1;
    byBarber.set(row.barberId, entry);
  }

  return Array.from(byBarber.entries()).map(([barberId, entry]) => {
    let total: number;
    if (metric === 'revenue') total = entry.revenue;
    else if (metric === 'bookings') total = entry.bookings;
    else total = entry.bookings > 0 ? (entry.cancelled / entry.bookings) * 100 : 0;

    return { barberId, barberName: entry.name, total };
  });
}

export function getWinnerBarberId(
  reports: ReportsChartInput,
  metric: ReportsChartMetric,
): string | null {
  const totals = getBarberTotals(reports, metric);
  const eligible = metric === 'cancelRate'
    ? totals.filter((row) => {
        const bookings = reports.reportBookings.filter((b) => b.barberId === row.barberId).length;
        return bookings > 0;
      })
    : totals.filter((row) => row.total > 0);

  if (eligible.length === 0) return null;

  const sorted = [...eligible].sort((a, b) => {
    if (metric === 'cancelRate') return a.total - b.total;
    return b.total - a.total;
  });

  return sorted[0]?.barberId ?? null;
}

export function toChartValue(rawGbp: number, metric: ReportsChartMetric): number {
  if (metric === 'revenue') return Math.round(rawGbp * 100);
  return rawGbp;
}
