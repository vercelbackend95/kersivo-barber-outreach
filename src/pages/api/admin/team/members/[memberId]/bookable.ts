export const prerender = false;

import type { APIRoute } from 'astro';
import {
  ensureBarberHasAllServices,
  ensureBarberHasAvailabilityRules,
} from '@/lib/admin/defaultAvailability';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function createInactiveSeat(member: {
  id: string;
  userId: string;
  teamStatus: string;
  user: { name: string | null; email: string };
}, shopId: string) {
  const name =
    member.user.name?.trim() ||
    member.user.email.split('@')[0] ||
    'Team member';
  const maxSort = await prisma.barber.aggregate({
    where: { shopId },
    _max: { sortOrder: true },
  });

  const created = await prisma.barber.create({
    data: {
      shopId,
      name,
      email: member.user.email,
      userId: member.userId,
      active: false,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });

  await ensureBarberHasAllServices(created.id, shopId);
  await ensureBarberHasAvailabilityRules(created.id);

  await prisma.shopMember.update({
    where: { id: member.id },
    data: { barberId: created.id },
  });

  return created.id;
}

export const PATCH: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  const denied = requireAnyPermission(access, ['members.manage', 'catalog.manage']);
  if (denied) return denied;

  const memberId = context.params.memberId;
  if (!memberId) return json({ error: 'Missing member id.' }, 400);

  let body: { bookable?: boolean };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }

  if (typeof body.bookable !== 'boolean') {
    return json({ error: 'bookable must be a boolean.' }, 400);
  }

  const member = await prisma.shopMember.findFirst({
    where: { id: memberId, shopId: access.shopId },
    select: {
      id: true,
      role: true,
      barberId: true,
      userId: true,
      teamStatus: true,
      user: { select: { name: true, email: true } },
    },
  });
  if (!member) return json({ error: 'Member not found.' }, 404);
  if (member.role !== 'OWNER' && member.role !== 'MANAGER') {
    return json({ error: 'Only Owner or Manager can toggle bookable.' }, 400);
  }

  if (body.bookable) {
    if (member.barberId) {
      await prisma.barber.update({
        where: { id: member.barberId },
        data: {
          active: member.teamStatus === 'ACTIVE',
          userId: member.userId,
        },
      });
      return json({ ok: true, bookable: true, barberId: member.barberId });
    }

    const name =
      member.user.name?.trim() ||
      member.user.email.split('@')[0] ||
      'Team member';
    const maxSort = await prisma.barber.aggregate({
      where: { shopId: access.shopId },
      _max: { sortOrder: true },
    });

    const created = await prisma.barber.create({
      data: {
        shopId: access.shopId,
        name,
        email: member.user.email,
        userId: member.userId,
        active: member.teamStatus === 'ACTIVE',
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });

    await ensureBarberHasAllServices(created.id, access.shopId);
    await ensureBarberHasAvailabilityRules(created.id);

    await prisma.shopMember.update({
      where: { id: member.id },
      data: { barberId: created.id },
    });

    return json({ ok: true, bookable: true, barberId: created.id });
  }

  // Turn off bookable: deactivate but keep shopMember.barberId so profile stays reachable
  if (member.barberId) {
    await prisma.barber.update({
      where: { id: member.barberId },
      data: { active: false, userId: null },
    });
    return json({ ok: true, bookable: false, barberId: member.barberId });
  }

  // No seat yet — create inactive linked seat for profile access
  const barberId = await createInactiveSeat(member, access.shopId);
  return json({ ok: true, bookable: false, barberId });
};
