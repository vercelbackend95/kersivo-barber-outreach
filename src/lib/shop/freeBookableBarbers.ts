import { Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { loadKersivoAccess, type KersivoProductState } from './kersivoAccess';

/**
 * KERSIVO Free Booking: max active bookable barbers per location.
 * "Bookable" is Barber.active (the canonical Online bookings flag); non-bookable seats do not count.
 */
export const FREE_BOOKABLE_BARBER_LIMIT = 4;
export const FREE_BOOKABLE_BARBER_LIMIT_CODE = 'FREE_BOOKABLE_BARBER_LIMIT';
export const FREE_BOOKABLE_BARBER_LIMIT_MESSAGE =
  'KERSIVO Free includes up to 4 barbers taking online bookings.';

type Db = Prisma.TransactionClient | typeof prisma;

export type FreeBookableBarberLimitError = {
  ok: false;
  status: 409;
  code: typeof FREE_BOOKABLE_BARBER_LIMIT_CODE;
  error: string;
  limit: number;
};

export function freeBookableBarberLimitError(): FreeBookableBarberLimitError {
  return {
    ok: false,
    status: 409,
    code: FREE_BOOKABLE_BARBER_LIMIT_CODE,
    error: FREE_BOOKABLE_BARBER_LIMIT_MESSAGE,
    limit: FREE_BOOKABLE_BARBER_LIMIT,
  };
}

export function isFreeBookableBarberLimitError(
  value: unknown,
): value is FreeBookableBarberLimitError {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { code?: unknown }).code === FREE_BOOKABLE_BARBER_LIMIT_CODE &&
    (value as { ok?: unknown }).ok === false
  );
}

export function freeBookableBarberLimitResponse(): Response {
  const { status, ok: _ok, ...body } = freeBookableBarberLimitError();
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Live Free shops are always limited. SETUP shops are limited only on the onboarding path
 * that leads to Free activation. FULL_KERSIVO is never limited.
 */
export function freeBookableBarberLimitApplies(
  state: KersivoProductState,
  options?: { includeSetup?: boolean },
): boolean {
  if (state === 'FREE_BOOKING') return true;
  return state === 'SETUP' && options?.includeSetup === true;
}

export function exceedsFreeBookableBarberLimit(activeBookableCount: number): boolean {
  return activeBookableCount > FREE_BOOKABLE_BARBER_LIMIT;
}

export function isFreeActivationBarberCountEligible(activeBookableCount: number): boolean {
  return !exceedsFreeBookableBarberLimit(activeBookableCount);
}

export async function countActiveBookableBarbers(
  shopId: string,
  db: Db = prisma,
  options?: { excludeBarberId?: string | null },
): Promise<number> {
  return db.barber.count({
    where: {
      shopId,
      active: true,
      ...(options?.excludeBarberId ? { id: { not: options.excludeBarberId } } : {}),
    },
  });
}

/** Row lock on ShopSettings so concurrent bookable-barber changes for one shop serialize. */
export async function lockShopForBookableBarberChange(
  tx: Prisma.TransactionClient,
  shopId: string,
): Promise<void> {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "ShopSettings" WHERE id = ${shopId} FOR UPDATE`);
}

/**
 * Whether making one barber bookable (creating an active barber, or activating `barberId`)
 * would push a limited shop past the Free limit. Call inside the mutating transaction after
 * taking a shop row lock. Returns null when allowed.
 */
export async function checkFreeBookableBarberActivation(
  db: Db,
  params: { shopId: string; barberId?: string | null; includeSetup?: boolean },
): Promise<FreeBookableBarberLimitError | null> {
  const others = await countActiveBookableBarbers(params.shopId, db, {
    excludeBarberId: params.barberId,
  });
  return checkFreeBookableBarberTotal({
    shopId: params.shopId,
    resultingActiveCount: others + 1,
    includeSetup: params.includeSetup,
    db,
  });
}

/**
 * Whether a mutation that leaves `resultingActiveCount` bookable barbers is allowed.
 * Without `db` this is only a fast pre-check; the authoritative check must run with the
 * transaction client after the shop row lock is held.
 */
export async function checkFreeBookableBarberTotal(params: {
  shopId: string;
  resultingActiveCount: number;
  includeSetup?: boolean;
  db?: Db;
}): Promise<FreeBookableBarberLimitError | null> {
  if (!exceedsFreeBookableBarberLimit(params.resultingActiveCount)) return null;
  const { state } = await loadKersivoAccess(params.shopId, undefined, params.db ?? prisma);
  if (!freeBookableBarberLimitApplies(state, { includeSetup: params.includeSetup })) return null;
  return freeBookableBarberLimitError();
}
