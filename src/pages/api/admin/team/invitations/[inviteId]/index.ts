export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { assertCanInviteRole } from '@/lib/admin/rbac/members';
import { prisma } from '@/lib/db/client';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Cancel a pending (unaccepted) team invitation. */
export const DELETE: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  const denied = requireAnyPermission(access, ['members.manage', 'members.invite_barber']);
  if (denied) return denied;

  const inviteId = context.params.inviteId;
  if (!inviteId) {
    return json({ code: 'INVITATION_NOT_FOUND', error: 'Invitation not found.' }, 404);
  }

  const invite = await prisma.shopInvite.findFirst({
    where: { id: inviteId, shopId: access.shopId },
    select: {
      id: true,
      role: true,
      acceptedAt: true,
      barberId: true,
      email: true,
    },
  });

  if (!invite) {
    return json({ code: 'INVITATION_NOT_FOUND', error: 'Invitation not found.' }, 404);
  }

  if (invite.acceptedAt) {
    return json(
      {
        code: 'INVITATION_ALREADY_ACCEPTED',
        error: 'This invitation has already been accepted.',
      },
      409,
    );
  }

  if (invite.role === 'OWNER') {
    return json({ code: 'FORBIDDEN', error: 'Cannot cancel an Owner invitation.' }, 403);
  }

  const roleDenied = await assertCanInviteRole(access.role, invite.role);
  if (roleDenied) return roleDenied;

  await prisma.shopInvite.delete({ where: { id: invite.id } });

  return json({
    ok: true,
    cancelledInviteId: invite.id,
    barberId: invite.barberId,
  });
};

/** Owner-only: change pending invitation role (BARBER ↔ MANAGER). */
export const PATCH: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  if (access.role !== 'OWNER') {
    return json({ code: 'FORBIDDEN', error: 'Only the Owner can change invitation roles.' }, 403);
  }

  const denied = requireAnyPermission(access, ['members.manage']);
  if (denied) return denied;

  const inviteId = context.params.inviteId;
  if (!inviteId) {
    return json({ code: 'INVITATION_NOT_FOUND', error: 'Invitation not found.' }, 404);
  }

  let body: { role?: string };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }

  const nextRole = body.role;
  if (nextRole !== 'MANAGER' && nextRole !== 'BARBER') {
    return json({ error: 'role must be MANAGER or BARBER.' }, 400);
  }

  const invite = await prisma.shopInvite.findFirst({
    where: { id: inviteId, shopId: access.shopId },
    select: {
      id: true,
      role: true,
      acceptedAt: true,
      barberId: true,
    },
  });

  if (!invite) {
    return json({ code: 'INVITATION_NOT_FOUND', error: 'Invitation not found.' }, 404);
  }

  if (invite.acceptedAt) {
    return json(
      {
        code: 'INVITATION_ALREADY_ACCEPTED',
        error: 'This invitation has already been accepted.',
      },
      409,
    );
  }

  if (invite.role === 'OWNER') {
    return json({ code: 'FORBIDDEN', error: 'Cannot change an Owner invitation role.' }, 403);
  }

  const updated = await prisma.shopInvite.update({
    where: { id: invite.id },
    data: { role: nextRole },
    select: {
      id: true,
      role: true,
      barberId: true,
    },
  });

  if (invite.barberId) {
    await prisma.barber.updateMany({
      where: { id: invite.barberId, shopId: access.shopId },
      data: { intendedRole: nextRole },
    });
  }

  return json({ ok: true, invite: updated });
};
