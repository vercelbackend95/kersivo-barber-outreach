export const prerender = false;

import type { APIRoute } from 'astro';
import { formatInTimeZone } from 'date-fns-tz';
import { requireAdmin } from '../../../../lib/admin/auth';
import { prisma } from '../../../../lib/db/client';
import { getTimeBlockDelegate } from '../../../../lib/db/timeBlocks';
import { toUtcFromLondon, addMinutes } from '../../../../lib/booking/time';

const ADMIN_TIMEZONE = 'Europe/London';

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const searchParams = new URL(ctx.request.url).searchParams;
  const range = searchParams.get('range') ?? 'today';
  const date = searchParams.get('date');

  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });

  const now = new Date();
  const dayIso = date || formatInTimeZone(now, ADMIN_TIMEZONE, 'yyyy-MM-dd');
  const dayStart = toUtcFromLondon(dayIso, 0);
  const nextDayStart = addMinutes(dayStart, 24 * 60);


  const where = range === 'upcoming'
    ? { shopId: shop.id, endAt: { gte: now } }
    : { shopId: shop.id, startAt: { lt: nextDayStart }, endAt: { gt: dayStart } };

  const timeBlockDelegate = getTimeBlockDelegate();
  if (!timeBlockDelegate) {
    return new Response(JSON.stringify({ timeBlocks: [] }));
  }

  const timeBlocks = await timeBlockDelegate.findMany({

    where,
    orderBy: { startAt: 'asc' },
    include: { barber: { select: { id: true, name: true } } }
  });

  return new Response(JSON.stringify({ timeBlocks }));
};
