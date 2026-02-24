export const prerender = false;

import type { APIRoute } from 'astro';
import { formatInTimeZone } from 'date-fns-tz';
import { requireAdmin } from '../../../../lib/admin/auth';
import { prisma } from '../../../../lib/db/client';
import { toUtcFromLondon, addMinutes } from '../../../../lib/booking/time';

const ADMIN_TIMEZONE = 'Europe/London';

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const range = new URL(ctx.request.url).searchParams.get('range') ?? 'today';
  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });

  const now = new Date();
  const todayIso = formatInTimeZone(now, ADMIN_TIMEZONE, 'yyyy-MM-dd');
  const todayStart = toUtcFromLondon(todayIso, 0);
  const tomorrowStart = addMinutes(todayStart, 24 * 60);

  const where = range === 'upcoming'
    ? { shopId: shop.id, endAt: { gte: now } }
    : { shopId: shop.id, startAt: { lt: tomorrowStart }, endAt: { gt: todayStart } };

  const timeBlocks = await prisma.timeBlock.findMany({
    where,
    orderBy: { startAt: 'asc' },
    include: { barber: { select: { id: true, name: true } } }
  });

  return new Response(JSON.stringify({ timeBlocks }));
};
