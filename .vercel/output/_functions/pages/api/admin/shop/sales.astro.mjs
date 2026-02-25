import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { r as requireAdmin } from '../../../../chunks/auth_gRvu2ZyE.mjs';
import { p as prisma } from '../../../../chunks/client_C4jvTHHS.mjs';
import { r as resolveShopId } from '../../../../chunks/shopScope_BH7VvEiX.mjs';
export { renderers } from '../../../../renderers.mjs';

const LONDON_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
function toLondonDateBucket(date) {
  return LONDON_DAY_FORMATTER.format(date);
}

const prerender = false;
const TZ = "Europe/London";
const PAID_STATUSES = ["PAID", "COLLECTED"];
const DEFAULT_RANGE_DAYS = 30;
function toYmd(date) {
  return formatInTimeZone(date, TZ, "yyyy-MM-dd");
}
function parseYmd(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (utcDate.getUTCFullYear() !== year || utcDate.getUTCMonth() + 1 !== month || utcDate.getUTCDate() !== day) {
    return null;
  }
  return utcDate;
}
function dayRangeUtc(ymd) {
  const start = fromZonedTime(`${ymd}T00:00:00`, TZ);
  const nextStart = fromZonedTime(`${ymd}T00:00:00`, TZ);
  nextStart.setUTCDate(nextStart.getUTCDate() + 1);
  return { start, nextStart };
}
function listDays(from, to) {
  const start = parseYmd(from);
  const end = parseYmd(to);
  if (!start || !end) return [];
  const output = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    output.push(toYmd(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return output;
}
function getDateRange(searchParams) {
  const todayYmd = toYmd(/* @__PURE__ */ new Date());
  const todayDate = parseYmd(todayYmd);
  if (!todayDate) {
    throw new Error("Could not determine current date.");
  }
  const defaultFromDate = new Date(todayDate);
  defaultFromDate.setUTCDate(defaultFromDate.getUTCDate() - (DEFAULT_RANGE_DAYS - 1));
  const rawFrom = searchParams.get("from")?.trim();
  const rawTo = searchParams.get("to")?.trim();
  const fromDate = rawFrom ? parseYmd(rawFrom) : defaultFromDate;
  const toDate = rawTo ? parseYmd(rawTo) : todayDate;
  if (!fromDate || !toDate) {
    throw new Error("Invalid date range. Use YYYY-MM-DD for from/to.");
  }
  if (fromDate > toDate) {
    throw new Error('Invalid date range. "from" must be less than or equal to "to".');
  }
  return {
    from: toYmd(fromDate),
    to: toYmd(toDate)
  };
}
function parseProductIds(searchParams) {
  const direct = searchParams.getAll("productIds").flatMap((chunk) => chunk.split(","));
  const legacy = (searchParams.get("productId") ?? "").split(",");
  const values = [...direct, ...legacy].map((value) => value.trim()).filter(Boolean);
  return Array.from(new Set(values));
}
async function buildSalesResponse(shopId, fromYmd, toYmd2, productIds, includeOverall) {
  const dayBuckets = listDays(fromYmd, toYmd2);
  const { start: fromUtc } = dayRangeUtc(fromYmd);
  const { nextStart: toExclusiveUtc } = dayRangeUtc(toYmd2);
  const orders = await prisma.order.findMany({
    where: {
      shopId,
      status: { in: [...PAID_STATUSES] },
      paidAt: {
        gte: fromUtc,
        lt: toExclusiveUtc
      }
    },
    orderBy: { paidAt: "asc" },
    select: {
      id: true,
      paidAt: true,
      items: {
        select: {
          productId: true,
          nameSnapshot: true,
          quantity: true,
          lineTotalPence: true
        }
      }
    }
  });
  const selectedSet = productIds.length > 0 ? new Set(productIds) : null;
  const overallByDay = /* @__PURE__ */ new Map();
  const productDayMap = /* @__PURE__ */ new Map();
  const leaderboardMap = /* @__PURE__ */ new Map();
  let ordersCount = 0;
  let revenuePence = 0;
  for (const order of orders) {
    if (!order.paidAt) continue;
    const filteredItems = selectedSet ? order.items.filter((item) => selectedSet.has(item.productId)) : order.items;
    if (filteredItems.length === 0) continue;
    ordersCount += 1;
    const day = toLondonDateBucket(order.paidAt);
    for (const item of filteredItems) {
      revenuePence += item.lineTotalPence;
      overallByDay.set(day, (overallByDay.get(day) ?? 0) + item.lineTotalPence);
      const productBuckets = productDayMap.get(item.productId) ?? /* @__PURE__ */ new Map();
      const existingDay = productBuckets.get(day) ?? { revenuePence: 0, units: 0 };
      existingDay.revenuePence += item.lineTotalPence;
      existingDay.units += item.quantity;
      productBuckets.set(day, existingDay);
      productDayMap.set(item.productId, productBuckets);
      const leaderboardRow = leaderboardMap.get(item.productId) ?? {
        productId: item.productId,
        name: item.nameSnapshot,
        units: 0,
        revenuePence: 0
      };
      leaderboardRow.units += item.quantity;
      leaderboardRow.revenuePence += item.lineTotalPence;
      leaderboardMap.set(item.productId, leaderboardRow);
    }
  }
  const leaderboard = Array.from(leaderboardMap.values()).sort((a, b) => {
    if (b.revenuePence !== a.revenuePence) return b.revenuePence - a.revenuePence;
    if (b.units !== a.units) return b.units - a.units;
    return a.name.localeCompare(b.name);
  });
  const overall = includeOverall ? dayBuckets.map((date) => ({ date, revenuePence: overallByDay.get(date) ?? 0 })) : void 0;
  const products = Array.from(productDayMap.entries()).map(([productId, pointsByDate]) => {
    const row = leaderboardMap.get(productId);
    return {
      productId,
      name: row?.name ?? "Unknown product",
      points: dayBuckets.map((date) => {
        const value = pointsByDate.get(date) ?? { revenuePence: 0, units: 0 };
        return { date, revenuePence: value.revenuePence, units: value.units };
      })
    };
  }).sort((a, b) => {
    const left = leaderboardMap.get(a.productId)?.revenuePence ?? 0;
    const right = leaderboardMap.get(b.productId)?.revenuePence ?? 0;
    return right - left;
  });
  const bestProduct = leaderboard[0] ? {
    productId: leaderboard[0].productId,
    name: leaderboard[0].name,
    revenuePence: leaderboard[0].revenuePence,
    units: leaderboard[0].units
  } : void 0;
  const responsePayload = {
    range: {
      from: fromYmd,
      to: toYmd2,
      tz: TZ
    },
    kpis: {
      revenuePence,
      ordersCount,
      avgOrderValuePence: ordersCount > 0 ? Math.round(revenuePence / ordersCount) : 0,
      bestProduct
    },
    series: {
      overall,
      products
    },
    leaderboard
  };
  return new Response(JSON.stringify(responsePayload), { status: 200 });
}
const GET = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  try {
    const shopId = await resolveShopId();
    const range = getDateRange(ctx.url.searchParams);
    const productIds = parseProductIds(ctx.url.searchParams);
    const includeOverall = ctx.url.searchParams.get("includeOverall") !== "false";
    return await buildSalesResponse(shopId, range.from, range.to, productIds, includeOverall);
  } catch (error) {
    console.error("Failed to load sales analytics", error);
    const message = error instanceof Error ? error.message : "Could not load sales analytics.";
    const details = error instanceof Error && error.stack ? error.stack : void 0;
    return new Response(JSON.stringify({ error: message, details }), { status: 400 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
