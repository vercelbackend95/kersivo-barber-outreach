import { createHash, randomBytes } from 'node:crypto';
import type { Prisma, ShopRole } from '@prisma/client';
import {
  ensureBarberHasAllServices,
  ensureBarberHasAvailabilityRules,
} from '@/lib/admin/defaultAvailability';
import { prisma } from '@/lib/db/client';

const INVITE_TTL_MS = 1000 * 60 * 60 * 72; // 72h

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInviteToken(token) };
}

export function inviteExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_MS);
}

export async function assertCanInviteRole(
  actorRole: ShopRole,
  targetRole: ShopRole,
): Promise<Response | null> {
  if (targetRole === 'OWNER') {
    return new Response(JSON.stringify({ error: 'Cannot invite an Owner via this flow.' }), {
      status: 400,
    });
  }
  if (actorRole === 'OWNER') return null;
  if (actorRole === 'MANAGER' && targetRole === 'BARBER') return null;
  return new Response(JSON.stringify({ error: 'Forbidden to invite this role.' }), { status: 403 });
}

export async function countOwners(shopId: string): Promise<number> {
  return prisma.shopMember.count({ where: { shopId, role: 'OWNER' } });
}

/** Seats that are not linked to a login and not claimed by an open invite. */
export async function listAvailableRosterSeats(shopId: string): Promise<Array<{ id: string; name: string }>> {
  const [claimedByMember, claimedByInvite] = await Promise.all([
    prisma.shopMember.findMany({
      where: { shopId, barberId: { not: null } },
      select: { barberId: true },
    }),
    prisma.shopInvite.findMany({
      where: {
        shopId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
        barberId: { not: null },
      },
      select: { barberId: true },
    }),
  ]);

  const taken = new Set(
    [...claimedByMember, ...claimedByInvite]
      .map((row) => row.barberId)
      .filter((id): id is string => Boolean(id)),
  );

  const barbers = await prisma.barber.findMany({
    where: {
      shopId,
      active: true,
      userId: null,
      ...(taken.size > 0 ? { id: { notIn: [...taken] } } : {}),
    },
    select: { id: true, name: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  return barbers;
}

/**
 * Validate an existing free seat, or create a new active Barber (services + hours).
 * Returns barber id or a Response error.
 */
export async function resolveBarberSeatForInvite(input: {
  shopId: string;
  email: string;
  barberId?: string | null;
  createSeat?: { name?: string } | null;
}): Promise<string | Response> {
  const existingId = input.barberId ? String(input.barberId) : null;
  const createName = input.createSeat?.name?.trim() || '';

  if (existingId && createName) {
    return new Response(
      JSON.stringify({ error: 'Provide either an existing roster seat or createSeat, not both.' }),
      { status: 400 },
    );
  }

  if (!existingId && !createName) {
    return new Response(
      JSON.stringify({
        error: 'Barber invites require a roster seat. Pick an available seat or create a new one.',
      }),
      { status: 400 },
    );
  }

  if (existingId) {
    const barber = await prisma.barber.findFirst({
      where: { id: existingId, shopId: input.shopId },
      select: { id: true, userId: true },
    });
    if (!barber) {
      return new Response(JSON.stringify({ error: 'Barber not found in this shop.' }), { status: 400 });
    }
    if (barber.userId) {
      return new Response(JSON.stringify({ error: 'That roster seat is already linked to a login.' }), {
        status: 400,
      });
    }
    const memberClaim = await prisma.shopMember.findFirst({
      where: { shopId: input.shopId, barberId: existingId },
      select: { id: true },
    });
    if (memberClaim) {
      return new Response(JSON.stringify({ error: 'That roster seat is already linked to a member.' }), {
        status: 400,
      });
    }
    const inviteClaim = await prisma.shopInvite.findFirst({
      where: {
        shopId: input.shopId,
        barberId: existingId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (inviteClaim) {
      return new Response(JSON.stringify({ error: 'That roster seat is already reserved by an open invite.' }), {
        status: 400,
      });
    }
    return existingId;
  }

  const serviceCount = await prisma.service.count({
    where: { shopId: input.shopId, isActive: true },
  });
  if (serviceCount === 0) {
    return new Response(
      JSON.stringify({
        error: 'Add at least one active service before creating a roster seat for an invite.',
      }),
      { status: 400 },
    );
  }

  const maxSort = await prisma.barber.aggregate({
    where: { shopId: input.shopId },
    _max: { sortOrder: true },
  });

  const created = await prisma.barber.create({
    data: {
      shopId: input.shopId,
      name: createName,
      email: input.email,
      active: true,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });

  await ensureBarberHasAllServices(created.id, input.shopId);
  await ensureBarberHasAvailabilityRules(created.id);

  return created.id;
}

/**
 * Link (or re-link) a ShopMember to a free roster seat. Clears previous Barber.userId when re-linking.
 */
export async function linkMemberToBarberSeat(input: {
  shopId: string;
  memberId: string;
  barberId: string;
}): Promise<
  | { id: string; role: ShopRole; barberId: string; barber: { id: string; name: string } }
  | Response
> {
  const member = await prisma.shopMember.findFirst({
    where: { id: input.memberId, shopId: input.shopId },
    select: { id: true, role: true, barberId: true, userId: true },
  });
  if (!member) {
    return new Response(JSON.stringify({ error: 'Member not found.' }), { status: 404 });
  }
  if (member.role === 'OWNER') {
    return new Response(JSON.stringify({ error: 'Cannot link an Owner to a roster seat here.' }), {
      status: 400,
    });
  }
  if (member.role !== 'BARBER') {
    return new Response(JSON.stringify({ error: 'Only Barber members can be linked to a roster seat.' }), {
      status: 400,
    });
  }

  const barber = await prisma.barber.findFirst({
    where: { id: input.barberId, shopId: input.shopId },
    select: { id: true, name: true, userId: true },
  });
  if (!barber) {
    return new Response(JSON.stringify({ error: 'Barber not found in this shop.' }), { status: 400 });
  }
  if (barber.userId && barber.userId !== member.userId) {
    return new Response(JSON.stringify({ error: 'That roster seat is already linked to another login.' }), {
      status: 400,
    });
  }

  const otherMember = await prisma.shopMember.findFirst({
    where: {
      shopId: input.shopId,
      barberId: input.barberId,
      id: { not: member.id },
    },
    select: { id: true },
  });
  if (otherMember) {
    return new Response(JSON.stringify({ error: 'That roster seat is already linked to another member.' }), {
      status: 400,
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (member.barberId && member.barberId !== input.barberId) {
      await tx.barber.updateMany({
        where: { id: member.barberId, shopId: input.shopId, userId: member.userId },
        data: { userId: null },
      });
    }

    await tx.barber.update({
      where: { id: input.barberId },
      data: { userId: member.userId },
    });

    return tx.shopMember.update({
      where: { id: member.id },
      data: { barberId: input.barberId },
      select: {
        id: true,
        role: true,
        barberId: true,
        barber: { select: { id: true, name: true } },
      },
    });
  });

  if (!updated.barberId || !updated.barber) {
    return new Response(JSON.stringify({ error: 'Could not link roster seat.' }), { status: 500 });
  }

  return {
    id: updated.id,
    role: updated.role,
    barberId: updated.barberId,
    barber: updated.barber,
  };
}

type AcceptableInvite = {
  id: string;
  shopId: string;
  role: ShopRole;
  barberId: string | null;
};

export type AcceptInviteSuccess = {
  ok: true;
  shopId: string;
  role: ShopRole;
  alreadyMember: boolean;
};

export type AcceptInviteFailure = {
  ok: false;
  code: string;
  error: string;
};

export type AcceptInviteResult = AcceptInviteSuccess | AcceptInviteFailure;

/**
 * Create ShopMember from an invite (or mark invite accepted if already a member).
 * Caller must validate email match, expiry, and role !== OWNER.
 * New members start as teamStatus NEW. Linked booking profiles keep Barber.active
 * (and services/hours/avatar) so online bookings do not wait on Activate.
 */
export async function acceptInviteForUser(
  invite: AcceptableInvite,
  userId: string,
): Promise<AcceptInviteResult> {
  const existing = await prisma.shopMember.findUnique({
    where: {
      shopId_userId: { shopId: invite.shopId, userId },
    },
    select: { id: true, barberId: true },
  });

  try {
    if (existing) {
      if (
        existing.barberId &&
        invite.barberId &&
        existing.barberId !== invite.barberId
      ) {
        return {
          ok: false,
          code: 'MEMBER_BARBER_LINK_CONFLICT',
          error: 'This account is already linked to a different booking profile.',
        };
      }

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        if (invite.barberId) {
          const barber = await tx.barber.findFirst({
            where: { id: invite.barberId, shopId: invite.shopId },
            select: { id: true, userId: true },
          });
          if (!barber) {
            throw {
              ok: false as const,
              code: 'BOOKING_PROFILE_NOT_FOUND',
              error: 'The linked booking profile could not be found.',
            };
          }
          if (barber.userId && barber.userId !== userId) {
            throw {
              ok: false as const,
              code: 'BOOKING_PROFILE_ALREADY_LINKED',
              error: 'This booking profile is already linked to another account.',
            };
          }

          if (!existing.barberId) {
            if (!barber.userId) {
              await tx.barber.update({
                where: { id: barber.id },
                data: { userId },
              });
            }
            await tx.shopMember.update({
              where: { id: existing.id },
              data: { barberId: barber.id },
            });
          } else if (!barber.userId) {
            await tx.barber.update({
              where: { id: barber.id },
              data: { userId },
            });
          }
        }

        await tx.shopInvite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        });
      });
      return { ok: true, shopId: invite.shopId, role: invite.role, alreadyMember: true };
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let barberId = invite.barberId;
      if (barberId) {
        const barber = await tx.barber.findFirst({
          where: { id: barberId, shopId: invite.shopId },
          select: { id: true, userId: true },
        });
        if (!barber) {
          throw {
            ok: false as const,
            code: 'BOOKING_PROFILE_NOT_FOUND',
            error: 'The linked booking profile could not be found.',
          };
        }
        if (barber.userId && barber.userId !== userId) {
          throw {
            ok: false as const,
            code: 'BOOKING_PROFILE_ALREADY_LINKED',
            error: 'This booking profile is already linked to another account.',
          };
        }
        if (!barber.userId) {
          // Link login only — do not change active, services, hours, or avatar.
          await tx.barber.update({
            where: { id: barberId },
            data: { userId },
          });
        }
      }

      await tx.shopMember.create({
        data: {
          shopId: invite.shopId,
          userId,
          role: invite.role,
          barberId,
          teamStatus: 'NEW',
        },
      });

      await tx.shopInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
    });

    return { ok: true, shopId: invite.shopId, role: invite.role, alreadyMember: false };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'ok' in error &&
      (error as AcceptInviteFailure).ok === false &&
      'code' in error
    ) {
      return error as AcceptInviteFailure;
    }
    throw error;
  }
}
