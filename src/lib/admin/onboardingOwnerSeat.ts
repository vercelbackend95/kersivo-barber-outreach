import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Dual-link a ShopMember to a Barber seat (Barber.userId + ShopMember.barberId).
 * Same contract as createBookingProfileForMember / invite accept.
 */
export async function linkMemberToBarber(
  db: DbClient,
  params: {
    memberId: string;
    barberId: string;
    userId: string;
    email?: string | null;
  },
) {
  await db.barber.update({
    where: { id: params.barberId },
    data: {
      userId: params.userId,
      ...(params.email ? { email: params.email } : {}),
    },
    select: { id: true },
  });

  await db.shopMember.update({
    where: { id: params.memberId },
    data: { barberId: params.barberId },
    select: { id: true },
  });
}

/**
 * Clear ShopMember.barberId and Barber.userId (leaves the Barber row for soft-deactivate elsewhere).
 */
export async function unlinkMemberBarber(
  db: DbClient,
  params: { memberId: string; barberId: string },
) {
  await db.shopMember.update({
    where: { id: params.memberId },
    data: { barberId: null },
    select: { id: true },
  });

  await db.barber.update({
    where: { id: params.barberId },
    data: { userId: null },
    select: { id: true },
  });
}

/** Normalize names for Just-me orphan reuse matching. */
export function namesLikelySame(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const left = norm(a ?? '');
  const right = norm(b ?? '');
  return Boolean(left) && left === right;
}

/** Active calendar seats with no dashboard user and no member/invite link. */
export async function findActiveOrphanBarbers(
  shopId: string,
  db: DbClient = prisma,
): Promise<Array<{ id: string; name: string; avatarUrl: string | null }>> {
  const [barbers, members, invites] = await Promise.all([
    db.barber.findMany({
      where: { shopId, active: true, userId: null },
      select: { id: true, name: true, avatarUrl: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    db.shopMember.findMany({
      where: { shopId, barberId: { not: null } },
      select: { barberId: true },
    }),
    db.shopInvite.findMany({
      where: { shopId, barberId: { not: null }, acceptedAt: null },
      select: { barberId: true },
    }),
  ]);

  const linked = new Set(
    [...members.map((m) => m.barberId), ...invites.map((i) => i.barberId)].filter(
      (id): id is string => Boolean(id),
    ),
  );

  return barbers.filter((b) => !linked.has(b.id));
}
