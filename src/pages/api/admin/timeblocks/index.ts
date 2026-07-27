export const prerender = false;

import type { APIRoute } from 'astro';
import { formatInTimeZone } from 'date-fns-tz';
import { requireAdminContext } from '../../../../lib/admin/auth';
import { requireAnyPermission } from '../../../../lib/admin/rbac/can';
import { getTimeBlockDelegate } from '../../../../lib/db/timeBlocks';
import { toUtcFromLondon, addMinutes } from '../../../../lib/booking/time';

const ADMIN_TIMEZONE = 'Europe/London';

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requireAnyPermission(access, ['catalog.manage', 'team.read']);
  if (denied) return denied;

  const searchParams = new URL(ctx.request.url).searchParams;
  const range = searchParams.get('range') ?? 'today';
  const date = searchParams.get('date');

  const shopId = access.shopId;

  const now = new Date();
  const dayIso = date || formatInTimeZone(now, ADMIN_TIMEZONE, 'yyyy-MM-dd');
  const dayStart = toUtcFromLondon(dayIso, 0);
  const nextDayStart = addMinutes(dayStart, 24 * 60);


  const where = range === 'upcoming'
    ? { shopId, endAt: { gte: now } }
    : { shopId, startAt: { lt: nextDayStart }, endAt: { gt: dayStart } };

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
