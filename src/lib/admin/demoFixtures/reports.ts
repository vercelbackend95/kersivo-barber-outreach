import { addMilliseconds } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { customRangeDayCount, getStartOfMonthInLondon, type ReportsRangeKey } from '../reportsRange';
import { DEMO_BARBER_IDS } from './ids';

const TZ = 'Europe/London';

const DEMO_DAILY_REVENUE = [312, 288, 356, 402, 448, 512, 90];

function dayKeyDaysAgo(daysAgo: number): string {
  const anchor = fromZonedTime(
    `${formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd')}T12:00:00.000`,
    TZ,
  );
  return formatInTimeZone(addMilliseconds(anchor, -daysAgo * 24 * 60 * 60 * 1000), TZ, 'yyyy-MM-dd');
}

function startAtOnDayKey(dayKey: string, hour = 10): string {
  return fromZonedTime(`${dayKey}T${String(hour).padStart(2, '0')}:00:00.000`, TZ).toISOString();
}

function isoDaysAgo(days: number): string {
  return startAtOnDayKey(dayKeyDaysAgo(days));
}

function buildDemoRevenueSeries(dayCount: number) {
  return Array.from({ length: dayCount }, (_, index) => {
    const label = dayKeyDaysAgo(dayCount - 1 - index);
    return {
      label,
      value: DEMO_DAILY_REVENUE[index % DEMO_DAILY_REVENUE.length] ?? 300,
    };
  });
}

function resolveDemoDayCount(range: ReportsRangeKey, customFrom?: string, customTo?: string): number {
  if (range === 'custom' && customFrom && customTo) {
    return Math.max(1, Math.min(90, customRangeDayCount(customFrom, customTo)));
  }
  if (range === '1d') return 1;
  if (range === '1y') return 90;
  if (range === '90d') return 90;
  if (range === '30d') return 30;
  if (range === 'month') {
    const monthStart = getStartOfMonthInLondon(new Date(), TZ);
    const todayKey = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
    const monthStartKey = formatInTimeZone(monthStart, TZ, 'yyyy-MM-dd');
    return Math.max(1, customRangeDayCount(monthStartKey, todayKey));
  }
  return 7;
}

function reportBooking(
  id: string,
  startAt: string,
  barberId: string,
  barberName: string,
  serviceName: string,
  clientName: string,
  clientEmail: string,
  valueGbp: number,
) {
  return {
    id,
    startAt,
    barberId,
    barberName,
    serviceName,
    status: 'COMPLETED',
    clientName,
    clientEmail,
    computedValueGbp: valueGbp,
  };
}

export function getDemoReportsResponse(range: ReportsRangeKey, customFrom?: string, customTo?: string) {
  const now = new Date();
  const dayCount = resolveDemoDayCount(range, customFrom, customTo);
  const revenueSeries = buildDemoRevenueSeries(dayCount);
  const from = range === 'custom' && customFrom
    ? startAtOnDayKey(customFrom, 0)
    : startAtOnDayKey(revenueSeries[0]?.label ?? dayKeyDaysAgo(dayCount - 1), 0);
  const to = range === 'custom' && customTo
    ? startAtOnDayKey(customTo, 23)
    : now.toISOString();
  const jamieDay = revenueSeries[revenueSeries.length - 1]?.label ?? dayKeyDaysAgo(1);
  const alexDay = revenueSeries[revenueSeries.length - 2]?.label ?? dayKeyDaysAgo(2);
  const jamieEarlierDay = revenueSeries[revenueSeries.length - 3]?.label ?? dayKeyDaysAgo(3);
  const previousSpan = range === '30d' || range === '90d' ? dayCount : range === 'month' ? dayCount : 7;

  return {
    range,
    rangeBoundaries: { from, to, tz: TZ },
    previousRangeBoundaries: {
      from: isoDaysAgo(previousSpan * 2 - 1),
      to: isoDaysAgo(previousSpan),
      tz: TZ,
    },
    bookingsCount: 86,
    cancelledRate: 0.08,
    noShowExpiredRate: 0.04,
    revenue: 2408,
    avgBookingValue: 28,
    revenueCount: 82,
    usedDemoPricing: true,
    breakdown: {
      completed: 78,
      cancelledByClient: 5,
      cancelledByShop: 2,
      noShowExpired: 1,
    },
    peakDay: formatInTimeZone(now, TZ, 'EEE'),
    peakHour: '14:00',
    bookedMinutes: 3840,
    availableMinutes: 5040,
    utilizationPct: 76.2,
    revenueSeries,
    trends: {
      bookingsPct: 12.5,
      cancelledRatePp: -1.2,
      revenuePct: 8.4,
      revenueDelta: 186,
      avgBookingValueDelta: 1.5,
      noShowExpiredCountDelta: -1,
      noShowExpiredRatePp: -0.5,
      utilizationPp: 3.1,
    },
    recentBarbers: [
      { id: DEMO_BARBER_IDS.jamie, name: 'Jamie Reed', avatarUrl: null },
      { id: DEMO_BARBER_IDS.alex, name: 'Alex Morgan', avatarUrl: null },
      { id: DEMO_BARBER_IDS.sam, name: 'Sam Brooks', avatarUrl: null },
    ],
    selectedBarber: null,
    previousMetrics: {
      bookingsCount: 76,
      cancelledRate: 0.092,
      revenue: 2222,
      avgBookingValue: 26.5,
      utilizationPct: 73.1,
      noShowExpiredCount: 2,
      noShowExpiredRate: 0.045,
    },
    mostPopularService: { name: 'Skin Fade', count: 34 },
    busiestBarber: { name: 'Jamie Reed', count: 38 },
    reportBookings: [
      reportBooking('demo-rpt-01', startAtOnDayKey(jamieDay, 11), DEMO_BARBER_IDS.jamie, 'Jamie Reed', 'Skin Fade', 'Oliver Reed', 'oliver.reed@example.com', 28),
      reportBooking('demo-rpt-02', startAtOnDayKey(alexDay, 12), DEMO_BARBER_IDS.alex, 'Alex Morgan', 'Classic Cut', 'Amelia Clarke', 'amelia.clarke@example.com', 24),
      reportBooking('demo-rpt-03', startAtOnDayKey(jamieEarlierDay, 9), DEMO_BARBER_IDS.jamie, 'Jamie Reed', 'Beard Trim', 'Noah Bennett', 'noah.bennett@example.com', 15),
    ],
  };
}
