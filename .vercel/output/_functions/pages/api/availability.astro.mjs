import { BookingStatus } from '@prisma/client';
import { p as prisma } from '../../chunks/client_C4jvTHHS.mjs';
import { g as getTimeBlockDelegate } from '../../chunks/timeBlocks_6d7g-gTW.mjs';
import { l as londonDayOfWeekFromIsoDate, t as toUtcFromLondon, a as addMinutes, b as londonDateKey, m as minutesInLondonDay, n as normalizeToIsoDate } from '../../chunks/time_Bf5AYUQW.mjs';
import { e as expirePendingBookings } from '../../chunks/service_B7J0v9Yf.mjs';
export { renderers } from '../../renderers.mjs';

function hasOverlap(a, b) {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}
function hasAnyOverlap(target, intervals) {
  return intervals.some((item) => hasOverlap(target, item));
}

function generateSlots(input) {
  const weekday = londonDayOfWeekFromIsoDate(input.date);
  if (weekday == null || weekday === 0) return [];
  const rule = input.rules.find((entry) => entry.dayOfWeek === weekday && entry.active);
  if (!rule) return [];
  const buffer = input.service.bufferMinutes || input.settings.defaultBufferMinutes;
  const totalDuration = input.service.durationMinutes + buffer;
  const out = [];
  for (let minute = rule.startMinutes; minute + totalDuration <= rule.endMinutes; minute += input.settings.slotIntervalMinutes) {
    if (rule.breakStartMin != null && rule.breakEndMin != null) {
      const inBreak = minute < rule.breakEndMin && minute + totalDuration > rule.breakStartMin;
      if (inBreak) continue;
    }
    const startAt = toUtcFromLondon(input.date, minute);
    const endAt = addMinutes(startAt, totalDuration);
    const sameDate = londonDateKey(startAt) === input.date && londonDateKey(endAt) === input.date;
    if (!sameDate) continue;
    const collidesBooking = hasAnyOverlap({ startAt, endAt }, input.confirmedBookings.map((b) => ({ startAt: b.startAt, endAt: b.endAt })));
    if (collidesBooking) continue;
    const collidesTimeOff = hasAnyOverlap({ startAt, endAt }, input.timeOff.map((b) => ({ startAt: b.startsAt, endAt: b.endsAt })));
    if (collidesTimeOff) continue;
    const collidesTimeBlock = hasAnyOverlap({ startAt, endAt }, input.timeBlocks.map((b) => ({ startAt: b.startAt, endAt: b.endAt })));
    if (collidesTimeBlock) continue;
    const hh = String(Math.floor(minutesInLondonDay(startAt) / 60)).padStart(2, "0");
    const mm = String(minutesInLondonDay(startAt) % 60).padStart(2, "0");
    out.push(`${hh}:${mm}`);
  }
  return out;
}

const prerender = false;
const GET = async ({ request }) => {
  const searchParams = new URL(request.url).searchParams;
  Object.fromEntries(searchParams.entries());
  const serviceId = searchParams.get("serviceId") ?? searchParams.get("service_id") ?? searchParams.get("service");
  const barberId = searchParams.get("barberId") ?? searchParams.get("barber_id") ?? searchParams.get("barber");
  const rawDate = searchParams.get("date");
  if (!barberId || !serviceId || !rawDate) {
    return new Response(JSON.stringify({ error: "Missing required params. Expected serviceId, barberId, and date." }), { status: 400 });
  }
  const date = normalizeToIsoDate(rawDate);
  if (!date) {
    return new Response(JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD or DD/MM/YYYY." }), { status: 400 });
  }
  const dayOfWeek = londonDayOfWeekFromIsoDate(date);
  if (dayOfWeek == null) {
    return new Response(JSON.stringify({ error: "Invalid date value." }), { status: 400 });
  }
  const dayStartUtc = toUtcFromLondon(date, 0);
  const dayEndUtc = addMinutes(dayStartUtc, 24 * 60);
  await expirePendingBookings();
  const settings = await prisma.shopSettings.findFirstOrThrow();
  const timeBlockDelegate = getTimeBlockDelegate();
  const [service, rules, bookings, timeOff, timeBlocks] = await Promise.all([
    prisma.service.findUniqueOrThrow({ where: { id: serviceId } }),
    prisma.availabilityRule.findMany({ where: { barberId, active: true, dayOfWeek } }),
    prisma.booking.findMany({ where: { barberId, status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_CONFIRMATION] } }, select: { startAt: true, endAt: true } }),
    prisma.barberTimeOff.findMany({ where: { barberId }, select: { startsAt: true, endsAt: true } }),
    timeBlockDelegate ? timeBlockDelegate.findMany({
      where: {
        shopId: settings.id,
        OR: [{ barberId }, { barberId: null }],
        startAt: { lt: dayEndUtc },
        endAt: { gt: dayStartUtc }
      },
      select: { startAt: true, endAt: true }
    }) : Promise.resolve([])
  ]);
  const slots = generateSlots({ date, service, rules, confirmedBookings: bookings, timeOff, timeBlocks, settings });
  return new Response(JSON.stringify({ slots }));
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
