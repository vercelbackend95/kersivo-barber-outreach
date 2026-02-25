import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { r as requireAdmin } from '../../../chunks/auth_gRvu2ZyE.mjs';
import { p as prisma } from '../../../chunks/client_C4jvTHHS.mjs';
export { renderers } from '../../../renderers.mjs';

const ADMIN_TIMEZONE = "Europe/London";
function getTodayRangeInLondon() {
  const todayInLondon = formatInTimeZone(/* @__PURE__ */ new Date(), ADMIN_TIMEZONE, "yyyy-MM-dd");
  return {
    gte: fromZonedTime(`${todayInLondon}T00:00:00.000`, ADMIN_TIMEZONE),
    lt: fromZonedTime(`${todayInLondon}T23:59:59.999`, ADMIN_TIMEZONE)
  };
}
function getLondonDayRange(date) {
  return {
    gte: fromZonedTime(`${date}T00:00:00.000`, ADMIN_TIMEZONE),
    lte: fromZonedTime(`${date}T23:59:59.999`, ADMIN_TIMEZONE)
  };
}
function getHistoryPresetRange(preset) {
  const todayInLondon = formatInTimeZone(/* @__PURE__ */ new Date(), ADMIN_TIMEZONE, "yyyy-MM-dd");
  const todayStart = fromZonedTime(`${todayInLondon}T00:00:00.000`, ADMIN_TIMEZONE);
  if (preset === "last30") {
    return {
      from: formatInTimeZone(new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1e3), ADMIN_TIMEZONE, "yyyy-MM-dd"),
      to: todayInLondon
    };
  }
  if (preset === "overall") return { from: null, to: null };
  return {
    from: formatInTimeZone(new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1e3), ADMIN_TIMEZONE, "yyyy-MM-dd"),
    to: todayInLondon
  };
}
const GET = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const view = ctx.url.searchParams.get("view");
  if (view === "history") {
    const barberId = ctx.url.searchParams.get("barberId");
    const preset = ctx.url.searchParams.get("preset");
    const from = ctx.url.searchParams.get("from");
    const to = ctx.url.searchParams.get("to");
    const limit = Math.min(Math.max(Number(ctx.url.searchParams.get("limit") || "50"), 1), 100);
    const cursor = ctx.url.searchParams.get("cursor");
    const [cursorStartAt, cursorId] = cursor ? cursor.split("|") : [null, null];
    const fallbackRange = getHistoryPresetRange(preset);
    const effectiveFrom = from ?? fallbackRange.from;
    const effectiveTo = to ?? fallbackRange.to;
    const startAtFilter = effectiveFrom && effectiveTo ? { ...getLondonDayRange(effectiveFrom), ...{ lte: getLondonDayRange(effectiveTo).lte } } : void 0;
    const bookings2 = await prisma.booking.findMany({
      where: {
        barberId: barberId && barberId !== "all" ? barberId : void 0,
        startAt: startAtFilter,
        ...cursorStartAt && cursorId ? {
          OR: [
            { startAt: { lt: new Date(cursorStartAt) } },
            { startAt: new Date(cursorStartAt), id: { lt: cursorId } }
          ]
        } : {}
      },
      include: { barber: true, service: true },
      orderBy: [{ startAt: "desc" }, { id: "desc" }],
      take: limit + 1
    });
    const hasMore = bookings2.length > limit;
    const page = hasMore ? bookings2.slice(0, limit) : bookings2;
    const nextCursor = hasMore ? `${page[page.length - 1]?.startAt.toISOString() ?? ""}|${page[page.length - 1]?.id ?? ""}` : null;
    return new Response(JSON.stringify({ bookings: page, hasMore, cursor: nextCursor }));
  }
  const q = ctx.url.searchParams.get("q");
  const status = ctx.url.searchParams.get("status");
  const date = ctx.url.searchParams.get("date");
  const range = ctx.url.searchParams.get("range");
  const startAtRange = range === "today" ? getTodayRangeInLondon() : date ? { gte: /* @__PURE__ */ new Date(`${date}T00:00:00.000Z`), lt: /* @__PURE__ */ new Date(`${date}T23:59:59.999Z`) } : void 0;
  const bookings = await prisma.booking.findMany({
    where: {
      status: status || void 0,
      OR: q ? [{ fullName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] : void 0,
      startAt: startAtRange
    },
    include: { barber: true, service: true },
    orderBy: { startAt: "asc" }
  });
  return new Response(JSON.stringify({ bookings }));
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
