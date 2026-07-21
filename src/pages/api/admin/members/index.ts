export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { listAvailableRosterSeats } from '@/lib/admin/rbac/members';
import { prisma } from '@/lib/db/client';

export const GET: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  const denied = requireAnyPermission(access, ['members.manage', 'members.invite_barber']);
  if (denied) return denied;

  const [members, invites, availableSeats] = await Promise.all([
    prisma.shopMember.findMany({
      where: { shopId: access.shopId },
      select: {
        id: true,
        role: true,
        barberId: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, image: true } },
        barber: { select: { id: true, name: true } },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.shopInvite.findMany({
      where: {
        shopId: access.shopId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        role: true,
        barberId: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    listAvailableRosterSeats(access.shopId),
  ]);

  return new Response(
    JSON.stringify({
      ok: true,
      shopId: access.shopId,
      role: access.role,
      members,
      invites,
      availableSeats,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
