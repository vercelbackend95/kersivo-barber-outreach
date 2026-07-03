import { formatInTimeZone } from 'date-fns-tz';
import { DEMO_BARBER_IDS, DEMO_CLIENT_IDS, DEMO_SERVICE_IDS } from './ids';

const TZ = 'Europe/London';

function todayAt(hour: number, minute: number): string {
  const dateKey = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${dateKey}T${hh}:${mm}:00`).toISOString();
}

function booking(
  id: string,
  fullName: string,
  email: string,
  barberId: string,
  barberName: string,
  serviceId: string,
  serviceName: string,
  startHour: number,
  startMin: number,
  durationMin: number,
  status: string,
  pricePence: number,
) {
  const startAt = todayAt(startHour, startMin);
  const end = new Date(startAt);
  end.setMinutes(end.getMinutes() + durationMin);
  return {
    id,
    serviceId,
    barberId,
    fullName,
    email,
    phone: null,
    clientId: null,
    startAt,
    endAt: end.toISOString(),
    status,
    notes: null,
    rescheduledAt: null,
    paymentRequired: false,
    depositAmountPence: null,
    paymentStatus: 'NOT_REQUIRED',
    totalPricePence: pricePence,
    serviceNameAtBooking: serviceName,
    servicePricePenceAtBooking: pricePence,
    barber: { name: barberName },
    service: { name: serviceName },
    clientTags: [],
  };
}

export function getDemoBookingsResponse() {
  return {
    bookings: [
      booking('demo-booking-01', 'Oliver Reed', 'oliver.reed@example.com', DEMO_BARBER_IDS.jamie, 'Jamie Reed', DEMO_SERVICE_IDS.skinFade, 'Skin Fade', 9, 0, 45, 'BOOKED', 2800),
      booking('demo-booking-02', 'Amelia Clarke', 'amelia.clarke@example.com', DEMO_BARBER_IDS.jamie, 'Jamie Reed', DEMO_SERVICE_IDS.classicCut, 'Classic Cut', 10, 0, 40, 'BOOKED', 2400),
      booking('demo-booking-03', 'Noah Bennett', 'noah.bennett@example.com', DEMO_BARBER_IDS.alex, 'Alex Morgan', DEMO_SERVICE_IDS.skinFade, 'Skin Fade', 11, 30, 45, 'BOOKED', 2800),
      booking('demo-booking-04', 'Isla Morgan', 'isla.morgan@example.com', DEMO_BARBER_IDS.alex, 'Alex Morgan', DEMO_SERVICE_IDS.beardTrim, 'Beard Trim', 13, 0, 20, 'BOOKED', 1500),
      booking('demo-booking-05', 'Leo Carter', 'leo.carter@example.com', DEMO_BARBER_IDS.jamie, 'Jamie Reed', DEMO_SERVICE_IDS.skinFade, 'Skin Fade', 14, 30, 45, 'BOOKED', 2800),
      booking('demo-booking-06', 'Maya Brooks', 'maya.brooks@example.com', DEMO_BARBER_IDS.alex, 'Alex Morgan', DEMO_SERVICE_IDS.classicCut, 'Classic Cut', 15, 30, 40, 'BOOKED', 2400),
      booking('demo-booking-07', 'Theo Hughes', 'theo.hughes@example.com', DEMO_BARBER_IDS.jamie, 'Jamie Reed', DEMO_SERVICE_IDS.beardTrim, 'Beard Trim', 16, 15, 20, 'BOOKED', 1500),
      booking('demo-booking-08', 'Grace Turner', 'grace.turner@example.com', DEMO_BARBER_IDS.alex, 'Alex Morgan', DEMO_SERVICE_IDS.skinFade, 'Skin Fade', 17, 0, 45, 'BOOKED', 2800),
    ],
  };
}

export const demoTimeblocksResponse = {
  timeBlocks: [],
};

export function getDemoBookingsHistoryResponse() {
  const bookings = getDemoBookingsResponse().bookings.map((b) => ({
    ...b,
    startAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  }));
  return {
    bookings,
    hasMore: false,
    cursor: null,
  };
}
