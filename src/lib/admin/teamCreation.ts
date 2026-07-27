import type { Prisma, ShopRole } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { runSerializableTransaction } from '@/lib/db/serializableTransaction';
import { inviteExpiresAt } from '@/lib/admin/rbac/members';
import { canActorSetUpOnlineBookings } from '@/lib/admin/teamCards';
import {
  findActiveOrphanBarbers,
  linkMemberToBarber,
  namesLikelySame,
} from '@/lib/admin/onboardingOwnerSeat';

export type WorkingHourInput = {
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  breakStartMin?: number | null;
  breakEndMin?: number | null;
  active?: boolean;
};

export type ValidatedWorkingHourRow = {
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  breakStartMin: number | null;
  breakEndMin: number | null;
  active: boolean;
};

export type ValidationFailure = {
  ok: false;
  code: string;
  error: string;
};

/** Structured domain failure thrown from Team creation transactions. */
export type TeamCreationDomainError = {
  ok: false;
  status: 403 | 404 | 409 | 422;
  code: string;
  error: string;
  inviteId?: string;
  barberId?: string;
};

/** @deprecated Prefer TeamCreationDomainError — kept as alias for 409 invite conflicts. */
export type InviteConflict = TeamCreationDomainError & { status: 409 };

export function normalizeServiceIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = String(raw ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function toFiniteInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isInteger(n) && Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Strict working-hours validation for Team creation.
 * Rejects duplicate active dayOfWeek (scheduling uses one rule per day).
 */
export function assertValidWorkingHours(
  rows: WorkingHourInput[],
  options?: { requireActiveDay?: boolean },
): { ok: true; hours: ValidatedWorkingHourRow[] } | ValidationFailure {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      ok: false,
      code: 'INVALID_WORKING_HOURS',
      error: 'One or more working-hour entries are invalid.',
    };
  }

  const validated: ValidatedWorkingHourRow[] = [];
  const activeDays = new Set<number>();

  for (const row of rows) {
    const dayOfWeek = toFiniteInt(row.dayOfWeek);
    const startMinutes = toFiniteInt(row.startMinutes);
    const endMinutes = toFiniteInt(row.endMinutes);

    if (
      dayOfWeek === null ||
      !isIntInRange(dayOfWeek, 1, 7) ||
      startMinutes === null ||
      endMinutes === null ||
      !isIntInRange(startMinutes, 0, 1440) ||
      !isIntInRange(endMinutes, 0, 1440) ||
      startMinutes >= endMinutes
    ) {
      return {
        ok: false,
        code: 'INVALID_WORKING_HOURS',
        error: 'One or more working-hour entries are invalid.',
      };
    }

    const hasBreakStart = row.breakStartMin != null && row.breakStartMin !== undefined;
    const hasBreakEnd = row.breakEndMin != null && row.breakEndMin !== undefined;
    let breakStartMin: number | null = null;
    let breakEndMin: number | null = null;

    if (hasBreakStart || hasBreakEnd) {
      if (!hasBreakStart || !hasBreakEnd) {
        return {
          ok: false,
          code: 'INVALID_WORKING_HOURS',
          error: 'One or more working-hour entries are invalid.',
        };
      }
      breakStartMin = toFiniteInt(row.breakStartMin);
      breakEndMin = toFiniteInt(row.breakEndMin);
      if (
        breakStartMin === null ||
        breakEndMin === null ||
        !isIntInRange(breakStartMin, 0, 1440) ||
        !isIntInRange(breakEndMin, 0, 1440) ||
        breakStartMin >= breakEndMin ||
        breakStartMin < startMinutes ||
        breakEndMin > endMinutes
      ) {
        return {
          ok: false,
          code: 'INVALID_WORKING_HOURS',
          error: 'One or more working-hour entries are invalid.',
        };
      }
    }

    const active = row.active !== false;
    if (active) {
      if (activeDays.has(dayOfWeek)) {
        return {
          ok: false,
          code: 'INVALID_WORKING_HOURS',
          error: 'One or more working-hour entries are invalid.',
        };
      }
      activeDays.add(dayOfWeek);
    }

    validated.push({
      dayOfWeek,
      startMinutes,
      endMinutes,
      breakStartMin,
      breakEndMin,
      active,
    });
  }

  if (options?.requireActiveDay !== false && activeDays.size === 0) {
    return {
      ok: false,
      code: 'INVALID_WORKING_HOURS',
      error: 'One or more working-hour entries are invalid.',
    };
  }

  return { ok: true, hours: validated };
}

