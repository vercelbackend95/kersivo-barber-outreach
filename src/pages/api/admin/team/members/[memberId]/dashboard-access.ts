export const prerender = false;

import type { APIRoute } from 'astro';
import type { ShopRole } from '@prisma/client';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';
import { runSerializableTransaction } from '@/lib/db/serializableTransaction';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function canRevokeTargetRole(actorRole: ShopRole, targetRole: ShopRole): boolean {
  if (targetRole === 'OWNER') return false;
  if (actorRole === 'OWNER') return true;
  if (actorRole === 'MANAGER' && targetRole === 'BARBER') return true;
  return false;
}

/**
 * Remove dashboard login for a team member while keeping their booking seat (orphan Barber).
 */
export const DELETE: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  const denied = requireAnyPermission(access, ['members.manage']);
  if (denied) return denied;

  const memberId = context.params.memberId;
  if (!memberId) {
    return json({ code: 'MEMBER_NOT_FOUND', error: 'Team member not found.' }, 404);
  }

  try {
    const result = await runSerializableTransaction(async (tx) => {
      const member = await tx.shopMember.findFirst({
        where: { id: memberId, shopId: access.shopId },
        select: {
          id: true,
          userId: true,
          role: true,
          barberId: true,
          user: { select: { email: true } },
        },
      });

      if (!member) {
        throw {
          ok: false as const,
          status: 404 as const,
          code: 'MEMBER_NOT_FOUND',
          error: 'Team member not found.',
        };
      }

      if (member.userId === access.userId) {
        throw {
          ok: false as const,
          status: 403 as const,
          code: 'CANNOT_REVOKE_SELF',
          error: 'You cannot revoke your own dashboard access.',
        };
      }

      if (!canRevokeTargetRole(access.role, member.role)) {
        throw {
          ok: false as const,
          status: 403 as const,
          code: 'FORBIDDEN',
          error:
            member.role === 'OWNER'
              ? 'Cannot revoke dashboard access for the shop owner.'
              : 'Forbidden to revoke dashboard access for this member.',
        };
      }

      const barberId = member.barberId;

      await tx.shopMember.delete({ where: { id: member.id } });

      if (barberId) {
        await tx.barber.updateMany({
          where: { id: barberId, shopId: access.shopId },
          data: { userId: null },
        });
      }

      return { memberId: member.id, barberId, email: member.user.email };
    });

    return json({ ok: true, ...result });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'ok' in error &&
      (error as { ok: unknown }).ok === false
    ) {
      const failure = error as { status: number; code: string; error: string };
      return json({ code: failure.code, error: failure.error }, failure.status);
    }
    console.error('[team/members/dashboard-access] revoke failed', error);
    return json({ error: 'Could not revoke dashboard access.' }, 500);
  }
};
