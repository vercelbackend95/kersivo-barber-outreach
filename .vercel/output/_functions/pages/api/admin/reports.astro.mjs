import { BookingStatus } from '@prisma/client';
import { toZonedTime, formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { r as requireAdmin } from '../../../chunks/auth_gRvu2ZyE.mjs';
import { p as prisma } from '../../../chunks/client_C4jvTHHS.mjs';
export { renderers } from '../../../renderers.mjs';

const prerender = false;
const ADMIN_TIMEZONE = "Europe/London";
function getWeekRangeInLondon() {
  const now = /* @__PURE__ */ new Date();
  const londonNow = toZonedTime(now, ADMIN_TIMEZONE);
  const day = londonNow.getDay();
  const diffToMonday = (day + 6) % 7;
  const mondayDate = new Date(londonNow);
  mondayDate.setDate(londonNow.getDate() - diffToMonday);
  const sundayDate = new Date(mondayDate);
  sundayDate.setDate(mondayDate.getDate() + 6);
  const mondayKey = formatInTimeZone(mondayDate, ADMIN_TIMEZONE, "yyyy-MM-dd");
  const sundayKey = formatInTimeZone(sundayDate, ADMIN_TIMEZONE, "yyyy-MM-dd");
  return {
    from: fromZonedTime(`${mondayKey}T00:00:00.000`, ADMIN_TIMEZONE),
    to: fromZonedTime(`${sundayKey}T23:59:59.999`, ADMIN_TIMEZONE)
  };
}
const GET = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const range = ctx.url.searchParams.get("range");
  if (range !== "week") {
    return new Response(JSON.stringify({ error: "Only range=week is supported." }), { status: 400 });
  }
  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });
  const weekRange = getWeekRangeInLondon();
  const bookingRangeWhere = {
    startAt: { gte: weekRange.from, lte: weekRange.to },
    client: { shopId: shop.id }
  };
  const [totalScheduled, cancelledCount, mostPopularServiceRaw, busiestBarberRaw] = await Promise.all([
    prisma.booking.count({
      where: {
        ...bookingRangeWhere,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_CONFIRMATION] }
      }
    }),
    prisma.booking.count({
      where: {
        ...bookingRangeWhere,
        status: { in: [BookingStatus.CANCELLED_BY_CLIENT, BookingStatus.CANCELLED_BY_SHOP] }
      }
    }),
    prisma.booking.groupBy({
      by: ["serviceId"],
      where: {
        ...bookingRangeWhere,
        status: BookingStatus.CONFIRMED
      },
      _count: { serviceId: true },
      orderBy: { _count: { serviceId: "desc" } },
      take: 1
    }),
    prisma.booking.groupBy({
      by: ["barberId"],
      where: {
        ...bookingRangeWhere,
        status: BookingStatus.CONFIRMED
      },
      _count: { barberId: true },
      orderBy: { _count: { barberId: "desc" } },
      take: 1
    })
  ]);
  const mostPopularServiceTop = mostPopularServiceRaw[0];
  const busiestBarberTop = busiestBarberRaw[0];
  const [mostPopularServiceEntity, busiestBarberEntity] = await Promise.all([
    mostPopularServiceTop ? prisma.service.findUnique({ where: { id: mostPopularServiceTop.serviceId }, select: { name: true } }) : Promise.resolve(null),
    busiestBarberTop ? prisma.barber.findUnique({ where: { id: busiestBarberTop.barberId }, select: { name: true } }) : Promise.resolve(null)
  ]);
  const denominator = totalScheduled + cancelledCount;
  const cancelledRate = denominator > 0 ? cancelledCount / denominator * 100 : 0;
  return new Response(JSON.stringify({
    range: {
      from: weekRange.from.toISOString(),
      to: weekRange.to.toISOString(),
      tz: ADMIN_TIMEZONE
    },
    bookingsThisWeek: totalScheduled,
    cancelledRate,
    mostPopularService: mostPopularServiceTop && mostPopularServiceEntity ? { name: mostPopularServiceEntity.name, count: mostPopularServiceTop._count.serviceId } : null,
    busiestBarber: busiestBarberTop && busiestBarberEntity ? { name: busiestBarberEntity.name, count: busiestBarberTop._count.barberId } : null
  }));
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
