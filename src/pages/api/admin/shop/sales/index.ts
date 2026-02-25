// src/pages/api/admin/shop/sales/index.ts
export const prerender = false;

import type { APIRoute } from 'astro';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';
import { resolveShopId } from '../../../../../lib/db/shopScope';
import { toLondonDateBucket } from '../../../../../lib/time/londonDateBucket';

const TZ = 'Europe/London';
const PAID_STATUSES = ['PAID', 'COLLECTED'] as const;
const DEFAULT_RANGE_DAYS = 30;

type SalesDatePoint = { date: string; revenuePence: number; units?: number };

type SalesLeaderboardRow = {
  productId: string;
  name: string;
  units: number;
  revenuePence: number;
};

function toYmd(date: Date): string {
  return formatInTimeZone(date, TZ, 'yyyy-MM-dd');
}

function parseYmd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() + 1 !== month ||
    utcDate.getUTCDate() !== day
  ) {
    return null;
  }

  return utcDate;
}

function dayRangeUtc(ymd: string): { start: Date; nextStart: Date } {
  const start = fromZonedTime(`${ymd}T00:00:00`, TZ);
  const nextStart = fromZonedTime(`${ymd}T00:00:00`, TZ);
  nextStart.setUTCDate(nextStart.getUTCDate() + 1);
  return { start, nextStart };
}

function listDays(from: string, to: string): string[] {
  const start = parseYmd(from);
  const end = parseYmd(to);
  if (!start || !end) return [];

  const output: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    output.push(toYmd(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return output;
}

function getDateRange(searchParams: URLSearchParams): { from: string; to: string } {
  const todayYmd = toYmd(new Date());
  const todayDate = parseYmd(todayYmd);
  if (!todayDate) {
    throw new Error('Could not determine current date.');
  }

  const defaultFromDate = new Date(todayDate);
  defaultFromDate.setUTCDate(defaultFromDate.getUTCDate() - (DEFAULT_RANGE_DAYS - 1));

  const rawFrom = searchParams.get('from')?.trim();
  const rawTo = searchParams.get('to')?.trim();

  const fromDate = rawFrom ? parseYmd(rawFrom) : defaultFromDate;
  const toDate = rawTo ? parseYmd(rawTo) : todayDate;

  if (!fromDate || !toDate) {
    throw new Error('Invalid date range. Use YYYY-MM-DD for from/to.');
  }
  if (fromDate > toDate) {
    throw new Error('Invalid date range. "from" must be less than or equal to "to".');
  }

  return {
    from: toYmd(fromDate),
    to: toYmd(toDate)
  };
}

function parseProductIds(searchParams: URLSearchParams): string[] {
  const direct = searchParams.getAll('productIds').flatMap((chunk) => chunk.split(','));
  const legacy = (searchParams.get('productId') ?? '').split(',');
  const values = [...direct, ...legacy]
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(values));
}

async function buildSalesResponse(
  shopId: string,
  fromYmd: string,
  toYmd: string,
  productIds: string[],
  includeOverall: boolean
): Promise<Response> {
  const dayBuckets = listDays(fromYmd, toYmd);
  const { start: fromUtc } = dayRangeUtc(fromYmd);
  const { nextStart: toExclusiveUtc } = dayRangeUtc(toYmd);

  const orders = await prisma.order.findMany({
    where: {
      shopId,
      status: { in: [...PAID_STATUSES] },
      paidAt: {
        gte: fromUtc,
        lt: toExclusiveUtc
      }
    },
    orderBy: { paidAt: 'asc' },
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
  const overallByDay = new Map<string, number>();
  const productDayMap = new Map<string, Map<string, { revenuePence: number; units: number }>>();
  const leaderboardMap = new Map<string, SalesLeaderboardRow>();

  let ordersCount = 0;
  let revenuePence = 0;

  for (const order of orders) {
    if (!order.paidAt) continue;

    const filteredItems = selectedSet
      ? order.items.filter((item) => selectedSet.has(item.productId))
      : order.items;

    if (filteredItems.length === 0) continue;

    ordersCount += 1;
    const day = toLondonDateBucket(order.paidAt);

    for (const item of filteredItems) {
      revenuePence += item.lineTotalPence;
      overallByDay.set(day, (overallByDay.get(day) ?? 0) + item.lineTotalPence);

      const productBuckets = productDayMap.get(item.productId) ?? new Map<string, { revenuePence: number; units: number }>();
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

  const overall: SalesDatePoint[] | undefined = includeOverall
    ? dayBuckets.map((date) => ({ date, revenuePence: overallByDay.get(date) ?? 0 }))
    : undefined;

  const products = Array.from(productDayMap.entries())
    .map(([productId, pointsByDate]) => {
      const row = leaderboardMap.get(productId);
      return {
        productId,
        name: row?.name ?? 'Unknown product',
        points: dayBuckets.map((date) => {
          const value = pointsByDate.get(date) ?? { revenuePence: 0, units: 0 };
          return { date, revenuePence: value.revenuePence, units: value.units };
        })
      };
    })
    .sort((a, b) => {
      const left = leaderboardMap.get(a.productId)?.revenuePence ?? 0;
      const right = leaderboardMap.get(b.productId)?.revenuePence ?? 0;
      return right - left;
    });

  const bestProduct = leaderboard[0]
    ? {
        productId: leaderboard[0].productId,
        name: leaderboard[0].name,
        revenuePence: leaderboard[0].revenuePence,
        units: leaderboard[0].units
      }
    : undefined;

  const responsePayload = {
    range: {
      from: fromYmd,
      to: toYmd,
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

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  try {
    const shopId = await resolveShopId();
    const range = getDateRange(ctx.url.searchParams);
    const productIds = parseProductIds(ctx.url.searchParams);
    const includeOverall = ctx.url.searchParams.get('includeOverall') !== 'false';

    return await buildSalesResponse(shopId, range.from, range.to, productIds, includeOverall);
  } catch (error) {
    console.error('Failed to load sales analytics', error);
    const message = error instanceof Error ? error.message : 'Could not load sales analytics.';
    const details = error instanceof Error && error.stack ? error.stack : undefined;
    return new Response(JSON.stringify({ error: message, details }), { status: 400 });
  }
};