export async function assertValidShopServices(params: {
  shopId: string;
  serviceIds: unknown;
  db?: Prisma.TransactionClient | typeof prisma;
}): Promise<{ ok: true; serviceIds: string[] } | ValidationFailure> {
  const db = params.db ?? prisma;
  const serviceIds = normalizeServiceIds(params.serviceIds);
  if (serviceIds.length === 0) {
    return {
      ok: false,
      code: 'INVALID_SERVICE_SELECTION',
      error: 'One or more selected services are unavailable.',
    };
  }

  const found = await db.service.findMany({
    where: { shopId: params.shopId, id: { in: serviceIds }, isActive: true },
    select: { id: true },
  });

  if (found.length !== serviceIds.length) {
    return {
      ok: false,
      code: 'INVALID_SERVICE_SELECTION',
      error: 'One or more selected services are unavailable.',
    };
  }

  return { ok: true, serviceIds };
}

async function createBarberWithSetup(
  tx: Prisma.TransactionClient,
  params: {
    shopId: string;
    name: string;
    email?: string | null;
    userId?: string | null;
    serviceIds: string[];
    hours: ValidatedWorkingHourRow[];
    avatarUrl?: string | null;
  },
) {
  const services = await assertValidShopServices({
    shopId: params.shopId,
    serviceIds: params.serviceIds,
    db: tx,
  });
  if (!services.ok) {
    throw {
      ok: false as const,
      status: 422 as const,
      code: services.code,
      error: services.error,
    } satisfies TeamCreationDomainError;
  }

  const maxSort = await tx.barber.aggregate({
    where: { shopId: params.shopId },
    _max: { sortOrder: true },
  });

  const created = await tx.barber.create({
    data: {
      shopId: params.shopId,
      name: params.name,
      active: true,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      ...(params.email ? { email: params.email } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.avatarUrl ? { avatarUrl: params.avatarUrl } : {}),
    },
    select: {
      id: true,
      name: true,
      active: true,
      avatarUrl: true,
      email: true,
      userId: true,
    },
  });

  await tx.barberService.createMany({
    data: services.serviceIds.map((serviceId) => ({ barberId: created.id, serviceId })),
    skipDuplicates: true,
  });

  await tx.availabilityRule.createMany({
    data: params.hours.map((row) => ({
      barberId: created.id,
      dayOfWeek: row.dayOfWeek,
      startMinutes: row.startMinutes,
      endMinutes: row.endMinutes,
      breakStartMin: row.breakStartMin,
      breakEndMin: row.breakEndMin,
      active: row.active,
    })),
  });

  return { ...created, serviceIds: services.serviceIds };
}

/** Atomic standalone booking profile (no invite / member). */
export async function createStandaloneBookingProfile(params: {
  shopId: string;
  name: string;
  serviceIds: string[];
  hours: ValidatedWorkingHourRow[];
  avatarUrl?: string | null;
}) {
  return prisma.$transaction(async (tx) =>
    createBarberWithSetup(tx, {
      shopId: params.shopId,
      name: params.name,
      serviceIds: params.serviceIds,
      hours: params.hours,
      avatarUrl: params.avatarUrl,
    }),
  );
}

/**
 * Atomic online-bookings setup for an existing dashboard ShopMember (no invite / email).
 * Creates one Barber linked to the member User and sets ShopMember.barberId only.
 */
