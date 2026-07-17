import { addDays, differenceInCalendarDays, differenceInMilliseconds, subDays, subMonths } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

import { getEffectiveBookingStatus } from '../booking/operationalStatus';
import { isBookingPaidQualified } from '../booking/paymentReporting';
import { londonDayOfWeekFromIsoDate } from '../booking/time';
import {
  buildWorkdayHourLabels,
  formatHourLabel,
  getHourBucketLabel,
  parseHourLabel,
  toCumulativeSeries,
} from './reportsHourlySeries';
import {
  getStartOfMonthInLondon,
  parseYmdRange,
  type ReportsRangeKey,
} from './reportsRange';

export const ADMIN_REPORTS_TIMEZONE = 'Europe/London';

export type RangeBoundaries = { from: Date; to: Date };

export type TimeInterval = { start: Date; end: Date };

export type ReportStatusClass =
  | 'completed'
  | 'active'
  | 'cancelledByClient'
  | 'cancelledByShop'
  | 'expired'
  | 'noShow';

export type ReportBreakdown = {
  completed: number;
  active: number;
  cancelledByClient: number;
  cancelledByShop: number;
  expired: number;
  noShow: number;
};

/** Legacy UI shape: completed+active fold into `completed`, no-show+expired into `noShowExpired`. */
export type ReportBreakdownLegacy = {
  completed: number;
  cancelledByClient: number;
  cancelledByShop: number;
  noShowExpired: number;
};

export type AggregatableBooking = {
  id: string;
  status: string;
  startAt: Date;
  endAt: Date;
  barberId: string;
  barberName: string;
  serviceId: string | null;
  serviceName: string;
  clientName: string | null;
  clientEmail: string | null;
  paymentStatus: string | null;
  valuePence: number;
  durationMinutes: number;
};

export type AvailabilityRuleInput = {
  barberId: string;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  breakStartMin: number | null;
  breakEndMin: number | null;
};

export type BlockIntervalInput = {
  barberId: string | null;
  startAt: Date;
  endAt: Date;
};

export type ReportBookingRow = {
  id: string;
  startAt: string;
  barberId: string;
  barberName: string;
  serviceName: string;
  status: string;
  clientName: string | null;
  clientEmail: string | null;
  computedValueGbp: number | null;
};

export type AggregatedReportMetrics = {
  bookingsCount: number;
  revenue: number;
  revenueCount: number;
  avgBookingValue: number;
  cancelledRate: number;
  noShowExpiredRate: number;
  breakdown: ReportBreakdownLegacy;
  breakdownDetailed: ReportBreakdown;
  peakDay: string | null;
  peakHour: string | null;
  bookedMinutes: number;
  availableMinutes: number;
  utilizationPct: number | null;
  revenueSeries: Array<{ label: string; value: number }>;
  reportBookings: ReportBookingRow[];
  mostPopularService: { name: string; count: number } | null;
  busiestBarber: { name: string; count: number } | null;
};

const KEPT_CLASSES = new Set<ReportStatusClass>(['completed', 'active']);

export function classifyBookingStatus(
  status: string,
  startAt: Date | string,
  endAt: Date | string,
  nowMs: number = Date.now(),
): ReportStatusClass {
  const effective = getEffectiveBookingStatus({ status, startAt, endAt, nowMs });
  if (effective === 'CANCELLED_BY_CLIENT') return 'cancelledByClient';
  if (effective === 'CANCELLED_BY_SHOP' || effective === 'CANCELLED_BY_ADMIN') return 'cancelledByShop';
  if (effective === 'EXPIRED') return 'expired';
  if (effective === 'NO_SHOW') return 'noShow';
  if (effective === 'COMPLETED') return 'completed';
  return 'active';
}

export function isCancelledForReports(statusOrClass: string | ReportStatusClass): boolean {
  if (
    statusOrClass === 'cancelledByClient'
    || statusOrClass === 'cancelledByShop'
    || statusOrClass === 'CANCELLED_BY_CLIENT'
    || statusOrClass === 'CANCELLED_BY_SHOP'
    || statusOrClass === 'CANCELLED_BY_ADMIN'
  ) {
    return true;
  }
  return false;
}

/** Chart Cancel % matches KPI cancelled rate (client/shop/admin only; not expired/no-show). */
export function isCancelledChartStatus(status: string): boolean {
  return (
    status === 'CANCELLED_BY_CLIENT'
    || status === 'CANCELLED_BY_SHOP'
    || status === 'CANCELLED_BY_ADMIN'
  );
}

