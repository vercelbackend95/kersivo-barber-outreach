export const prerender = false;

import type { APIRoute } from 'astro';
import { Prisma } from '@prisma/client';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';
import { resolveShopId } from '../../../../../lib/db/shopScope';

const TZ = 'Europe/London';
const PAID_STATUSES = ['PAID', 'COLLECTED'] as const;

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
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

function getDateRange(params: URLSearchParams): { from: string; to: string } {
  const range = params.get('range');
  const from = params.get('from');
  const to = params.get('to');

  if (from && to) {
    if (!parseYmd(from) || !parseYmd(to)) {
      throw new Error('Invalid custom date range. Use YYYY-MM-DD format.');
    }
    if (from > to) {
      throw new Error('The "from" date must be before or equal to the "to" date.');
    }
    return { from, to };
  }

  const days = range === '7' || range === '30' || range === '90' ? Number(range) : 30;
  const today = new Date();
  const toYmdValue = toYmd(today);

  const toDateStartLondon = fromZonedTime(`${toYmdValue}T00:00:00`, TZ);
  const fromDateStartLondon = new Date(toDateStartLondon.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

  return {
    from: toYmd(fromDateStartLondon),
    to: toYmdValue
  };
}

function getDateKeys(from: string, to: string): string[] {
  const keys: string[] = [];
  const cursor = parseYmd(from);
  const end = parseYmd(to);
  if (!cursor || !end) return keys;

  while (cursor <= end) {
    keys.push(toYmd(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
}

function parseProductIds(params: URLSearchParams): string[] {
  const raw = params.get('productIds')?.trim();
  if (!raw) return [];
  const unique = Array.from(new Set(raw.split(',').map((item) => item.trim()).filter(Boolean)));
  if (unique.length > 3) {
    throw new Error('You can select up to 3 products.');
  }
  return unique;
}

async function buildSalesResponse(
  shopId: string,
  from: string,
  to: string,
  productIds: string[],
  includeOverall: boolean
): Promise<Response> {
  const fromUtc = fromZonedTime(`${from}T00:00:00`, TZ);
  const toExclusiveUtc = fromZonedTime(`${to}T00:00:00`, TZ);
  toExclusiveUtc.setUTCDate(toExclusiveUtc.getUTCDate() + 1);

  const paidWhere = {
    shopId,
    status: { in: [...PAID_STATUSES] },
    createdAt: {
      gte: fromUtc,
      lt: toExclusiveUtc
    }
  } as const;

  const [ordersAgg, productRows] = await Promise.all([
    prisma.order.aggregate({
      where: paidWhere,
      _sum: { totalPence: true },
      _count: { id: true }
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: paidWhere
      },
      _sum: {
        quantity: true,
        lineTotalPence: true
      }
    })
  ]);

  const productMeta = productRows.length
    ? await prisma.product.findMany({
        where: {
          shopId,
          id: { in: productRows.map((row) => row.productId) }
        },
        select: { id: true, name: true }
      })
    : [];

  const nameMap = new Map(productMeta.map((product) => [product.id, product.name]));

  const leaderboard: SalesLeaderboardRow[] = productRows
    .map((row) => ({
      productId: row.productId,
      name: nameMap.get(row.productId) ?? 'Unknown product',
      units: row._sum.quantity ?? 0,
      revenuePence: row._sum.lineTotalPence ?? 0
    }))
    .sort((a, b) => b.revenuePence - a.revenuePence || b.units - a.units || a.name.localeCompare(b.name));

  const bestProduct = leaderboard[0]
    ? {
        productId: leaderboard[0].productId,
        name: leaderboard[0].name,
        revenuePence: leaderboard[0].revenuePence,
        units: leaderboard[0].units
      }
    : undefined;

  const dateKeys = getDateKeys(from, to);

  let overall: SalesDatePoint[] | undefined;
  if (includeOverall) {
    const overallRows = await prisma.$queryRaw<Array<{ day: string; revenue_pence: bigint | number }>>(Prisma.sql`
      SELECT
        TO_CHAR(((o."createdAt" AT TIME ZONE ${TZ})::date), 'YYYY-MM-DD') AS day,
        COALESCE(SUM(o."totalPence"), 0) AS revenue_pence
      FROM "Order" o
      WHERE o."shopId" = ${shopId}
        AND o."status" IN (${Prisma.join(PAID_STATUSES)})
        AND o."createdAt" >= ${fromUtc}
        AND o."createdAt" < ${toExclusiveUtc}
      GROUP BY ((o."createdAt" AT TIME ZONE ${TZ})::date)
      ORDER BY ((o."createdAt" AT TIME ZONE ${TZ})::date) ASC
    `);

    const overallMap = new Map(overallRows.map((row) => [row.day, Number(row.revenue_pence)]));
    overall = dateKeys.map((date) => ({ date, revenuePence: overallMap.get(date) ?? 0 }));
  }

  const selectedProducts = productIds.length
    ? await prisma.product.findMany({
        where: { shopId, id: { in: productIds } },
        select: { id: true, name: true }
      })
    : [];

  const products = await Promise.all(
    selectedProducts.map(async (product) => {
      const rows = await prisma.$queryRaw<Array<{ day: string; revenue_pence: bigint | number; units: bigint | number }>>(Prisma.sql`
        SELECT
          TO_CHAR(((o."createdAt" AT TIME ZONE ${TZ})::date), 'YYYY-MM-DD') AS day,
          COALESCE(SUM(oi."lineTotalPence"), 0) AS revenue_pence,
          COALESCE(SUM(oi."quantity"), 0) AS units
        FROM "OrderItem" oi
        INNER JOIN "Order" o ON o."id" = oi."orderId"
        WHERE o."shopId" = ${shopId}
          AND o."status" IN (${Prisma.join(PAID_STATUSES)})
          AND o."createdAt" >= ${fromUtc}
          AND o."createdAt" < ${toExclusiveUtc}
          AND oi."productId" = ${product.id}
        GROUP BY ((o."createdAt" AT TIME ZONE ${TZ})::date)
        ORDER BY ((o."createdAt" AT TIME ZONE ${TZ})::date) ASC
      `);

      const byDate = new Map(rows.map((row) => [row.day, { revenuePence: Number(row.revenue_pence), units: Number(row.units) }]));

      return {
        productId: product.id,
        name: product.name,
        points: dateKeys.map((date) => ({
          date,
          revenuePence: byDate.get(date)?.revenuePence ?? 0,
          units: byDate.get(date)?.units ?? 0
        }))
      };
    })
  );

  const responsePayload = {
    range: { from, to, tz: TZ },
    kpis: {
      revenuePence: ordersAgg._sum.totalPence ?? 0,
      ordersCount: ordersAgg._count.id,
      avgOrderValuePence: ordersAgg._count.id > 0 ? Math.round((ordersAgg._sum.totalPence ?? 0) / ordersAgg._count.id) : 0,
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
    const message = error instanceof Error ? error.message : 'Could not load sales analytics.';
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }
};

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  if (!import.meta.env.DEV) {
    return new Response(JSON.stringify({ error: 'Demo data generation is available only in DEV.' }), { status: 403 });
  }

  try {
    const shopId = await resolveShopId();
    const products = await prisma.product.findMany({
      where: { shopId, active: true },
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
      take: 5,
      select: { id: true, name: true, pricePence: true }
    });

    if (products.length === 0) {
      return new Response(JSON.stringify({ error: 'Create at least one product first.' }), { status: 400 });
    }

    const orderCount = Math.min(12, Math.max(5, products.length * 2));

    await prisma.$transaction(
      Array.from({ length: orderCount }).map((_, index) => {
        const baseDate = new Date();
        baseDate.setUTCDate(baseDate.getUTCDate() - index * 2);
        baseDate.setUTCHours(10 + (index % 8), (index % 4) * 10, 0, 0);

        const itemCount = 1 + (index % Math.min(3, products.length));
        const selected = products.slice(0, itemCount);
        const items = selected.map((product, itemIndex) => {
          const quantity = 1 + ((index + itemIndex) % 2);
          const lineTotalPence = product.pricePence * quantity;
          return {
            productId: product.id,
            nameSnapshot: product.name,
            unitPricePenceSnapshot: product.pricePence,
            quantity,
            lineTotalPence
          };
        });

        const totalPence = items.reduce((sum, item) => sum + item.lineTotalPence, 0);

        return prisma.order.create({
          data: {
            shopId,
            customerEmail: `demo+${index + 1}@kersivo.local`,
            status: index % 3 === 0 ? 'COLLECTED' : 'PAID',
            currency: 'gbp',
            totalPence,
            paidAt: baseDate,
            collectedAt: index % 3 === 0 ? new Date(baseDate.getTime() + 2 * 60 * 60 * 1000) : null,
            createdAt: baseDate,
            items: {
              create: items
            }
          }
        });
      })
    );

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error('Failed to generate demo sales data', error);
    return new Response(JSON.stringify({ error: 'Could not generate demo sales data.' }), { status: 500 });
  }
};
