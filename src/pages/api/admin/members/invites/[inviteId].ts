export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';

/** Revoke a pending invite for this shopId. */
export const DELETE: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  const denied = requireAnyPermission(access, ['members.manage', 'members.invite_barber']);
  if (denied) return denied;

  const inviteId = context.params.inviteId;
  if (!inviteId) {
    return new Response(JSON.stringify({ error: 'Missing invite id.' }), { status: 400 });
  }

  const invite = await prisma.shopInvite.findFirst({
    where: {
      id: inviteId,
      shopId: access.shopId,
      acceptedAt: null,
    },
  });
  if (!invite) {
    return new Response(JSON.stringify({ error: 'Invite not found.' }), { status: 404 });
  }

  if (access.role === 'MANAGER' && invite.role !== 'BARBER') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  await prisma.shopInvite.delete({ where: { id: invite.id } });
  return new Response(JSON.stringify({ ok: true }));
};
