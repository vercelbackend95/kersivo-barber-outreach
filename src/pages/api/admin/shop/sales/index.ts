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
@@ -256,99 +256,31 @@ async function buildSalesResponse(
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
