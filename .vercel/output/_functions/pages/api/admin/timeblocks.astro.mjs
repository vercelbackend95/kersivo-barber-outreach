import { formatInTimeZone } from 'date-fns-tz';
import { r as requireAdmin } from '../../../chunks/auth_gRvu2ZyE.mjs';
import { p as prisma } from '../../../chunks/client_C4jvTHHS.mjs';
import { g as getTimeBlockDelegate } from '../../../chunks/timeBlocks_6d7g-gTW.mjs';
import { t as toUtcFromLondon, a as addMinutes } from '../../../chunks/time_Bf5AYUQW.mjs';
export { renderers } from '../../../renderers.mjs';

const prerender = false;
const ADMIN_TIMEZONE = "Europe/London";
const GET = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const range = new URL(ctx.request.url).searchParams.get("range") ?? "today";
  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });
  const now = /* @__PURE__ */ new Date();
  const todayIso = formatInTimeZone(now, ADMIN_TIMEZONE, "yyyy-MM-dd");
  const todayStart = toUtcFromLondon(todayIso, 0);
  const tomorrowStart = addMinutes(todayStart, 24 * 60);
  const where = range === "upcoming" ? { shopId: shop.id, endAt: { gte: now } } : { shopId: shop.id, startAt: { lt: tomorrowStart }, endAt: { gt: todayStart } };
  const timeBlockDelegate = getTimeBlockDelegate();
  if (!timeBlockDelegate) {
    return new Response(JSON.stringify({ timeBlocks: [] }));
  }
  const timeBlocks = await timeBlockDelegate.findMany({
    where,
    orderBy: { startAt: "asc" },
    include: { barber: { select: { id: true, name: true } } }
  });
  return new Response(JSON.stringify({ timeBlocks }));
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
