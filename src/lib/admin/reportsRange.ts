import { differenceInCalendarDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const ADMIN_REPORTS_TIMEZONE = 'Europe/London';

export const REPORTS_RANGE_MAX_DAYS = 365;

export type ReportsRangeKey = '1d' | '1y' | 'week' | '7d' | '30d' | '90d' | 'month' | 'custom';

export type ReportsPresetKey = Exclude<ReportsRangeKey, 'custom'>;

export type ReportsCustomDateRange = {
  from?: Date;
  to?: Date;
};

export const DESKTOP_REPORTS_RANGE_OPTIONS: Array<{ value: ReportsPresetKey; label: string }> = [
  { value: '1d', label: '1 Day' },
  { value: '7d', label: '1 Week' },
  { value: '30d', label: '1 Month' },
  { value: '1y', label: '1 Year' },
];

export const MOBILE_REPORTS_RANGE_OPTIONS: Array<{ value: ReportsPresetKey; label: string }> = [
  { value: '1d', label: '1D' },
  { value: '7d', label: '1W' },
  { value: '30d', label: '1M' },
  { value: '1y', label: '1Y' },
];

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getDefaultReportsPreset(_isMobileViewport?: boolean): ReportsPresetKey {
  return '1d';
}

export function getStartOfMonthInLondon(now: Date, timezone = ADMIN_REPORTS_TIMEZONE): Date {
  const monthKey = formatInTimeZone(now, timezone, 'yyyy-MM-01');
  return fromZonedTime(`${monthKey}T00:00:00.000`, timezone);
}

export function dateToYmdInLondon(date: Date, timezone = ADMIN_REPORTS_TIMEZONE): string {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

export function parseYmd(value: string): Date | null {
  if (!YMD_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

export function parseYmdRange(from: string, to: string): { from: string; to: string } {
  const fromDate = parseYmd(from);
  const toDate = parseYmd(to);

  if (!fromDate || !toDate) {
    throw new Error('Invalid date range. Use YYYY-MM-DD for from/to.');
  }
  if (fromDate > toDate) {
    throw new Error('Invalid date range. "from" must be less than or equal to "to".');
  }

  const spanDays = differenceInCalendarDays(toDate, fromDate) + 1;
  if (spanDays > REPORTS_RANGE_MAX_DAYS) {
    throw new Error(`Date range cannot exceed ${REPORTS_RANGE_MAX_DAYS} days.`);
  }

  return { from, to };
}

export function customRangeToYmd(range: ReportsCustomDateRange | null): { from: string; to: string } | null {
  if (!range?.from || !range?.to) return null;
  return {
    from: dateToYmdInLondon(range.from),
    to: dateToYmdInLondon(range.to),
  };
}

export function isCustomRangeComplete(range: ReportsCustomDateRange | null): range is { from: Date; to: Date } {
  return Boolean(range?.from && range?.to);
}

export function buildReportsFetchParams(
  preset: ReportsRangeKey,
  customRange?: ReportsCustomDateRange | null,
): URLSearchParams | null {
  if (preset === 'custom') {
    const ymd = customRangeToYmd(customRange ?? null);
    if (!ymd) return null;
    try {
      parseYmdRange(ymd.from, ymd.to);
    } catch {
      return null;
    }
    return new URLSearchParams({ range: 'custom', from: ymd.from, to: ymd.to });
  }

  return new URLSearchParams({ range: preset });
}

export function customRangeDayCount(fromYmd: string, toYmd: string): number {
  const fromDate = parseYmd(fromYmd);
  const toDate = parseYmd(toYmd);
  if (!fromDate || !toDate) return 0;
  return differenceInCalendarDays(toDate, fromDate) + 1;
}