export async function createBookingProfileForMember(params: {
  shopId: string;
  memberId: string;
  actorRole: ShopRole | string;
  displayName: string;
  serviceIds: string[];
  hours: ValidatedWorkingHourRow[];
  /** Uploaded avatar URL; when omitted, falls back to User.image inside the transaction. */
  uploadedAvatarUrl?: string | null;
}) {
  return runSerializableTransaction(async (tx) => {
    const member = await tx.shopMember.findFirst({
      where: { id: params.memberId, shopId: params.shopId },
      select: {
        id: true,
        userId: true,
        role: true,
        barberId: true,
        teamStatus: true,
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    if (!member) {
      throw {
        ok: false as const,
        status: 404 as const,
        code: 'TEAM_MEMBER_NOT_FOUND',
        error: 'Team member not found.',
      } satisfies TeamCreationDomainError;
    }

    if (!canActorSetUpOnlineBookings(params.actorRole, member.role)) {
      throw {
        ok: false as const,
        status: 403 as const,
        code: 'FORBIDDEN',
        error: 'Forbidden to set up online bookings for this team member.',
      } satisfies TeamCreationDomainError;
    }

    if (member.barberId) {
      throw {
        ok: false as const,
        status: 409 as const,
        code: 'BOOKING_PROFILE_ALREADY_EXISTS',
        error: 'This team member already has a booking profile.',
        barberId: member.barberId,
      } satisfies TeamCreationDomainError;
    }

    const existingUserBarber = await tx.barber.findFirst({
      where: { userId: member.userId },
      select: { id: true },
    });
    if (existingUserBarber) {
      throw {
        ok: false as const,
        status: 409 as const,
        code: 'USER_ALREADY_HAS_BOOKING_PROFILE',
        error: 'This account is already linked to another booking profile.',
        barberId: existingUserBarber.id,
      } satisfies TeamCreationDomainError;
    }

    const avatarUrl = params.uploadedAvatarUrl ?? member.user.image ?? null;

    // Just-me leftover only: reuse the single orphan when it already looks like this person.
    const orphans = await findActiveOrphanBarbers(params.shopId, tx);
    const matchingOrphan =
      orphans.length === 1 &&
      (namesLikelySame(orphans[0]!.name, params.displayName) ||
        namesLikelySame(orphans[0]!.name, member.user.name))
        ? orphans[0]
        : null;

    if (matchingOrphan) {
      const orphanId = matchingOrphan.id;
      const services = await assertValidShopServices({
        shopId: params.shopId,
        serviceIds: params.serviceIds,
        db: tx,
      });
      if (!services.ok) {
        throw {
          ok: false as const,
          status: 422 as const,
          code: services.code,
          error: services.error,
        } satisfies TeamCreationDomainError;
      }

      const updated = await tx.barber.update({
        where: { id: orphanId },
        data: {
          name: params.displayName,
          active: true,
          email: member.user.email,
          userId: member.userId,
          ...(avatarUrl ? { avatarUrl } : {}),
        },
        select: {
          id: true,
          name: true,
          active: true,
          avatarUrl: true,
          email: true,
          userId: true,
        },
      });

      await tx.barberService.createMany({
        data: services.serviceIds.map((serviceId) => ({ barberId: updated.id, serviceId })),
        skipDuplicates: true,
      });

      await tx.availabilityRule.deleteMany({ where: { barberId: updated.id } });
      await tx.availabilityRule.createMany({
        data: params.hours.map((row) => ({
          barberId: updated.id,
          dayOfWeek: row.dayOfWeek,
          startMinutes: row.startMinutes,
          endMinutes: row.endMinutes,
          breakStartMin: row.breakStartMin,
          breakEndMin: row.breakEndMin,
          active: row.active,
        })),
      });

      await tx.shopMember.update({
        where: { id: member.id },
        data: { barberId: updated.id },
        select: { id: true },
      });

      return {
        barber: {
          id: updated.id,
          name: updated.name,
          active: updated.active,
          avatarUrl: updated.avatarUrl,
          email: updated.email,
          userId: updated.userId,
          serviceIds: services.serviceIds,
        },
        memberId: member.id,
        role: member.role,
        teamStatus: member.teamStatus,
      };
    }

    const created = await createBarberWithSetup(tx, {
      shopId: params.shopId,
      name: params.displayName,
      email: member.user.email,
      userId: member.userId,
      serviceIds: params.serviceIds,
      hours: params.hours,
      avatarUrl,
    });

    await linkMemberToBarber(tx, {
      memberId: member.id,
      barberId: created.id,
      userId: member.userId,
      email: member.user.email,
    });

    return {
      barber: {
        id: created.id,
        name: created.name,
        active: created.active,
        avatarUrl: created.avatarUrl,
        email: created.email,
        userId: created.userId,
        serviceIds: created.serviceIds,
      },
      memberId: member.id,
      role: member.role,
      teamStatus: member.teamStatus,
    };
  });
}

export async function findInviteCreationConflict(
  params: {
    shopId: string;
    email: string;
    bookable: boolean;
    /** When linking an orphan seat, skip BOOKING_PROFILE_ALREADY_EXISTS for this id. */
    excludeBarberId?: string | null;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<TeamCreationDomainError | null> {
  const existingMember = await db.shopMember.findFirst({
    where: { shopId: params.shopId, user: { email: params.email } },
    select: { id: true },
  });
  if (existingMember) {
    return {
      ok: false,
      status: 409,
      code: 'MEMBER_ALREADY_EXISTS',
      error: 'This email already belongs to a member of this shop.',
    };
  }

  const openInvite = await db.shopInvite.findFirst({
    where: {
      shopId: params.shopId,
      email: params.email,
      acceptedAt: null,
    },
    select: { id: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  });
  if (openInvite) {
    if (openInvite.expiresAt.getTime() > Date.now()) {
      return {
        ok: false,
        status: 409,
        code: 'INVITATION_ALREADY_PENDING',
        error: 'An invitation is already pending for this email.',
        inviteId: openInvite.id,
      };
    }
    return {
      ok: false,
      status: 409,
      code: 'EXPIRED_INVITATION_EXISTS',
      error: 'An expired invitation already exists for this email.',
      inviteId: openInvite.id,
    };
  }

  if (params.bookable) {
    const existingBarber = await db.barber.findFirst({
      where: {
        shopId: params.shopId,
        email: params.email,
        ...(params.excludeBarberId ? { id: { not: params.excludeBarberId } } : {}),
      },
      select: { id: true },
    });
    if (existingBarber) {
      return {
        ok: false,
        status: 409,
        code: 'BOOKING_PROFILE_ALREADY_EXISTS',
        error: 'A booking profile already exists for this email.',
        barberId: existingBarber.id,
      };
    }
  }

  return null;
}

export type CreatedTeamInvite = {
  id: string;
  email: string;
  role: ShopRole;
  barberId: string | null;
  displayName: string | null;
  bookable: boolean;
  expiresAt: Date;
};

/** Atomic invite (+ optional booking profile) with conflict re-checks. */
export async function createTeamInviteWithOptionalProfile(params: {
  shopId: string;
  email: string;
  role: 'MANAGER' | 'BARBER';
  displayName: string;
  bookable: boolean;
  tokenHash: string;
  invitedByUserId: string | null;
  serviceIds?: string[];
  hours?: ValidatedWorkingHourRow[];
  avatarUrl?: string | null;
  /** Link invite to an existing orphan Barber seat (no new Barber created). */
  existingBarberId?: string | null;
}): Promise<{ invite: CreatedTeamInvite; barberId: string | null }> {
  return runSerializableTransaction(async (tx) => {
    const conflict = await findInviteCreationConflict(
      {
        shopId: params.shopId,
        email: params.email,
        bookable: params.bookable,
        excludeBarberId: params.existingBarberId ?? null,
      },
      tx,
    );
    if (conflict) {
      throw conflict;
    }

    let barberId: string | null = null;

    if (params.existingBarberId) {
      const barber = await tx.barber.findFirst({
        where: { id: params.existingBarberId, shopId: params.shopId },
        select: { id: true, userId: true, active: true, name: true },
      });
      if (!barber) {
        throw {
          ok: false as const,
          status: 404 as const,
          code: 'BOOKING_PROFILE_NOT_FOUND',
          error: 'The booking profile could not be found.',
        } satisfies TeamCreationDomainError;
      }
      if (barber.userId) {
        throw {
          ok: false as const,
          status: 409 as const,
          code: 'BOOKING_PROFILE_ALREADY_LINKED',
          error: 'This booking profile is already linked to a dashboard account.',
          barberId: barber.id,
        } satisfies TeamCreationDomainError;
      }

      const linkedMember = await tx.shopMember.findFirst({
        where: { shopId: params.shopId, barberId: barber.id },
        select: { id: true },
      });
      if (linkedMember) {
        throw {
          ok: false as const,
          status: 409 as const,
          code: 'BOOKING_PROFILE_ALREADY_LINKED',
          error: 'This booking profile is already linked to a team member.',
          barberId: barber.id,
        } satisfies TeamCreationDomainError;
      }

      const openSeatInvite = await tx.shopInvite.findFirst({
        where: { shopId: params.shopId, barberId: barber.id, acceptedAt: null },
        select: { id: true, expiresAt: true },
        orderBy: { createdAt: 'desc' },
      });
      if (openSeatInvite && openSeatInvite.expiresAt.getTime() > Date.now()) {
        throw {
          ok: false as const,
          status: 409 as const,
          code: 'INVITATION_ALREADY_PENDING',
          error: 'An invitation is already pending for this booking profile.',
          inviteId: openSeatInvite.id,
          barberId: barber.id,
        } satisfies TeamCreationDomainError;
      }

      await tx.barber.update({
        where: { id: barber.id },
        data: { email: params.email },
        select: { id: true },
      });
      barberId = barber.id;
    } else if (params.bookable) {
      if (!params.serviceIds?.length || !params.hours?.length) {
        throw new Error('Bookable invite requires services and working hours.');
      }
      const created = await createBarberWithSetup(tx, {
        shopId: params.shopId,
        name: params.displayName,
        email: params.email,
        serviceIds: params.serviceIds,
        hours: params.hours,
        avatarUrl: params.avatarUrl,
      });
      barberId = created.id;
    }

    const invite = await tx.shopInvite.create({
      data: {
        shopId: params.shopId,
        email: params.email,
        role: params.role,
        tokenHash: params.tokenHash,
        barberId,
        displayName: params.displayName,
        bookable: params.bookable,
        invitedByUserId: params.invitedByUserId,
        expiresAt: inviteExpiresAt(),
      },
      select: {
        id: true,
        email: true,
        role: true,
        barberId: true,
        displayName: true,
        bookable: true,
        expiresAt: true,
      },
    });

    return { invite, barberId };
  });
}

export function isTeamCreationDomainError(error: unknown): error is TeamCreationDomainError {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as TeamCreationDomainError;
  return (
    candidate.ok === false &&
    (candidate.status === 403 ||
      candidate.status === 404 ||
      candidate.status === 409 ||
      candidate.status === 422) &&
    typeof candidate.code === 'string' &&
    typeof candidate.error === 'string'
  );
}

/**
 * Log orphan blob cleanup risk when a DB transaction fails after avatar upload.
 * Never logs tokens, acceptPath, passwords, or session data.
 */
export function logOrphanedTeamAvatarRisk(params: {
  route: string;
  avatarUrl: string;
  error: unknown;
}): void {
  const safeError = isTeamCreationDomainError(params.error)
    ? { code: params.error.code, status: params.error.status, error: params.error.error }
    : {
        message: params.error instanceof Error ? params.error.message : 'Unknown error',
      };

  console.error('[team] DB transaction failed after avatar upload; orphan blob may remain', {
    route: params.route,
    avatarUrl: params.avatarUrl,
    error: safeError,
  });
}

/** @deprecated Prefer isTeamCreationDomainError */
export function isInviteConflict(error: unknown): error is InviteConflict {
  return isTeamCreationDomainError(error) && error.status === 409;
}
