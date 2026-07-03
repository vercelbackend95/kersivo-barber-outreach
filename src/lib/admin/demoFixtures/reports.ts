import { formatInTimeZone } from 'date-fns-tz';
import { DEMO_BARBER_IDS } from './ids';

const TZ = 'Europe/London';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
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

export function getDemoReportsResponse(range: 'week' | '7d' | '30d') {
  const now = new Date();
  const from = isoDaysAgo(range === 'week' ? 6 : range === '7d' ? 6 : 29);
  const to = now.toISOString();

  return {
    range,
    rangeBoundaries: { from, to, tz: TZ },
    previousRangeBoundaries: {
      from: isoDaysAgo(range === '30d' ? 59 : 13),
      to: isoDaysAgo(range === '30d' ? 30 : 7),
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
    revenueSeries: [
      { label: 'Mon', value: 312 },
      { label: 'Tue', value: 288 },
      { label: 'Wed', value: 356 },
      { label: 'Thu', value: 402 },
      { label: 'Fri', value: 448 },
      { label: 'Sat', value: 512 },
      { label: 'Sun', value: 90 },
    ],
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
      reportBooking('demo-rpt-01', isoDaysAgo(1), DEMO_BARBER_IDS.jamie, 'Jamie Reed', 'Skin Fade', 'Oliver Reed', 'oliver.reed@example.com', 28),
      reportBooking('demo-rpt-02', isoDaysAgo(2), DEMO_BARBER_IDS.alex, 'Alex Morgan', 'Classic Cut', 'Amelia Clarke', 'amelia.clarke@example.com', 24),
      reportBooking('demo-rpt-03', isoDaysAgo(3), DEMO_BARBER_IDS.jamie, 'Jamie Reed', 'Beard Trim', 'Noah Bennett', 'noah.bennett@example.com', 15),
    ],
  };
}
