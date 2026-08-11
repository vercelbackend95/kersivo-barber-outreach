import type { ReportsChartMetric } from '@/lib/admin/reportsChartSeries';
import type { ReportsRangeKey } from '@/lib/admin/reportsRange';

const STORAGE_KEY = 'feature261-reports-widget-v2';

export type LandingReportsWidgetPrefs = {
  rangePreset?: ReportsRangeKey;
  chartMetric?: ReportsChartMetric;
  selectedBarberIds?: string[];
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function readLandingReportsWidgetPrefs(): LandingReportsWidgetPrefs {
  if (!isBrowser()) return {};

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LandingReportsWidgetPrefs;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

let writeTimer: number | null = null;

export function writeLandingReportsWidgetPrefs(prefs: LandingReportsWidgetPrefs): void {
  if (!isBrowser()) return;

  if (writeTimer) {
    window.clearTimeout(writeTimer);
  }

  writeTimer = window.setTimeout(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore quota / privacy errors.
    }
    writeTimer = null;
  }, 150);
}
