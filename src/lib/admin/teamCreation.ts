import type { Prisma, ShopRole } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { runSerializableTransaction } from '@/lib/db/serializableTransaction';
import { inviteExpiresAt } from '@/lib/admin/rbac/members';

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

export type InviteConflict = {
  ok: false;
  status: 409;
  code: string;
  error: string;
  inviteId?: string;
  barberId?: string;
};

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
      !isIntInRange(dayOfWeek, 0, 6) ||
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
    serviceIds: string[];
    hours: ValidatedWorkingHourRow[];
    avatarUrl?: string | null;
  },
) {
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
    data: params.serviceIds.map((serviceId) => ({ barberId: created.id, serviceId })),
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

  return created;
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

export async function findInviteCreationConflict(
  params: {
    shopId: string;
    email: string;
    bookable: boolean;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<InviteConflict | null> {
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
      where: { shopId: params.shopId, email: params.email },
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
}): Promise<{ invite: CreatedTeamInvite; barberId: string | null }> {
  return runSerializableTransaction(async (tx) => {
    const conflict = await findInviteCreationConflict(
      { shopId: params.shopId, email: params.email, bookable: params.bookable },
      tx,
    );
    if (conflict) {
      throw conflict;
    }

    let barberId: string | null = null;
    if (params.bookable) {
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

export function isInviteConflict(error: unknown): error is InviteConflict {
  return (
    typeof error === 'object' &&
    error !== null &&
    'ok' in error &&
    (error as InviteConflict).ok === false &&
    'status' in error &&
    (error as InviteConflict).status === 409 &&
    'code' in error
  );
}