export function isKeptForChairMetrics(statusClass: ReportStatusClass): boolean {
  return KEPT_CLASSES.has(statusClass);
}

export function toLegacyBreakdown(detailed: ReportBreakdown): ReportBreakdownLegacy {
  return {
    completed: detailed.completed + detailed.active,
    cancelledByClient: detailed.cancelledByClient,
    cancelledByShop: detailed.cancelledByShop,
    noShowExpired: detailed.noShow + detailed.expired,
  };
}

export function minutesOfOverlap(rangeFrom: Date, rangeTo: Date, eventFrom: Date, eventTo: Date): number {
  const fromMs = Math.max(rangeFrom.getTime(), eventFrom.getTime());
  const toMs = Math.min(rangeTo.getTime(), eventTo.getTime());
  if (toMs <= fromMs) return 0;
  return Math.round((toMs - fromMs) / 60000);
}

export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length <= 1) return intervals.map((interval) => ({ ...interval }));
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: TimeInterval[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const tail = merged[merged.length - 1];
    if (current.start.getTime() <= tail.end.getTime()) {
      if (current.end.getTime() > tail.end.getTime()) {
        tail.end = current.end;
      }
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/** Advance by London calendar dates (midday) to avoid DST duplicate/skipped days. */
export function getRangeDayKeys(range: RangeBoundaries, timezone = ADMIN_REPORTS_TIMEZONE): string[] {
  const keys: string[] = [];
  let dayKey = formatInTimeZone(range.from, timezone, 'yyyy-MM-dd');
  const endKey = formatInTimeZone(range.to, timezone, 'yyyy-MM-dd');

  while (dayKey <= endKey) {
    keys.push(dayKey);
    const midday = fromZonedTime(`${dayKey}T12:00:00.000`, timezone);
    dayKey = formatInTimeZone(addDays(midday, 1), timezone, 'yyyy-MM-dd');
  }

  return keys;
}

export function getStartOfWeekInLondon(now: Date, timezone = ADMIN_REPORTS_TIMEZONE): Date {
  const londonNow = toZonedTime(now, timezone);
  const day = londonNow.getDay();
  const diffToMonday = (day + 6) % 7;
  const mondayDate = new Date(londonNow);
  mondayDate.setDate(londonNow.getDate() - diffToMonday);
  const mondayKey = formatInTimeZone(mondayDate, timezone, 'yyyy-MM-dd');
  return fromZonedTime(`${mondayKey}T00:00:00.000`, timezone);
}

export function getReportsRange(range: ReportsRangeKey, now = new Date()): RangeBoundaries {
  if (range === 'week') {
    return { from: getStartOfWeekInLondon(now), to: now };
  }
  if (range === 'month') {
    return { from: getStartOfMonthInLondon(now, ADMIN_REPORTS_TIMEZONE), to: now };
  }
  if (range === '1d') {
    const todayKey = formatInTimeZone(now, ADMIN_REPORTS_TIMEZONE, 'yyyy-MM-dd');
    return {
      from: fromZonedTime(`${todayKey}T00:00:00.000`, ADMIN_REPORTS_TIMEZONE),
      to: now,
    };
  }
  if (range === '1y') {
    return { from: subDays(now, 365), to: now };
  }
  const daysBack = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  return { from: subDays(now, daysBack), to: now };
}

export function getCustomReportsRange(fromYmd: string, toYmd: string): RangeBoundaries {
  const { from, to } = parseYmdRange(fromYmd, toYmd);
  return {
    from: fromZonedTime(`${from}T00:00:00.000`, ADMIN_REPORTS_TIMEZONE),
    to: fromZonedTime(`${to}T23:59:59.999`, ADMIN_REPORTS_TIMEZONE),
  };
}

export function getPreviousRange(range: ReportsRangeKey, current: RangeBoundaries, now = new Date()): RangeBoundaries {
  if (range === 'week') {
    const currentWeekStart = getStartOfWeekInLondon(now);
    const previousWeekStart = subDays(currentWeekStart, 7);
    return { from: previousWeekStart, to: new Date(currentWeekStart.getTime() - 1) };
  }
  if (range === 'month') {
    const currentMonthStart = getStartOfMonthInLondon(now, ADMIN_REPORTS_TIMEZONE);
    const previousMonthStart = subMonths(currentMonthStart, 1);
    return { from: previousMonthStart, to: new Date(currentMonthStart.getTime() - 1) };
  }
  const diffMs = Math.max(0, differenceInMilliseconds(current.to, current.from));
  return {
    from: new Date(current.from.getTime() - (diffMs + 1)),
    to: new Date(current.from.getTime() - 1),
  };
}

export function toTrendPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function getRevenueBucketMode(rangeKey: ReportsRangeKey, range: RangeBoundaries): 'hour' | 'day' | 'week' {
  if (rangeKey === '1d') return 'hour';
  if (rangeKey === 'custom') {
    const spanDays = differenceInCalendarDays(range.to, range.from) + 1;
    if (spanDays > 90) return 'week';
  }
  return 'day';
}

export function buildHourLabelsForBookings(
  rangeTo: Date,
  bookingStarts: Array<Date | string>,
  timezone = ADMIN_REPORTS_TIMEZONE,
): string[] {
  const base = buildWorkdayHourLabels(rangeTo, timezone);
  const hours = new Set(base.map((label) => parseHourLabel(label)).filter((h): h is number => h != null));
  for (const start of bookingStarts) {
    const hour = parseHourLabel(getHourBucketLabel(start, timezone));
    if (hour != null) hours.add(hour);
  }
  return [...hours].sort((a, b) => a - b).map(formatHourLabel);
}

export function getRevenueSeriesSeed(
  range: RangeBoundaries,
  rangeKey: ReportsRangeKey,
  bookingStarts: Array<Date | string> = [],
): Array<{ label: string; value: number }> {
  const mode = getRevenueBucketMode(rangeKey, range);
  if (mode === 'hour') {
    return buildHourLabelsForBookings(range.to, bookingStarts).map((label) => ({ label, value: 0 }));
  }
  if (mode === 'day') {
    return getRangeDayKeys(range).map((dayKey) => ({ label: dayKey, value: 0 }));
  }

  const keys = new Set<string>();
  for (const dayKey of getRangeDayKeys(range)) {
    const midday = fromZonedTime(`${dayKey}T12:00:00.000`, ADMIN_REPORTS_TIMEZONE);
    keys.add(formatInTimeZone(midday, ADMIN_REPORTS_TIMEZONE, "yyyy-'W'II"));
  }
  return [...keys].map((weekKey) => ({ label: weekKey, value: 0 }));
}

export function getRevenueBucketLabel(date: Date, rangeKey: ReportsRangeKey, range: RangeBoundaries): string {
  const mode = getRevenueBucketMode(rangeKey, range);
  if (mode === 'hour') return getHourBucketLabel(date, ADMIN_REPORTS_TIMEZONE);
  if (mode === 'week') return formatInTimeZone(date, ADMIN_REPORTS_TIMEZONE, "yyyy-'W'II");
  return formatInTimeZone(date, ADMIN_REPORTS_TIMEZONE, 'yyyy-MM-dd');
}

function minutesFromRuleParts(dayKey: string, minutes: number): Date {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return fromZonedTime(
    `${dayKey}T${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`,
    ADMIN_REPORTS_TIMEZONE,
  );
}

export function computeAvailableMinutes(input: {
  range: RangeBoundaries;
  activeBarberIds: string[];
  availability: AvailabilityRuleInput[];
  timeBlocks: BlockIntervalInput[];
  timeOff: BlockIntervalInput[];
}): number {
  const { range, activeBarberIds, availability, timeBlocks, timeOff } = input;
  const dayKeys = getRangeDayKeys(range);
  const rulesByBarber = new Map<string, AvailabilityRuleInput[]>();
  for (const rule of availability) {
    if (!rulesByBarber.has(rule.barberId)) rulesByBarber.set(rule.barberId, []);
    rulesByBarber.get(rule.barberId)?.push(rule);
  }

  let availableMinutes = 0;
  for (const barberId of activeBarberIds) {
    const rules = rulesByBarber.get(barberId) ?? [];

    for (const dayKey of dayKeys) {
      const schemaDay = londonDayOfWeekFromIsoDate(dayKey);
      if (schemaDay == null) continue;
      const dayRules = rules.filter((rule) => rule.dayOfWeek === schemaDay);
      const workingIntervals: TimeInterval[] = [];

      for (const rule of dayRules) {
        const startAt = minutesFromRuleParts(dayKey, rule.startMinutes);
        const endAt = minutesFromRuleParts(dayKey, rule.endMinutes);
        let effectiveStart = startAt;
        const effectiveEnd = endAt;

        if (rule.breakStartMin != null && rule.breakEndMin != null && rule.breakEndMin > rule.breakStartMin) {
          const breakStart = minutesFromRuleParts(dayKey, rule.breakStartMin);
          const breakEnd = minutesFromRuleParts(dayKey, rule.breakEndMin);
          if (breakStart > effectiveStart) {
            workingIntervals.push({
              start: effectiveStart,
              end: breakStart < effectiveEnd ? breakStart : effectiveEnd,
            });
          }
          if (breakEnd < effectiveEnd) {
            effectiveStart = breakEnd > effectiveStart ? breakEnd : effectiveStart;
          } else {
            effectiveStart = effectiveEnd;
          }
        }
        if (effectiveEnd > effectiveStart) {
          workingIntervals.push({ start: effectiveStart, end: effectiveEnd });
        }
      }

      const mergedWorkingIntervals = mergeIntervals(
        workingIntervals
          .map((interval) => ({
            start: interval.start < range.from ? range.from : interval.start,
            end: interval.end > range.to ? range.to : interval.end,
          }))
          .filter((interval) => interval.end > interval.start),
      );

      const relevantBlocks = [...timeBlocks, ...timeOff]
        .filter((block) => block.barberId === null || block.barberId === barberId)
        .map((block) => ({
          start: block.startAt < range.from ? range.from : block.startAt,
          end: block.endAt > range.to ? range.to : block.endAt,
        }))
        .filter((block) => block.end > block.start);

      const mergedBlockedIntervals = mergeIntervals(relevantBlocks);

      for (const workingInterval of mergedWorkingIntervals) {
        const baseMinutes = minutesOfOverlap(range.from, range.to, workingInterval.start, workingInterval.end);
        if (baseMinutes <= 0) continue;

        let blockedMinutes = 0;
        for (const blockInterval of mergedBlockedIntervals) {
          blockedMinutes += minutesOfOverlap(
            workingInterval.start,
            workingInterval.end,
            blockInterval.start,
            blockInterval.end,
          );
        }
        availableMinutes += Math.max(0, baseMinutes - blockedMinutes);
      }
    }
  }

  return availableMinutes;
}

export function aggregateReportMetrics(input: {
  bookings: AggregatableBooking[];
  range: RangeBoundaries;
  rangeKey: ReportsRangeKey;
  nowMs?: number;
  activeBarberIds: string[];
  availability: AvailabilityRuleInput[];
  timeBlocks: BlockIntervalInput[];
  timeOff: BlockIntervalInput[];
}): AggregatedReportMetrics {
  const nowMs = input.nowMs ?? Date.now();
  const { bookings, range, rangeKey } = input;

  const revenueSeriesMap = new Map(
    getRevenueSeriesSeed(
      range,
      rangeKey,
      bookings.map((booking) => booking.startAt),
    ).map((point) => [point.label, point.value]),
  );

  let revenue = 0;
  let revenueCount = 0;
  let bookedMinutes = 0;
  const reportBookings: ReportBookingRow[] = [];
  const detailed: ReportBreakdown = {
    completed: 0,
    active: 0,
    cancelledByClient: 0,
    cancelledByShop: 0,
    expired: 0,
    noShow: 0,
  };
  const weekdayCounts = new Map<string, number>();
  const hourWindowCounts = new Map<number, number>();
  const barberCounts = new Map<string, { name: string; count: number }>();
  const serviceCounts = new Map<string, { name: string; count: number }>();

  for (const booking of bookings) {
    const statusClass = classifyBookingStatus(booking.status, booking.startAt, booking.endAt, nowMs);
    detailed[statusClass] += 1;

    const bookingValue = booking.valuePence / 100;
    const isPaidQualified = isBookingPaidQualified({
      status: booking.status,
      startAt: booking.startAt,
      endAt: booking.endAt,
      paymentStatus: booking.paymentStatus,
      nowMs,
    });

    reportBookings.push({
      id: booking.id,
      startAt: booking.startAt.toISOString(),
      barberId: booking.barberId,
      barberName: booking.barberName,
      serviceName: booking.serviceName,
      status: booking.status,
      clientName: booking.clientName,
      clientEmail: booking.clientEmail,
      computedValueGbp: isPaidQualified ? bookingValue : null,
    });

    if (isKeptForChairMetrics(statusClass)) {
      const durationFromTimes = minutesOfOverlap(range.from, range.to, booking.startAt, booking.endAt);
      bookedMinutes += durationFromTimes > 0 ? durationFromTimes : Math.max(0, booking.durationMinutes);

      const weekdayKey = formatInTimeZone(booking.startAt, ADMIN_REPORTS_TIMEZONE, 'EEEE');
      weekdayCounts.set(weekdayKey, (weekdayCounts.get(weekdayKey) ?? 0) + 1);

      const hour = Number.parseInt(formatInTimeZone(booking.startAt, ADMIN_REPORTS_TIMEZONE, 'H'), 10);
      const bucketStart = Math.floor(hour / 2) * 2;
      hourWindowCounts.set(bucketStart, (hourWindowCounts.get(bucketStart) ?? 0) + 1);

      const barberEntry = barberCounts.get(booking.barberId) ?? { name: booking.barberName, count: 0 };
      barberEntry.count += 1;
      barberCounts.set(booking.barberId, barberEntry);

      if (booking.serviceId) {
        const serviceEntry = serviceCounts.get(booking.serviceId) ?? { name: booking.serviceName, count: 0 };
        serviceEntry.count += 1;
        serviceCounts.set(booking.serviceId, serviceEntry);
      }
    }

    if (!isPaidQualified) continue;

    revenue += bookingValue;
    revenueCount += 1;
    const bucketLabel = getRevenueBucketLabel(booking.startAt, rangeKey, range);
    if (revenueSeriesMap.has(bucketLabel)) {
      revenueSeriesMap.set(bucketLabel, (revenueSeriesMap.get(bucketLabel) ?? 0) + bookingValue);
    } else {
      // Off-seed hour still counted in KPI; extend series so chart matches totals.
      revenueSeriesMap.set(bucketLabel, bookingValue);
    }
  }

  const bookingsCount = bookings.length;
  const breakdown = toLegacyBreakdown(detailed);
  const cancelledCount = breakdown.cancelledByClient + breakdown.cancelledByShop;
  const cancelledRate = bookingsCount > 0 ? (cancelledCount / bookingsCount) * 100 : 0;
  const noShowExpiredRate = bookingsCount > 0 ? (breakdown.noShowExpired / bookingsCount) * 100 : 0;

  let peakDay: string | null = null;
  let peakDayCount = 0;
  for (const [key, count] of weekdayCounts.entries()) {
    if (count > peakDayCount) {
      peakDay = key;
      peakDayCount = count;
    }
  }

  let peakHour: string | null = null;
  let peakHourCount = 0;
  for (const [startHour, count] of hourWindowCounts.entries()) {
    if (count > peakHourCount) {
      peakHourCount = count;
      peakHour = `${String(startHour).padStart(2, '0')}:00–${String((startHour + 2) % 24).padStart(2, '0')}:00`;
    }
  }

  const availableMinutes = computeAvailableMinutes({
    range,
    activeBarberIds: input.activeBarberIds,
    availability: input.availability,
    timeBlocks: input.timeBlocks,
    timeOff: input.timeOff,
  });
  const utilizationPct = availableMinutes > 0
    ? Math.min(100, Math.max(0, (bookedMinutes / availableMinutes) * 100))
    : null;

  const busiestBarber = [...barberCounts.entries()]
    .map(([id, entry]) => ({ id, ...entry }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))[0] ?? null;

  const mostPopularService = [...serviceCounts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))[0] ?? null;

  const revenueSeriesSeed = getRevenueSeriesSeed(
    range,
    rangeKey,
    bookings.map((booking) => booking.startAt),
  );
  // Ensure any late-added hour labels are ordered.
  const allLabels = [...new Set([...revenueSeriesSeed.map((p) => p.label), ...revenueSeriesMap.keys()])];
  if (getRevenueBucketMode(rangeKey, range) === 'hour') {
    allLabels.sort((a, b) => (parseHourLabel(a) ?? 0) - (parseHourLabel(b) ?? 0));
  } else {
    allLabels.sort();
  }

  const revenueSeriesRaw = allLabels.map((label) => ({
    label,
    value: revenueSeriesMap.get(label) ?? 0,
  }));
  const revenueSeries = getRevenueBucketMode(rangeKey, range) === 'hour'
    ? toCumulativeSeries(
      revenueSeriesRaw.map((point) => point.label),
      new Map(revenueSeriesRaw.map((point) => [point.label, point.value])),
    )
    : revenueSeriesRaw;

  return {
    bookingsCount,
    revenue,
    revenueCount,
    avgBookingValue: revenueCount > 0 ? revenue / revenueCount : 0,
    cancelledRate,
    noShowExpiredRate,
    breakdown,
    breakdownDetailed: detailed,
    peakDay,
    peakHour,
    bookedMinutes,
    availableMinutes,
    utilizationPct,
    revenueSeries,
    reportBookings,
    mostPopularService: mostPopularService
      ? { name: mostPopularService.name, count: mostPopularService.count }
      : null,
    busiestBarber: busiestBarber
      ? { name: busiestBarber.name, count: busiestBarber.count }
      : null,
  };
}
